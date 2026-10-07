/**
 * The facility ontology: every thing StorageAds knows about one facility,
 * typed, addressed and linked, so the tools stop being islands.
 *
 * Three ideas carry it (reference library entry 006):
 *  - One address per object. `units/10x10-climate` names that unit type on
 *    every surface — the dashboard, the index and a tool's focus bar — and is
 *    derived from the record itself, so the same record always gets the same
 *    address.
 *  - Objects say what they can become. Each type declares which tools act on
 *    it, so a tool opens with the object already in hand instead of the
 *    operator re-typing what the system already knows.
 *  - Same inputs, same output. `buildOntology` is a pure function of the rows
 *    and a clock; nothing in it reads the network, the locale or Math.random.
 *
 * This file is types only and safe to import from client components.
 */

export const OBJECT_TYPE_KEYS = [
  "units",
  "offers",
  "campaigns",
  "ads",
  "pages",
  "links",
  "posts",
  "leads",
  "tours",
  "tenants",
  "reviews",
  "competitors",
] as const;

export type ObjectTypeKey = (typeof OBJECT_TYPE_KEYS)[number];

/** The four lanes the types sit in, in the order an operator's month runs. */
export type LaneKey = "space" | "signal" | "people" | "place";

/** Tool keys accepted by /portal/tools?tool=… (see TOOL_GROUPS in owner-tools). */
export type ToolKey =
  | "overview"
  | "proven-ads"
  | "creative-studio"
  | "ad-studio"
  | "ad-publisher"
  | "google-ads"
  | "tiktok"
  | "video"
  | "media-library"
  | "funnels"
  | "landing-pages"
  | "utm-links"
  | "gbp"
  | "social"
  | "lead-nurture"
  | "occupancy"
  | "market-intel"
  | "revenue"
  | "tenants"
  | "pms"
  | "call-tracking";

export interface Fact {
  label: string;
  value: string;
}

/** Something an operator can do with an object: open a tool with it in focus, or go to a page. */
export interface ObjectAction {
  label: string;
  /** Tool to open. The object's address travels with it as `focus`. */
  tool?: ToolKey;
  /** Extra tool params (e.g. the Ad Generator's `variation`). */
  params?: Record<string, string>;
  /** A portal page instead of a tool. */
  href?: string;
}

export interface OntologyObject {
  /** Canonical address, `<type>/<slug>`. Permanent for as long as the record exists. */
  address: string;
  type: ObjectTypeKey;
  /** Source row id. Competitors have none of their own and use their address slug. */
  id: string;
  /** The name you would say on the phone. */
  name: string;
  /** Short state word, lower case ("live", "draft", "waiting"…), or null. */
  status: string | null;
  /** The date that matters most for this object (ISO), or null. */
  at: string | null;
  /** Ordered properties, most useful first. */
  facts: Fact[];
  /** Addresses of the objects this one is linked to, sorted. */
  links: string[];
  /** One plain sentence carrying the facts a tool needs. */
  brief: string;
  /** What can be done with it, at most three. */
  actions: ObjectAction[];
}

/** The one true reading for a type, and how it is computed. */
export interface Reading {
  value: string;
  unit: string;
  definition: string;
}

export interface TypeSummary {
  type: ObjectTypeKey;
  count: number;
  reading: Reading;
}

/** A gap the links reveal, phrased as one sentence with one way to close it. */
export interface Move {
  /** Stable id: `<rule>:<subject address>`. */
  id: string;
  rule: string;
  rank: number;
  /** The object the move is about. */
  subject: string;
  type: ObjectTypeKey;
  sentence: string;
  reason: string;
  action: ObjectAction;
}

export interface Ontology {
  facility: { id: string; name: string };
  generatedAt: string;
  objects: OntologyObject[];
  summaries: TypeSummary[];
  moves: Move[];
}

/* ─── raw rows, as loaded (plain values; Decimals already numbers) ─── */

export interface RawUnit {
  id: string;
  unitType: string;
  sizeLabel: string | null;
  widthFt: number | null;
  depthFt: number | null;
  total: number;
  occupied: number;
  streetRate: number | null;
  webRate: number | null;
  features: string[];
  lastUpdated: string | null;
}

export interface RawSpecial {
  id: string;
  name: string;
  description: string | null;
  appliesTo: string[];
  discountType: string | null;
  discountValue: number | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean | null;
}

export interface RawCampaign {
  id: string;
  name: string;
  status: string;
  archetype: string | null;
  dailyBudget: number | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface RawAd {
  id: string;
  platform: string;
  angle: string | null;
  status: string | null;
  createdAt: string;
  funnelId: string | null;
  headline: string | null;
  /** All copy fields flattened into one string, for mention matching. */
  text: string;
}

export interface RawPage {
  id: string;
  slug: string;
  title: string;
  status: string;
  funnelId: string | null;
  variationIds: string[];
  createdAt: string;
  publishedAt: string | null;
  /** Visits (touches of kind "visit") in the last 30 days. */
  visits30: number;
}

export interface RawLink {
  id: string;
  label: string;
  shortCode: string;
  landingPageId: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
}

export interface RawPost {
  id: string;
  /** "google" for Google Business posts, otherwise the social platform. */
  channel: string;
  title: string | null;
  body: string;
  status: string | null;
  offerCode: string | null;
  createdAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface RawLead {
  id: string;
  name: string | null;
  hasContact: boolean;
  unitSize: string | null;
  status: string | null;
  sourceChannel: string | null;
  landingPageId: string | null;
  funnelId: string | null;
  createdAt: string;
  firstResponseAt: string | null;
  matchedTenantId: string | null;
  converted: boolean;
}

export interface RawTour {
  id: string;
  leadId: string | null;
  contactName: string | null;
  sizeLabel: string | null;
  scheduledAt: string;
  status: string;
}

export interface RawTenant {
  id: string;
  name: string;
  unitNumber: string;
  unitSize: string | null;
  unitType: string | null;
  monthlyRate: number;
  moveInDate: string;
  status: string | null;
}

export interface RawReview {
  id: string;
  author: string | null;
  rating: number;
  text: string | null;
  reviewTime: string | null;
  hasResponse: boolean;
}

export interface RawCompetitor {
  name: string;
  distanceMiles: number | null;
  rating: number | null;
  reviewCount: number;
  website: string | null;
  units: { size: string; price: string | null; type: string | null }[];
  promotions: string[];
}

export interface RawFacility {
  facility: { id: string; name: string; googleRating: number | null; reviewCount: number | null };
  units: RawUnit[];
  specials: RawSpecial[];
  campaigns: RawCampaign[];
  ads: RawAd[];
  pages: RawPage[];
  links: RawLink[];
  posts: RawPost[];
  leads: RawLead[];
  tours: RawTour[];
  /** Move-ins in the last 90 days (the people the marketing produced). */
  tenants: RawTenant[];
  tenantCounts: { active: number; movedIn30: number };
  reviews: RawReview[];
  competitors: RawCompetitor[];
}
