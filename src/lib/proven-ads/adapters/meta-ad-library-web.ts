/**
 * Ads observed on the public Meta Ad Library page (facebook.com/ads/library).
 *
 * The Graph ads_archive API only returns commercial ads that reached the EU or
 * UK, so a US self-storage ad never comes back from it. The public Ad Library
 * page does show them, with the same fields. This source takes an export of
 * what that page showed (one observation per ad, the shape below) and turns
 * it into library rows. It never fetches: a person runs the observation and
 * imports the file, so it is never swept as stale either; re-importing a
 * newer export is what re-confirms an ad is still running.
 *
 * What is kept: the copy, the CTA, the landing page (no query string), the
 * advertiser, the run dates and the Ad Library link. What is not: the
 * creative itself. Image and video URLs are signed, expire within days, and
 * belong to the advertiser; the Ad Library link is the reference.
 */

import { classify } from "../classify";
import type { AdFormat, ProvenAdDraft } from "../types";
import type { AdapterSearch, FetchPage, SourceAdapter } from "./types";

export const META_AD_LIBRARY_WEB_SOURCE = "meta_ad_library_web" as const;

/** One ad as the public Ad Library page describes it. */
export interface LibraryObservation {
  /** Library ID (ad_archive_id). */
  id: string;
  /** "N ads use this creative and text" — Meta's own grouping. */
  cc?: number | null;
  page_id?: string | null;
  page?: string | null;
  /** Delivery start, unix seconds. */
  start: number;
  /** Delivery stop (or the observation day for a live ad), unix seconds. */
  end?: number | null;
  active?: boolean | null;
  plat?: string[] | null;
  body?: string | null;
  title?: string | null;
  caption?: string | null;
  cta?: string | null;
  cta_type?: string | null;
  /** IMAGE | VIDEO | CAROUSEL | DCO | DPA | MULTI_IMAGES | MULTI_MEDIAS | TEXT … */
  fmt?: string | null;
  ldesc?: string | null;
  link?: string | null;
  likes?: number | null;
  pcats?: (string | { name?: string })[] | null;
  cards?: {
    body?: string | null;
    title?: string | null;
    link?: string | null;
    cta?: string | null;
    ldesc?: string | null;
    /** Card image (signed CDN link, expires). */
    img?: string | null;
    /** Card video poster frame (signed CDN link, expires). */
    vprev?: string | null;
  }[] | null;
  /** { o: original, r: resized } signed CDN links. */
  images?: ({ o?: string | null; r?: string | null } | null)[] | null;
  /** { prev: poster frame } signed CDN links. */
  videos?: ({ prev?: string | null } | null)[] | null;
  extra?: unknown[] | null;
}

/** Dynamic-creative ads ship template tokens in the top-level fields. */
function real(text: string | null | undefined): string | null {
  if (typeof text !== "string") return null;
  const t = text.trim();
  if (!t || /\{\{[^}]+\}\}/.test(t)) return null;
  return t;
}

/** Ad Library dates are midnight Pacific; noon UTC of that instant lands on the right day in any season. */
export function libraryDate(unixSeconds: number): string | null {
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return null;
  return new Date(unixSeconds * 1000 + 12 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Landing page without tracking parameters; unwraps facebook.com/l.php redirects. */
export function cleanLandingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    let u = new URL(url);
    if (u.hostname.endsWith("facebook.com") && u.pathname === "/l.php") {
      const target = u.searchParams.get("u");
      if (!target) return null;
      u = new URL(target);
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.origin}${u.pathname}`.slice(0, 2000);
  } catch {
    return null;
  }
}

export function libraryFormat(o: Pick<LibraryObservation, "fmt" | "cards" | "videos">): AdFormat {
  const fmt = (o.fmt || "").toUpperCase();
  const cardVideo = (o.cards ?? []).some((c) => Boolean(c.vprev));
  const hasVideo = (o.videos?.length ?? 0) > 0 || cardVideo;
  switch (fmt) {
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "TEXT":
      return "text";
    case "CAROUSEL":
    case "DPA":
    case "MULTI_MEDIAS":
      return "carousel";
    case "MULTI_IMAGES":
      return "image";
    case "DCO":
      return hasVideo ? "video" : "image";
    default:
      return hasVideo ? "video" : "unknown";
  }
}

/**
 * Up to three frames of the creative for the insights job to look at. These
 * are the Ad Library's own signed CDN links: they expire within days, are
 * never shown in the product, and are only read once, by the model.
 */
export function previewUrls(o: Pick<LibraryObservation, "images" | "videos" | "cards">, max = 3): string[] {
  const urls = [
    ...(o.images ?? []).map((i) => i?.r || i?.o),
    ...(o.videos ?? []).map((v) => v?.prev),
    ...(o.cards ?? []).map((c) => c.img || c.vprev),
  ].filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u));
  return Array.from(new Set(urls)).slice(0, max);
}

/** The preview links a library row was imported with, if any are left. */
export function previewUrlsFromRaw(raw: unknown): string[] {
  const list = (raw as { library?: { preview_urls?: unknown } } | null)?.library?.preview_urls;
  return Array.isArray(list) ? list.filter((u): u is string => typeof u === "string").slice(0, 3) : [];
}

export function adLibraryUrl(id: string): string {
  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(id)}`;
}

function firstCard(o: LibraryObservation) {
  return (o.cards ?? []).find((c) => real(c.body) || real(c.title)) ?? null;
}

/**
 * One observation onto a draft. `observedAt` is when the Ad Library showed it
 * (the export time), which becomes last_seen_at.
 */
export function mapObservation(
  o: LibraryObservation,
  observedAt: Date,
  family: { size: number; members: string[] } = { size: Math.max(1, o.cc ?? 1), members: [] }
): ProvenAdDraft | null {
  if (!o?.id) return null;
  const started = libraryDate(o.start);
  if (!started) return null;

  const card = firstCard(o);
  const headline = real(o.title) ?? real(card?.title);
  const primary = real(o.body) ?? real(card?.body);
  const description = real(o.ldesc) ?? real(card?.ldesc);
  const active = o.active !== false;
  const endedAt = !active && o.end ? new Date(o.end * 1000).toISOString() : null;

  const draft: ProvenAdDraft = {
    source: META_AD_LIBRARY_WEB_SOURCE,
    source_ad_id: String(o.id).slice(0, 128),
    platform: "meta",
    publisher_platforms: (o.plat ?? []).map((p) => String(p).toLowerCase()),
    advertiser_name: (o.page || "Unknown advertiser").trim().slice(0, 200),
    advertiser_page_id: o.page_id ? String(o.page_id).slice(0, 64) : null,
    advertiser_url: o.page_id ? `https://www.facebook.com/${encodeURIComponent(o.page_id)}` : null,
    format: libraryFormat(o),
    headline: headline?.slice(0, 500) ?? null,
    primary_text: primary,
    description: description?.slice(0, 1000) ?? null,
    cta: real(o.cta)?.slice(0, 64) ?? real(card?.cta)?.slice(0, 64) ?? null,
    landing_url: cleanLandingUrl(o.link ?? card?.link),
    snapshot_url: adLibraryUrl(String(o.id)),
    media_refs: null,
    started_at: started,
    last_seen_at: observedAt.toISOString(),
    ended_at: endedAt,
    active,
    created_by: "ad-library-import",
    family_size: Math.max(1, family.size),
    raw: {
      library: {
        collation_count: o.cc ?? null,
        page_like_count: o.likes ?? null,
        page_categories: (o.pcats ?? []).map((c) => (typeof c === "string" ? c : c?.name ?? "")).filter(Boolean),
        cta_type: o.cta_type ?? null,
        display_format: o.fmt ?? null,
        card_count: o.cards?.length ?? 0,
        image_count: o.images?.length ?? 0,
        video_count: o.videos?.length ?? 0,
        preview_urls: previewUrls(o),
      },
      family: { size: Math.max(1, family.size), members: family.members.slice(0, 60) },
    },
  };

  const classified = classify(draft, Math.max(1, o.cards?.length ?? 0));
  draft.offer_type = classified.offer_type;
  draft.unit_type = classified.unit_type;
  draft.angle = classified.angle;
  return draft;
}

const STOP = new Set([
  "the", "and", "for", "you", "your", "our", "with", "are", "from", "that", "this", "get", "now",
  "at", "in", "on", "of", "to", "a", "an", "is", "we", "us", "or", "it", "be", "can", "all",
]);

/** The words that make an ad this ad, with numbers, places in digits and filler stripped. */
export function signature(o: LibraryObservation): Set<string> {
  const card = firstCard(o);
  const text = [real(o.title), real(o.body), real(o.ldesc), real(card?.title), real(card?.body)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z\s]/g, " ");
  return new Set(text.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface Family {
  /** The longest-running member; the one the library keeps. */
  representative: LibraryObservation;
  /** Every member's library id, representative first. */
  members: string[];
  /** Live ads in the family, counting Meta's own "N ads use this creative" groups. */
  size: number;
}

/**
 * Collapse one advertiser's near-identical ads into a family. A multi-site
 * operator runs the same creative per location with the address swapped; the
 * library should show the creative once and say how many locations run it.
 */
export function groupFamilies(observations: LibraryObservation[], threshold = 0.6): Family[] {
  const byPage = new Map<string, LibraryObservation[]>();
  for (const o of observations) {
    if (!o?.id) continue;
    const key = o.page_id || `page:${o.page ?? "unknown"}`;
    const list = byPage.get(key) ?? [];
    list.push(o);
    byPage.set(key, list);
  }

  const families: Family[] = [];
  for (const list of byPage.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
    const groups: { sig: Set<string>; obs: LibraryObservation[] }[] = [];
    for (const o of sorted) {
      const sig = signature(o);
      const home = groups.find((g) => jaccard(g.sig, sig) >= threshold);
      if (home) home.obs.push(o);
      else groups.push({ sig, obs: [o] });
    }
    for (const g of groups) {
      families.push({
        representative: g.obs[0],
        members: g.obs.map((o) => o.id),
        size: g.obs.reduce((n, o) => n + Math.max(1, o.cc ?? 1), 0),
      });
    }
  }
  return families;
}

async function fetchPage(_search: AdapterSearch, _cursor: string | null): Promise<FetchPage> {
  return {
    ads: [],
    nextCursor: null,
    note: "Ad Library page observations are imported as a file, not fetched.",
  };
}

export const metaAdLibraryWebAdapter: SourceAdapter = {
  id: META_AD_LIBRARY_WEB_SOURCE,
  coverage:
    "US ads observed on the public Meta Ad Library page and imported as a file. Re-import a newer export to re-confirm they are still running.",
  automated: false,
  configured: () => true,
  fetchPage,
};
