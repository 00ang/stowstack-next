import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isMissedCall, textBackMissedCall } from "@/lib/respond/missed-call";
import { enqueue } from "@/lib/jobs/queue";
import { callTouch, phoneHash } from "@/lib/attribution/touch";
import { recordTouch } from "@/lib/attribution/visitor";

const { VoiceResponse } = twilio.twiml;

function twimlResponse(twiml: InstanceType<typeof VoiceResponse>): NextResponse {
  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function parseFormParams(text: string): Record<string, string> {
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function verifyTwilioSignature(req: NextRequest, rawBody: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    // No token configured — in dev, allow through. In prod, require it.
    return process.env.VERCEL_ENV !== "production";
  }
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;
  // Twilio signs <url> + sorted(body params concatenated as key+value)
  const url = new URL(req.url);
  const fullUrl = `${process.env.NEXT_PUBLIC_SITE_URL || `https://${url.host}`}${url.pathname}${url.search}`;
  const params = parseFormParams(rawBody);
  return twilio.validateRequest(authToken, signature, fullUrl, params);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.WEBHOOK, "wh-call-webhook");
  if (limited) return limited;
  const rawBody = await req.text();
  if (!verifyTwilioSignature(req, rawBody)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const url = new URL(req.url);
  const event = url.searchParams.get("event");
  const body = parseFormParams(rawBody);

  // Status callback: update call duration and final status
  if (event === "status") {
    const { CallSid, CallDuration, CallStatus } = body;
    if (CallSid) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE call_logs SET status = ${CallStatus || "completed"}, duration = ${parseInt(CallDuration) || 0}, ended_at = NOW()
          WHERE twilio_call_sid = ${CallSid}
        `;
        await tx.$executeRaw`
          UPDATE call_tracking_numbers SET
            call_count = (SELECT COUNT(*) FROM call_logs WHERE tracking_number_id = call_tracking_numbers.id AND status = 'completed'),
            total_duration = (SELECT COALESCE(SUM(duration), 0) FROM call_logs WHERE tracking_number_id = call_tracking_numbers.id AND status = 'completed')
          WHERE id = (SELECT tracking_number_id FROM call_logs WHERE twilio_call_sid = ${CallSid})
        `;
      });
    }
    // RESPOND r3 — text back a missed call, inline and immediately.
    //
    // Deliberately NOT queued: the worker runs once a minute, and a text that
    // arrives a minute later reaches somebody who has already called a
    // competitor. The queue is the fallback when this fails, not the path.
    //
    // Wrapped so a messaging failure can never break call tracking or make us
    // return non-2xx to Twilio, which would have it retry the whole callback.
    if (CallSid && isMissedCall({ status: CallStatus ?? null, duration: parseInt(CallDuration) || 0 })) {
      try {
        const res = await textBackMissedCall(CallSid);
        if (!res.sent && res.reason !== "cooldown" && res.reason !== "already-handled") {
          // Worth one durable retry — but never for a reason that will not change.
          await enqueue({
            queue: "respond.missed-call",
            dedupeKey: `missed:${CallSid}`,
            payload: { callSid: CallSid },
            maxAttempts: 3,
          });
        }
      } catch (err) {
        console.error("[call-webhook] missed-call text-back failed:", err);
        await enqueue({
          queue: "respond.missed-call",
          dedupeKey: `missed:${CallSid}`,
          payload: { callSid: CallSid },
          maxAttempts: 3,
        }).catch(() => {});
      }
    }

    return new NextResponse(null, { status: 200 });
  }

  // Initial voice webhook: forward the call
  const { CallSid, To, From, FromCity, FromState } = body;

  if (!To) {
    const twiml = new VoiceResponse();
    twiml.say("Sorry, this number is not configured.");
    return twimlResponse(twiml);
  }

  const trackingNum = await db.call_tracking_numbers.findFirst({
    where: { phone_number: To, status: "active" },
    select: { id: true, facility_id: true, forward_to: true, utm_link_id: true, landing_page_id: true },
  });

  if (!trackingNum) {
    const twiml = new VoiceResponse();
    twiml.say("Sorry, this number is no longer in service.");
    return twimlResponse(twiml);
  }

  // Derive campaign attribution from tracking number → UTM link
  let campaignSource: string | null = null;
  let utmLink: {
    utm_source: string; utm_medium: string; utm_campaign: string | null;
    utm_content: string | null; utm_term: string | null;
  } | null = null;
  if (trackingNum.utm_link_id) {
    try {
      utmLink = await db.utm_links.findUnique({
        where: { id: trackingNum.utm_link_id },
        select: { utm_source: true, utm_medium: true, utm_campaign: true, utm_content: true, utm_term: true },
      });
      campaignSource = utmLink?.utm_campaign || null;
    } catch { /* non-critical */ }
  }

  // Log the call with campaign attribution (fire-and-forget)
  db.$executeRaw`
    INSERT INTO call_logs (tracking_number_id, facility_id, twilio_call_sid, caller_number, caller_city, caller_state, campaign_source, status, started_at, updated_at)
    VALUES (${trackingNum.id}::uuid, ${trackingNum.facility_id}::uuid, ${CallSid}, ${From || null}, ${FromCity || null}, ${FromState || null}, ${campaignSource}, 'ringing', NOW(), NOW())
    ON CONFLICT (twilio_call_sid) DO NOTHING
  `.catch((err) => console.error("[call_log] Fire-and-forget failed:", err));

  // MISSION.md s12 — the call is a touch too. Keyed by CallSid, so a redelivered
  // webhook records it once; joined to a lead later by the caller's phone hash.
  recordTouch({
    ...callTouch(utmLink),
    facility_id: trackingNum.facility_id,
    landing_page_id: trackingNum.landing_page_id,
    source_ref: CallSid || null,
    phone_hash: phoneHash(From),
  }).catch((err) => console.error("[call_touch] Fire-and-forget failed:", err));

  // Generate TwiML to forward the call with recording
  const twiml = new VoiceResponse();
  twiml.dial({ callerId: To, record: "record-from-answer" }, trackingNum.forward_to);

  return twimlResponse(twiml);
}
