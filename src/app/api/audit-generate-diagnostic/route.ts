import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { sendEmail, SENDERS } from "@/lib/email";
import { escapeHtml } from "@/lib/validation";

// Claude API call needs 30-60s for full diagnostic audit generation
export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DiagnosticInput {
  facilityName: string;
  facilityAddress: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  role: string;
  yearsManaged: string;
  facilityAge: string;
  facilityCount: string;

  // Occupancy
  occupancy: string;
  leasingMomentum: string;
  occupancyVs6Months: string;
  occupancyVsLastYear: string;
  moveIns30Days: string;
  moveOuts30Days: string;
  totalUnits: string;

  // Unit mix
  unitTypesOffered: string[];
  bestRentingUnits: string[];
  hardestToRentUnits: string[];
  specificVacancyNotes: string;
  offlineUnits: string;
  unitMixBalance: string;

  // Lead flow
  biggerIssue: string;
  leadSources: string[];
  weeklyInquiries: string;
  whyPeopleDontRent: string;
  canReserveOnline: string;
  canRentFullyOnline: string;
  onlineVsWalkIn: string;

  // Sales
  followUpConfidence: string;
  callsRecorded: string;
  callTrackingSoftware: string;
  missedCallProcess: string;
  abandonedReservationFollowUp: string;
  reservationNoShowProcess: string;
  phoneClosingAbility: string;

  // Marketing
  currentMarketing: string[];
  monthlyAdSpend: string;
  googleAdsPerformance: string;
  metaAdsPerformance: string;
  knowsCostPerLead: string;
  whoManagesMarketing: string;
  openToMetaAds: string;
  idealAdBudget: string;
  storageAgencyExperience: string;

  // Digital presence
  websiteBuilder: string;
  lastWebsiteUpdate: string;
  showsLiveAvailability: string;
  googleReviewCount: string;
  googleRating: string;
  respondsToReviews: string;
  requestsReviews: string;
  gbpStatus: string;
  gbpPostFrequency: string;
  socialMedia: string[];

  // Revenue management
  pms: string;
  revenueManagementSoftware: string;
  pricingPerception: string;
  currentPromotions: string;
  ecriStatus: string;
  lastStreetRateIncrease: string;
  pricingMethod: string;
  tenantProtection: string;
  autopayPercentage: string;

  // Operations
  staffingModel: string;
  officeHours: string;
  gateAccessHours: string;
  facilityCondition: string;
  facilityAgeYears: string;
  securityFeatures: string[];
  amenities: string[];
  recentRenovations: string;

  // Competition
  topCompetitors: string;
  competitorAdvantages: string;
  yourAdvantages: string;
  commonObjections: string[];
  newSupply: string;
  marketSaturation: string;

  // Priorities
  vacancyReason: string;
  unusualCircumstances: string;
  fixOneThingFirst: string;
  aggressiveness: string;
  urgency: string;
  openToPmsReports: string;
  howHeard: string;
  additionalNotes: string;

  // Optional scraped data
  scrapedGoogleRating?: number;
  scrapedReviewCount?: number;
  scrapedCompetitors?: Array<{
    name: string;
    rating: number | null;
    reviewCount: number;
    address: string;
  }>;
}

interface CategoryAudit {
  name: string;
  slug: string;
  score: number;
  grade: string;
  summary: string;
  greenFlags: [string, string];
  yellowFlag: string;
  redFlags: [string, string, string];
  doNothingConsequence: string;
  inactionCost: number;
  actions: Array<{
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
  }>;
}

interface IndustryBenchmark {
  metric: string;
  facilityValue: string;
  industryAverage: string;
  topPerformers: string;
  gap: string;
}

interface RevenueOpportunity {
  source: string;
  estimatedMonthlyGain: number;
  timeToImplement: string;
  difficulty: "easy" | "moderate" | "hard";
}

interface RevenueOptimization {
  currentEstimatedRevenue: number;
  potentialMonthlyRevenue: number;
  monthlyGap: number;
  annualGap: number;
  topOpportunities: RevenueOpportunity[];
}

interface CostOfInaction {
  monthlyBleed: number;
  projectedOccupancy6Months: string;
  projectedOccupancy12Months: string;
  competitorGapWidening: string;
  urgencyStatement: string;
}

interface NinetyDayProjection {
  ifYouAct: {
    occupancyTarget: string;
    additionalMoveIns: number;
    revenueRecaptured: number;
    keyWins: [string, string, string];
  };
  ifYouDont: {
    occupancyProjection: string;
    additionalMoveOuts: number;
    revenueLost: number;
    consequences: [string, string, string];
  };
}

interface ConversionFunnelStage {
  name: string;
  status: "strong" | "weak" | "critical";
  evidence: string;
  leakPercentage: number;
}

interface ConversionFunnel {
  stages: ConversionFunnelStage[];
  biggestLeak: string;
  narrative: string;
}

interface OperatorAlignment {
  accuracy: "accurate" | "partially_accurate" | "misdiagnosed";
  operatorSaid: string;
  auditFound: string;
  note: string;
}

interface FullDiagnosticAudit {
  generatedAt: string;
  facility: {
    name: string;
    address: string;
    contactName: string;
    contactEmail: string;
    websiteUrl: string;
    occupancy: string;
    totalUnits: string;
    facilityAge: string;
  };
  overallScore: number;
  overallGrade: string;
  categories: CategoryAudit[];
  executiveSummary: string;
  industryBenchmarks: IndustryBenchmark[];
  revenueOptimization: RevenueOptimization;
  costOfInaction: CostOfInaction;
  ninetyDayProjection: NinetyDayProjection;
  conversionFunnel?: ConversionFunnel;
  operatorAlignment?: OperatorAlignment;
  vacancyCost: {
    vacantUnits: number;
    monthlyLoss: number;
    annualLoss: number;
    avgUnitRate: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export const OCCUPANCY_MAP: Record<string, number> = {
  "Under 50%": 45,
  "50–59%": 55,
  "60–69%": 65,
  "70–79%": 75,
  "80–84%": 82,
  "85–89%": 87,
  "90–94%": 92,
  "95%+": 97,
};

export const UNIT_COUNT_MAP: Record<string, number> = {
  "Under 100": 75,
  "100–199": 150,
  "200–349": 275,
  "350–499": 425,
  "500–749": 625,
  "750–999": 875,
  "1,000+": 1100,
};

export function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function parseCSVRow(headers: string[], row: string[]): DiagnosticInput {
  const get = (col: string) => {
    const idx = headers.findIndex(
      (h) => h.trim().toLowerCase() === col.trim().toLowerCase()
    );
    return idx >= 0 ? (row[idx] || "").trim() : "";
  };
  const getMulti = (col: string) => {
    const val = get(col);
    return val ? val.split(",").map((s) => s.trim()) : [];
  };

  return {
    facilityName: get("Facility name"),
    facilityAddress: get("Facility address (city, state, zip)"),
    contactName: get("Best contact name"),
    contactEmail: get("Best email address"),
    contactPhone: get("Best phone number"),
    websiteUrl: get("Website URL"),
    role: get("What is your role?"),
    yearsManaged: get("How long have you owned or managed this facility?"),
    facilityAge: get("Is this a new build / lease-up or stabilized facility?"),
    facilityCount: get("Do you manage one facility or multiple?"),

    occupancy: get(
      "About where is your facility sitting today (overall occupancy)?"
    ),
    leasingMomentum: get(
      "How would you describe the facility's leasing momentum right now?"
    ),
    occupancyVs6Months: get("Compared to 6 months ago, occupancy is:"),
    occupancyVsLastYear: get(
      "Compared to the same time last year, occupancy is:"
    ),
    moveIns30Days: get(
      "Roughly how many move-ins have you had in the last 30 days?"
    ),
    moveOuts30Days: get("Roughly how many move-outs in the last 30 days?"),
    totalUnits: get("What is your total unit count (approximately)?"),

    unitTypesOffered: getMulti(
      "Which unit types does your facility offer? (select all)"
    ),
    bestRentingUnits: getMulti(
      "Which unit type is renting BEST right now? (select up to 3)"
    ),
    hardestToRentUnits: getMulti(
      "Which unit type is the HARDEST to rent right now? (select up to 3)"
    ),
    specificVacancyNotes: get(
      "Are there specific unit types or areas of the property you especially need to fill?"
    ),
    offlineUnits: get(
      "Do you have any units currently offline or unavailable for rent?"
    ),
    unitMixBalance: get(
      "Is your unit mix weighted heavily toward any one size?"
    ),

    biggerIssue: get("What feels like the bigger issue right now?"),
    leadSources: getMulti(
      "Where do most of your leads currently come from? (select all that apply)"
    ),
    weeklyInquiries: get(
      "Roughly how many rental inquiries (calls + online leads) do you get per week?"
    ),
    whyPeopleDontRent: get(
      "What do you think is happening most often with people who don't rent?"
    ),
    canReserveOnline: get(
      "Can a customer complete a reservation online (hold a unit)?"
    ),
    canRentFullyOnline: get(
      "Can a customer complete the FULL rental online without staff help (e-sign, pay, get access)?"
    ),
    onlineVsWalkIn: get(
      "What percentage of move-ins come from online reservations vs walk-in / call?"
    ),

    followUpConfidence: get(
      "When a lead comes in, how confident are you that follow-up happens well?"
    ),
    callsRecorded: get("Are inbound calls recorded or tracked?"),
    callTrackingSoftware: get("Do you use any call tracking software?"),
    missedCallProcess: get(
      "When someone calls and the office doesn't answer, what happens?"
    ),
    abandonedReservationFollowUp: get(
      "Do you follow up on abandoned online reservations (started but not completed)?"
    ),
    reservationNoShowProcess: get(
      "If someone reserves but doesn't move in within a few days, what happens?"
    ),
    phoneClosingAbility: get(
      "How would you rate your team's ability to close a rental over the phone?"
    ),

    currentMarketing: getMulti(
      "What marketing / advertising are you currently running? (select all)"
    ),
    monthlyAdSpend: get(
      "What is your approximate total monthly marketing / ad spend?"
    ),
    googleAdsPerformance: get(
      "If you run Google Ads, how would you describe the performance?"
    ),
    metaAdsPerformance: get(
      "If you run Facebook / Instagram ads, how would you describe performance?"
    ),
    knowsCostPerLead: get(
      "Do you know your cost per lead or cost per move-in from paid ads?"
    ),
    whoManagesMarketing: get("Who manages your marketing / ads?"),
    openToMetaAds: get(
      "Are you open to running paid Meta (Facebook / Instagram) ads to drive leads?"
    ),
    idealAdBudget: get(
      "What would be your ideal monthly ad budget range if the ROI was clear?"
    ),
    storageAgencyExperience: get(
      "Have you worked with a storage-specific marketing agency before?"
    ),

    websiteBuilder: get("Who built your website?"),
    lastWebsiteUpdate: get(
      "When was the last time your website was meaningfully updated?"
    ),
    showsLiveAvailability: get(
      "Does your website show real-time unit availability and pricing?"
    ),
    googleReviewCount: get(
      "Approximately how many Google reviews does your facility have?"
    ),
    googleRating: get("What is your approximate Google review rating?"),
    respondsToReviews: get("Do you actively respond to Google reviews?"),
    requestsReviews: get("Do you actively request reviews from tenants?"),
    gbpStatus: get(
      "Is your Google Business Profile (GBP) claimed and actively managed?"
    ),
    gbpPostFrequency: get(
      "Do you post updates, offers, or photos to your Google Business Profile regularly?"
    ),
    socialMedia: getMulti(
      "Which social media does your facility actively use? (select all)"
    ),

    pms: get("Which PMS / management software do you use?"),
    revenueManagementSoftware: get(
      "Do you use revenue management software (automated pricing)?"
    ),
    pricingPerception: get("Do you believe your pricing is generally:"),
    currentPromotions: get(
      "Are you currently running any move-in specials or promotions?"
    ),
    ecriStatus: get("Do you run ECRI (Existing Customer Rate Increases)?"),
    lastStreetRateIncrease: get(
      "When did you last raise street rates on any unit types?"
    ),
    pricingMethod: get("How do you typically decide on pricing?"),
    tenantProtection: get("Do you offer tenant protection / insurance?"),
    autopayPercentage: get(
      "Approximately what percentage of tenants are on autopay?"
    ),

    staffingModel: get("What is your staffing model?"),
    officeHours: get("What are your office hours?"),
    gateAccessHours: get("What are your gate / access hours?"),
    facilityCondition: get("How is your facility's physical condition?"),
    facilityAgeYears: get("Approximately how old is the facility?"),
    securityFeatures: getMulti(
      "Which security features does your facility have? (select all)"
    ),
    amenities: getMulti(
      "Which amenities does your facility offer? (select all)"
    ),
    recentRenovations: get(
      "Have you done any significant renovations or upgrades in the last 2 years?"
    ),

    topCompetitors: get(
      "Who are the top 3 competitors you watch most closely? (names or addresses)"
    ),
    competitorAdvantages: get(
      "What do you think those competitors are doing better than you?"
    ),
    yourAdvantages: get(
      "What does your facility do better than nearby competitors?"
    ),
    commonObjections: getMulti(
      "What objections do you hear most often from prospects? (select all)"
    ),
    newSupply: get(
      "Is there new supply (new facilities) being built in your market?"
    ),
    marketSaturation: get("How saturated do you believe your market is?"),

    vacancyReason: get(
      "What do you believe is the #1 reason your vacant units are still vacant?"
    ),
    unusualCircumstances: get(
      "Is there anything about your facility, market, or situation that's unusual or that we should know?"
    ),
    fixOneThingFirst: get(
      "If this diagnostic could fix only ONE thing, what should it fix first?"
    ),
    aggressiveness: get(
      "How aggressive are you willing to be if the audit shows changes are needed?"
    ),
    urgency: get("How soon are you looking to take action?"),
    openToPmsReports: get(
      "Would you be open to sending PMS reports afterward so we can validate with actual data?"
    ),
    howHeard: get("How did you hear about StorageAds?"),
    additionalNotes: get(
      "Anything else you want us to know before we review your facility?"
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  AI Audit Generation                                               */
/* ------------------------------------------------------------------ */

function buildAuditPrompt(d: DiagnosticInput): string {
  const occPct = OCCUPANCY_MAP[d.occupancy] || 75;
  const totalUnits = UNIT_COUNT_MAP[d.totalUnits] || 300;
  const vacantUnits = Math.round(totalUnits * (1 - occPct / 100));

  return `You are an elite self-storage marketing analyst who has audited 1,000+ facilities. Generate a comprehensive diagnostic audit for this facility based on their self-reported diagnostic form data, Google data, and competitive intelligence.

===== FACILITY PROFILE =====
Name: ${d.facilityName}
Address: ${d.facilityAddress}
Website: ${d.websiteUrl}
Contact: ${d.contactName} (${d.contactEmail})
Role: ${d.role}
Years Managing: ${d.yearsManaged}
Facility Stage: ${d.facilityAge}
Manages: ${d.facilityCount}

===== OCCUPANCY SNAPSHOT =====
Current Occupancy: ${d.occupancy} (~${occPct}%)
Leasing Momentum: ${d.leasingMomentum}
vs 6 Months Ago: ${d.occupancyVs6Months}
vs Last Year: ${d.occupancyVsLastYear}
Move-ins (30d): ${d.moveIns30Days}
Move-outs (30d): ${d.moveOuts30Days}
Total Units: ${d.totalUnits} (~${totalUnits})
Estimated Vacant: ${vacantUnits}

===== UNIT MIX =====
Types Offered: ${d.unitTypesOffered.join(", ")}
Best Renting: ${d.bestRentingUnits.join(", ")}
Hardest to Rent: ${d.hardestToRentUnits.join(", ")}
Specific Vacancy Notes: ${d.specificVacancyNotes || "None"}
Offline Units: ${d.offlineUnits}
Mix Balance: ${d.unitMixBalance}

===== LEAD FLOW & CONVERSION =====
Bigger Issue: ${d.biggerIssue}
Lead Sources: ${d.leadSources.join(", ")}
Weekly Inquiries: ${d.weeklyInquiries}
Why People Don't Rent: ${d.whyPeopleDontRent}
Can Reserve Online: ${d.canReserveOnline}
Can Rent Fully Online: ${d.canRentFullyOnline}
Online vs Walk-in: ${d.onlineVsWalkIn}

===== SALES & FOLLOW-UP =====
Follow-up Confidence: ${d.followUpConfidence}
Calls Recorded: ${d.callsRecorded}
Call Tracking: ${d.callTrackingSoftware}
Missed Call Process: ${d.missedCallProcess}
Abandoned Reservation Follow-up: ${d.abandonedReservationFollowUp}
No-Show Process: ${d.reservationNoShowProcess}
Phone Closing Ability: ${d.phoneClosingAbility}

===== MARKETING & AD SPEND =====
Currently Running: ${d.currentMarketing.join(", ")}
Monthly Ad Spend: ${d.monthlyAdSpend}
Google Ads Performance: ${d.googleAdsPerformance}
Meta Ads Performance: ${d.metaAdsPerformance}
Knows Cost Per Lead: ${d.knowsCostPerLead}
Who Manages Marketing: ${d.whoManagesMarketing}
Open to Meta Ads: ${d.openToMetaAds}
Ideal Budget: ${d.idealAdBudget}
Agency Experience: ${d.storageAgencyExperience}

===== DIGITAL PRESENCE =====
Website Builder: ${d.websiteBuilder}
Last Updated: ${d.lastWebsiteUpdate}
Live Availability: ${d.showsLiveAvailability}
Google Reviews: ${d.googleReviewCount}
Google Rating: ${d.googleRating}
Responds to Reviews: ${d.respondsToReviews}
Requests Reviews: ${d.requestsReviews}
GBP Status: ${d.gbpStatus}
GBP Post Frequency: ${d.gbpPostFrequency}
Social Media: ${d.socialMedia.join(", ") || "None"}
${d.scrapedGoogleRating ? `Actual Google Rating (scraped): ${d.scrapedGoogleRating}` : ""}
${d.scrapedReviewCount ? `Actual Review Count (scraped): ${d.scrapedReviewCount}` : ""}

===== REVENUE MANAGEMENT =====
PMS: ${d.pms}
Revenue Management Software: ${d.revenueManagementSoftware}
Pricing Perception: ${d.pricingPerception}
Current Promotions: ${d.currentPromotions}
ECRI Status: ${d.ecriStatus}
Last Street Rate Increase: ${d.lastStreetRateIncrease}
Pricing Method: ${d.pricingMethod}
Tenant Protection: ${d.tenantProtection}
Autopay %: ${d.autopayPercentage}

===== OPERATIONS =====
Staffing: ${d.staffingModel}
Office Hours: ${d.officeHours}
Gate Access: ${d.gateAccessHours}
Condition: ${d.facilityCondition}
Age: ${d.facilityAgeYears}
Security: ${d.securityFeatures.join(", ")}
Amenities: ${d.amenities.join(", ")}
Recent Renovations: ${d.recentRenovations}

===== COMPETITION =====
Top Competitors: ${d.topCompetitors}
What Competitors Do Better: ${d.competitorAdvantages}
What This Facility Does Better: ${d.yourAdvantages}
Common Objections: ${d.commonObjections.join(", ")}
New Supply: ${d.newSupply}
Market Saturation: ${d.marketSaturation}
${d.scrapedCompetitors?.length ? `\nScraped Competitor Data:\n${d.scrapedCompetitors.map((c, i) => `${i + 1}. ${c.name} — ${c.rating || "N/A"} rating (${c.reviewCount} reviews) — ${c.address}`).join("\n")}` : ""}

===== OPERATOR PRIORITIES =====
#1 Vacancy Reason: ${d.vacancyReason}
Unusual Circumstances: ${d.unusualCircumstances || "None stated"}
Fix One Thing First: ${d.fixOneThingFirst}
Aggressiveness: ${d.aggressiveness}
Urgency: ${d.urgency}
Open to PMS Reports: ${d.openToPmsReports}
Additional Notes: ${d.additionalNotes || "None"}

===== YOUR TASK =====

Generate a JSON object with EXACTLY this structure. Score each category 0-100 based on the data above. Be brutally honest but constructive. Every flag and action must reference specific data from above — no generic advice.

IMPORTANT SCORING GUIDELINES:
- Green flags = things this facility is already doing well (based on their answers)
- Yellow flag = an area that's okay but has clear room for improvement
- Red flags = critical problems that are actively costing them money or leads
- Actions must be specific, pragmatic, and immediately actionable with clear next steps
- "doNothingConsequence" = What SPECIFICALLY happens to this facility in 6-12 months if they ignore this category. Use real numbers from their data (vacancy rate, move-out pace, revenue loss). Make it visceral and financially painful — this is what sells the engagement.
- "inactionCost" = Estimated dollar amount this category is costing them per year if nothing changes. Be specific using their unit count, vacancy, rates, etc.

{
  "executiveSummary": "3-4 sentence executive overview of the facility's situation, biggest opportunities, and most urgent problems. Reference specific data points.",
  "industryBenchmarks": [
    {"metric": "Occupancy Rate", "facilityValue": "<this facility's value>", "industryAverage": "<REIT/industry average>", "topPerformers": "<top 25% value>", "gap": "<+/- difference from average>"},
    {"metric": "Revenue Per Square Foot", "facilityValue": "<estimated>", "industryAverage": "<industry avg>", "topPerformers": "<top 25%>", "gap": "<+/->"},
    {"metric": "Online Rental Capability", "facilityValue": "<Yes/No/Partial>", "industryAverage": "78% of facilities", "topPerformers": "Full e-rental", "gap": "<behind/ahead>"},
    {"metric": "ECRI Implementation", "facilityValue": "<Yes/No>", "industryAverage": "72% of facilities", "topPerformers": "6-8% annual increases", "gap": "<behind/ahead>"},
    {"metric": "Google Review Rating", "facilityValue": "<their rating>", "industryAverage": "4.2 stars", "topPerformers": "4.7+ stars", "gap": "<+/- stars>"},
    {"metric": "Autopay Adoption", "facilityValue": "<their %>", "industryAverage": "55%", "topPerformers": "75%+", "gap": "<+/- points>"},
    {"metric": "Revenue Management", "facilityValue": "<Manual/Automated>", "industryAverage": "48% automated", "topPerformers": "Fully dynamic", "gap": "<behind/ahead>"},
    {"metric": "Cost Per Lead", "facilityValue": "<estimated or Unknown>", "industryAverage": "$35-50", "topPerformers": "$15-25", "gap": "<estimated gap>"}
  ],
  "revenueOptimization": {
    "currentEstimatedRevenue": <estimated monthly revenue based on occupancy and rates>,
    "potentialMonthlyRevenue": <what they SHOULD earn at optimal occupancy + ECRI + tenant protection>,
    "monthlyGap": <difference>,
    "annualGap": <difference * 12>,
    "topOpportunities": [
      {"source": "name of revenue opportunity", "estimatedMonthlyGain": <dollar amount>, "timeToImplement": "X weeks", "difficulty": "easy|moderate|hard"},
      {"source": "...", "estimatedMonthlyGain": <number>, "timeToImplement": "...", "difficulty": "..."},
      {"source": "...", "estimatedMonthlyGain": <number>, "timeToImplement": "...", "difficulty": "..."},
      {"source": "...", "estimatedMonthlyGain": <number>, "timeToImplement": "...", "difficulty": "..."},
      {"source": "...", "estimatedMonthlyGain": <number>, "timeToImplement": "...", "difficulty": "..."}
    ]
  },
  "costOfInaction": {
    "monthlyBleed": <estimated total monthly revenue loss from all issues combined>,
    "projectedOccupancy6Months": "<projected occupancy % in 6 months if nothing changes>",
    "projectedOccupancy12Months": "<projected occupancy % in 12 months if nothing changes>",
    "competitorGapWidening": "1-2 sentences about how competitors will pull further ahead",
    "urgencyStatement": "1 sentence about seasonal timing, market windows, or why delay is expensive"
  },
  "ninetyDayProjection": {
    "ifYouAct": {
      "occupancyTarget": "<realistic occupancy target if they execute top recommendations>",
      "additionalMoveIns": <projected additional move-ins per month>,
      "revenueRecaptured": <monthly revenue recaptured>,
      "keyWins": ["specific win #1 in 30 days", "specific win #2 in 60 days", "specific win #3 in 90 days"]
    },
    "ifYouDont": {
      "occupancyProjection": "<where occupancy will be in 90 days>",
      "additionalMoveOuts": <projected net unit loss over 90 days>,
      "revenueLost": <additional revenue lost over 90 days>,
      "consequences": ["specific consequence #1", "specific consequence #2", "specific consequence #3"]
    }
  },
  "conversionFunnel": {
    "stages": [
      {"name": "Market Awareness", "status": "strong|weak|critical", "evidence": "1 sentence grounded in their data (ad spend, who runs marketing, GBP)", "leakPercentage": <0-100 estimate of how much potential demand is lost at this stage>},
      {"name": "Website / Online Discovery", "status": "strong|weak|critical", "evidence": "1 sentence (website freshness, online rental capability)", "leakPercentage": <0-100>},
      {"name": "Inquiry / Contact", "status": "strong|weak|critical", "evidence": "1 sentence (lead volume, call handling)", "leakPercentage": <0-100>},
      {"name": "Reservation", "status": "strong|weak|critical", "evidence": "1 sentence (follow-up, conversion)", "leakPercentage": <0-100>},
      {"name": "Move-In", "status": "strong|weak|critical", "evidence": "1 sentence (move-in vs move-out pace)", "leakPercentage": <0-100>}
    ],
    "biggestLeak": "Which single stage leaks the most, and why — name the stage",
    "narrative": "2-3 sentences walking a prospect through this facility's funnel and pinpointing where they fall out"
  },
  "operatorAlignment": {
    "accuracy": "accurate|partially_accurate|misdiagnosed",
    "operatorSaid": "What the operator named as their biggest issue / what they said they'd fix first (from their answers)",
    "auditFound": "What THIS audit identifies as the real top problem based on the data",
    "note": "1-2 sentences on whether the operator's self-diagnosis matches the data — honest but respectful, operator to operator"
  },
  "categories": [
    {
      "name": "Occupancy & Unit Mix",
      "slug": "occupancy",
      "score": <0-100>,
      "summary": "2-3 sentence assessment",
      "greenFlags": ["specific positive finding from data", "specific positive finding from data"],
      "yellowFlag": "specific concern from data",
      "redFlags": ["specific critical issue", "specific critical issue", "specific critical issue"],
      "doNothingConsequence": "2-3 sentences: what happens to occupancy, revenue, and competitive position in 6-12 months if they take zero action on this category. Use their actual move-in/move-out numbers to project forward.",
      "inactionCost": <estimated annual dollar cost of inaction for this category>,
      "actions": [
        {"title": "short action title", "detail": "specific actionable recommendation with exact steps", "priority": "high|medium|low"},
        {"title": "short action title", "detail": "specific actionable recommendation with exact steps", "priority": "high|medium|low"}
      ]
    },
    {
      "name": "Lead Generation",
      "slug": "lead-generation",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Sales & Follow-Up",
      "slug": "sales",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Marketing & Advertising",
      "slug": "marketing",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Digital Presence & Reputation",
      "slug": "digital-presence",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Revenue Management",
      "slug": "revenue",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Operations & Facility",
      "slug": "operations",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    },
    {
      "name": "Competitive Position",
      "slug": "competition",
      "score": <0-100>,
      "summary": "...",
      "greenFlags": ["...", "..."],
      "yellowFlag": "...",
      "redFlags": ["...", "...", "..."],
      "doNothingConsequence": "...",
      "inactionCost": <number>,
      "actions": [{"title": "...", "detail": "...", "priority": "..."}]
    }
  ]
}

CRITICAL RULES:
1. Each category MUST have exactly 2 green flags, exactly 1 yellow flag, exactly 3 red flags, and 2-4 actions.
2. Each category MUST have a doNothingConsequence (2-3 sentences, specific to their data) and inactionCost (dollar amount).
3. Reference the ACTUAL data from the diagnostic — not generic self-storage advice.
4. The costOfInaction and ninetyDayProjection sections are REQUIRED. Use their actual move-in/move-out pace, unit count, and occupancy to calculate real projections. If move-outs are outpacing move-ins, project that forward. If they have no ECRI, calculate lost revenue per existing tenant.
5. Actions must be things they can DO this week or this month — not vague strategies.
6. Use operator language: "move-ins" not "customers", "units" not "rooms", "street rate" not "price".
7. The doNothingConsequence should create URGENCY — paint a clear picture of the facility's trajectory if they ignore the findings. Reference competitors by name where provided.
8. inactionCost should be a realistic annual estimate based on their data (vacancy * rate * 12, lost ECRI revenue, wasted ad spend, etc.).
9. conversionFunnel: map the prospect's journey across all 5 stages. leakPercentage is your estimate of how much potential demand is lost at each stage (0 = no leak, higher = worse). Ground each status and evidence in their actual answers, and name the single worst stage in biggestLeak.
10. operatorAlignment: compare what the operator said is their biggest problem against what the data actually shows. Be honest but respectful — if they've misdiagnosed, say so plainly and point to the real issue. This is operator-to-operator, not a lecture.`;
}

async function generateWithAI(
  prompt: string
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 12000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export function generateSlug(facilityName: string): string {
  const base = (facilityName || "facility")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

/* ------------------------------------------------------------------ */
/*  CSV Parser (handles quoted fields)                                 */
/* ------------------------------------------------------------------ */

export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/* ------------------------------------------------------------------ */
/*  Route Handler                                                      */
/* ------------------------------------------------------------------ */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.EXPENSIVE_API, "audit-generate-diagnostic");
  if (limited) return limited;

  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const {
      diagnosticCsv,
      diagnosticJson,
      rowIndex,
      facilityId,
    } = body || {};

    let diagnostic: DiagnosticInput;

    if (diagnosticJson) {
      // Direct JSON input
      diagnostic = diagnosticJson as DiagnosticInput;
    } else if (diagnosticCsv) {
      // Parse CSV
      const lines = (diagnosticCsv as string).split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        return errorResponse("CSV must have header + at least 1 data row", 400, origin);
      }
      const headers = parseCSVLine(lines[0]);
      const dataIdx = Math.min(rowIndex || 1, lines.length - 1);
      const row = parseCSVLine(lines[dataIdx]);
      diagnostic = parseCSVRow(headers, row);
    } else {
      return errorResponse(
        "Provide diagnosticCsv or diagnosticJson",
        400,
        origin
      );
    }

    // Fetch scraped data if facilityId provided
    if (facilityId) {
      try {
        const facility = await db.facilities.findUnique({
          where: { id: facilityId },
        });
        if (facility) {
          if (facility.google_rating) {
            diagnostic.scrapedGoogleRating = Number(facility.google_rating);
          }
          if (facility.review_count) {
            diagnostic.scrapedReviewCount = facility.review_count;
          }
        }
      } catch {
        // Non-critical
      }
    }

    // Generate audit with AI
    const prompt = buildAuditPrompt(diagnostic);
    const aiResult = await generateWithAI(prompt);

    if (!aiResult) {
      return errorResponse("Failed to generate audit — check API key", 500, origin);
    }

    // Build full audit object
    const occPct = OCCUPANCY_MAP[diagnostic.occupancy] || 75;
    const totalUnits = UNIT_COUNT_MAP[diagnostic.totalUnits] || 300;
    const vacantUnits = Math.round(totalUnits * (1 - occPct / 100));
    const avgRate = 110;

    const categories = (aiResult.categories || []) as CategoryAudit[];
    const overallScore =
      categories.length > 0
        ? Math.round(
            categories.reduce((sum, c) => sum + (c.score || 0), 0) /
              categories.length
          )
        : 0;

    const industryBenchmarks = (aiResult.industryBenchmarks || []) as IndustryBenchmark[];
    const revenueOptimization = (aiResult.revenueOptimization || {}) as RevenueOptimization;
    const costOfInaction = (aiResult.costOfInaction || {}) as CostOfInaction;
    const ninetyDayProjection = (aiResult.ninetyDayProjection || {}) as NinetyDayProjection;
    const conversionFunnel = aiResult.conversionFunnel
      ? (aiResult.conversionFunnel as ConversionFunnel)
      : undefined;
    const operatorAlignment = aiResult.operatorAlignment
      ? (aiResult.operatorAlignment as OperatorAlignment)
      : undefined;

    const fullAudit: FullDiagnosticAudit = {
      generatedAt: new Date().toISOString(),
      facility: {
        name: diagnostic.facilityName,
        address: diagnostic.facilityAddress,
        contactName: diagnostic.contactName,
        contactEmail: diagnostic.contactEmail,
        websiteUrl: diagnostic.websiteUrl,
        occupancy: diagnostic.occupancy,
        totalUnits: diagnostic.totalUnits,
        facilityAge: diagnostic.facilityAge,
      },
      overallScore,
      overallGrade: letterGrade(overallScore),
      categories,
      executiveSummary: (aiResult.executiveSummary as string) || "",
      industryBenchmarks,
      revenueOptimization,
      costOfInaction,
      ninetyDayProjection,
      ...(conversionFunnel ? { conversionFunnel } : {}),
      ...(operatorAlignment ? { operatorAlignment } : {}),
      vacancyCost: {
        vacantUnits,
        monthlyLoss: vacantUnits * avgRate,
        annualLoss: vacantUnits * avgRate * 12,
        avgUnitRate: avgRate,
      },
    };

    // Save to shared_audits
    const slug = generateSlug(diagnostic.facilityName);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await db.shared_audits.create({
      data: {
        slug,
        facility_name: diagnostic.facilityName,
        audit_json: fullAudit as unknown as Prisma.InputJsonValue,
        views: 0,
        expires_at: expiresAt,
      },
    });

    // Also save to audits table if facilityId
    if (facilityId) {
      try {
        await db.audits.create({
          data: {
            facility_id: facilityId,
            audit_json: fullAudit as unknown as Prisma.InputJsonValue,
            overall_score: overallScore,
            grade: letterGrade(overallScore),
          },
        });

        await db.facilities.update({
          where: { id: facilityId },
          data: {
            pipeline_status: "audit_generated",
            shared_audit_slug: slug,
            updated_at: new Date(),
          },
        });
      } catch {
        // Non-critical
      }
    }

    const auditUrl = `https://storageads.com/audit/${slug}`;

    // Diagnostic emails via the canonical email layer (validates, retries,
    // honors EMAIL_DRY_RUN / EMAIL_REDIRECT_TO, skips cleanly when RESEND_API_KEY
    // is unset, dedups on idempotencyKey).
    const gradeText = letterGrade(overallScore);
    const annualVacancyCost = fullAudit.vacancyCost.annualLoss;
    const facilityNameSafe = escapeHtml(diagnostic.facilityName || "Your facility");
    const adminEmail = process.env.ADMIN_EMAIL || "blake@storageads.com";

    // Operator email — only when we captured an address to send it to.
    if (diagnostic.contactEmail) {
      const scoreColor =
        overallScore >= 80
          ? "#22c55e"
          : overallScore >= 60
            ? "#6a9bcc"
            : overallScore >= 40
              ? "#AB5505"
              : "#ef4444";
      const summaryExcerpt = escapeHtml((fullAudit.executiveSummary || "").slice(0, 300));

      const operatorHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #faf9f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #141413; font-size: 22px; font-weight: 700; margin: 0 0 8px;">Your Facility Diagnostic is Ready</h1>
      <p style="color: #6a6560; font-size: 14px; margin: 0;">${facilityNameSafe}</p>
    </div>

    <!-- Score Ring -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; width: 140px; height: 140px; position: relative;">
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="70" cy="70" r="62" fill="none" stroke="#e8e6dc" stroke-width="10"/>
          <circle cx="70" cy="70" r="62" fill="none" stroke="${scoreColor}" stroke-width="10"
            stroke-dasharray="${(overallScore / 100) * 2 * Math.PI * 62} ${2 * Math.PI * 62}"
            stroke-linecap="round" transform="rotate(-90 70 70)"/>
          <text x="70" y="62" text-anchor="middle" fill="#141413" font-size="36" font-weight="bold" dominant-baseline="middle">${overallScore}</text>
          <text x="70" y="88" text-anchor="middle" fill="#6a6560" font-size="12">/ 100 (${gradeText})</text>
        </svg>
      </div>
    </div>

    <!-- Executive Summary -->
    <div style="background-color: #ffffff; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #e8e6dc;">
      <h2 style="color: #141413; font-size: 16px; font-weight: 600; margin: 0 0 12px;">Executive Summary</h2>
      <p style="color: #6a6560; font-size: 14px; line-height: 1.6; margin: 0;">${summaryExcerpt}${(fullAudit.executiveSummary || "").length > 300 ? "..." : ""}</p>
    </div>

    <!-- Vacancy Cost Teaser -->
    ${annualVacancyCost > 0 ? `
    <div style="background-color: #fef2f2; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #fecaca;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 28px;">&#x26A0;&#xFE0F;</div>
        <div>
          <p style="color: #ef4444; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Estimated Vacancy Cost</p>
          <p style="color: #141413; font-size: 24px; font-weight: 700; margin: 0;">$${annualVacancyCost.toLocaleString()}<span style="color: #6a6560; font-size: 14px; font-weight: 400;">/year in lost revenue</span></p>
        </div>
      </div>
    </div>
    ` : ""}

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 40px;">
      <a href="${auditUrl}" style="display: inline-block; padding: 16px 40px; background-color: #141413; color: #faf9f5; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 10px;">View Your Full Diagnostic</a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #e8e6dc; padding-top: 24px;">
      <p style="color: #b0aea5; font-size: 12px; margin: 0;">Generated by <strong style="color: #141413;">StorageAds</strong> &middot; storageads.com</p>
      <p style="color: #b0aea5; font-size: 11px; margin: 8px 0 0;">This diagnostic report will remain accessible for 90 days.</p>
    </div>
  </div>
</body>
</html>`;

      void sendEmail({
        from: SENDERS.notifications,
        to: diagnostic.contactEmail,
        subject: `Your StorageAds Facility Diagnostic is Ready: ${diagnostic.facilityName}`,
        tags: [{ name: "type", value: "diagnostic_operator" }],
        idempotencyKey: `diagnostic-operator:${slug}`,
        html: operatorHtml,
      }).catch((err) => console.error("[audit-generate] operator email failed:", err));
    }

    // Always notify Blake that a diagnostic was generated — including quick
    // diagnostics with no operator email — so generation is visible in the funnel.
    void sendEmail({
      from: SENDERS.notifications,
      to: adminEmail,
      subject: `Audit Generated: ${diagnostic.facilityName} (Score: ${overallScore}/100)`,
      tags: [{ name: "type", value: "diagnostic_generated" }],
      idempotencyKey: `diagnostic-generated:${slug}`,
      html: `
            <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="margin: 0 0 12px; color: #141413;">Diagnostic Audit Generated</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Facility</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${facilityNameSafe}</strong></td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Score</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;"><strong>${overallScore}/100 (${gradeText})</strong></td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Contact</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">${escapeHtml(diagnostic.contactName || "N/A")} (${escapeHtml(diagnostic.contactEmail || "no email provided")})</td></tr>
                <tr><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5; color: #666;">Vacancy Cost</td><td style="padding: 8px 12px; border-bottom: 1px solid #e5e5e5;">$${annualVacancyCost.toLocaleString()}/yr</td></tr>
              </table>
              <p style="margin-top: 20px;">
                <a href="${auditUrl}" style="display: inline-block; padding: 12px 24px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600;">View Audit</a>
              </p>
            </div>`,
    }).catch((err) => console.error("[audit-generate] admin notify failed:", err));

    return jsonResponse(
      {
        success: true,
        slug,
        auditUrl,
        overallScore,
        overallGrade: letterGrade(overallScore),
        categoryCount: categories.length,
        audit: fullAudit,
      },
      200,
      origin
    );
  } catch (e) {
    console.error("Diagnostic audit error:", e);
    return errorResponse("Internal server error", 500, origin);
  }
}
