import { confirmedThrough, daysRunning, isProven, whyFlagged } from "./days-running";
import type { ProvenAdInsight } from "./types";

export interface ProvenAdRow {
  id: string;
  source: string;
  source_ad_id: string;
  platform: string;
  publisher_platforms: string[];
  advertiser_name: string;
  advertiser_page_id: string | null;
  advertiser_url: string | null;
  format: string;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  landing_url: string | null;
  snapshot_url: string | null;
  media_refs: unknown;
  country: string | null;
  state: string | null;
  city: string | null;
  offer_type: string | null;
  unit_type: string | null;
  angle: string | null;
  started_at: Date;
  first_seen_at: Date;
  last_seen_at: Date;
  ended_at: Date | null;
  active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  insight?: unknown;
  insight_at?: Date | null;
  family_size?: number;
  audience?: string | null;
  advertiser_scale?: string | null;
  study_value?: number | null;
}

/** A stored read is used only if it has the shape this version writes. */
export function readInsight(value: unknown): ProvenAdInsight | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ProvenAdInsight>;
  if (v.v !== 1 || typeof v.summary !== "string" || typeof v.relevance !== "string") return null;
  return {
    v: 1,
    relevance: v.relevance,
    study_value: v.study_value === 1 || v.study_value === 2 || v.study_value === 3 ? v.study_value : 2,
    summary: v.summary,
    why: typeof v.why === "string" ? v.why : "",
    hook: typeof v.hook === "string" ? v.hook : "",
    creative: typeof v.creative === "string" ? v.creative : "",
    beats: Array.isArray(v.beats) ? v.beats.filter((b) => b && typeof b.label === "string" && typeof b.text === "string") : [],
    run_it: Array.isArray(v.run_it) ? v.run_it.filter((s) => typeof s === "string") : [],
    needs: Array.isArray(v.needs) ? v.needs.filter((s) => typeof s === "string") : [],
    best_for: Array.isArray(v.best_for) ? v.best_for.filter((s) => typeof s === "string") : [],
    watch_out: typeof v.watch_out === "string" ? v.watch_out : "",
    model: typeof v.model === "string" ? v.model : "",
  };
}

/**
 * The row as the library page sees it. `forOwner` drops what a facility
 * owner has no business reading: admin notes, who entered it, the raw source
 * payload (never selected for the page in the first place).
 */
export function presentProvenAd<T extends ProvenAdRow>(row: T, now: Date = new Date(), forOwner = false) {
  const days = daysRunning(row, now);
  const insight = readInsight(row.insight);
  return {
    id: row.id,
    source: row.source,
    source_ad_id: row.source_ad_id,
    platform: row.platform,
    publisher_platforms: row.publisher_platforms,
    advertiser_name: row.advertiser_name,
    advertiser_page_id: row.advertiser_page_id,
    advertiser_url: row.advertiser_url,
    format: row.format,
    headline: row.headline,
    primary_text: row.primary_text,
    description: row.description,
    cta: row.cta,
    landing_url: row.landing_url,
    snapshot_url: row.snapshot_url,
    media_refs: row.media_refs,
    country: row.country,
    state: row.state,
    city: row.city,
    offer_type: row.offer_type,
    unit_type: row.unit_type,
    angle: row.angle,
    audience: row.audience ?? null,
    advertiser_scale: row.advertiser_scale ?? null,
    family_size: row.family_size ?? 1,
    study_value: row.study_value ?? null,
    started_at: row.started_at,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    confirmed_through: confirmedThrough(row, now),
    ended_at: row.ended_at,
    active: row.active,
    notes: forOwner ? null : row.notes,
    created_by: forOwner ? null : row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    days_running: days,
    proven: isProven(row, now),
    why_flagged: whyFlagged(row, now),
    insight: insight && insight.relevance === "renter" ? insight : null,
    relevance: insight?.relevance ?? null,
    insight_pending: row.insight_at == null,
  };
}

export type PresentedProvenAd = ReturnType<typeof presentProvenAd>;
