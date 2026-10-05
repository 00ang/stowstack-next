import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  corsResponse,
  getOrigin,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { SENDERS, sendEmail } from "@/lib/email";

function esc(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface LeadData {
  name: string;
  email: string;
  facilityName: string;
  biggestIssue: string;
  occupancyRange: string;
  totalUnits: string;
  returnUrl?: string;
  unitSize?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  subject: (lead: LeadData) => string;
  body: (lead: LeadData) => string;
}

const TEMPLATES: Record<string, Template> = {
  follow_up: {
    id: "follow_up",
    name: "Follow Up",
    description: "Warm follow-up after audit form submission",
    subject: (lead) => `Quick question about ${esc(lead.facilityName)}`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Thanks for filling out the facility audit form for <strong>${esc(lead.facilityName)}</strong>. I took a look at your numbers and I have some initial thoughts on how we could help you fill units faster.</p>
          <p>Would you have 15 minutes this week for a quick call? I'd love to walk you through what we're seeing in your market and share a few ideas specific to your facility.</p>
          <p>No pressure at all \u2014 just want to make sure you have the full picture before deciding if we're a fit.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  audit_delivery: {
    id: "audit_delivery",
    name: "Audit Delivery",
    description: "Deliver the marketing audit report",
    subject: (lead) =>
      `Your ${esc(lead.facilityName)} marketing audit is ready`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Your marketing audit for <strong>${esc(lead.facilityName)}</strong> is ready. I've broken down your vacancy cost, identified your market opportunity score, and put together projected metrics for what a targeted Meta campaign could look like.</p>
          <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Key Highlights</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151;">
              <li>Vacancy cost analysis for your facility size and occupancy</li>
              <li>Market opportunity assessment with competitive positioning</li>
              <li>Projected campaign performance and ROI estimates</li>
              <li>6 specific action items to start filling units</li>
            </ul>
          </div>
          <p>I'd love to walk you through the numbers on a quick call. What does your schedule look like this week?</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  proposal: {
    id: "proposal",
    name: "Proposal",
    description: "Send pricing and next steps",
    subject: (lead) =>
      `StorageAds proposal for ${esc(lead.facilityName)}`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Great talking with you about <strong>${esc(lead.facilityName)}</strong>. As discussed, here's what working with StorageAds looks like:</p>
          <div style="margin: 24px 0; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #0f172a;">What's Included</p>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 2;">
              <li>Full-funnel Meta campaign architecture (CBO + Advantage+)</li>
              <li>Custom creative development and A/B testing</li>
              <li>Meta Pixel + Conversions API installation</li>
              <li>Monthly performance reporting tied to move-ins</li>
              <li>Dedicated account management</li>
              <li>Call handling and speed-to-lead audit</li>
            </ul>
          </div>
          <p>Campaigns typically go live within 48-72 hours of sign-on. You'll have access to your own client portal where you can track leads, move-ins, and ROAS in real time.</p>
          <p>Ready to get started? Just reply to this email and we'll kick things off.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  check_in: {
    id: "check_in",
    name: "Check In",
    description: "Re-engage a quiet lead",
    subject: (lead) =>
      `Still thinking about ${esc(lead.facilityName)}?`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Just checking in \u2014 I know things get busy. Wanted to see if you still had questions about filling units at <strong>${esc(lead.facilityName)}</strong>.</p>
          <p>No worries if the timing isn't right. But if occupancy is still a concern, we're here whenever you're ready to chat.</p>
          <p>Either way, I appreciate you taking the time to fill out the audit form.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  onboarding_reminder: {
    id: "onboarding_reminder",
    name: "Onboarding Reminder",
    description: "Remind client to complete campaign setup",
    subject: (lead) =>
      `Quick reminder: Finish your ${esc(lead.facilityName)} campaign setup`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Just a quick reminder \u2014 we're getting your campaigns ready to launch, but we still need a few details from you to make sure everything is dialed in for <strong>${esc(lead.facilityName)}</strong>.</p>
          <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: center;">
            <p style="margin: 0 0 12px; font-weight: 600; color: #166534;">Complete Your Campaign Setup</p>
            <a href="https://storageads.com/portal" style="display: inline-block; padding: 14px 28px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Open Your Portal</a>
          </div>
          <p>It only takes about 5 minutes. The sooner we have your info, the sooner your ads go live.</p>
          <p style="margin-top: 24px;">
            Anna Almeida<br/>
            StorageAds<br/>
            <a href="mailto:anna@storageads.com" style="color: #446386; text-decoration: none;">anna@storageads.com</a>
          </p>
        </div>`;
    },
  },
  campaign_update: {
    id: "campaign_update",
    name: "Campaign Update",
    description: "Share performance highlights with client",
    subject: (lead) => `${esc(lead.facilityName)} campaign update`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Here's a quick update on how your <strong>${esc(lead.facilityName)}</strong> campaigns are performing.</p>
          <p>You can always check your full dashboard with real-time metrics at any time:</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="https://storageads.com/portal" style="display: inline-block; padding: 14px 28px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Dashboard</a>
          </div>
          <p>Let us know if you have any questions about the numbers or if there's anything you'd like us to adjust in the campaigns.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  value_add: {
    id: "value_add",
    name: "Value Add",
    description: "Personalized tip based on facility challenge (drip sequence)",
    subject: (lead) => `A quick tip for ${esc(lead.facilityName)}`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      const issue = lead.biggestIssue || "";
      let tip = "";
      if (issue === "lease-up" || issue === "low-occupancy") {
        tip = `
          <p>Since you mentioned occupancy is a priority at <strong>${esc(lead.facilityName)}</strong>, here is something we have seen work really well for facilities in your position:</p>
          <div style="margin: 20px 0; padding: 16px 20px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Geo-targeted move-in specials</p>
            <p style="margin: 0; font-size: 14px; color: #374151;">Operators who run hyper-local Meta ads with a first-month discount to people actively searching for storage within a 10-mile radius typically see 3-5x better cost-per-lead than broad campaigns. The key is pairing the offer with a dedicated landing page that has one clear call to action.</p>
          </div>`;
      } else if (issue === "climate-controlled") {
        tip = `
          <p>Climate-controlled units sitting empty is more common than you'd think, and it is usually a positioning problem rather than a demand problem. Here is what we have seen work:</p>
          <div style="margin: 20px 0; padding: 16px 20px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Lead with the problem, not the feature</p>
            <p style="margin: 0; font-size: 14px; color: #374151;">Instead of advertising "climate-controlled units available," target people storing furniture, electronics, wine, or documents and emphasize protection. Ads that say "Don't let humidity ruin your furniture" outperform generic unit listings by 2-3x in our experience.</p>
          </div>`;
      } else if (issue === "drive-up") {
        tip = `
          <p>Drive-up units are usually the easiest to fill when you nail the targeting. Here is a pattern we keep seeing work:</p>
          <div style="margin: 20px 0; padding: 16px 20px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Target life events in your zip codes</p>
            <p style="margin: 0; font-size: 14px; color: #374151;">People moving, downsizing, renovating, or going through a divorce are your best prospects for drive-up units. Meta lets you target these life events with surprising precision. Pair that with "reserve online in 60 seconds" messaging and conversion rates jump significantly.</p>
          </div>`;
      } else if (issue === "vehicle-rv-boat") {
        tip = `
          <p>Vehicle, RV, and boat storage has massive seasonal demand swings, and the operators who win are the ones who get ahead of the curve:</p>
          <div style="margin: 20px 0; padding: 16px 20px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Start campaigns 6-8 weeks before peak season</p>
            <p style="margin: 0; font-size: 14px; color: #374151;">Most operators wait until demand picks up, but by then ad costs are higher and spots are filling at competitors. Running early-bird reservation campaigns with a small deposit to lock in a spot consistently fills vehicle storage before the rush even starts.</p>
          </div>`;
      } else {
        tip = `
          <p>I have been looking at facilities similar to <strong>${esc(lead.facilityName)}</strong> in your area and noticed something interesting:</p>
          <div style="margin: 20px 0; padding: 16px 20px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; font-weight: 600; color: #166534;">Most operators leave money on the table with their online presence</p>
            <p style="margin: 0; font-size: 14px; color: #374151;">The #1 thing we see across the board is facilities sending paid traffic to their homepage instead of a dedicated landing page. A simple landing page with unit availability, pricing, and a reservation form typically converts 3-4x better than a homepage.</p>
          </div>`;
      }
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          ${tip}
          <p>Happy to dig into this more if you are interested \u2014 no pitch, just sharing what is working in your market right now.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
  recovery_1hr: {
    id: "recovery_1hr",
    name: "Recovery: 1 Hour",
    description: "First recovery email sent 1 hour after form abandonment",
    subject: (lead) =>
      `Still looking for storage${lead.facilityName ? ` near ${esc(lead.facilityName)}` : ""}?`,
    body: (lead) => {
      const firstName = lead.name
        ? esc(lead.name.trim().split(" ")[0])
        : "there";
      const unitLine = lead.unitSize
        ? `<p>It looks like you were checking out <strong>${esc(lead.unitSize)}</strong> units. `
        : "<p>";
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          ${unitLine}Good news \u2014 units are still available and we are holding your spot.</p>
          <div style="margin: 24px 0; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; text-align: center;">
            <p style="margin: 0 0 4px; font-weight: 600; color: #166534; font-size: 18px;">Your unit is still available</p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">Pick up right where you left off \u2014 takes less than 60 seconds.</p>
            <a href="${esc(lead.returnUrl || "https://storageads.com")}" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reserve Your Unit</a>
          </div>
          <p style="font-size: 13px; color: #6b7280;">Questions? Just reply to this email or call us at <a href="tel:2699298541" style="color: #16a34a;">269-929-8541</a>.</p>
        </div>`;
    },
  },
  recovery_24hr: {
    id: "recovery_24hr",
    name: "Recovery: 24 Hours",
    description:
      "Second recovery email with urgency, sent 24 hours after abandonment",
    subject: (lead) =>
      `Don't miss out \u2014 units are filling up${lead.facilityName ? ` at ${esc(lead.facilityName)}` : ""}`,
    body: (lead) => {
      const firstName = lead.name
        ? esc(lead.name.trim().split(" ")[0])
        : "there";
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>Just a heads up \u2014 we have seen a few units get reserved since yesterday, and availability is getting tighter.</p>
          <div style="margin: 24px 0; padding: 16px 20px; background: #FBEFE4; border-left: 4px solid #AB5505; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-weight: 600; color: #92400e;">Units are going fast</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #78350f;">We can not guarantee pricing or availability beyond today. Lock in your rate now.</p>
          </div>
          <div style="margin: 24px 0; text-align: center;">
            <a href="${esc(lead.returnUrl || "https://storageads.com")}" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Reserve Now \u2014 Keep Your Rate</a>
          </div>
          <p style="font-size: 13px; color: #6b7280;">Need help deciding? Call us at <a href="tel:2699298541" style="color: #16a34a;">269-929-8541</a> \u2014 we will walk you through options.</p>
        </div>`;
    },
  },
  recovery_72hr: {
    id: "recovery_72hr",
    name: "Recovery: 72 Hours",
    description:
      "Final recovery email with discount offer, sent 72 hours after abandonment",
    subject: (lead) =>
      `A little something to help you decide${lead.facilityName ? ` \u2014 ${esc(lead.facilityName)}` : ""}`,
    body: (lead) => {
      const firstName = lead.name
        ? esc(lead.name.trim().split(" ")[0])
        : "there";
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>We know finding the right storage spot takes time. To make the decision a little easier, we have got something for you:</p>
          <div style="margin: 24px 0; padding: 24px; background: linear-gradient(135deg, #022c22, #0f172a); border-radius: 16px; text-align: center;">
            <p style="margin: 0 0 4px; font-size: 13px; color: #34d399; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Limited Time Offer</p>
            <p style="margin: 0 0 8px; font-size: 32px; font-weight: 800; color: white;">$1 First Month</p>
            <p style="margin: 0 0 20px; font-size: 14px; color: #94a3b8;">Reserve in the next 48 hours to lock this in.</p>
            <a href="${esc(lead.returnUrl || "https://storageads.com")}?promo=COMEBACK1" style="display: inline-block; padding: 14px 32px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Claim Your $1 First Month</a>
          </div>
          <p style="font-size: 13px; color: #6b7280;">This offer expires in 48 hours and is limited to new reservations only. Questions? Reply to this email or call <a href="tel:2699298541" style="color: #16a34a;">269-929-8541</a>.</p>
        </div>`;
    },
  },
  last_chance: {
    id: "last_chance",
    name: "Last Chance",
    description:
      "Final soft touch before marking lead cold (drip sequence)",
    subject: (lead) =>
      `One last thought on ${esc(lead.facilityName)}`,
    body: (lead) => {
      const firstName = esc(lead.name.trim().split(" ")[0]);
      return `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
          <p>Hey ${firstName},</p>
          <p>I know I have reached out a few times, so I will keep this short. Totally understand if the timing is not right for <strong>${esc(lead.facilityName)}</strong> \u2014 running a storage facility is a lot and marketing is just one of a hundred things on the list.</p>
          <p>This will be my last follow-up unless you want to keep the conversation going. But if occupancy ever becomes a priority again, we are here and happy to help. No expiration on that offer.</p>
          <p>Either way, wishing you the best with the facility.</p>
          <p style="margin-top: 24px;">
            Blake Burkett<br/>
            StorageAds<br/>
            <a href="tel:2699298541" style="color: #446386; text-decoration: none;">269-929-8541</a><br/>
            <a href="mailto:blake@storageads.com" style="color: #446386; text-decoration: none;">blake@storageads.com</a>
          </p>
        </div>`;
    },
  },
};

function logActivity(params: {
  type: string;
  facilityId: string;
  leadName: string;
  facilityName: string;
  detail: string;
  meta: Record<string, unknown>;
}) {
  db.activity_log
    .create({
      data: {
        type: params.type,
        facility_id: params.facilityId,
        lead_name: params.leadName || "",
        facility_name: params.facilityName || "",
        detail: (params.detail || "").slice(0, 500),
        meta: (params.meta || {}) as unknown as Prisma.InputJsonValue,
      },
    })
    .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "send-template");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  const templateList = Object.values(TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
  return jsonResponse({ templates: templateList }, 200, origin);
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "send-template");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const { templateId, leadId } = body as {
    templateId?: string;
    leadId?: string;
  };

  if (!templateId || !leadId) {
    return errorResponse("Missing templateId or leadId", 400, origin);
  }

  const template = TEMPLATES[templateId];
  if (!template) {
    return errorResponse("Unknown template", 400, origin);
  }

  try {
    const facility = await db.facilities.findUnique({
      where: { id: leadId },
    });
    if (!facility) {
      return errorResponse("Lead not found", 404, origin);
    }

    const lead: LeadData = {
      name: facility.contact_name || "",
      email: facility.contact_email || "",
      facilityName: facility.name || "",
      biggestIssue: facility.biggest_issue || "",
      occupancyRange: facility.occupancy_range || "",
      totalUnits: facility.total_units || "",
    };

    if (!lead.email) {
      return errorResponse("Lead has no email address", 400, origin);
    }

    const subject = template.subject(lead);
    const html = template.body(lead);

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return jsonResponse(
        {
          success: true,
          preview: true,
          message: "No email API key configured \u2014 email not sent",
          subject,
        },
        200,
        origin
      );
    }

    const result = await sendEmail({
      from: templateId === "onboarding_reminder" ? SENDERS.anna : SENDERS.blake,
      to: lead.email,
      cc: "anna@storageads.com",
      replyTo: ["blake@storageads.com", "anna@storageads.com"],
      subject,
      html,
      tags: [{ name: "type", value: "outreach" }],
    });

    if (!result.ok) {
      return errorResponse("Failed to send email", 500, origin);
    }

    logActivity({
      type: "note_added",
      facilityId: leadId,
      leadName: lead.name,
      facilityName: lead.facilityName,
      detail: `Sent "${template.name}" email to ${lead.email}`,
      meta: { templateId },
    });

    return jsonResponse({ success: true, subject }, 200, origin);
  } catch {
    return errorResponse("Failed to send email", 500, origin);
  }
}
