import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SEQUENCES } from "@/lib/drip-sequences";
import { verifyCronSecret } from "@/lib/cron-auth";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { SENDERS, sendEmail, sendEmailOrThrow } from "@/lib/email";
import { sendCronFailureAlert } from "@/lib/cron-runner";

export const maxDuration = 60;

const RECOVERY_SEQUENCE = SEQUENCES.recovery;

function logActivity(params: {
  type: string;
  facilityId: string | null;
  leadName: string;
  facilityName: string;
  detail: string;
  meta: Record<string, unknown>;
}) {
  db.$executeRaw`
    INSERT INTO activity_log (type, facility_id, lead_name, facility_name, detail, meta)
    VALUES (${params.type}, ${params.facilityId}::uuid, ${params.leadName}, ${params.facilityName}, ${params.detail.slice(0, 500)}, ${JSON.stringify(params.meta)}::jsonb)
  `.catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
}

function esc(str: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRecoverySubject(
  templateId: string,
  lead: { facilityName?: string }
): string {
  switch (templateId) {
    case "recovery_1hr":
      return `Still looking for storage${lead.facilityName ? ` near ${lead.facilityName}` : ""}?`;
    case "recovery_24hr":
      return `Don't miss out, units are filling up${lead.facilityName ? ` at ${lead.facilityName}` : ""}`;
    case "recovery_72hr":
      return `A little something to help you decide${lead.facilityName ? `, ${lead.facilityName}` : ""}`;
    default:
      return "Your storage unit is still available";
  }
}

function getRecoveryBody(
  templateId: string,
  lead: { name?: string; returnUrl?: string; unitSize?: string }
): string {
  const firstName = lead.name
    ? esc(lead.name.trim().split(" ")[0])
    : "there";
  const returnUrl = esc(lead.returnUrl || "https://storageads.com");

  switch (templateId) {
    case "recovery_1hr":
      return `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
  <p>Hey ${firstName},</p>
  <p>${lead.unitSize ? `It looks like you were checking out <strong>${esc(lead.unitSize)}</strong> units. ` : ""}Good news, units are still available and we are holding your spot.</p>
  <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: center;">
    <p style="margin: 0 0 4px; font-weight: 600; color: #166534; font-size: 18px;">Your unit is still available</p>
    <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Pick up right where you left off. Takes less than 60 seconds.</p>
    <a href="${returnUrl}" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reserve Your Unit</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">Questions? Just reply to this email or call us at <a href="tel:2699298541" style="color: #141413;">269-929-8541</a>.</p>
</div>`;

    case "recovery_24hr":
      return `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
  <p>Hey ${firstName},</p>
  <p>Just a heads up, we have seen a few units get reserved since yesterday, and availability is getting tighter.</p>
  <div style="margin: 24px 0; padding: 16px 20px; background: #FBEFE4; border-left: 4px solid #AB5505; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; font-weight: 600; color: #92400e;">Units are going fast</p>
    <p style="margin: 4px 0 0; font-size: 14px; color: #78350f;">We can not guarantee pricing or availability beyond today. Lock in your rate now.</p>
  </div>
  <div style="margin: 24px 0; text-align: center;">
    <a href="${returnUrl}" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reserve Now, Keep Your Rate</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">Need help deciding? Call us at <a href="tel:2699298541" style="color: #141413;">269-929-8541</a>, we will walk you through options.</p>
</div>`;

    case "recovery_72hr":
      return `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
  <p>Hey ${firstName},</p>
  <p>We know finding the right storage spot takes time. To make the decision a little easier, we have got something for you:</p>
  <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #022c22, #0f172a); border-radius: 16px; text-align: center;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #34d399; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Limited Time Offer</p>
    <p style="margin: 0 0 8px; font-size: 32px; font-weight: 800; color: white;">$1 First Month</p>
    <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8;">Reserve in the next 48 hours to lock this in.</p>
    <a href="${returnUrl}${returnUrl.includes("?") ? "&" : "?"}promo=COMEBACK1" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Claim Your $1 First Month</a>
  </div>
  <p style="font-size: 13px; color: #6b7280;">This offer expires in 48 hours and is limited to new reservations only. Questions? Reply to this email or call <a href="tel:2699298541" style="color: #141413;">269-929-8541</a>.</p>
</div>`;

    default:
      return "";
  }
}

async function sendRecoveryEmail(
  partialLead: Record<string, unknown>,
  step: { templateId: string }
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { preview: true };
  }

  let returnUrl = "https://storageads.com";
  if (partialLead.page_slug) {
    returnUrl = `https://storageads.com/p/${partialLead.page_slug}`;
  }

  const params = new URLSearchParams({
    utm_source: "recovery_drip",
    utm_medium: "email",
    utm_campaign: step.templateId,
    recovery_id: String(partialLead.id),
  });
  if (partialLead.name)
    params.set("prefill_name", String(partialLead.name));
  if (partialLead.email)
    params.set("prefill_email", String(partialLead.email));
  if (partialLead.phone)
    params.set("prefill_phone", String(partialLead.phone));

  returnUrl += `?${params.toString()}`;

  const lead = {
    name: (partialLead.name as string) || "",
    email: partialLead.email as string,
    facilityName: (partialLead.page_title as string) || "",
    unitSize: (partialLead.unit_size as string) || "",
    returnUrl,
  };

  const subject = getRecoverySubject(step.templateId, lead);
  const html = getRecoveryBody(step.templateId, lead);

  // sendEmailOrThrow preserves this function's original throw-on-failure
  // contract so the caller's retry/failure accounting is unchanged.
  return sendEmailOrThrow({
    from: SENDERS.blake,
    to: partialLead.email as string,
    replyTo: ["blake@storageads.com"],
    subject,
    html,
    tags: [{ name: "type", value: "recovery_drip" }],
  });
}

async function sendHotLeadAlert(partialLead: Record<string, unknown>) {
  const html = `<div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="padding: 16px 20px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
    <p style="margin: 0; font-weight: 600; color: #991b1b;">Hot Abandoned Lead (Score: ${partialLead.lead_score})</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    ${partialLead.name ? `<tr><td style="padding: 6px 12px; color: #666;">Name</td><td style="padding: 6px 12px;">${esc(String(partialLead.name))}</td></tr>` : ""}
    <tr><td style="padding: 6px 12px; color: #666;">Email</td><td style="padding: 6px 12px;"><a href="mailto:${esc(String(partialLead.email))}">${esc(String(partialLead.email))}</a></td></tr>
    ${partialLead.phone ? `<tr><td style="padding: 6px 12px; color: #666;">Phone</td><td style="padding: 6px 12px;">${esc(String(partialLead.phone))}</td></tr>` : ""}
    ${partialLead.unit_size ? `<tr><td style="padding: 6px 12px; color: #666;">Unit Size</td><td style="padding: 6px 12px;">${esc(String(partialLead.unit_size))}</td></tr>` : ""}
    ${partialLead.page_title ? `<tr><td style="padding: 6px 12px; color: #666;">Landing Page</td><td style="padding: 6px 12px;">${esc(String(partialLead.page_title))}</td></tr>` : ""}
    <tr><td style="padding: 6px 12px; color: #666;">Fields Completed</td><td style="padding: 6px 12px;">${partialLead.fields_completed}/${partialLead.total_fields}</td></tr>
    <tr><td style="padding: 6px 12px; color: #666;">Time on Page</td><td style="padding: 6px 12px;">${Math.round(Number(partialLead.time_on_page) / 60)}m ${Number(partialLead.time_on_page) % 60}s</td></tr>
    <tr><td style="padding: 6px 12px; color: #666;">Scroll Depth</td><td style="padding: 6px 12px;">${partialLead.scroll_depth}%</td></tr>
    ${partialLead.utm_source ? `<tr><td style="padding: 6px 12px; color: #666;">Source</td><td style="padding: 6px 12px;">${esc(String(partialLead.utm_source))} / ${esc(String(partialLead.utm_medium || ""))}</td></tr>` : ""}
  </table>
  <p style="margin-top: 16px; font-size: 12px; color: #999;">Recovery sequence has been started automatically. This lead scored ${partialLead.lead_score}/100. Consider a personal follow-up call.</p>
</div>`;

  void sendEmail({
    from: SENDERS.notifications,
    to: [process.env.ADMIN_EMAIL || "blake@storageads.com"],
    subject: `Hot abandoned lead: ${partialLead.email} (Score: ${partialLead.lead_score})`,
    html,
    tags: [{ name: "type", value: "hot_lead_alert" }],
  });
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.WEBHOOK, "cron-process-recovery");
  if (limited) return limited;
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const MAX_EXECUTION_TIME_MS = 45_000; // 45s (leave 15s buffer for 60s limit)
  const startTime = Date.now();

  const now = new Date();
  const results = {
    processed: 0,
    sent: 0,
    exhausted: 0,
    alerts: 0,
    errors: [] as { id?: string; email?: string; error: string }[],
    timedOut: false,
  };

  try {
    const dueLeads = await db.$queryRaw<Record<string, unknown>[]>`
      SELECT pl.*, lp.title AS page_title, lp.slug AS page_slug
      FROM partial_leads pl
      LEFT JOIN landing_pages lp ON pl.landing_page_id = lp.id
      WHERE pl.recovery_status IN ('pending', 'active')
        AND pl.email IS NOT NULL
        AND pl.converted = FALSE
        AND pl.next_recovery_at <= NOW()
      ORDER BY pl.lead_score DESC
      LIMIT 50
    `;

    for (const lead of dueLeads) {
      if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
        console.warn(`[CRON:process-recovery] Time limit reached. Processed: ${results.processed}, Sent: ${results.sent}. Remaining will be picked up next run.`);
        results.timedOut = true;
        break;
      }
      try {
        results.processed++;

        const fullLead = await db.$queryRaw<{ id: string }[]>`
          SELECT id FROM facilities WHERE contact_email = ${lead.email} AND created_at > ${lead.created_at}::timestamptz
        `;

        if (fullLead.length) {
          await db.$executeRaw`
            UPDATE partial_leads SET converted = TRUE, converted_at = NOW(), recovery_status = 'converted' WHERE id = ${lead.id}::uuid
          `;
          continue;
        }

        const stepIdx = (lead.recovery_sent_count as number) || 0;
        const steps = RECOVERY_SEQUENCE.steps;

        if (stepIdx >= steps.length) {
          await db.$executeRaw`
            UPDATE partial_leads SET recovery_status = 'exhausted', updated_at = NOW() WHERE id = ${lead.id}::uuid
          `;
          results.exhausted++;
          continue;
        }

        const step = steps[stepIdx];

        try {
          await sendRecoveryEmail(lead, step);

          const nextStepIdx = stepIdx + 1;
          let nextRecoveryAt: string | null = null;
          if (nextStepIdx < steps.length) {
            const nextStep = steps[nextStepIdx];
            nextRecoveryAt = new Date(
              now.getTime() +
                (nextStep.delayHours || 0) * 60 * 60 * 1000
            ).toISOString();
          }

          await db.$executeRaw`
            UPDATE partial_leads SET
              recovery_sent_count = ${nextStepIdx},
              recovery_status = CASE WHEN ${nextRecoveryAt}::timestamptz IS NULL THEN 'exhausted' ELSE 'active' END,
              next_recovery_at = ${nextRecoveryAt}::timestamptz,
              updated_at = NOW()
            WHERE id = ${lead.id}::uuid
          `;

          logActivity({
            type: "recovery_sent",
            facilityId: (lead.facility_id as string) || null,
            leadName: (lead.name as string) || (lead.email as string),
            facilityName: (lead.page_title as string) || "",
            detail: `Recovery email sent: "${step.label}" to ${lead.email}`,
            meta: {
              partialLeadId: lead.id,
              step: stepIdx,
              templateId: step.templateId,
            },
          });

          results.sent++;

          if (!nextRecoveryAt) results.exhausted++;
        } catch (emailErr: unknown) {
          const message =
            emailErr instanceof Error
              ? emailErr.message
              : "Unknown error";
          results.errors.push({
            id: lead.id as string,
            email: lead.email as string,
            error: message,
          });
        }
      } catch (leadErr: unknown) {
        const message =
          leadErr instanceof Error ? leadErr.message : "Unknown error";
        results.errors.push({
          id: lead.id as string,
          error: message,
        });
      }
    }

    // Send hot lead alerts (skip if timed out)
    if (!results.timedOut) {
      const hotLeads = await db.$queryRaw<Record<string, unknown>[]>`
        SELECT pl.*, lp.title AS page_title, lp.slug AS page_slug
        FROM partial_leads pl
        LEFT JOIN landing_pages lp ON pl.landing_page_id = lp.id
        WHERE pl.lead_score >= 60
          AND pl.email IS NOT NULL
          AND pl.converted = FALSE
          AND pl.recovery_sent_count = 0
          AND pl.recovery_status = 'pending'
          AND pl.created_at >= NOW() - INTERVAL '1 hour'
        LIMIT 20
      `;

      for (const hotLead of hotLeads) {
        try {
          await sendHotLeadAlert(hotLead);
          results.alerts++;
        } catch {
          // Alert failed — continue
        }
      }
    }

    console.log(`[CRON:process-recovery] Complete. Processed: ${results.processed}, Sent: ${results.sent}, Exhausted: ${results.exhausted}, Alerts: ${results.alerts}, Errors: ${results.errors.length}`);
    if (results.errors.length > 0) {
      console.error(`[CRON:process-recovery] Failures:`, JSON.stringify(results.errors));
    }

    // Log cron completion
    db.activity_log.create({
      data: {
        type: "cron_completed",
        detail: `[process-recovery] Processed: ${results.processed}, Sent: ${results.sent}, Exhausted: ${results.exhausted}, Alerts: ${results.alerts}, Errors: ${results.errors.length}`,
        meta: JSON.parse(JSON.stringify(results)),
      },
    }).catch((err) => console.error("[activity_log] Cron log failed:", err));

    return NextResponse.json({ success: true, ...results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[CRON:process-recovery] Fatal error:`, err);

    // Notify admin of cron failure (centralized; fire-and-forget).
    sendCronFailureAlert("process-recovery", message);

    return NextResponse.json({ error: "Cron processing failed", message }, { status: 500 });
  }
}
