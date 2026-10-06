/** Shared types for the Proven Ads library. No I/O. */

export const PROVEN_SOURCES = [
  "meta_ad_library_api",
  "meta_ad_library_web",
  "manual",
  "csv_import",
] as const;
export type ProvenSource = (typeof PROVEN_SOURCES)[number];

export const PROVEN_PLATFORMS = ["meta", "google", "tiktok"] as const;
export type ProvenPlatform = (typeof PROVEN_PLATFORMS)[number];

export const AD_FORMATS = ["image", "video", "carousel", "text", "unknown"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

export const OFFER_TYPES = [
  "first_month_free",
  "dollar_move_in",
  "percent_off",
  "free_truck",
  "no_offer",
  "other",
] as const;
export type OfferType = (typeof OFFER_TYPES)[number];

export const UNIT_TYPES = [
  "climate_controlled",
  "drive_up",
  "vehicle",
  "business",
  "general",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const ANGLES = [
  "social_proof",
  "convenience",
  "urgency",
  "lifestyle",
  "price",
  "other",
] as const;
export type Angle = (typeof ANGLES)[number];

export const OFFER_LABELS: Record<OfferType, string> = {
  first_month_free: "First month free",
  dollar_move_in: "$1 move-in",
  percent_off: "Percent off",
  free_truck: "Free truck",
  no_offer: "No offer",
  other: "Other offer",
};

export const UNIT_LABELS: Record<UnitType, string> = {
  climate_controlled: "Climate-controlled",
  drive_up: "Drive-up",
  vehicle: "Vehicle / RV / boat",
  business: "Business / commercial",
  general: "General storage",
};

export const ANGLE_LABELS: Record<Angle, string> = {
  social_proof: "Social proof",
  convenience: "Convenience",
  urgency: "Urgency",
  lifestyle: "Lifestyle",
  price: "Price",
  other: "Other",
};

export const FORMAT_LABELS: Record<AdFormat, string> = {
  image: "Image",
  video: "Video",
  carousel: "Carousel",
  text: "Text",
  unknown: "Unknown",
};

export const PLATFORM_LABELS: Record<ProvenPlatform, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
};

export const AUDIENCES = [
  "movers",
  "declutterers",
  "vehicle_owners",
  "businesses",
  "students",
  "military",
  "general",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  movers: "Movers",
  declutterers: "Declutterers",
  vehicle_owners: "RV, boat, vehicle",
  businesses: "Businesses",
  students: "Students",
  military: "Military",
  general: "Everyone",
};

export const ADVERTISER_SCALES = ["national", "regional", "independent"] as const;
export type AdvertiserScale = (typeof ADVERTISER_SCALES)[number];

export const SCALE_LABELS: Record<AdvertiserScale, string> = {
  national: "National",
  regional: "Regional",
  independent: "Independent",
};

/**
 * The read on one ad, written for an independent operator. Facts about the
 * ad (offer, unit, angle, format, audience, scale, market) live in their own
 * columns; this holds the prose and the playbook.
 */
export interface ProvenAdInsight {
  v: 1;
  /**
   * renter: sells storage to people who would rent it. Anything else (an
   * investor pitch, a vendor, a job post, a listing) keeps its row but is
   * left out of the library, and carries no prose.
   */
  relevance: "renter" | "investor" | "b2b" | "jobs" | "listing" | "not_storage";
  /**
   * Our editorial read on how much an operator can take from it: 3 a clear,
   * transferable structure; 2 solid and ordinary; 1 a bare presence ad.
   * Judgement, not a performance number, and labelled that way.
   */
  study_value: 1 | 2 | 3;
  /** One sentence: what this ad is, operator to operator. */
  summary: string;
  /** Why it has kept running: the renter problem, the friction removed, why the offer is believable. */
  why: string;
  /** What stops the scroll in the first second, described rather than quoted. */
  hook: string;
  /** What the image or video frame shows, as a shootable direction. Empty when no image was read. */
  creative: string;
  /** The ad's structure, in order. */
  beats: { label: string; text: string }[];
  /** Three steps to run a version of this at your own facility. */
  run_it: string[];
  /** What an operator must really have for this to work honestly. */
  needs: string[];
  /** Situations the ad fits. */
  best_for: string[];
  /** How it goes wrong when copied. Empty when there is nothing real to say. */
  watch_out: string;
  /** Which model wrote it, for re-runs. */
  model: string;
}

export interface MediaRef {
  kind: "image" | "video";
  url: string;
}

/**
 * What a source adapter emits. Dates are ISO (YYYY-MM-DD or full ISO).
 * Classification fields may be omitted — the upsert path fills them.
 */
export interface ProvenAdDraft {
  source: ProvenSource;
  source_ad_id: string;
  platform: ProvenPlatform;
  publisher_platforms?: string[];
  advertiser_name: string;
  advertiser_page_id?: string | null;
  advertiser_url?: string | null;
  format?: AdFormat;
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  cta?: string | null;
  landing_url?: string | null;
  snapshot_url?: string | null;
  media_refs?: MediaRef[] | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  offer_type?: OfferType | null;
  unit_type?: UnitType | null;
  angle?: Angle | null;
  started_at: string;
  last_seen_at?: string | null;
  ended_at?: string | null;
  active: boolean;
  raw?: unknown;
  notes?: string | null;
  created_by?: string | null;
  /** Live ads sharing this creative, this one included. */
  family_size?: number;
  audience?: Audience | null;
  advertiser_scale?: AdvertiserScale | null;
}

export interface AdaptedCopy {
  angle: string;
  angleLabel: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  targetingNote: string;
}

export interface FacilitySnapshot {
  id: string;
  name: string;
  location: string;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** Lowest advertised monthly rate from PMS, if any. */
  fromRate: number | null;
  vacantUnits: number | null;
  specials: string[];
  /** Unit types that still have vacancies. */
  openUnitTypes: string[];
}
