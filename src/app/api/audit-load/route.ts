import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, SENDERS, submissionNotifyRecipients } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`audit_load:${ip}`, 20, 60);
  if (!rl.allowed) {
    return errorResponse("Too many requests", 429, origin);
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return errorResponse("Missing slug parameter", 400, origin);

  try {
    const record = await db.shared_audits.findFirst({
      where: {
        slug,
        expires_at: { gt: new Date() },
      },
    });

    if (!record) {
      return errorResponse("Audit not found or has expired", 404, origin);
    }

    const currentViews = record.views || 0;

    // Increment view count (fire-and-forget)
    db.shared_audits
      .update({
        where: { id: record.id },
        data: { views: { increment: 1 } },
      })
      .catch((err) => console.error("[audit_view] Fire-and-forget failed:", err));

    // View-based notification emails via the canonical email layer: validates,
    // retries, honors EMAIL_DRY_RUN / EMAIL_REDIRECT_TO, skips cleanly when
    // RESEND_API_KEY is unset, and dedups on idempotencyKey — which matters here
    // because the view increment is fire-and-forget, so a fast double-load could
    // otherwise fire two "first view" alerts.
    {
      const auditJson = record.audit_json as Record<string, unknown> | null;
      const overallScore = escapeHtml(String(auditJson?.overallScore ?? "N/A"));
      const facilityName = escapeHtml(record.facility_name || "Unknown Facility");
      const adminEmail = submissionNotifyRecipients();
      const auditUrl = `https://storageads.com/audit/${slug}`;

      if (currentViews === 0) {
        // First view — operator just opened their audit
        void sendEmail({
          from: SENDERS.notifications,
          to: adminEmail,
          subject: `Audit Opened: ${facilityName} (Score: ${overallScore}/100)`,
          tags: [{ name: "type", value: "audit_first_view" }],
          idempotencyKey: `audit-first-view:${record.id}`,
          html: `
              <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="margin: 0 0 12px; color: #1a1a1a;">Audit First View</h2>
                <p style="color: #333; font-size: 15px;">${facilityName} just opened their diagnostic audit for the first time.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Facility</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${facilityName}</strong></td></tr>
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Score</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${overallScore}/100</strong></td></tr>
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Audit Link</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><a href="${auditUrl}">View Audit</a></td></tr>
                </table>
              </div>`,
        }).catch((err) => console.error("[audit-load] first-view notify failed:", err));
      } else if (currentViews + 1 >= 3 && currentViews < 3) {
        // Just hit 3 views — hot lead signal (only fire once when crossing threshold)
        void sendEmail({
          from: SENDERS.notifications,
          to: adminEmail,
          subject: `Hot Lead: ${facilityName} — ${currentViews + 1} audit views`,
          tags: [{ name: "type", value: "audit_hot_lead" }],
          idempotencyKey: `audit-hot-lead:${record.id}`,
          html: `
              <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="margin: 0 0 12px; color: #1a1a1a;">Hot Lead Alert</h2>
                <p style="color: #333; font-size: 15px;">${facilityName} has viewed their audit <strong>${currentViews + 1} times</strong> — this is a hot lead.</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Facility</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${facilityName}</strong></td></tr>
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Score</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${overallScore}/100</strong></td></tr>
                  <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Views</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${currentViews + 1}</strong></td></tr>
                </table>
                <p style="margin-top: 16px; color: #333;">Consider reaching out — they're engaged with the report.</p>
              </div>`,
        }).catch((err) => console.error("[audit-load] hot-lead notify failed:", err));
      }
    }

    return jsonResponse(
      {
        audit: record.audit_json,
        facilityName: record.facility_name,
        createdAt: record.created_at,
        expiresAt: record.expires_at,
        views: currentViews + 1,
      },
      200,
      origin
    );
  } catch {
    return errorResponse("Failed to load audit", 500, origin);
  }
}
