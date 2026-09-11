/**
 * Static fixture for the public "See a sample diagnostic report" link.
 *
 * Synthesized for a fictional rural SW-Michigan combo storage/U-Haul dealer.
 * Numbers are plausible for that profile but are not derived from any real
 * business. Visitor sees an amber banner indicating this is a sample.
 *
 * Lives in /lib (not the DB) so it never expires, never inflates view counts,
 * never triggers admin "first view" or "hot lead" emails, and renders even if
 * the audit-load API or database is unreachable.
 */

export interface SampleCategoryAudit {
  name: string;
  slug: string;
  score: number;
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

export interface SampleAuditData {
  audit: {
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
    executiveSummary: string;
    categories: SampleCategoryAudit[];
    vacancyCost: {
      vacantUnits: number;
      monthlyLoss: number;
      annualLoss: number;
      avgUnitRate: number;
    };
    industryBenchmarks: Array<{
      metric: string;
      facilityValue: string;
      industryAverage: string;
      topPerformers: string;
      gap: string;
    }>;
    revenueOptimization: {
      currentEstimatedRevenue: number;
      potentialMonthlyRevenue: number;
      monthlyGap: number;
      annualGap: number;
      topOpportunities: Array<{
        source: string;
        estimatedMonthlyGain: number;
        timeToImplement: string;
        difficulty: "easy" | "moderate" | "hard";
      }>;
    };
    costOfInaction: {
      monthlyBleed: number;
      projectedOccupancy6Months: string;
      projectedOccupancy12Months: string;
      competitorGapWidening: string;
      urgencyStatement: string;
    };
    ninetyDayProjection: {
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
    };
    conversionFunnel?: {
      stages: Array<{
        name: string;
        status: "strong" | "weak" | "critical";
        evidence: string;
        leakPercentage: number;
      }>;
      biggestLeak: string;
      narrative: string;
    };
    operatorAlignment?: {
      accuracy: "accurate" | "partially_accurate" | "misdiagnosed";
      operatorSaid: string;
      auditFound: string;
      note: string;
    };
  };
  facilityName: string;
  createdAt: string;
  expiresAt: string;
  views: number;
}

const FACILITY_NAME = "Northline Self Storage & U-Haul";

const CATEGORIES: SampleCategoryAudit[] = [
  {
    name: "Occupancy & Unit Mix",
    slug: "occupancy",
    score: 78,
    summary:
      "Physical occupancy of 79% trails the 87% Midwest market average. 5x10s and 10x10s are essentially full, but a surplus of 10x20 inventory at 62% occupancy is driving most of the vacancy gap.",
    greenFlags: [
      "Climate-controlled units running at 91% occupancy, strong demand for the premium product",
      "Move-in pace of 6 per month exceeds the typical rural-Michigan facility benchmark of 4–5",
    ],
    yellowFlag:
      "Large-unit segment (10x20, 10x25) has 14 units vacant, either overbuilt for the rural Mattawan market or under-marketed to the right customer (contractors, U-Haul one-way movers, boat/RV owners).",
    redFlags: [
      "28 vacant units bleeding $2,576 every month while paid acquisition spend is $0",
      "No waitlist for 5x10 or 10x10 despite both sizes being at 96%+ occupancy. Captured demand is walking out the door",
      "Net unit growth is -1 per month (6 in, 7 out). The facility is quietly shrinking, not filling",
    ],
    doNothingConsequence:
      "At the current -1/month net pace, another 12 units will go vacant over the next 12 months and physical occupancy will fall to roughly 70%. Monthly vacancy bleed grows from $2,576 to roughly $3,400 by Q4.",
    inactionCost: 30912,
    actions: [
      {
        title: "Stand up a waitlist for the full unit sizes",
        detail:
          "Add a 'Notify me when available' form for 5x10 and 10x10 sizes on the site, capture phone + email, and text-blast the waitlist the moment a unit vacates. Comparable facilities convert 18–22% of waitlist sign-ups into rentals within 60 days.",
        priority: "high",
      },
      {
        title: "Reposition the 10x20 surplus to contractors + RV/boat",
        detail:
          "Run a 15-mile-radius Facebook campaign targeting contractors (carpenters, electricians, landscapers) plus boat and RV owners. Bundle large-unit storage with U-Haul truck rentals for one-way movers needing 30-day overflow.",
        priority: "medium",
      },
      {
        title: "Audit unit mix against actual demand",
        detail:
          "Pull 24 months of move-in data. If 5x10s fill on the day they vacate while 10x20s sit 90+ days, partition 4–6 of the surplus large units into doubles. Cost is roughly $800/unit; payback is under 6 months at $92/month rate.",
        priority: "low",
      },
    ],
  },
  {
    name: "Lead Generation",
    slug: "lead-generation",
    score: 60,
    summary:
      "Zero paid acquisition. Inbound leads are entirely organic: drive-bys, U-Haul referrals, and the handful of monthly Google searches that happen to land on the GBP. Estimated 8–10 leads per month in a market that should be producing 25–30.",
    greenFlags: [
      "U-Haul dealer status produces a steady trickle of foot-traffic leads (~3–4 per month)",
      "Google Business Profile is claimed and verified. The basic foundation is in place",
    ],
    yellowFlag:
      "No tracked phone number or web form on the GBP. Even the organic leads that do arrive can't be attributed or measured. You can't fix what you can't see.",
    redFlags: [
      "$0 in monthly paid acquisition spend in a market where Extra Space and CubeSmart are spending $1,500–$3,000 per month",
      "No retargeting pixel, no Meta or Google tag on the website. Every prospect who doesn't convert on the first visit is gone forever",
      "Website contact form sends to a generic Gmail inbox with no auto-response, no SMS notification, and no follow-up sequence",
    ],
    doNothingConsequence:
      "With Extra Space, CubeSmart, and U-Stor all running paid in the Kalamazoo corridor, your share of voice keeps dropping. Every quarter without paid acquisition is roughly 20–30 missed move-ins you'll never recover.",
    inactionCost: 28800,
    actions: [
      {
        title: "Launch Google Ads + LSA in the Mattawan/Paw Paw/Kalamazoo corridor",
        detail:
          "Start at $1,200/month targeting 'storage near me' plus competitor brand terms. Based on Kalamazoo market data, expect 18–24 qualified leads per month at a $50–65 CPL within the first 60 days.",
        priority: "high",
      },
      {
        title: "Install Meta + Google tracking on the website",
        detail:
          "Drop the Meta pixel and Google Tag Manager in the site head. Build a 90-day retargeting audience for anyone who viewed the rates page but didn't reserve. Retargeting alone typically recovers 8–12% of bounced traffic.",
        priority: "high",
      },
      {
        title: "Replace the Gmail contact form with a real CRM + auto-responder",
        detail:
          "Web inquiries should hit a CRM with a 30-second auto-reply, an immediate manager SMS, and a 4-touch follow-up over 7 days. Today, leads sit unanswered for hours. The prospect rents from the next facility on the list.",
        priority: "medium",
      },
    ],
  },
  {
    name: "Sales & Follow-Up",
    slug: "sales",
    score: 64,
    summary:
      "Inquiries that don't convert on first contact are effectively dead. There's no follow-up cadence, no abandoned-reservation recovery, and no win-back. Top-performing operators recover 15–20% of bounced inquiries through structured follow-up; this facility is recovering near zero.",
    greenFlags: [
      "Manager answers the phone during business hours. Baseline responsiveness is intact",
      "U-Haul counter staff cross-sell storage informally when customers ask about long-distance moves",
    ],
    yellowFlag:
      "No after-hours coverage. Calls between 6pm and 8am go to voicemail and most never get a callback, especially on weekends, when 40% of self-storage decisions actually happen.",
    redFlags: [
      "Zero abandoned-reservation recovery. Prospects who start but don't finish online don't hear from you again",
      "Zero structured follow-up on inbound calls that didn't rent. Calling back within 24 hours converts those at 20%+",
      "No call recording or scoring, so the actual inbound conversion rate is unknown, likely 22–25% vs. a top-quartile of 38–45%",
    ],
    doNothingConsequence:
      "Of roughly 100 inquiries over the next 12 months, current handling converts 25–30. Structured follow-up alone would push that to 45–50. The other 15–20 move-ins are quietly walking to competitors who do call back.",
    inactionCost: 22080,
    actions: [
      {
        title: "Stand up an abandoned-reservation drip sequence",
        detail:
          "Anyone who starts but doesn't complete an online reservation: SMS within 5 minutes, email at 1 hour, manager call attempt at 4 hours, last-chance email at 48 hours. Industry recovery rate is 18–25%.",
        priority: "high",
      },
      {
        title: "Add after-hours call routing",
        detail:
          "Either a virtual receptionist (Smith.ai or similar, ~$300/month) or structured voicemail-to-text feeding an 8am callback queue. Either way: 100% of inbound calls get a human response within 12 hours.",
        priority: "high",
      },
      {
        title: "Record and score every inbound call",
        detail:
          "CallRail (~$45/month) records every call and AI-scores conversion. Use the data to coach the manager on objection handling. Most rural facilities can move from 22% to 35% inbound conversion within 90 days of starting this.",
        priority: "medium",
      },
    ],
  },
  {
    name: "Marketing & Advertising",
    slug: "marketing",
    score: 58,
    summary:
      "No active marketing beyond yellow-pages-era roadside signage and the U-Haul dealer placement. Every prospect arrives by accident: no campaigns, no seasonal promotions, no community presence, no referral program, no social.",
    greenFlags: [
      "U-Haul co-branded signage drives steady free brand impressions to Cole Ave traffic",
      "Roadside sign with phone number is visible from the road. A baseline lead source is in place",
    ],
    yellowFlag:
      "No seasonal campaigns. The May–September moving peak is when 60% of self-storage decisions happen, and this facility is functionally invisible during it.",
    redFlags: [
      "Zero brand presence on Facebook, Instagram, TikTok, or YouTube. Competitors are running $400–800/month in video ads",
      "No tenant referral program. Your highest-converting channel (word of mouth) is uninstrumented and unrewarded",
      "No partnerships with local realtors, movers, or apartment complexes. Those channels feed Kalamazoo competitors for ~$50 per referral",
    ],
    doNothingConsequence:
      "Without seasonal marketing live by April, the May–September moving peak gets missed again. That's 18–25 move-ins walking directly to Kalamazoo competitors, or roughly $20–25K in first-year revenue gone.",
    inactionCost: 24000,
    actions: [
      {
        title: "Build a 6-month seasonal campaign calendar",
        detail:
          "Snowbird storage (Oct–Nov), holiday overflow (Dec), spring cleaning (Mar–Apr), college move-out (May), peak moving (Jun–Aug), back-to-school RV/boat (Sept). Each gets a landing page, ad creative, and email/SMS sequence.",
        priority: "high",
      },
      {
        title: "Launch a tenant referral program",
        detail:
          "$50 account credit to the referrer plus a free first month to the referred party. Promote at the U-Haul counter, in the monthly invoice email, and on gate signage. Expect 4–7 referrals per month at full ramp.",
        priority: "medium",
      },
      {
        title: "Partner with 3 local realtors + 2 apartment complexes",
        detail:
          "Offer a co-branded $25 storage credit to anyone moving in or out of their property. Mattawan and Paw Paw realtors handle 200+ moves per year combined. A 10% capture rate is 20 move-ins.",
        priority: "medium",
      },
      {
        title: "Start a low-volume Facebook + Instagram presence",
        detail:
          "Two posts per week: behind-the-scenes facility, U-Haul rental tips, customer spotlights, seasonal storage tips. The goal isn't followers. It's showing up in local search and giving prospects social proof.",
        priority: "low",
      },
    ],
  },
  {
    name: "Digital Presence & Reputation",
    slug: "digital-presence",
    score: 70,
    summary:
      "GBP is claimed but neglected. 14 reviews at 4.1 stars against competitors carrying 60+ reviews at 4.5+ stars. The website is functional but dated, with no live unit availability and no online reservation. Visible online but not winning the click.",
    greenFlags: [
      "4.1-star GBP rating is above the 3.8 industry floor. Base reputation is acceptable",
      "Website is mobile-responsive and loads under 3 seconds. The technical baseline is fine",
    ],
    yellowFlag:
      "GBP has had no posts, no new photos, and no Q&A engagement for 8+ months. Google ranks active profiles materially higher in the local pack.",
    redFlags: [
      "14 reviews vs. CubeSmart Kalamazoo's 287 and Extra Space's 412. Review volume is the single biggest local-SEO signal and you're losing it badly",
      "Website has no live unit availability, no displayed rates, and no online reservation. Prospects compare you to one-click competitors and bounce",
      "No LocalBusiness schema.org markup on the site. Search engines can't parse hours, address, or rates into rich results",
    ],
    doNothingConsequence:
      "Every month without active review solicitation, the gap to Kalamazoo competitors widens. By Q4 the facility will be effectively invisible in 'storage near me' map-pack results within a 12-mile radius, roughly 70% of your addressable market.",
    inactionCost: 18000,
    actions: [
      {
        title: "Launch a review-solicitation campaign",
        detail:
          "Text every new move-in 7 days after they rent with a direct Google review link. Goal: 4 new reviews per month. At a 90% positive ratio, you'll be at 50+ reviews and 4.4+ stars within 12 months.",
        priority: "high",
      },
      {
        title: "Rebuild the website with live availability + online rental",
        detail:
          "Modern PMS platforms (storEDGE, SiteLink, easyStorage) push live unit availability into a website widget. Add online reservation to capture the 35% of prospects who refuse to call.",
        priority: "high",
      },
      {
        title: "Post to GBP weekly",
        detail:
          "Photos (gate, units, U-Haul trucks), updates (rate changes, promotions, hours), and Q&A responses. Even one post per week moves local-pack rankings inside 60 days.",
        priority: "medium",
      },
    ],
  },
  {
    name: "Revenue Management",
    slug: "revenue",
    score: 66,
    summary:
      "Street rate hasn't moved in 26 months. No existing-customer rate increases in 18+ months. Insurance attach rate is 14% versus an industry top quartile of 80%+. Multiple revenue levers are sitting idle while costs keep climbing.",
    greenFlags: [
      "Delinquency rate of 3.2% is below the 5.1% industry average. Collections discipline is solid",
      "Auctions run quarterly and recover roughly $1,200 per cycle. The process is mature",
    ],
    yellowFlag:
      "Average tenancy is 14 months but most tenants haven't seen a single rate increase during their entire stay. Every existing tenant is paying below current market.",
    redFlags: [
      "No ECRI program. 30+ tenants are paying 2022 rates while street rate is up 8–12%. A conservative 6% increase on tenured units is $480/month recurring left on the table",
      "Tenant insurance attach rate is 14% vs. industry standard 60–90%. Each policy nets ~$8 margin × ~50 missed policies = $400/month forgone",
      "Late fees are collected on roughly 60% of actual delinquencies because enforcement is discretionary, another $200–300/month walking out",
    ],
    doNothingConsequence:
      "Every month without ECRI is permanent. Those tenants eventually move out and the rate-raise window closes for good. At current pace you'll forgo roughly $5,700 in rate revenue this year plus another $4,800 in unrealized insurance attach.",
    inactionCost: 13200,
    actions: [
      {
        title: "Run an ECRI cycle on all 30+ tenured units",
        detail:
          "6% increase on anyone at the facility 12+ months, communicated 45 days in advance. Industry churn on ECRI is under 8%. Net effect after attrition is +$450/month recurring.",
        priority: "high",
      },
      {
        title: "Mandate insurance acceptance at move-in",
        detail:
          "Update the lease to require either tenant-provided proof of coverage or enrollment in the facility's insurance program. Push attach rate from 14% to 75%+ within 6 months as new tenants come in.",
        priority: "high",
      },
      {
        title: "Automate late-fee enforcement",
        detail:
          "PMS auto-applies late fees on day 6 and lockout on day 15 with no manager discretion. Current discretion is costing $200–300 every month in skipped fees.",
        priority: "medium",
      },
    ],
  },
  {
    name: "Operations & Facility",
    slug: "operations",
    score: 88,
    summary:
      "Facility is well-maintained, gate access is reliable, lighting is good, and the U-Haul integration runs smoothly. Operational discipline is a clear strength. This is one of the few categories not actively bleeding revenue.",
    greenFlags: [
      "Gate access system is functional with 24/7 keypad entry and no recent failures or service complaints",
      "Property is clean, well-lit, and well-signed. The manager runs a tight operation",
    ],
    yellowFlag:
      "Facility is 15 years old. Original asphalt and perimeter fencing are due for refresh within 24 months. Capex planning should start now rather than at the moment of failure.",
    redFlags: [
      "No security cameras at the front gate or on drive lanes. Single biggest liability gap and the most common driver of catastrophic 1-star reviews after a break-in",
      "Office hours are M–F 9–5 only, missing the ~30% of prospects who want to tour evenings or weekends",
      "No automated vacate process. Tenants must call the manager to vacate, which delays unit turn and creates manual reconciliation work every month",
    ],
    doNothingConsequence:
      "The camera gap is the highest-risk item in the audit. One break-in incident typically generates 4–6 negative reviews that erase 18 months of reputation work, and direct costs (claims, lost tenants, review damage) run $15–30K.",
    inactionCost: 9000,
    actions: [
      {
        title: "Install a 4-camera IP security system",
        detail:
          "Modern cloud-recorded IP cameras run $1,200–1,800 installed at the gate and drive lanes. Pays for itself the first time a tenant tries to dispute a break-in claim, and forecloses the catastrophic-review scenario.",
        priority: "high",
      },
      {
        title: "Extend office availability via kiosk or virtual manager",
        detail:
          "OpenTech IoE, Insomniac, or similar provides 24/7 virtual move-in via kiosk for ~$300/month. Or extend manager coverage to Saturday 9–2. Either way, stop turning away weekend prospects.",
        priority: "medium",
      },
      {
        title: "Build a 24-month capex plan",
        detail:
          "Asphalt refresh ($18–25K), perimeter fence ($12–15K), exterior paint ($6–8K). Spread the work across 8 quarters with a quarterly reserve set-aside so the year of the refresh isn't a cash-flow shock.",
        priority: "low",
      },
    ],
  },
  {
    name: "Competitive Position",
    slug: "competition",
    score: 82,
    summary:
      "Mattawan/Paw Paw market has only 2 direct competitors within 8 miles and neither is a REIT. Kalamazoo (12 miles east) has Extra Space and CubeSmart marketing aggressively into your radius, but local geography still favors you for Mattawan/Lawton/Decatur customers.",
    greenFlags: [
      "No REIT competitor within 8 miles. Local pricing power is intact",
      "U-Haul dealer status is a defensible moat. Only one U-Haul dealer per zip and you have it",
    ],
    yellowFlag:
      "Two new self-storage development permits were filed in Van Buren County in the last 12 months. Local supply could grow 15–20% over the next 18–24 months.",
    redFlags: [
      "Extra Space Kalamazoo bids on 'storage Mattawan' and 'storage Paw Paw' in Google Ads. They are intercepting prospects in your own backyard",
      "CubeSmart's Kalamazoo location has 287 Google reviews and a 4.6 rating. They win the trust comparison every time a Mattawan prospect comparison-shops",
      "Your street rate is 6–9% below the Kalamazoo market. That trains prospects to expect rural pricing, then you lose them anyway when life pulls them toward Kalamazoo",
    ],
    doNothingConsequence:
      "When the two permitted facilities come online in 12–18 months, your Mattawan/Paw Paw market share will erode unless paid acquisition, review volume, and brand presence are built now. Defending share is 3–5x cheaper than recapturing it after a new entrant lands.",
    inactionCost: 16000,
    actions: [
      {
        title: "Bid defensively on competitor brand terms",
        detail:
          "Run Google Ads on 'Extra Space Kalamazoo' and 'CubeSmart Kalamazoo'. Anyone within 12 miles searching those terms is your customer if you can land rural-Michigan pricing in front of them.",
        priority: "high",
      },
      {
        title: "Build a 'why local beats big-box' content angle",
        detail:
          "Owner-operator vs. corporate, free U-Haul integration, a manager who knows your name. Bake this positioning into website copy, GBP posts, and Facebook content. It's a story the REITs structurally can't tell.",
        priority: "medium",
      },
      {
        title: "Track the two permitted facilities monthly",
        detail:
          "Watch site work, hiring activity, and signage at the permitted addresses. The moment construction starts, accelerate review solicitation and lock current tenants into 12–24 month leases at slightly favorable rates.",
        priority: "low",
      },
    ],
  },
];

function buildSampleAudit(): SampleAuditData {
  const now = Date.now();
  const createdAt = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString();
  const overallScore = Math.round(
    CATEGORIES.reduce((sum, c) => sum + c.score, 0) / CATEGORIES.length,
  );

  return {
    audit: {
      generatedAt: createdAt,
      facility: {
        name: FACILITY_NAME,
        address: "24560 Cole Ave, Mattawan, MI 49071",
        contactName: "Sample Owner",
        contactEmail: "owner@example.com",
        websiteUrl: "https://example.com",
        occupancy: "79%",
        totalUnits: "135",
        facilityAge: "15 years",
      },
      overallScore,
      overallGrade: "C",
      executiveSummary:
        "Northline Self Storage & U-Haul has a strong physical asset and a defensible local moat, but the marketing and revenue-management muscle isn't built, and it's costing roughly $2,576/month in vacancy plus another $1,000+/month in unrealized rate and insurance revenue. Lead generation is effectively unfunded, follow-up systems don't exist, and the Google review gap to Kalamazoo competitors is widening every month. Every issue is fixable in 90 days with a structured plan; doing nothing means dropping from 79% to 73% occupancy by Q4 while two newly permitted competitors prepare to come online within 18 months.",
      categories: CATEGORIES,
      vacancyCost: {
        vacantUnits: 28,
        avgUnitRate: 92,
        monthlyLoss: 2576,
        annualLoss: 30912,
      },
      industryBenchmarks: [
        {
          metric: "Physical Occupancy",
          facilityValue: "79%",
          industryAverage: "87%",
          topPerformers: "93%",
          gap: "-8 pts",
        },
        {
          metric: "Google Reviews",
          facilityValue: "14 @ 4.1★",
          industryAverage: "62 @ 4.4★",
          topPerformers: "200+ @ 4.7★",
          gap: "-48 reviews",
        },
        {
          metric: "Insurance Attach Rate",
          facilityValue: "14%",
          industryAverage: "65%",
          topPerformers: "88%",
          gap: "-51 pts",
        },
        {
          metric: "Monthly Lead Volume",
          facilityValue: "~10",
          industryAverage: "28",
          topPerformers: "52",
          gap: "-18/mo",
        },
        {
          metric: "Lead → Move-In Conversion",
          facilityValue: "~24%",
          industryAverage: "35%",
          topPerformers: "48%",
          gap: "-11 pts",
        },
        {
          metric: "Avg Street Rate (10x10)",
          facilityValue: "$92",
          industryAverage: "$108",
          topPerformers: "$124",
          gap: "-$16/mo",
        },
        {
          metric: "Paid Ad Spend",
          facilityValue: "$0",
          industryAverage: "$1,800",
          topPerformers: "$4,200",
          gap: "behind",
        },
        {
          metric: "ECRI Cycles per Year",
          facilityValue: "0",
          industryAverage: "1.2",
          topPerformers: "2",
          gap: "behind",
        },
      ],
      revenueOptimization: {
        currentEstimatedRevenue: 9844,
        potentialMonthlyRevenue: 12400,
        monthlyGap: 2556,
        annualGap: 30672,
        topOpportunities: [
          {
            source: "ECRI 6% on tenured units (30+)",
            estimatedMonthlyGain: 420,
            timeToImplement: "30 days",
            difficulty: "easy",
          },
          {
            source: "Paid search + LSA in Mattawan/Paw Paw/Kalamazoo corridor",
            estimatedMonthlyGain: 1100,
            timeToImplement: "60 days",
            difficulty: "moderate",
          },
          {
            source: "Reactivate dormant leads from past 12 months",
            estimatedMonthlyGain: 380,
            timeToImplement: "30 days",
            difficulty: "easy",
          },
          {
            source: "Tenant insurance attach (14% → 75%)",
            estimatedMonthlyGain: 250,
            timeToImplement: "30 days",
            difficulty: "easy",
          },
          {
            source: "U-Haul counter cross-sell to storage",
            estimatedMonthlyGain: 420,
            timeToImplement: "60 days",
            difficulty: "moderate",
          },
        ],
      },
      costOfInaction: {
        monthlyBleed: 2576,
        projectedOccupancy6Months: "73%",
        projectedOccupancy12Months: "67%",
        competitorGapWidening:
          "Extra Space and CubeSmart Kalamazoo each run aggressive Google Ads and carry 200+ reviews at 4.6+ stars. Every prospect searching 'storage near Mattawan' is intercepted before they ever see your listing, and the review gap compounds every month it isn't closed.",
        urgencyStatement:
          "At the current move-out pace (~4–5/month) and $0 paid acquisition, you'll bleed roughly $31K in vacancy this year plus another $18K in undermarket rates and forgone insurance. Every month without a fix is roughly $4K gone, permanently.",
      },
      ninetyDayProjection: {
        ifYouAct: {
          occupancyTarget: "87%",
          additionalMoveIns: 8,
          revenueRecaptured: 2400,
          keyWins: [
            "Reactivate 24+ dormant leads from the past 12 months and convert 4–6 to move-ins from inquiries already in the CRM",
            "Google Ads + LSA live across the Mattawan/Paw Paw/Kalamazoo corridor producing 18–24 leads/month",
            "Hit 87% physical occupancy with ECRI on 30+ tenured units adding $450/month in recurring revenue",
          ],
        },
        ifYouDont: {
          occupancyProjection: "73%",
          additionalMoveOuts: 8,
          revenueLost: 9700,
          consequences: [
            "Net unit count drops by another 8 over 90 days. Vacancy bleed grows from $2,576 to $3,100+ per month",
            "$9,700 in lost revenue compounds because every undermarket tenant who stays is another month of rate revenue left on the table",
            "Extra Space and CubeSmart Kalamazoo widen the review-volume gap, pushing your listing further down the local map pack and out of consideration",
          ],
        },
      },
      conversionFunnel: {
        stages: [
          {
            name: "Market Awareness",
            status: "critical",
            evidence:
              "$0 paid acquisition and no Google Ads. Prospects searching 'storage near Mattawan' never see you.",
            leakPercentage: 70,
          },
          {
            name: "Website / Online Discovery",
            status: "weak",
            evidence:
              "Site hasn't been updated in 18+ months and has no online reservation. Visitors can't self-serve.",
            leakPercentage: 45,
          },
          {
            name: "Inquiry / Contact",
            status: "weak",
            evidence:
              "Inbound calls go to voicemail after hours with no callback workflow, so off-hours inquiries die.",
            leakPercentage: 35,
          },
          {
            name: "Reservation",
            status: "weak",
            evidence:
              "24+ dormant leads sit in the CRM with no follow-up sequence reactivating them.",
            leakPercentage: 30,
          },
          {
            name: "Move-In",
            status: "strong",
            evidence:
              "Once a prospect reaches the counter, close rate is healthy. The front desk converts well.",
            leakPercentage: 10,
          },
        ],
        biggestLeak:
          "Market Awareness: with $0 paid spend, ~70% of in-market demand never even reaches your listing, so every downstream stage is starved before it starts.",
        narrative:
          "A renter in Mattawan searches 'storage near me,' sees Extra Space and CubeSmart's ads and 200+ reviews first, and books before your listing ever loads. The few who do find you hit a stale site with no online reservation, then a voicemail after hours. Your counter staff close well, but almost no one makes it that far.",
      },
      operatorAlignment: {
        accuracy: "misdiagnosed",
        operatorSaid:
          "Owner believes the core problem is too much large-unit (10x20) inventory for a rural market.",
        auditFound:
          "The unit mix is a real but secondary issue. The primary leak is zero top-of-funnel demand capture: $0 paid acquisition and no online reservation path.",
        note:
          "Filling those 10x20s matters, but you can't fill what never finds you. Fix the demand and discovery leaks first and the large-unit vacancy starts closing as a byproduct.",
      },
    },
    facilityName: FACILITY_NAME,
    createdAt,
    expiresAt,
    views: 0,
  };
}

export function getSampleAuditData(): SampleAuditData {
  return buildSampleAudit();
}

export const SAMPLE_AUDIT_SLUG = "sample";
