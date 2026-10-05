/** Shared types for the Proven Ads library. No I/O. */

export const PROVEN_SOURCES = ["meta_ad_library_api", "manual", "csv_import"] as const;
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
