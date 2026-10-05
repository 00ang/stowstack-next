import { NextRequest, after } from "next/server";
import { db } from "@/lib/db";
import { scheduleDiagnosticRetry } from "@/lib/diagnostic-retry";
import { selfBaseUrl } from "@/lib/self-url";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { SENDERS, sendEmail } from "@/lib/email";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidEmail, escapeHtml } from "@/lib/validation";

// DB write + notification email + internal audit trigger. 120, not 30: the
// audit trigger runs in after() and waits for generation (up to its own 120s)
// so a failure is logged, not lost. The response itself still returns at once.
export const maxDuration = 120;

/**
 * Maps form responses (question-answer pairs) to DiagnosticInput format
 * expected by the audit-generate-diagnostic endpoint.
 */
function mapResponsesToDiagnosticInput(
  facility: {
    facilityName: string;
    facilityAddress: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    websiteUrl: string;
  },
  responses: Record<string, string | string[]>
) {
  const r = (key: string): string => {
    const val = responses[key];
    return typeof val === "string" ? val : Array.isArray(val) ? val.join(", ") : "";
  };

  return {
    facilityName: facility.facilityName,
    facilityAddress: facility.facilityAddress,
    contactName: facility.contactName,
    contactEmail: facility.contactEmail,
    contactPhone: facility.contactPhone,
    websiteUrl: facility.websiteUrl,
    role: "",
    yearsManaged: "",
    facilityAge: "",
    facilityCount: "1",

    // Occupancy
    occupancy: r("About where is your facility sitting today (overall occupancy)?"),
    leasingMomentum: r("How would you describe the facility's leasing momentum right now?"),
    occupancyVs6Months: "",
    occupancyVsLastYear: "",
    moveIns30Days: r("Roughly how many move-ins have you had in the last 30 days?"),
    moveOuts30Days: r("Roughly how many move-outs in the last 30 days?"),
    totalUnits: r("What is your total unit count (approximately)?"),

    // Unit mix
    unitTypesOffered: [],
    bestRentingUnits: [],
    hardestToRentUnits: [],
    specificVacancyNotes: "",
    offlineUnits: "",
    unitMixBalance: "",

    // Lead flow
    biggerIssue: r("What feels like the bigger issue right now?"),
    leadSources: [],
    weeklyInquiries: "",
    whyPeopleDontRent: "",
    canReserveOnline: "",
    canRentFullyOnline: "",
    onlineVsWalkIn: "",

    // Sales
    followUpConfidence: "",
    callsRecorded: "",
    callTrackingSoftware: "",
    missedCallProcess: "",
    abandonedReservationFollowUp: "",
    reservationNoShowProcess: "",
    phoneClosingAbility: "",

    // Marketing
    currentMarketing: r("What marketing / advertising are you currently running? (select all)").split(", ").filter(Boolean),
    monthlyAdSpend: r("What is your approximate total monthly marketing / ad spend?"),
    googleAdsPerformance: r("If you run Google Ads, how would you describe the performance?"),
    metaAdsPerformance: "",
    knowsCostPerLead: "",
    whoManagesMarketing: r("Who manages your marketing / ads?"),
    openToMetaAds: "",
    idealAdBudget: "",
    storageAgencyExperience: "",

    // Digital presence
    websiteBuilder: "",
    lastWebsiteUpdate: r("When was the last time your website was meaningfully updated?"),
    showsLiveAvailability: "",
    googleReviewCount: r("Approximately how many Google reviews does your facility have?"),
    googleRating: r("What is your approximate Google review rating?"),
    respondsToReviews: "",
    requestsReviews: "",
    gbpStatus: r("Is your Google Business Profile (GBP) claimed and actively managed?"),
    gbpPostFrequency: "",
    socialMedia: [],

    // Revenue management
    pms: r("Which PMS / management software do you use?"),
    revenueManagementSoftware: "",
    pricingPerception: "",
    currentPromotions: "",
    ecriStatus: "",
    lastStreetRateIncrease: "",
    pricingMethod: "",
    tenantProtection: "",
    autopayPercentage: "",

    // Operations
    staffingModel: "",
    officeHours: "",
    gateAccessHours: "",
    facilityCondition: "",
    facilityAgeYears: "",
    securityFeatures: [],
    amenities: [],
    recentRenovations: "",

    // Competition
    topCompetitors: "",
    competitorAdvantages: "",
    yourAdvantages: "",
    commonObjections: [],
    newSupply: "",
    marketSaturation: "",

    // Priorities
    vacancyReason: "",
    unusualCircumstances: "",
    fixOneThingFirst: r("If this diagnostic could fix only ONE thing, what should it fix first?"),
    aggressiveness: r("How aggressive are you willing to be if the audit shows changes are needed?"),
    urgency: r("How soon are you looking to take action?"),
    openToPmsReports: "",
    howHeard: "",
    additionalNotes: r("Anything else you want us to know before we review your facility?"),
  };
}

/**
 * POST /api/diagnostic-intake
 *
 * Accepts diagnostic form submissions from:
 * 1. Google Forms via Apps Script webhook
 * 2. Direct JSON submissions from our own forms
 *
 * Stores the submission in the facilities table with pipeline_status='diagnostic_submitted'
 * and stores the full form data in the notes field as JSON.
 *
 * Google Apps Script webhook payload format:
 * {
 *   "facilityName": "...",
 *   "facilityAddress": "...",
 *   "contactName": "...",
 *   "contactEmail": "...",
 *   "contactPhone": "...",
 *   "websiteUrl": "...",
 *   "responses": { ...all form field key-value pairs... }
 * }
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "diagnostic-intake");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      facilityName,
      facilityAddress,
      contactName,
      contactEmail,
      contactPhone,
      websiteUrl,
      responses,
    } = body || {};

    // Bound the (billed) downstream Anthropic call: reject oversized public
    // submissions before the free-text answers reach the AI prompt. This
    // public route is the one un-gated entry to the diagnostic engine, so the
    // size cap lives here (mirrors the guard the deleted diagnostic-analyze
    // endpoint carried).
    if (responses && JSON.stringify(responses).length > 50_000) {
      return errorResponse("Submission too large", 413, origin);
    }

    if (!facilityName || !contactEmail) {
      return errorResponse(
        "facilityName and contactEmail are required",
        400,
        origin
      );
    }
    if (!isValidEmail(contactEmail)) {
      return errorResponse(
        "Invalid email format",
        400,
        origin
      );
    }

    // Parse occupancy from responses if available
    const occupancyRaw =
      responses?.[
        "About where is your facility sitting today (overall occupancy)?"
      ] || "";
    const occupancyMap: Record<string, string> = {
      "Under 50%": "below-60",
      "50–59%": "below-60",
      "60–69%": "60-75",
      "70–79%": "60-75",
      "80–84%": "75-85",
      "85–89%": "85-95",
      "90–94%": "85-95",
      "95%+": "above-95",
    };

    const totalUnitsRaw =
      responses?.[
        "What is your total unit count (approximately)?"
      ] || "";
    const unitCountMap: Record<string, string> = {
      "Under 100": "under-100",
      "100–199": "100-300",
      "200–349": "100-300",
      "350–499": "300-500",
      "500–749": "500+",
      "750–999": "500+",
      "1,000+": "500+",
    };

    const biggestIssueRaw =
      responses?.[
        "What feels like the bigger issue right now?"
      ] || "";
    const issueMap: Record<string, string> = {
      "Not enough leads coming in": "filling-units",
      "Plenty of leads, not enough are converting to move-ins":
        "competitive-pressure",
      "Both — not enough leads AND they're not converting": "filling-units",
      "Revenue per unit is too low": "revenue",
      "Operations are stretched thin": "operations",
      "Not sure where to start": "filling-units",
      "Not sure": "filling-units",
    };

    // Lead scoring — prioritize follow-up based on diagnostic responses
    const urgencyRaw = responses?.["How soon are you looking to take action?"] || "";
    const aggressivenessRaw = responses?.["How aggressive are you willing to be if the audit shows changes are needed?"] || "";
    const adSpendRaw = responses?.["What is your approximate total monthly marketing / ad spend?"] || "";
    const marketingMgmtRaw = responses?.["Who manages your marketing / ads?"] || "";

    let leadScore = 0;
    // Urgency signals
    if (urgencyRaw.includes("Immediately") || urgencyRaw.includes("This week")) leadScore += 30;
    else if (urgencyRaw.includes("30 days") || urgencyRaw.includes("This month")) leadScore += 20;
    else if (urgencyRaw.includes("90 days") || urgencyRaw.includes("This quarter")) leadScore += 10;

    // Aggressiveness signals
    if (aggressivenessRaw.includes("Very aggressive") || aggressivenessRaw.includes("Whatever it takes")) leadScore += 20;
    else if (aggressivenessRaw.includes("Moderately") || aggressivenessRaw.includes("Willing")) leadScore += 12;

    // Occupancy distress — lower occupancy = higher urgency
    if (["Under 50%", "50–59%", "60–69%"].includes(occupancyRaw)) leadScore += 20;
    else if (["70–79%"].includes(occupancyRaw)) leadScore += 10;

    // Has budget or willing to spend
    if (adSpendRaw.includes("$1,000") || adSpendRaw.includes("$2,500") || adSpendRaw.includes("$5,000")) leadScore += 15;
    else if (adSpendRaw.includes("$500")) leadScore += 8;

    // Nobody managing marketing = high need
    if (marketingMgmtRaw.includes("Nobody") || marketingMgmtRaw.includes("not actively")) leadScore += 15;
    else if (marketingMgmtRaw.includes("myself")) leadScore += 8;

    // Cap at 100
    leadScore = Math.min(100, leadScore);

    // Create facility record
    const facility = await db.facilities.create({
      data: {
        name: facilityName,
        location: facilityAddress || "",
        contact_name: contactName || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        website: websiteUrl || null,
        occupancy_range: occupancyMap[occupancyRaw] || "60-75",
        total_units: unitCountMap[totalUnitsRaw] || "100-300",
        biggest_issue: issueMap[biggestIssueRaw] || "filling-units",
        lead_score: leadScore,
        status: "intake",
        pipeline_status: "diagnostic_submitted",
        notes: JSON.stringify({
          source: "diagnostic_form",
          submittedAt: new Date().toISOString(),
          leadScore,
          responses: responses || body,
          diagnosticJson: mapResponsesToDiagnosticInput(
            { facilityName, facilityAddress: facilityAddress || "", contactName: contactName || "", contactEmail, contactPhone: contactPhone || "", websiteUrl: websiteUrl || "" },
            responses || {}
          ),
        }),
      },
    });

    // The net under the fire-and-forget generation below: a check for when this
    // submission would count as stuck. A no-op if the audit arrived by then.
    await scheduleDiagnosticRetry(facility.id)
      .catch((err) => console.error("[diagnostic-intake] scheduling retry failed:", err));

    // Send notification email (fire-and-forget).
    void sendEmail({
      from: SENDERS.notifications,
      to: [process.env.ADMIN_EMAIL || "blake@storageads.com"],
      subject: `[Score: ${leadScore}] New Diagnostic: ${escapeHtml(facilityName)}`,
      tags: [{ name: "type", value: "diagnostic_intake" }],
      html: `
            <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="margin: 0 0 12px; color: #1a1a1a;">New Diagnostic Form Submission</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Facility</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${escapeHtml(facilityName)}</strong></td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Address</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(facilityAddress || "N/A")}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Contact</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(contactName || "N/A")} (${escapeHtml(contactEmail)})</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Occupancy</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(occupancyRaw || "N/A")}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Units</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(totalUnitsRaw || "N/A")}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Issue</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(biggestIssueRaw || "N/A")}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Lead Score</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${leadScore}/100</strong></td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Urgency</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(urgencyRaw || "N/A")}</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Aggressiveness</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(aggressivenessRaw || "N/A")}</td></tr>
              </table>
              <p style="margin-top: 20px;">
                <a href="https://storageads.com/admin/audits" style="display: inline-block; padding: 12px 24px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600;">Generate Audit</a>
              </p>
            </div>`,
    });

    // Log activity
    db.activity_log
      .create({
        data: {
          type: "diagnostic_submitted",
          facility_id: facility.id,
          facility_name: facilityName,
          detail: `Diagnostic form submitted by ${contactName || contactEmail}`,
        },
      })
      .catch((err) => {
        console.error("[diagnostic-intake] Activity log write failed:", err instanceof Error ? err.message : err);
      });

    // Auto-trigger audit generation, after the response so the prospect is not
    // kept waiting on the AI. after() rather than a floating fetch: a promise
    // left running when a serverless response returns can be frozen mid-flight.
    // And the outcome is logged — this call 401'd silently for weeks.
    const adminSecret = process.env.ADMIN_SECRET;
    // Not VERCEL_URL: it sits behind deployment protection and 401s (see self-url).
    const appUrl = selfBaseUrl();

    if (adminSecret && process.env.ANTHROPIC_API_KEY) {
      const diagnosticJson = mapResponsesToDiagnosticInput(
        { facilityName, facilityAddress, contactName, contactEmail, contactPhone, websiteUrl },
        responses || {}
      );

      after(async () => {
        try {
          const res = await fetch(`${appUrl}/api/audit-generate-diagnostic`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Admin-Key": adminSecret,
            },
            body: JSON.stringify({
              diagnosticJson,
              facilityId: facility.id,
            }),
          });
          if (!res.ok) {
            console.error(`[diagnostic-intake] Auto-audit generation returned ${res.status} for facility ${facility.id}; the queued retry will try again`);
          }
        } catch (err) {
          console.error("[diagnostic-intake] Auto-audit generation trigger failed:", err);
        }
      });
    }

    return jsonResponse(
      {
        success: true,
        facilityId: facility.id,
        message: "Diagnostic submission received. Your audit is being generated now.",
      },
      201,
      origin
    );
  } catch (e) {
    console.error("Diagnostic intake error:", e);
    return errorResponse("Internal server error", 500, origin);
  }
}
