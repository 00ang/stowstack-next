/**
 * Meta Ad Library API adapter.
 *
 * Official Graph endpoint: GET /ads_archive.
 * Docs: https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 *
 * Coverage, in Meta's own words: ads that did not reach any location in the
 * EU (or UK) are returned only if they are about social issues, elections or
 * politics. A self-storage ad that ran only in the US will not come back
 * from this endpoint. We query EU/UK markets as a compliant proxy for
 * brands that also advertise there, and we do not scrape facebook.com/ads/
 * library to fill the US gap — that would be a ToS problem. US commercial
 * ads enter the library through the manual / CSV path.
 */

import type { ProvenAdDraft } from "../types";
import { classify } from "../classify";
import type { AdapterSearch, FetchPage, SourceAdapter } from "./types";

export const META_AD_LIBRARY_SOURCE = "meta_ad_library_api" as const;
export const META_GRAPH_VERSION = "v21.0";

const ARCHIVE_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "publisher_platforms",
  "languages",
].join(",");

export interface MetaArchivedAd {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
  languages?: string[];
}

export interface MetaSearchConfig {
  searchTerms?: string;
  countries?: string[];
  pageIds?: string[];
  platforms?: string[];
  limit?: number;
}

export function metaAccessToken(): string | null {
  return process.env.META_AD_LIBRARY_TOKEN || process.env.META_ACCESS_TOKEN || null;
}

function first(list?: string[] | null): string | null {
  const v = list?.find((s) => typeof s === "string" && s.trim());
  return v ? v.trim() : null;
}

function dateOnly(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function isActive(stop: string | undefined, now: Date): boolean {
  if (!stop) return true;
  const t = new Date(stop).getTime();
  return Number.isFinite(t) && t > now.getTime();
}

/**
 * Map one ads_archive row onto our draft. Exported so the mapping can be
 * tested without hitting Graph.
 */
export function mapMetaAd(
  raw: MetaArchivedAd,
  country: string | null,
  now: Date = new Date()
): ProvenAdDraft | null {
  if (!raw.id) return null;
  const started = dateOnly(raw.ad_delivery_start_time);
  if (!started) return null;

  const bodies = raw.ad_creative_bodies ?? [];
  const titles = raw.ad_creative_link_titles ?? [];
  const captions = raw.ad_creative_link_captions ?? [];
  const descriptions = raw.ad_creative_link_descriptions ?? [];
  const bodyCount = Math.max(bodies.length, titles.length, 1);

  const draft: ProvenAdDraft = {
    source: META_AD_LIBRARY_SOURCE,
    source_ad_id: String(raw.id),
    platform: "meta",
    publisher_platforms: raw.publisher_platforms ?? [],
    advertiser_name: (raw.page_name || "Unknown advertiser").slice(0, 200),
    advertiser_page_id: raw.page_id ?? null,
    headline: first(titles) ?? first(captions),
    primary_text: first(bodies),
    description: first(descriptions),
    cta: null,
    landing_url: null,
    snapshot_url: raw.ad_snapshot_url ?? null,
    media_refs: raw.ad_snapshot_url
      ? [{ kind: "image", url: raw.ad_snapshot_url }]
      : null,
    country: country?.slice(0, 2).toUpperCase() ?? null,
    started_at: started,
    last_seen_at: now.toISOString(),
    ended_at: isActive(raw.ad_delivery_stop_time, now)
      ? null
      : raw.ad_delivery_stop_time ?? null,
    active: isActive(raw.ad_delivery_stop_time, now),
    raw,
    created_by: "system",
  };

  const classified = classify(draft, bodyCount);
  draft.offer_type = classified.offer_type;
  draft.unit_type = classified.unit_type;
  draft.angle = classified.angle;
  draft.format = classified.format;
  return draft;
}

function countriesOf(config: MetaSearchConfig): string[] {
  const raw = config.countries;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((c) => String(c).toUpperCase()).slice(0, 10);
  }
  // Default to markets where Meta actually archives commercial ads.
  return ["GB"];
}

export function buildArchiveUrl(
  config: MetaSearchConfig,
  token: string,
  cursor: string | null
): string {
  const params = new URLSearchParams();
  params.set("access_token", token);
  params.set("fields", ARCHIVE_FIELDS);
  params.set("ad_type", "ALL");
  params.set("ad_active_status", "ALL");
  params.set("ad_reached_countries", JSON.stringify(countriesOf(config)));
  params.set("limit", String(Math.min(config.limit ?? 25, 50)));
  if (config.searchTerms) params.set("search_terms", config.searchTerms);
  if (config.pageIds?.length) {
    params.set("search_page_ids", JSON.stringify(config.pageIds));
  }
  if (config.platforms?.length) {
    params.set("publisher_platforms", JSON.stringify(config.platforms));
  }
  if (cursor) params.set("after", cursor);
  return `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params.toString()}`;
}

async function fetchPage(search: AdapterSearch, cursor: string | null): Promise<FetchPage> {
  const token = metaAccessToken();
  if (!token) {
    return {
      ads: [],
      nextCursor: null,
      note: "META_AD_LIBRARY_TOKEN (or META_ACCESS_TOKEN) is not set. Automated Meta refresh is idle; use the manual / CSV path.",
    };
  }

  const config = (search.config ?? {}) as MetaSearchConfig;
  const url = buildArchiveUrl(config, token, cursor);
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as {
    data?: MetaArchivedAd[];
    paging?: { cursors?: { after?: string }; next?: string };
    error?: { message?: string };
  };

  if (!res.ok) {
    const message = json.error?.message || `Meta Ad Library HTTP ${res.status}`;
    throw new Error(message);
  }

  const country = countriesOf(config)[0] ?? null;
  const ads = (json.data ?? [])
    .map((row) => mapMetaAd(row, country))
    .filter((d): d is ProvenAdDraft => d !== null);

  const after = json.paging?.cursors?.after ?? null;
  return {
    ads,
    nextCursor: after && json.paging?.next ? after : null,
    note:
      ads.length === 0
        ? "No ads returned. For commercial creatives the API only archives ads that reached the EU or UK."
        : undefined,
  };
}

export const metaAdLibraryAdapter: SourceAdapter = {
  id: META_AD_LIBRARY_SOURCE,
  coverage:
    "Official Meta Ad Library API. Commercial ads only when they reached the EU or UK. US-only self-storage ads are not returned — seed those by hand from the public Ad Library page.",
  automated: true,
  configured: () => Boolean(metaAccessToken()),
  fetchPage,
};
