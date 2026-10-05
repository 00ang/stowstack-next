/**
 * Email templates for the post-audit drip sequence.
 *
 * Template IDs align with the steps defined in drip-sequences.ts:
 *   "follow_up"  — Day 1 warm follow-up
 *   "value_add"  — Day 3 cost-of-waiting education
 *   "check_in"   — Day 7 book-a-call nudge
 */

const DEFAULT_CAL_URL = "https://cal.com/blake-storageads/15min";

interface DripEmailData {
  facilityName: string;
  auditScore?: number;
  auditUrl?: string;
  calUrl?: string;
}

interface DripEmailResult {
  subject: string;
  html: string;
}

/* ------------------------------------------------------------------ */
/*  Shared layout                                                      */
/* ------------------------------------------------------------------ */

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>StorageAds</title>
</head>
<body style="margin:0;padding:0;background-color:#faf9f5;font-family:-apple-system,system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf9f5;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;width:100%;">

<!-- Logo -->
<tr><td style="padding-bottom:32px;">
<span style="font-size:20px;font-weight:600;letter-spacing:-0.02em;text-decoration:none;">
<span style="color:#141413;">storage</span><span style="color:#446386;">ads</span>
</span>
</td></tr>

<!-- Body -->
<tr><td style="color:#6a6560;font-size:15px;line-height:1.6;">
${body}
</td></tr>

<!-- Footer -->
<tr><td style="padding-top:40px;border-top:1px solid #e8e6dc;color:#b0aea5;font-size:12px;line-height:1.5;">
StorageAds. Marketing that fills units.<br />
<a href="https://storageads.com" style="color:#b0aea5;text-decoration:underline;">storageads.com</a>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
<tr><td style="background-color:#141413;border-radius:8px;">
<a href="${href}" style="display:inline-block;padding:12px 28px;color:#faf9f5;font-size:15px;font-weight:500;text-decoration:none;">
${text}
</a>
</td></tr>
</table>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

function followUp(data: DripEmailData): DripEmailResult {
  const name = escapeHtml(data.facilityName);
  const scoreSection =
    data.auditScore != null
      ? `<p style="margin:20px 0;">
<span style="font-size:36px;font-weight:600;color:#446386;">${data.auditScore}</span>
<span style="font-size:15px;color:#6a6560;">&nbsp;/ 100</span>
</p>
<p style="margin:0 0 8px;color:#141413;font-size:15px;">
That&rsquo;s your ${name} marketing score. ${
          data.auditScore >= 70
            ? "Not bad, but there&rsquo;s room to tighten things up."
            : data.auditScore >= 40
              ? "There are some clear opportunities to improve."
              : "There&rsquo;s a lot of low-hanging fruit here."
        }
</p>`
      : "";

  const auditLink = data.auditUrl || "https://storageads.com/audit-tool";

  return {
    subject: `Your ${data.facilityName} audit results are ready`,
    html: layout(`
<p style="margin:0 0 16px;color:#141413;font-size:17px;font-weight:500;">
Hi there,
</p>

<p style="margin:0 0 16px;">
We just finished the marketing audit for <strong style="color:#141413;">${name}</strong>. Here&rsquo;s a quick snapshot of where things stand.
</p>

${scoreSection}

<p style="margin:16px 0;">
The full report breaks down your Google Business Profile, local SEO, ad presence, and online reputation, with specific recommendations for each.
</p>

${ctaButton("View Your Full Results", auditLink)}

<p style="margin:0;">
No strings attached. Just a clear picture of what&rsquo;s working and what isn&rsquo;t.
</p>

<p style="margin:24px 0 0;color:#141413;">
Blake<br />
<span style="color:#6a6560;font-size:13px;">Founder, StorageAds</span>
</p>
`),
  };
}

function valueAdd(data: DripEmailData): DripEmailResult {
  const name = escapeHtml(data.facilityName);
  const auditLink = data.auditUrl || "https://storageads.com/audit-tool";

  return {
    subject: `What empty units are costing ${data.facilityName} every month`,
    html: layout(`
<p style="margin:0 0 16px;color:#141413;font-size:17px;font-weight:500;">
Quick math on ${name}:
</p>

<p style="margin:0 0 16px;">
The average self-storage unit rents for about <strong style="color:#141413;">$130/month</strong>. That means every vacant unit is $130 walking out the door every 30 days.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;width:100%;">
<tr>
<td style="background-color:#F2EBD9;border-radius:8px;padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
<tr>
<td style="color:#6a6560;font-size:13px;padding-bottom:8px;">5 empty units</td>
<td style="color:#141413;font-size:13px;font-weight:500;text-align:right;padding-bottom:8px;">$650/mo lost</td>
</tr>
<tr>
<td style="color:#6a6560;font-size:13px;padding-bottom:8px;">10 empty units</td>
<td style="color:#141413;font-size:13px;font-weight:500;text-align:right;padding-bottom:8px;">$1,300/mo lost</td>
</tr>
<tr>
<td style="color:#6a6560;font-size:13px;">25 empty units</td>
<td style="color:#141413;font-size:13px;font-weight:500;text-align:right;">$3,250/mo lost</td>
</tr>
</table>
</td>
</tr>
</table>

<p style="margin:0 0 16px;">
Most facilities we audit are leaving money on the table with incomplete Google profiles, missing ad coverage, or a website that doesn&rsquo;t convert. These are fixable problems.
</p>

<p style="margin:0 0 16px;">
StorageAds runs your ads, your Google listing, your retargeting, and your reputation, so you can run the facility.
</p>

${ctaButton("See What StorageAds Can Do", auditLink)}

<p style="margin:24px 0 0;color:#141413;">
Blake<br />
<span style="color:#6a6560;font-size:13px;">Founder, StorageAds</span>
</p>
`),
  };
}

function checkIn(data: DripEmailData): DripEmailResult {
  const name = escapeHtml(data.facilityName);
  const calLink = data.calUrl || DEFAULT_CAL_URL;

  return {
    subject: `Let's talk about filling ${data.facilityName}`,
    html: layout(`
<p style="margin:0 0 16px;color:#141413;font-size:17px;font-weight:500;">
Hey, quick note on ${name}.
</p>

<p style="margin:0 0 16px;">
I put together that audit earlier this week and wanted to follow up personally. I see some clear wins that could fill more units, and I&rsquo;d like to walk you through them.
</p>

<p style="margin:0 0 16px;">
No pitch deck, no pressure. Just 15 minutes to talk through what we found and whether it makes sense to work together.
</p>

${ctaButton("Book a 15-Minute Call", calLink)}

<p style="margin:0 0 16px;">
Or just reply to this email, happy to answer any questions.
</p>

<p style="margin:24px 0 0;color:#141413;">
Blake<br />
<span style="color:#6a6560;font-size:13px;">Founder, StorageAds</span>
</p>
`),
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const TEMPLATES: Record<string, (data: DripEmailData) => DripEmailResult> = {
  follow_up: followUp,
  value_add: valueAdd,
  check_in: checkIn,
};

/**
 * Render a drip-sequence email to { subject, html }.
 *
 * @param templateId  One of "follow_up" | "value_add" | "check_in"
 * @param data        Merge fields for the template
 * @throws            If templateId is unknown
 */
export function getDripEmailHtml(
  templateId: string,
  data: {
    facilityName: string;
    auditScore?: number;
    auditUrl?: string;
    calUrl?: string;
  },
): { subject: string; html: string } {
  const render = TEMPLATES[templateId];
  if (!render) {
    throw new Error(`Unknown drip template: "${templateId}"`);
  }
  return render(data);
}
