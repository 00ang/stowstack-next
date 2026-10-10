/**
 * A short diagnostic for a made-up facility, shaped like a thin intake.
 * Not a client. Not a result. Dollar fields are 0 because no street rate
 * was given.
 */

export const SAMPLE_INTAKE_SLUG = "sample-intake";

export function getSampleIntakeAudit() {
  return {
    audit: {
      generatedAt: "2026-10-10T00:00:00.000Z",
      facility: {
        name: "Sample Facility (not a real lead)",
        address: "Sample town",
        contactName: "Sample Operator",
        contactEmail: "sample@example.com",
        websiteUrl: "",
        occupancy: "70–79%",
        totalUnits: "200–349",
        facilityAge: "Open and stabilized (3+ years)",
      },
      overallScore: 0,
      overallGrade: "n/a",
      categories: [
        {
          name: "What you told us",
          slug: "what-you-told-us",
          score: 0,
          grade: "n/a",
          summary:
            "Sample Facility is open, about 200 to 349 units, sitting in the 70 to 79 percent band. Move-outs have been matching move-ins. The owner says there are not enough leads. That is all we were told.",
          greenFlags: ["The owner can decide.", "The facility is open and renting."] as [string, string],
          yellowFlag: "Move-outs are keeping up with move-ins, so ads are only half the story.",
          redFlags: [
            "No street rate, so there is no dollar figure.",
            "No move-in count, only the comparison.",
            "No website was given.",
          ] as [string, string, string],
          doNothingConsequence: "We were not given enough to project a year from now.",
          inactionCost: 0,
          actions: [
            {
              title: "Count the last 30 days",
              detail: "Move-ins and move-outs, as numbers, before anyone spends on ads.",
              priority: "high" as const,
            },
          ],
        },
      ],
      executiveSummary:
        "This is a sample for a facility that does not exist. An owner with one open site, 200 to 349 units, occupancy in the 70s, and move-outs matching move-ins. They want more leads this month. We were not given a street rate, a website, or a real move-in count, so this note does not estimate money.",
      industryBenchmarks: [],
      revenueOptimization: {
        currentEstimatedRevenue: 0,
        potentialMonthlyRevenue: 0,
        monthlyGap: 0,
        annualGap: 0,
        topOpportunities: [],
      },
      costOfInaction: {
        monthlyBleed: 0,
        projectedOccupancy6Months: "Unknown",
        projectedOccupancy12Months: "Unknown",
        competitorGapWidening: "Not enough was given to say.",
        urgencyStatement: "They said this month. The dollar cost of waiting was not calculated.",
      },
      ninetyDayProjection: {
        ifYouAct: {
          occupancyTarget: "Unknown",
          additionalMoveIns: 0,
          revenueRecaptured: 0,
          keyWins: ["Get a real unit count.", "Get a street rate.", "See where leads come from."] as [
            string,
            string,
            string,
          ],
        },
        ifYouDont: {
          occupancyProjection: "Unknown",
          additionalMoveOuts: 0,
          revenueLost: 0,
          consequences: [
            "Move-outs keep pace.",
            "Leads stay thin.",
            "No number was invented to make this look worse.",
          ] as [string, string, string],
        },
      },
      vacancyCost: {
        vacantUnits: 70,
        monthlyLoss: 0,
        annualLoss: 0,
        avgUnitRate: 0,
        dollarsKnown: false,
      },
    },
    facilityName: "Sample Facility (not a real lead)",
    createdAt: "2026-10-10T00:00:00.000Z",
    expiresAt: "2027-01-08T00:00:00.000Z",
    views: 0,
  };
}
