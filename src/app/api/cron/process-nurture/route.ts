import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import {
  SENDERS,
  facilitySender,
  sendEmail as sendCentralEmail,
  sendEmailOrThrow,
} from "@/lib/email";
import { messagingLive } from "@/lib/messaging";

export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:5173");

function resolveMergeTags(
  template: string | null,
  data: Record<string, string | null | undefined>
): string {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null
      ? String(data[key])
      : match;
  });
}

async function advanceStep(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  enrollmentId: string,
  steps: { delay_minutes?: number }[],
  currentStepIdx: number
) {
  const nextIdx = currentStepIdx + 1;
  if (nextIdx >= steps.length) {
    await tx.$executeRaw`
      UPDATE nurture_enrollments SET status = 'completed', completed_at = NOW(),
      current_step = ${nextIdx}, next_send_at = NULL WHERE id = ${enrollmentId}::uuid
    `;
  } else {
    const nextStep = steps[nextIdx];
    const delayMs = (nextStep.delay_minutes || 60) * 60 * 1000;
    const nextSendAt = new Date(Date.now() + delayMs).toISOString();
    await tx.$executeRaw`
      UPDATE nurture_enrollments SET current_step = ${nextIdx},
      next_send_at = ${nextSendAt}::timestamptz WHERE id = ${enrollmentId}::uuid
    `;
  }
}

async function logMessage(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  enrollmentId: string,
  stepNumber: number,
  channel: string,
  toAddress: string,
  subject: string | null,
  body: string,
  status: string,
  externalId: string | null,
  errorMessage: string | null
) {
  await tx.$executeRaw`
    INSERT INTO nurture_messages (enrollment_id, step_number, channel, to_address, subject, body, status, external_id, sent_at, error_message)
    VALUES (${enrollmentId}::uuid, ${stepNumber}, ${channel}, ${toAddress}, ${subject}, ${body}, ${status}, ${externalId}, ${status === "sent" ? new Date().toISOString() : null}::timestamptz, ${errorMessage})
  `;
}

/** Reserved, held or moved in: the follow-up has done its job. */
async function leadIsDone(leadId: string): Promise<boolean> {
  const lead = await db.partial_leads.findUnique({
    where: { id: leadId },
    select: { lead_status: true, matched_tenant_id: true },
  });
  if (!lead) return false;
  return !!lead.matched_tenant_id || ["reserved", "hold", "held", "moved_in"].includes((lead.lead_status ?? "").toLowerCase());
}

async function sendSMS(to: string, body: string, facilityId: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio not configured");

  let fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!fromNumber && facilityId) {
    const rows = await db.$queryRaw<{ phone_number: string }[]>`
      SELECT phone_number FROM call_tracking_numbers WHERE facility_id = ${facilityId}::uuid AND status = 'active' LIMIT 1
    `;
    if (rows[0]) fromNumber = rows[0].phone_number;
  }
  if (!fromNumber) throw new Error("No SMS from number configured");

  const bodyWithOptOut = body.includes("STOP")
    ? body
    : `${body}\n\nReply STOP to opt out`;

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: bodyWithOptOut,
      }),
    }
  );
  const result = await twilioRes.json();
  if (result.error_code)
    throw new Error(`Twilio: ${result.message}`);
  return result;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  facilityName: string | null
) {
  // sendEmailOrThrow preserves this wrapper's original throw-on-failure
  // contract, so a failed/skipped send still surfaces as a step failure and
  // the enrollment does not advance past an undelivered message.
  return sendEmailOrThrow({
    from: facilitySender(facilityName, "notifications"),
    to: [to],
    subject,
    text: body,
    tags: [{ name: "type", value: "nurture" }],
  });
}

interface EnrollmentRow {
  id: string;
  sequence_id: string;
  facility_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  current_step: number;
  lead_id: string | null;
  metadata: unknown;
  seq_steps: unknown;
  seq_name: string;
  trigger_type: string;
}

interface NurtureStep {
  channel: string;
  body: string;
  subject?: string;
  send_window?: { start?: string; end?: string };
  delay_minutes?: number;
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.WEBHOOK, "cron-process-nurture");
  if (limited) return limited;
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MAX_EXECUTION_TIME_MS = 45_000; // 45s (leave 15s buffer for 60s limit)
  const startTime = Date.now();

  try {
    const dueEnrollments = await db.$queryRaw<EnrollmentRow[]>`
      SELECT ne.*, ns.steps as seq_steps, ns.name as seq_name, ns.trigger_type
      FROM nurture_enrollments ne
      JOIN nurture_sequences ns ON ns.id = ne.sequence_id
      WHERE ne.status = 'active'
        AND ne.next_send_at <= NOW()
        AND ns.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM facilities f
          WHERE f.id = ne.facility_id AND f.sort_last = true
        )
      ORDER BY ne.next_send_at ASC
      LIMIT 50
    `;

    let sent = 0,
      failed = 0,
      completed = 0,
      skipped = 0,
      timedOut = false;

    for (const enrollment of dueEnrollments) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn(`[CRON:process-nurture] Time limit reached. Sent: ${sent}. Remaining will be picked up next run.`);
        timedOut = true;
        break;
      }
      try {
        const steps: NurtureStep[] =
          typeof enrollment.seq_steps === "string"
            ? JSON.parse(enrollment.seq_steps)
            : (enrollment.seq_steps as NurtureStep[]);
        const currentStepIdx = enrollment.current_step;
        const step = steps[currentStepIdx];

        if (!step) {
          await db.$executeRaw`
            UPDATE nurture_enrollments SET status = 'completed', completed_at = NOW(), next_send_at = NULL WHERE id = ${enrollment.id}::uuid
          `;
          completed++;
          continue;
        }

        // A lead who has reserved or moved in is done being followed up.
        if (enrollment.lead_id && (await leadIsDone(enrollment.lead_id))) {
          await db.$executeRaw`
            UPDATE nurture_enrollments SET status = 'exited', exit_reason = 'reserved_or_moved_in',
            completed_at = NOW(), next_send_at = NULL WHERE id = ${enrollment.id}::uuid
          `;
          completed++;
          continue;
        }

        // A text can't reach anyone until texting is live (A2P registration).
        // Skip the step rather than retry it every run, so the emails after it
        // still go out.
        if (step.channel === "sms" && !messagingLive()) {
          await db.$transaction(async (tx) => {
            await logMessage(tx, enrollment.id, currentStepIdx, "sms", enrollment.contact_phone || "unknown", null, step.body, "skipped", null, "Texting is not live yet");
            await advanceStep(tx, enrollment.id, steps, currentStepIdx);
          });
          skipped++;
          continue;
        }

        if (step.channel === "sms" && step.send_window) {
          const now = new Date();
          const hour = now.getHours();
          const startHour = parseInt(
            step.send_window.start?.split(":")[0] || "9"
          );
          const endHour = parseInt(
            step.send_window.end?.split(":")[0] || "21"
          );
          if (hour < startHour || hour >= endHour) {
            skipped++;
            continue;
          }
        }

        const facilityRows = await db.$queryRaw<Record<string, unknown>[]>`
          SELECT * FROM facilities WHERE id = ${enrollment.facility_id}::uuid
        `;
        const facility = facilityRows[0];
        const metadata: Record<string, string> =
          typeof enrollment.metadata === "string"
            ? JSON.parse(enrollment.metadata)
            : ((enrollment.metadata as Record<string, string>) || {});

        const mergeData: Record<string, string | null | undefined> = {
          ...metadata,
          first_name:
            enrollment.contact_name?.split(" ")[0] || "there",
          contact_name: enrollment.contact_name || "",
          facility_name: (facility?.name as string) || "",
          facility_location: (facility?.location as string) || "",
          facility_phone:
            (facility?.google_phone as string) ||
            (facility?.contact_phone as string) ||
            "",
          reserve_link:
            metadata.reserve_link || `${SITE_URL}/reserve`,
          review_link:
            metadata.review_link ||
            (facility?.google_maps_url as string) ||
            "",
          feedback_link:
            metadata.feedback_link || `${SITE_URL}/feedback`,
        };

        const resolvedBody = resolveMergeTags(step.body, mergeData);
        const resolvedSubject = step.subject
          ? resolveMergeTags(step.subject, {
              ...metadata,
              first_name:
                enrollment.contact_name?.split(" ")[0] || "there",
              facility_name: (facility?.name as string) || "",
              unit_size: metadata.unit_size || "storage",
            })
          : null;

        const toAddress =
          step.channel === "sms"
            ? enrollment.contact_phone
            : enrollment.contact_email;

        if (!toAddress) {
          await db.$transaction(async (tx) => {
            await logMessage(
              tx,
              enrollment.id,
              currentStepIdx,
              step.channel,
              "unknown",
              resolvedSubject,
              resolvedBody,
              "failed",
              null,
              "No contact info for this channel"
            );
            await advanceStep(tx, enrollment.id, steps, currentStepIdx);
          });
          failed++;
          continue;
        }

        let externalId: string | null = null;
        if (step.channel === "sms") {
          const smsResult = await sendSMS(
            toAddress,
            resolvedBody,
            enrollment.facility_id
          );
          externalId = smsResult.messageSid;
        } else {
          const emailResult = await sendEmail(
            toAddress,
            resolvedSubject ||
              `Message from ${(facility?.name as string) || "StorageAds"}`,
            resolvedBody,
            (facility?.name as string) || null
          );
          externalId = emailResult?.id || null;
        }

        await db.$transaction(async (tx) => {
          await logMessage(
            tx,
            enrollment.id,
            currentStepIdx,
            step.channel,
            toAddress,
            resolvedSubject,
            resolvedBody,
            "sent",
            externalId,
            null
          );
          await advanceStep(tx, enrollment.id, steps, currentStepIdx);
        });
        sent++;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        logMessage(
          db as Parameters<Parameters<typeof db.$transaction>[0]>[0],
          enrollment.id,
          enrollment.current_step,
          "unknown",
          "",
          null,
          "",
          "failed",
          null,
          message
        ).catch((err) => console.error("[nurture_log] Fire-and-forget failed:", err));
        failed++;
      }
    }

    console.log(`[CRON:process-nurture] Complete. Processed: ${dueEnrollments.length}, Sent: ${sent}, Failed: ${failed}, Completed: ${completed}, Skipped: ${skipped}`);

    // Log cron completion
    db.activity_log.create({
      data: {
        type: "cron_completed",
        detail: `[process-nurture] Processed: ${dueEnrollments.length}, Sent: ${sent}, Failed: ${failed}, Completed: ${completed}, Skipped: ${skipped}`,
        meta: { processed: dueEnrollments.length, sent, failed, completed, skipped, timedOut },
      },
    }).catch((err) => console.error("[activity_log] Cron log failed:", err));

    return NextResponse.json({
      processed: dueEnrollments.length,
      sent,
      failed,
      completed,
      skipped,
      timedOut,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[CRON:process-nurture] Fatal error:`, err);

    // Notify admin of cron failure (fire-and-forget; sendEmail never throws).
    void sendCentralEmail({
      from: SENDERS.noreply,
      to: process.env.ADMIN_EMAIL || "blake@storageads.com",
      subject: `[CRON FAILURE] process-nurture`,
      tags: [{ name: "type", value: "cron_failure" }],
      html: `<p>The <strong>process-nurture</strong> cron job failed:</p><pre>${message}</pre><p>Time: ${new Date().toISOString()}</p>`,
    });

    return NextResponse.json({ error: "Cron processing failed", message }, { status: 500 });
  }
}
