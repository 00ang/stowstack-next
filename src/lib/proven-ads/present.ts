import { daysRunning, isProven, whyFlagged } from "./days-running";

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
}

export function presentProvenAd<T extends ProvenAdRow>(row: T, now: Date = new Date()) {
  const days = daysRunning(row, now);
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
    started_at: row.started_at,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    ended_at: row.ended_at,
    active: row.active,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    days_running: days,
    proven: isProven(row, now),
    why_flagged: whyFlagged(row, now),
  };
}
