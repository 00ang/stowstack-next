import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyCronSecret } from "@/lib/cron-auth";
import { SENDERS, sendEmail } from "@/lib/email";

export const maxDuration = 60;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPhotoPromptEmail(facilityName: string): string {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://storageads.com";
  const adminUrl = `${baseUrl}/admin?tab=gbp-posts`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,system-ui,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#faf9f5;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:20px;font-weight:600;letter-spacing:-0.5px;">
      <span style="color:#141413;">storage</span><span style="color:#446386;">ads</span>
    </span>
  </div>
  <div style="background:#ffffff;border:1px solid #e8e6dc;border-radius:8px;padding:28px 24px;">
    <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#141413;">Time for fresh photos</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#6a6560;line-height:1.6;">Google rewards profiles that post new photos regularly. Snap two quick photos of <strong>${esc(facilityName)}</strong> on your phone (a clean drive aisle, a freshly swept unit, the gate, the signage) and upload them so we can push them to your Business Profile.</p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${adminUrl}" style="display:inline-block;background:#141413;color:#faf9f5;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:500;">Upload photos</a>
    </div>
  </div>
  <p style="text-align:center;margin-top:16px;font-size:12px;color:#b0aea5;">StorageAds &middot; Monthly photo refresh</p>
</div>
</body></html>`;
}

async function sendPhotoPrompt(
  facilityName: string,
  contactEmail: string | null
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL || "blake@storageads.com";
  const recipients = [adminEmail];
  if (contactEmail && contactEmail !== adminEmail) recipients.push(contactEmail);

  const result = await sendEmail({
    from: SENDERS.notifications,
    to: recipients,
    subject: `Time to refresh your ${facilityName} photos`,
    html: buildPhotoPromptEmail(facilityName),
    tags: [{ name: "type", value: "photo_refresh" }],
  });
  return result.ok;
}

/**
 * Monthly photo-refresh prompt (Operator OS Phase 1, PRD §3.6 / §4.3).
 * For each facility with a connected GBP, emails the operator a reminder to
 * upload two fresh phone photos and records a photo_refresh_prompts row.
 * Idempotent per (facility, month) via the unique constraint.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const results = { prompts_sent: 0, skipped: 0, facilities: 0 };

  try {
    const facilities = await db.facilities.findMany({
      where: {
        deleted_at: null,
        gbp_connections: { is: { status: "connected" } },
      },
      select: { id: true, name: true, contact_email: true },
    });
    results.facilities = facilities.length;

    for (const f of facilities) {
      const existing = await db.photo_refresh_prompts.findUnique({
        where: {
          facility_id_prompt_month: {
            facility_id: f.id,
            prompt_month: monthStart,
          },
        },
        select: { id: true },
      });
      if (existing) {
        results.skipped++;
        continue;
      }

      const sent = await sendPhotoPrompt(f.name, f.contact_email);
      await db.photo_refresh_prompts.create({
        data: {
          facility_id: f.id,
          prompt_month: monthStart,
          prompt_sent_at: sent ? new Date() : null,
          prompt_channel: "email",
          status: sent ? "sent" : "pending",
        },
      });
      if (sent) results.prompts_sent++;
    }

    db.activity_log
      .create({
        data: {
          type: "cron_completed",
          detail: `[photo-refresh-prompts] Sent: ${results.prompts_sent}, Skipped: ${results.skipped}`,
          meta: JSON.parse(JSON.stringify(results)),
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, ...results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CRON:photo-refresh-prompts] Fatal error:", err);
    return NextResponse.json({ error: "Cron failed", message }, { status: 500 });
  }
}
