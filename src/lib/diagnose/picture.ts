/**
 * Everything we actually know about one facility, with holes left empty.
 * A missing source is null. A counted zero means we looked and found none.
 * Nothing in this shape is guessed.
 */

export type EvidenceSource =
  | "pms"
  | "intake"
  | "jev"
  | "google"
  | "ads"
  | "calls"
  | "visitors"
  | "ledger"
  | "leads"
  | "market";

export interface Evidence {
  text: string;
  source: EvidenceSource;
  /** Plain attribution: "from your PMS upload", "you told us". */
  sourceLabel: string;
  /** What kind of fact this line is, so a template can follow it without parsing the sentence. */
  signal?: string;
}

export interface UnitFact {
  key: string;
  name: string;
  /** Normalized "10x10", or the name when it isn't a size. */
  sizeKey: string;
  empty: number;
  total: number;
  streetRate: number | null;
  webRate: number | null;
  climate: boolean;
}

export interface IntakeFacts {
  role: string | null;
  stage: string | null;
  unitsBand: string | null;
  occupancyBand: string | null;
  moveBalance: string | null;
  pain: string | null;
  adSpendBand: string | null;
  timeline: string | null;
  freeText: string | null;
  onlineRental: string | null;
  googleAds: string | null;
}

export interface JevFacts {
  painCategory: string | null;
  /** 0–1 when Jev reported one. Null when it didn't. */
  confidence: number | null;
}

export interface SnapshotFacts {
  at: string | null;
  occupancyPct: number | null;
  moveIns: number | null;
  moveOuts: number | null;
  totalUnits: number | null;
  occupiedUnits: number | null;
}

export interface LeadFacts {
  total: number;
  withContact: number;
  /** Asked, have a way to reply, and nobody has, in the last 14 days. */
  waiting: number;
  movedIn: number;
  /** Reserved and not yet a move-in. */
  reservedOpen: number;
}

export interface PageFacts {
  title: string;
  visits30: number;
  leads30: number;
}

export interface CallFacts {
  total30: number;
  missed30: number;
}

export interface AdFacts {
  impressions30: number;
  clicks30: number;
  leads30: number | null;
  spend30: number | null;
  moveIns30: number | null;
}

export interface GoogleFacts {
  rating: number | null;
  reviewCount: number | null;
  unanswered: number;
  /** Unanswered reviews at 3 stars or lower. */
  unansweredLow: number;
  /** Lowest unanswered rating, when there is one. */
  lowestUnanswered: number | null;
}

export interface CompetitorRate {
  name: string;
  sizeKey: string;
  sizeLabel: string;
  price: number;
  miles: number | null;
  climate: boolean;
}

export interface RateFacts {
  compared: number;
  belowStandard: number;
  /** Typical dollars under the standard rate, among those below. Null when none are. */
  medianGap: number | null;
}

export interface PictureStamps {
  pmsUnitsAt: string | null;
  snapshotAt: string | null;
  /** Sorted keys the operator actually answered. Null when they haven't. */
  intakeKey: string | null;
  callsKnown: boolean;
  adsKnown: boolean;
  googleKnown: boolean;
}

export interface FacilityPicture {
  sample: boolean;
  facilityName: string | null;
  intake: IntakeFacts | null;
  jev: JevFacts | null;
  /** Null when no unit mix has been uploaded. */
  units: UnitFact[] | null;
  snapshot: SnapshotFacts | null;
  /** Move-ins on the ledger in 30 days. Null when the ledger wasn't read. */
  ledgerMoveIns30: number | null;
  leads30: LeadFacts | null;
  pages: PageFacts[] | null;
  /** Null when call tracking isn't on. Zero means it is on and the phone was quiet. */
  calls: CallFacts | null;
  ads: AdFacts | null;
  /** Page arrivals in 30 days. Null when visit tracking isn't on. */
  visitors30: number | null;
  google: GoogleFacts | null;
  competitors: CompetitorRate[] | null;
  rates: RateFacts | null;
  stamps: PictureStamps;
}

export type GapKind =
  | "demand"
  | "conversion"
  | "retention"
  | "lease_up"
  | "vacant_sizes"
  | "google"
  | "online_rental"
  | "rates";

export type Confidence = "high" | "medium" | "low";

export interface Gap {
  id: GapKind;
  kind: GapKind;
  title: string;
  /** 0–100, from the measurements. Higher means more lacking. Not shown as a grade. */
  severity: number;
  confidence: Confidence;
  evidence: Evidence[];
  /** "We'd know more if you shared …", or null when this gap is already well counted. */
  nudge: string | null;
  /** The one number a funnel for this gap should move. No promised result. */
  metric: string;
  /** What the funnel is aimed at, in the operator's own sizes and words. */
  target: string;
  signals: string[];
}

export interface Digest {
  /** Ranked by severity, then by kind, so the same picture always ranks the same way. */
  gaps: Gap[];
  /** Sources we don't have. At most three. */
  nudges: string[];
  fingerprint: string;
}

const SOURCE_BASE: Record<EvidenceSource, string> = {
  pms: "from your PMS upload",
  intake: "you told us",
  jev: "from the read of your answers",
  google: "from Google",
  ads: "from your ad results",
  calls: "from your call log",
  visitors: "from visits to your pages",
  ledger: "from your move-in ledger",
  leads: "from people who asked",
  market: "from nearby listings",
};

export function sourceLabel(source: EvidenceSource, sample: boolean): string {
  const base = SOURCE_BASE[source];
  return sample ? `Sample · ${base}` : base;
}

export function confidenceLabel(confidence: Confidence): string {
  if (confidence === "high") return "Firm read";
  if (confidence === "medium") return "Partial read";
  return "Thin read";
}

export function blankStamps(): PictureStamps {
  return {
    pmsUnitsAt: null,
    snapshotAt: null,
    intakeKey: null,
    callsKnown: false,
    adsKnown: false,
    googleKnown: false,
  };
}

export function blankPicture(over: Partial<FacilityPicture> = {}): FacilityPicture {
  return {
    sample: false,
    facilityName: null,
    intake: null,
    jev: null,
    units: null,
    snapshot: null,
    ledgerMoveIns30: null,
    leads30: null,
    pages: null,
    calls: null,
    ads: null,
    visitors30: null,
    google: null,
    competitors: null,
    rates: null,
    ...over,
    stamps: { ...blankStamps(), ...over.stamps },
  };
}
