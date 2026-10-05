/**
 * Manual / CSV source. A person (or a spreadsheet they built from the public
 * Ad Library / Ads Transparency Center) is the source of truth. No fetch.
 *
 * This is how US commercial Meta ads and every Google ad enter the library
 * today: Google has no public commercial Transparency API, and scraping
 * adstransparency.google.com conflicts with Google's terms.
 */

import { classify } from "../classify";
import type { AdFormat, Angle, OfferType, ProvenAdDraft, ProvenPlatform, UnitType } from "../types";
import {
  AD_FORMATS,
  ANGLES,
  OFFER_TYPES,
  PROVEN_PLATFORMS,
  UNIT_TYPES,
} from "../types";
import type { AdapterSearch, FetchPage, SourceAdapter } from "./types";

export const MANUAL_SOURCE = "manual" as const;
export const CSV_SOURCE = "csv_import" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function inSet<T extends string>(value: unknown, set: readonly T[], fallback: T): T {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (set as readonly string[]).includes(v) ? (v as T) : fallback;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function str(value: unknown, max?: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return max ? t.slice(0, max) : t;
}

export interface ManualInput {
  source_ad_id?: string;
  platform?: string;
  advertiser_name?: string;
  advertiser_page_id?: string;
  advertiser_url?: string;
  format?: string;
  headline?: string;
  primary_text?: string;
  description?: string;
  cta?: string;
  landing_url?: string;
  snapshot_url?: string;
  country?: string;
  state?: string;
  city?: string;
  offer_type?: string;
  unit_type?: string;
  angle?: string;
  started_at?: string;
  last_seen_at?: string;
  ended_at?: string;
  active?: boolean | string;
  notes?: string;
  publisher_platforms?: string[] | string;
}

function parseActive(value: unknown, ended: string | null): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["false", "0", "no", "inactive", "ended"].includes(v)) return false;
    if (["true", "1", "yes", "active"].includes(v)) return true;
  }
  return !ended;
}

function newManualId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftFromManual(
  input: ManualInput,
  source: typeof MANUAL_SOURCE | typeof CSV_SOURCE = MANUAL_SOURCE,
  createdBy: string | null = null
): { draft: ProvenAdDraft } | { error: string } {
  const advertiser = str(input.advertiser_name, 200);
  if (!advertiser) return { error: "advertiser_name is required" };
  const started = dateOnly(input.started_at);
  if (!started) return { error: "started_at is required (YYYY-MM-DD)" };

  const ended = dateOnly(input.ended_at);
  const sourceAdId = str(input.source_ad_id, 128) || newManualId();

  const platforms =
    typeof input.publisher_platforms === "string"
      ? input.publisher_platforms.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
      : Array.isArray(input.publisher_platforms)
        ? input.publisher_platforms
        : [];

  const draft: ProvenAdDraft = {
    source,
    source_ad_id: sourceAdId,
    platform: inSet(input.platform, PROVEN_PLATFORMS, "meta"),
    publisher_platforms: platforms,
    advertiser_name: advertiser,
    advertiser_page_id: str(input.advertiser_page_id, 64),
    advertiser_url: str(input.advertiser_url, 2000),
    format: inSet(input.format, AD_FORMATS, "unknown"),
    headline: str(input.headline, 500),
    primary_text: str(input.primary_text),
    description: str(input.description, 1000),
    cta: str(input.cta, 64),
    landing_url: str(input.landing_url, 2000),
    snapshot_url: str(input.snapshot_url, 2000),
    country: str(input.country, 2)?.toUpperCase() ?? null,
    state: str(input.state, 8)?.toUpperCase() ?? null,
    city: str(input.city, 120),
    started_at: started,
    last_seen_at: dateOnly(input.last_seen_at) ?? new Date().toISOString(),
    ended_at: ended,
    active: parseActive(input.active, ended),
    notes: str(input.notes),
    created_by: createdBy,
  };

  const classified = classify(draft);
  draft.offer_type = inSet(input.offer_type, OFFER_TYPES, classified.offer_type);
  draft.unit_type = inSet(input.unit_type, UNIT_TYPES, classified.unit_type);
  draft.angle = inSet(input.angle, ANGLES, classified.angle);
  if (!input.format) draft.format = classified.format;

  return { draft };
}

/** Split a CSV line on commas, honouring double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): { drafts: ProvenAdDraft[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { drafts: [], errors: ["CSV needs a header row and at least one data row"] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const drafts: ProvenAdDraft[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.every((c) => !c)) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    const result = draftFromManual(row, CSV_SOURCE, "csv");
    if ("error" in result) {
      errors.push(`Row ${i + 1}: ${result.error}`);
    } else {
      drafts.push(result.draft);
    }
  }

  return { drafts, errors };
}

async function fetchPage(_search: AdapterSearch, _cursor: string | null): Promise<FetchPage> {
  return {
    ads: [],
    nextCursor: null,
    note: "Manual / CSV source has no fetch. Ads enter through the admin import form.",
  };
}

export const manualAdapter: SourceAdapter = {
  id: MANUAL_SOURCE,
  coverage: "Admin-entered ads, typically transcribed from the public Meta Ad Library or Google Ads Transparency Center pages.",
  automated: false,
  configured: () => true,
  fetchPage,
};

export const csvAdapter: SourceAdapter = {
  id: CSV_SOURCE,
  coverage: "Bulk import of the same fields as the manual form. Use this to seed the library from a spreadsheet.",
  automated: false,
  configured: () => true,
  fetchPage,
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type { ProvenPlatform, OfferType, UnitType, Angle, AdFormat };
