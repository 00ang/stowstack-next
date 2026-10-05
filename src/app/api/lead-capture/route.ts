import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse } from "@/lib/api-helpers";
import { SENDERS, sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidEmail, sanitizeString } from "@/lib/validation";
import { fireMetaCapi } from "@/lib/meta-capi";
import { identifyFromRequest } from "@/lib/attribution/visitor";
import { respondToNewLeadSafely, scheduleSpeedCheck } from "@/lib/respond/speed-to-lead";
import { enqueue } from "@/lib/jobs/queue";

/**
 * When a lead converts on a landing page that belongs to a funnel,
 * auto-enroll them in that funnel's post-conversion drip sequence.
 */
async function enrollInFunnelDrip(
  landingPageId: string,
  facilityId: string | null,
  leadSessionId: string
) {
  // Look up the landing page's funnel
  const lp = await db.landing_pages.findUnique({
    where: { id: landingPageId },
    select: { funnel_id: true, facility_id: true },
  });
  if (!lp?.funnel_id) return; // No funnel — nothing to enroll in

  const fId = facilityId || lp.facility_id;

  // Find the lead record
  const lead = await db.partial_leads.findUnique({
    where: { session_id: leadSessionId },
    select: { id: true },
  });
  if (!lead) return;

  // Tag the lead with the funnel
  await db.partial_leads.update({
    where: { session_id: leadSessionId },
    data: { funnel_id: lp.funnel_id },
  });

  // Find the funnel's post-conversion drip template
  const template = await db.drip_sequence_templates.findFirst({
    where: {
      funnel_id: lp.funnel_id,
      sequence_type: "post_conversion",
    },
    select: { id: true, steps: true },
  });
  if (!template) return;

  const steps = template.steps as Array<{
    delayDays?: number;
    delayHours?: number;
  }>;
  const firstStep = steps[0];
  const delayMs = firstStep
    ? ((firstStep.delayDays || 0) * 86400000 + (firstStep.delayHours || 0) * 3600000)
    : 0;

  // Create a drip sequence for this lead
  await db.drip_sequences.create({
    data: {
      facility_id: fId,
      funnel_id: lp.funnel_id,
      lead_id: lead.id,
      sequence_id: `funnel_${lp.funnel_id}`,
      current_step: 0,
      status: "active",
      next_send_at: new Date(Date.now() + delayMs),
      history: [],
    },
  });
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`lead_capture:${ip}`, 10, 60);
  if (!rl.allowed) {
    return errorResponse("Too many requests", 429, origin);
  }

  try {
    const body = await req.json();
    const {
      phone,
      unitSize,
      timeline,
      facilityId,
      landingPageId,
      sessionId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      referrer,
    } = body;

    const name = sanitizeString(body.name, 200);
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!name || !email || !phone || typeof phone !== "string") {
      return errorResponse("Name, email, and phone are required", 400, origin);
    }

    if (email.length > 254 || phone.length > 30) {
      return errorResponse("Field length exceeded", 400, origin);
    }

    if (!isValidEmail(email)) {
      return errorResponse("Invalid email", 400, origin);
    }

    const sid = sessionId || `lead-${Date.now()}`;
    const lead = await db.partial_leads.upsert({
      where: { session_id: sid },
      create: {
        session_id: sid,
        landing_page_id: landingPageId || null,
        facility_id: facilityId || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        unit_size: unitSize || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        utm_content: utmContent || null,
        referrer: referrer || null,
        fields_completed: 5,
        total_fields: 5,
        recovery_status: "converted",
        // These three were missing, and the update branch below always set them.
        // A first-touch submit (no prior `partial-lead` beacon row) therefore
        // landed as lead_status='partial', converted=false — which is exactly
        // what the abandoned-rescue sweep looks for, so somebody who had just
        // filled the form in full was queued a "you didn't finish" text.
        converted: true,
        converted_at: new Date(),
        lead_status: "new",
        lead_score: 80,
      },
      update: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        unit_size: unitSize || null,
        fields_completed: 5,
        recovery_status: "converted",
        converted: true,
        converted_at: new Date(),
        lead_status: "new",
        lead_score: 80,
        updated_at: new Date(),
      },
    });

    // RESPOND r5 — inline, before the fire-and-forget work below, because the
    // first minute is the whole point and the drip/CAPI calls are not urgent.
    // The check goes first so a request that dies mid-answer is still covered.
    await scheduleSpeedCheck(lead.id, facilityId || null).catch(() => { /* best effort: the six-hourly sweep will find it */ });
    const speed = await respondToNewLeadSafely(lead.id);
    if (!speed.acked && !speed.alerted) {
      await enqueue({
        queue: "respond.speed-to-lead",
        payload: { leadId: lead.id },
        dedupeKey: `speed:${lead.id}`,
        tenantKey: facilityId || undefined,
      }).catch(() => { /* best effort: the sweep will find it */ });
    }
    // MISSION.md s12 — tie this browser's touches to the lead. After speed-to-lead
    // on purpose: the first reply is the urgent part. Never throws.
    await identifyFromRequest(req, lead.id);

    if (facilityId) {
      db.activity_log
        .create({
          data: {
            type: "lead_captured",
            facility_id: facilityId,
            lead_name: name.trim(),
            detail: `Lead from landing page: ${email.trim()}`,
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
    }

    // Auto-enroll in funnel drip sequence if landing page belongs to a funnel
    if (landingPageId) {
      enrollInFunnelDrip(landingPageId, facilityId, sid).catch((err) =>
        console.error("[funnel-drip-enroll] Fire-and-forget failed:", err)
      );
    }

    // Server-side Meta CAPI Lead event — fires only when META_PIXEL_ID and
    // META_ACCESS_TOKEN are configured. Dedupe with browser pixel via event_id.
    fireMetaCapi({
      eventName: "Lead",
      eventId: `lead-${sid}`,
      eventSourceUrl: referrer || undefined,
      userData: {
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        firstName: name.trim().split(" ")[0],
        lastName: name.trim().split(" ").slice(1).join(" ") || null,
        clientIpAddress: ip !== "unknown" ? ip : null,
        clientUserAgent: req.headers.get("user-agent"),
      },
      customData: {
        contentName: utmCampaign || "landing_page_lead",
        contentCategory: "lead",
      },
    }).catch((err) => console.error("[meta-capi] lead fire failed:", err));

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && facilityId) {
      const facility = await db.facilities.findUnique({
        where: { id: facilityId },
        select: { name: true, contact_email: true },
      });
      const facilityName = facility?.name || "Unknown Facility";

      const notificationHtml = `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="margin: 0 0 16px; color: #1a1a1a;">New Lead from Landing Page</h2>
          <p style="color: #666; margin: 0 0 16px;">A visitor filled out the lead capture form on a ${esc(facilityName)} landing page.</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666; width: 120px;">Name</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(name)}</td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Email</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
            <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Phone</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(phone)}</td></tr>
            ${unitSize ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Unit Size</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(unitSize)}</td></tr>` : ""}
            ${timeline ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Timeline</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(timeline)}</td></tr>` : ""}
            ${utmCampaign ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Campaign</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(utmCampaign)}</td></tr>` : ""}
            ${utmSource ? `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Source</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${esc(utmSource)}</td></tr>` : ""}
          </table>
          <p style="margin-top: 16px; font-size: 13px; color: #999;">Submitted: ${new Date().toISOString()}</p>
        </div>`;

      const recipients = (process.env.AUDIT_NOTIFICATION_EMAILS || "blake@storageads.com")
        .split(",")
        .map((e: string) => e.trim());

      if (facility?.contact_email) {
        recipients.push(facility.contact_email);
      }

      void sendEmail({
        from: SENDERS.notifications,
        to: [...new Set(recipients)],
        subject: `New Lead: ${name.trim()} — ${facilityName}`,
        html: notificationHtml,
        tags: [{ name: "type", value: "new_lead" }],
      });
    }

    return jsonResponse({ success: true }, 200, origin);
  } catch {
    return errorResponse("Internal server error", 500, origin);
  }
}
