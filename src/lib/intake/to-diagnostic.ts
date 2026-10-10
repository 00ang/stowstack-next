/**
 * Turn saved qualifier answers into the diagnostic generator's input.
 * Blank strings mean "not told". Callers must not fill those in.
 */

export interface DiagnosticFacts {
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
  occupancy: string;
  leasingMomentum: string;
  occupancyVs6Months: string;
  occupancyVsLastYear: string;
  moveIns30Days: string;
  moveOuts30Days: string;
  totalUnits: string;
  unitTypesOffered: string[];
  bestRentingUnits: string[];
  hardestToRentUnits: string[];
  specificVacancyNotes: string;
  offlineUnits: string;
  unitMixBalance: string;
  biggerIssue: string;
  leadSources: string[];
  weeklyInquiries: string;
  whyPeopleDontRent: string;
  canReserveOnline: string;
  canRentFullyOnline: string;
  onlineVsWalkIn: string;
  followUpConfidence: string;
  callsRecorded: string;
  callTrackingSoftware: string;
  missedCallProcess: string;
  abandonedReservationFollowUp: string;
  reservationNoShowProcess: string;
  phoneClosingAbility: string;
  currentMarketing: string[];
  monthlyAdSpend: string;
  googleAdsPerformance: string;
  metaAdsPerformance: string;
  knowsCostPerLead: string;
  whoManagesMarketing: string;
  openToMetaAds: string;
  idealAdBudget: string;
  storageAgencyExperience: string;
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
  pms: string;
  revenueManagementSoftware: string;
  pricingPerception: string;
  currentPromotions: string;
  ecriStatus: string;
  lastStreetRateIncrease: string;
  pricingMethod: string;
  tenantProtection: string;
  autopayPercentage: string;
  staffingModel: string;
  officeHours: string;
  gateAccessHours: string;
  facilityCondition: string;
  facilityAgeYears: string;
  securityFeatures: string[];
  amenities: string[];
  recentRenovations: string;
  topCompetitors: string;
  competitorAdvantages: string;
  yourAdvantages: string;
  commonObjections: string[];
  newSupply: string;
  marketSaturation: string;
  vacancyReason: string;
  unusualCircumstances: string;
  fixOneThingFirst: string;
  aggressiveness: string;
  urgency: string;
  openToPmsReports: string;
  howHeard: string;
  additionalNotes: string;
  scrapedGoogleRating?: number;
  scrapedReviewCount?: number;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function answersOf(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function diagnosticFromLead(lead: {
  name?: string | null;
  location?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  google_rating?: unknown;
  review_count?: number | null;
  intake_answers?: unknown;
}): DiagnosticFacts {
  const answers = answersOf(lead.intake_answers);
  const facility =
    answers.facility && typeof answers.facility === "object"
      ? (answers.facility as Record<string, unknown>)
      : {};
  const facilityName = str(facility.name) || (lead.name && lead.name !== "Homepage inquiry" ? lead.name : "");
  const address = str(facility.address) || str(facility.city);
  const location =
    address || (lead.location && lead.location !== "Not provided" ? lead.location : "");
  const channels = str(answers.marketing_channels);
  const words = [str(answers.reach_out), str(answers.site_note)].filter(Boolean).join("\n");
  const rating = lead.google_rating != null ? Number(lead.google_rating) : undefined;

  const facts: DiagnosticFacts = {
    facilityName: facilityName || "Facility",
    facilityAddress: location,
    contactName: lead.contact_name || "",
    contactEmail: lead.contact_email || "",
    contactPhone: lead.contact_phone || "",
    websiteUrl: str(facility.website) || lead.website || "",
    role: str(answers.role),
    yearsManaged: "",
    facilityAge: str(answers.stage),
    facilityCount: str(answers.facility_count),
    occupancy: str(answers.occupancy),
    leasingMomentum: "",
    occupancyVs6Months: "",
    occupancyVsLastYear: "",
    moveIns30Days: str(answers.move_balance),
    moveOuts30Days: "",
    totalUnits: str(answers.units),
    unitTypesOffered: [],
    bestRentingUnits: [],
    hardestToRentUnits: [],
    specificVacancyNotes: "",
    offlineUnits: "",
    unitMixBalance: "",
    biggerIssue: str(answers.pain),
    leadSources: [],
    weeklyInquiries: "",
    whyPeopleDontRent: "",
    canReserveOnline: "",
    canRentFullyOnline: str(answers.online_rental),
    onlineVsWalkIn: "",
    followUpConfidence: "",
    callsRecorded: "",
    callTrackingSoftware: "",
    missedCallProcess: "",
    abandonedReservationFollowUp: "",
    reservationNoShowProcess: "",
    phoneClosingAbility: "",
    currentMarketing: channels ? channels.split(" · ").filter(Boolean) : [],
    monthlyAdSpend: str(answers.ad_spend),
    googleAdsPerformance: str(answers.google_ads),
    metaAdsPerformance: "",
    knowsCostPerLead: "",
    whoManagesMarketing: str(answers.who_manages),
    openToMetaAds: "",
    idealAdBudget: "",
    storageAgencyExperience: "",
    websiteBuilder: "",
    lastWebsiteUpdate: "",
    showsLiveAvailability: "",
    googleReviewCount: "",
    googleRating: "",
    respondsToReviews: "",
    requestsReviews: "",
    gbpStatus: "",
    gbpPostFrequency: "",
    socialMedia: [],
    pms: str(answers.pms),
    revenueManagementSoftware: "",
    pricingPerception: "",
    currentPromotions: "",
    ecriStatus: "",
    lastStreetRateIncrease: "",
    pricingMethod: "",
    tenantProtection: "",
    autopayPercentage: "",
    staffingModel: "",
    officeHours: "",
    gateAccessHours: "",
    facilityCondition: "",
    facilityAgeYears: "",
    securityFeatures: [],
    amenities: [],
    recentRenovations: "",
    topCompetitors: "",
    competitorAdvantages: "",
    yourAdvantages: "",
    commonObjections: [],
    newSupply: "",
    marketSaturation: "",
    vacancyReason: "",
    unusualCircumstances: "",
    fixOneThingFirst: "",
    aggressiveness: "",
    urgency: str(answers.timeline),
    openToPmsReports: "",
    howHeard: "",
    additionalNotes: words,
  };
  if (typeof rating === "number" && !Number.isNaN(rating)) facts.scrapedGoogleRating = rating;
  if (typeof lead.review_count === "number") facts.scrapedReviewCount = lead.review_count;
  return facts;
}
