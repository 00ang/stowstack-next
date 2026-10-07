import type { LaneKey, ObjectTypeKey, ToolKey } from "./types";

/**
 * The type registry: the single place each kind of object is named, defined,
 * coloured and given its tool. The dashboard, the index and the tools' focus
 * bar all read from here, so a type can never be called one thing on one
 * screen and another thing on the next.
 *
 * Colour is identity, not decoration: every type has its own hue
 * (`--onto-<type>` in globals.css), solved by luminance to 5.2:1 or better on
 * the cool-light ground and checked so no two neighbouring tiles are close
 * (worst neighbour ΔE00 14.0). Text never takes these hues; marks and glyphs do.
 */

export interface TypeDef {
  key: ObjectTypeKey;
  singular: string;
  plural: string;
  lane: LaneKey;
  /** One line, operator voice: what this thing is. */
  definition: string;
  /** The tool that owns this type, opened with the object in focus. */
  tool: ToolKey | null;
}

export interface LaneDef {
  key: LaneKey;
  label: string;
  definition: string;
}

export const LANES: LaneDef[] = [
  { key: "space", label: "Space", definition: "What you rent, and what it costs." },
  { key: "signal", label: "Marketing", definition: "What goes out with your name on it." },
  { key: "people", label: "People", definition: "Who answered, and who moved in." },
  { key: "place", label: "Place", definition: "How you stand on your street." },
];

export const TYPE_DEFS: Record<ObjectTypeKey, TypeDef> = {
  units: {
    key: "units",
    singular: "Unit",
    plural: "Units",
    lane: "space",
    definition: "Each size you rent.",
    tool: "occupancy",
  },
  offers: {
    key: "offers",
    singular: "Offer",
    plural: "Offers",
    lane: "space",
    definition: "Specials you run, and the sizes they apply to.",
    tool: "revenue",
  },
  campaigns: {
    key: "campaigns",
    singular: "Campaign",
    plural: "Campaigns",
    lane: "signal",
    definition: "A campaign ties ads, a page and follow-up into one run.",
    tool: "funnels",
  },
  ads: {
    key: "ads",
    singular: "Ad",
    plural: "Ads",
    lane: "signal",
    definition: "Every ad written for you, drafts included.",
    tool: "ad-studio",
  },
  pages: {
    key: "pages",
    singular: "Page",
    plural: "Pages",
    lane: "signal",
    definition: "Landing pages your ads and links send people to.",
    tool: "landing-pages",
  },
  links: {
    key: "links",
    singular: "Link",
    plural: "Links",
    lane: "signal",
    definition: "Tracking links, so every click knows where it came from.",
    tool: "utm-links",
  },
  posts: {
    key: "posts",
    singular: "Post",
    plural: "Posts",
    lane: "signal",
    definition: "Google Business and social posts.",
    tool: "gbp",
  },
  leads: {
    key: "leads",
    singular: "Lead",
    plural: "Leads",
    lane: "people",
    definition: "People who asked about a unit in the last 90 days.",
    tool: "lead-nurture",
  },
  tours: {
    key: "tours",
    singular: "Tour",
    plural: "Tours",
    lane: "people",
    definition: "Visits people booked to see the facility.",
    tool: null,
  },
  tenants: {
    key: "tenants",
    singular: "Move-in",
    plural: "Move-ins",
    lane: "people",
    definition: "Tenants who moved in during the last 90 days.",
    tool: "tenants",
  },
  reviews: {
    key: "reviews",
    singular: "Review",
    plural: "Reviews",
    lane: "place",
    definition: "Your Google reviews, and whether you answered.",
    tool: "gbp",
  },
  competitors: {
    key: "competitors",
    singular: "Competitor",
    plural: "Competitors",
    lane: "place",
    definition: "Facilities near you, with the prices they list.",
    tool: "market-intel",
  },
};

/** Types in display order: lane by lane, as an operator's month runs. */
export const TYPE_ORDER: ObjectTypeKey[] = [
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
];

/** The CSS custom property carrying a type's identity hue. */
export function typeHue(type: ObjectTypeKey): string {
  return `var(--onto-${type})`;
}

export function typesInLane(lane: LaneKey): ObjectTypeKey[] {
  return TYPE_ORDER.filter((t) => TYPE_DEFS[t].lane === lane);
}

/** `units/10x10-climate` → "units"; null when the address is not well formed. */
export function typeOfAddress(address: string): ObjectTypeKey | null {
  const head = address.split("/")[0];
  return (TYPE_ORDER as string[]).includes(head) ? (head as ObjectTypeKey) : null;
}
