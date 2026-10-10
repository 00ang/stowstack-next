import { escapeHtml } from "@/lib/validation";

/**
 * Operator email for a finished diagnostic. Dollar vacancy is included
 * only when we actually have it. A sample preview uses the same HTML.
 */
export function operatorAuditEmail(input: {
  facilityName: string;
  summary: string;
  auditUrl: string;
  score: number;
  grade: string;
  annualLoss?: number | null;
  dollarsKnown?: boolean;
}): string {
  const facilityNameSafe = escapeHtml(input.facilityName || "Your facility");
  const summaryExcerpt = escapeHtml((input.summary || "").slice(0, 300));
  const more = (input.summary || "").length > 300 ? "..." : "";
  const showDollars = input.dollarsKnown === true && (input.annualLoss || 0) > 0;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Manrope,system-ui,sans-serif;color:#16161A;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#525766;">StorageAds</p>
    <h1 style="margin:0 0 8px;font-size:26px;line-height:1.15;font-weight:800;">Your facility diagnostic is ready</h1>
    <p style="margin:0 0 24px;color:#3F4350;">${facilityNameSafe}</p>
    ${input.score > 0 ? `<p style="margin:0 0 8px;font-size:13px;color:#525766;">Score ${input.score}/100 (${escapeHtml(input.grade)})</p>` : ""}
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#16161A;">${summaryExcerpt}${more}</p>
    ${
      showDollars
        ? `<p style="margin:0 0 24px;font-size:15px;">Vacancy, from the numbers you gave: $${(input.annualLoss || 0).toLocaleString()} a year.</p>`
        : `<p style="margin:0 0 24px;font-size:14px;color:#525766;">No dollar loss in this note. We only print one when you gave us the numbers to calculate it.</p>`
    }
    <p style="margin:0 0 28px;">
      <a href="${input.auditUrl}" style="display:inline-block;padding:14px 22px;background:#16161A;color:#ffffff;text-decoration:none;font-weight:700;">Read the diagnostic</a>
    </p>
    <p style="margin:0;font-size:12px;color:#525766;">The link stays up for 90 days.</p>
  </div>
</body>
</html>`;
}
