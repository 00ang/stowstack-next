/**
 * A landing page as ordered blocks. Stored in the existing
 * landing_page_sections rows (one section per block). Nothing here
 * talks to the database.
 */

export const BLOCK_TYPES = [
  "hero",
  "units",
  "offer",
  "reserve",
  "ask",
  "location",
  "access",
  "faq",
  "photos",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** A section the editor doesn't own, kept so a save doesn't drop it. */
export type StoredBlockType = BlockType | "custom";

export interface Block {
  id: string;
  type: StoredBlockType;
  config: Record<string, unknown>;
}

export interface LiveUnit {
  /** Unit type name, the key the page filters on. */
  key: string;
  name: string;
  size: string;
  /** Web rate, dollars per month. Null when the facility has no rate on file. */
  rate: number | null;
  vacant: number;
  total: number;
  features: string[];
  climate: boolean;
}

export interface UnitFact {
  key: string;
  name: string;
  rate: number | null;
  vacant: number;
  total: number;
  climate: boolean;
  features: string[];
}

/** Facts a draft may use. Every number here belongs to the facility. */
export interface PageFacts {
  facilityName: string;
  address: string | null;
  phone: string | null;
  /** One line, already written out. */
  hours: string | null;
  sizes: string[];
  offerName: string | null;
  offerDetail: string | null;
  adHeadline: string | null;
  units: UnitFact[];
  photos: { url: string; alt: string }[];
  /** A storEDGE reservation link the facility already uses, if one is on file. */
  storedgeUrl: string | null;
}

export const TEMPLATE_KEYS = ["lease-up", "climate", "size", "seasonal"] as const;
export type PageTemplateKey = (typeof TEMPLATE_KEYS)[number];

export interface PageDraft {
  title: string;
  blocks: Block[];
  storedgeUrl: string | null;
}

/** What the public URL serves after a publish. */
export interface PageSnapshot {
  editor: "blocks" | "legacy";
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  storedgeWidgetUrl: string | null;
  sections: SnapshotSection[];
}

export interface SnapshotSection {
  section_type: string;
  sort_order: number;
  config: Record<string, unknown>;
}

export interface SectionRow {
  id?: string;
  section_type: string;
  sort_order: number;
  config: unknown;
}

export type PageFix =
  | { kind: "add"; block: BlockType }
  | { kind: "set-headline"; headline: string }
  | { kind: "live-units"; sizeKeys: string[] }
  | { kind: "add-offer"; name: string; detail: string };

export interface PageInsight {
  id: string;
  /** The one line the operator reads. */
  line: string;
  /** Why, from this facility's own facts. One line. */
  why: string;
  fixLabel: string;
  fix: PageFix;
}

export interface InsightInput {
  blocks: Block[];
  /** Sizes this campaign is trying to fill, with the rate on file. */
  campaignSizes: { name: string; rate: number | null }[];
  /** Every size the facility has a rate for. Used when the campaign hasn't named one. */
  units: { name: string; rate: number | null; vacant: number }[];
  adHeadline: string | null;
  /** Facility name, so "Maple Street" in both lines doesn't count as the same promise. */
  facilityName?: string | null;
  offerName: string | null;
  offerDetail: string | null;
  /** The campaign has a Reserve function, or a storEDGE link is already on file. */
  expectsReserve: boolean;
}
