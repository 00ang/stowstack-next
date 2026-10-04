/**
 * Touch — the pure half (MISSION.md s12).
 *
 * No database, no clock, no request. Everything that decides what a visit WAS
 * (which channel, which source, which click id) and what a lead's history SAYS
 * (first touch, latest touch, which click to report) lives here, because those
 * are the rules that must be right and a DB test would hide them.
 *
 * The model in one line: a touch is append-only. "First touch" and "latest
 * touch" are questions asked of a lead's touches, never fields that get
 * overwritten — which is the whole fix for the first-vs-last fight.
 */

import crypto from "crypto";

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid"] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

export type TouchKind = "visit" | "call";

export type Channel =
  | "paid_search"
  | "paid_social"
  | "paid_other"
  | "organic_search"
  | "organic_social"
  | "email"
  | "referral"
  | "direct"
  | "call";

/** The columns of a `touches` row that describe the arrival itself. */
export interface TouchFields {
  kind: TouchKind;
  channel: Channel;
  source: string | null;
  url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  ttclid: string | null;
  msclkid: string | null;
}

/** A stored touch, as the attribution functions below read it. */
export interface TouchRecord extends TouchFields {
  id?: string;
  occurred_at: Date;
}

const LIMITS: Record<string, number> = { url: 2000, referrer: 2000, source: 64, fbp: 128 };
const clip = (v: string | null | undefined, max: number): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

// ── Channel rules ──────────────────────────────────────────────────────────

const PAID_SEARCH_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "paid-search", "sem", "search_ads"]);
const PAID_SOCIAL_MEDIUMS = new Set(["paid_social", "paidsocial", "paid-social", "social_paid", "social-paid", "cpm_social"]);
const PAID_OTHER_MEDIUMS = new Set(["display", "cpm", "banner", "video", "retargeting", "remarketing", "programmatic", "ctv"]);
const SOCIAL_MEDIUMS = new Set(["social", "organic_social", "social-organic", "social_organic"]);
const ORGANIC_MEDIUMS = new Set(["organic", "gbp", "local", "maps", "google_business_profile"]);
const EMAIL_MEDIUMS = new Set(["email", "e-mail", "newsletter", "sms", "text"]);

const SEARCH_SOURCES = new Set(["google", "bing", "yahoo", "duckduckgo", "ecosia", "baidu", "yandex", "microsoft"]);
const META_SOURCES = new Set(["facebook", "fb", "meta", "instagram", "ig"]);

/** Referring hosts. Matched by suffix, so l.facebook.com and m.facebook.com count. */
const SEARCH_HOSTS: [string, string][] = [
  ["google.", "google"], ["bing.com", "bing"], ["duckduckgo.com", "duckduckgo"],
  ["search.yahoo.com", "yahoo"], ["yahoo.com", "yahoo"], ["ecosia.org", "ecosia"],
  ["baidu.com", "baidu"], ["yandex.", "yandex"],
];
const SOCIAL_HOSTS: [string, string][] = [
  ["facebook.com", "meta"], ["fb.com", "meta"], ["instagram.com", "meta"], ["messenger.com", "meta"],
  ["t.co", "x"], ["x.com", "x"], ["twitter.com", "x"], ["linkedin.com", "linkedin"], ["lnkd.in", "linkedin"],
  ["tiktok.com", "tiktok"], ["pinterest.", "pinterest"], ["reddit.com", "reddit"],
  ["youtube.com", "youtube"], ["nextdoor.com", "nextdoor"], ["threads.net", "meta"],
];

function hostOf(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hostMatches(host: string, pattern: string): boolean {
  // "google." matches google.com, google.co.uk, www.google.de …
  if (pattern.endsWith(".")) return host === pattern.slice(0, -1) || host.startsWith(pattern) || host.includes(`.${pattern}`);
  return host === pattern || host.endsWith(`.${pattern}`);
}

function lookupHost(host: string, table: [string, string][]): string | null {
  for (const [pattern, name] of table) if (hostMatches(host, pattern)) return name;
  return null;
}

/**
 * Decide the channel and source of an arrival.
 *
 * Order of evidence, strongest first:
 *   1. Click ids the ad platforms add themselves (gclid/gbraid/wbraid, msclkid, ttclid).
 *   2. utm_medium, which we control on every ad we build.
 *   3. The referrer.
 *
 * fbclid is deliberately NOT proof of a paid click: Meta appends it to every
 * outbound link, organic posts included. It still gets stored (it is what
 * Meta matches a conversion on); it just does not, alone, make a visit paid.
 */
export function classify(
  p: Partial<Record<UtmKey | ClickIdKey, string | null>>,
  referrer: string | null,
  ownHosts: string[] = [],
): { channel: Channel; source: string | null } {
  const medium = p.utm_medium?.toLowerCase().trim() || null;
  const utmSource = p.utm_source?.toLowerCase().trim() || null;

  if (p.gclid || p.gbraid || p.wbraid) return { channel: "paid_search", source: "google" };
  if (p.msclkid) return { channel: "paid_search", source: "microsoft" };
  if (p.ttclid) return { channel: "paid_social", source: "tiktok" };

  if (medium) {
    if (PAID_SEARCH_MEDIUMS.has(medium)) {
      // "cpc" on a Meta link is a paid social click mislabelled, not search.
      if (utmSource && META_SOURCES.has(utmSource)) return { channel: "paid_social", source: "meta" };
      return { channel: "paid_search", source: utmSource };
    }
    if (PAID_SOCIAL_MEDIUMS.has(medium)) {
      return { channel: "paid_social", source: utmSource && META_SOURCES.has(utmSource) ? "meta" : utmSource };
    }
    if (PAID_OTHER_MEDIUMS.has(medium)) return { channel: "paid_other", source: utmSource };
    if (EMAIL_MEDIUMS.has(medium)) return { channel: "email", source: utmSource };
    if (SOCIAL_MEDIUMS.has(medium)) {
      return { channel: "organic_social", source: utmSource && META_SOURCES.has(utmSource) ? "meta" : utmSource };
    }
    if (ORGANIC_MEDIUMS.has(medium)) {
      // A Google Business Profile link tagged utm_medium=organic is organic search.
      if (utmSource && SEARCH_SOURCES.has(utmSource)) return { channel: "organic_search", source: utmSource };
      return { channel: "referral", source: utmSource };
    }
  }

  if (p.fbclid) return { channel: "organic_social", source: "meta" };
  if (utmSource) return { channel: "referral", source: utmSource };

  const host = hostOf(referrer);
  if (!host) return { channel: "direct", source: null };
  if (ownHosts.some((h) => hostMatches(host, h.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "")))) {
    return { channel: "direct", source: null }; // navigation inside our own site
  }
  const search = lookupHost(host, SEARCH_HOSTS);
  if (search) return { channel: "organic_search", source: search };
  const social = lookupHost(host, SOCIAL_HOSTS);
  if (social) return { channel: "organic_social", source: social };
  return { channel: "referral", source: host };
}

// ── Parsing an arrival ─────────────────────────────────────────────────────

export interface VisitInput {
  /** The full landing URL, query string included. The only trusted source of params. */
  url: string | null | undefined;
  referrer?: string | null;
  /** Hosts that count as "us" — a referrer from one of these is internal navigation. */
  ownHosts?: string[];
  /** Meta's browser cookies, read from the request, when the pixel has set them. */
  fbc?: string | null;
  fbp?: string | null;
}

/**
 * Turn one landing-page arrival into touch fields.
 *
 * Params come from the URL only. The client also posts its stored "last-touch"
 * params, but those are sticky across visits — trusting them would record last
 * week's campaign again on a direct revisit today.
 */
export function parseVisit(input: VisitInput): TouchFields {
  let params: URLSearchParams | null = null;
  const url = clip(input.url ?? null, LIMITS.url);
  if (url) {
    try {
      params = new URL(url).searchParams;
    } catch {
      params = null;
    }
  }
  const get = (k: string, max: number) => clip(params?.get(k) ?? null, max);

  const p = {
    utm_source: get("utm_source", 200),
    utm_medium: get("utm_medium", 200),
    utm_campaign: get("utm_campaign", 200),
    utm_content: get("utm_content", 200),
    utm_term: get("utm_term", 200),
    gclid: get("gclid", 512),
    gbraid: get("gbraid", 512),
    wbraid: get("wbraid", 512),
    fbclid: get("fbclid", 512),
    ttclid: get("ttclid", 512),
    msclkid: get("msclkid", 512),
  };
  const referrer = clip(input.referrer ?? null, LIMITS.referrer);
  const { channel, source } = classify(p, referrer, input.ownHosts ?? []);

  return {
    kind: "visit",
    channel,
    source: clip(source, LIMITS.source),
    url,
    referrer,
    ...p,
    fbc: clip(input.fbc ?? null, 512),
    fbp: clip(input.fbp ?? null, LIMITS.fbp),
  };
}

export interface CallCampaign {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
}

/**
 * Turn an inbound call into touch fields. A tracked number attached to a UTM
 * link inherits that link's campaign and channel — the number on a Meta ad is a
 * paid-social touch that happened to arrive by phone. A number on no campaign
 * is channel "call", never "direct": somebody found the number somewhere.
 */
export function callTouch(link: CallCampaign | null): TouchFields {
  const p = {
    utm_source: clip(link?.utm_source, 200),
    utm_medium: clip(link?.utm_medium, 200),
    utm_campaign: clip(link?.utm_campaign, 200),
    utm_content: clip(link?.utm_content, 200),
    utm_term: clip(link?.utm_term, 200),
  };
  const c = link ? classify(p, null) : { channel: "call" as Channel, source: null };
  return {
    kind: "call",
    channel: c.channel === "direct" ? "call" : c.channel,
    source: clip(c.source, LIMITS.source),
    url: null,
    referrer: null,
    ...p,
    gclid: null,
    gbraid: null,
    wbraid: null,
    fbclid: null,
    fbc: null,
    fbp: null,
    ttclid: null,
    msclkid: null,
  };
}

/**
 * Should this arrival be written as a touch?
 *
 * Always for a browser's first visit — it is the first touch. After that, only
 * when the arrival carries a source: a bare direct revisit cannot change first
 * touch, latest non-direct touch, or any click id, so storing it would be a
 * database write per pageview that no question ever reads.
 */
export function shouldRecord(touch: Pick<TouchFields, "channel">, isNewVisitor: boolean): boolean {
  return isNewVisitor || touch.channel !== "direct";
}

// ── Reading a lead's history ───────────────────────────────────────────────

const byTime = (a: TouchRecord, b: TouchRecord) => a.occurred_at.getTime() - b.occurred_at.getTime();
const atOrBefore = (rows: TouchRecord[], at?: Date | null) =>
  at ? rows.filter((t) => t.occurred_at.getTime() <= at.getTime()) : rows;

/** The earliest touch. Null when there are none. */
export function firstTouch(rows: TouchRecord[]): TouchRecord | null {
  return rows.length ? [...rows].sort(byTime)[0] : null;
}

/** The most recent touch at or before `at` (the conversion), or overall when `at` is omitted. */
export function latestTouch(rows: TouchRecord[], at?: Date | null): TouchRecord | null {
  const eligible = atOrBefore(rows, at).sort(byTime);
  return eligible.length ? eligible[eligible.length - 1] : null;
}

/**
 * The most recent touch that was not direct — the "last non-direct click" most
 * ad platforms and GA report. Falls back to the latest touch when every touch
 * is direct, so a lead always has an answer.
 */
export function latestNonDirectTouch(rows: TouchRecord[], at?: Date | null): TouchRecord | null {
  const eligible = atOrBefore(rows, at).filter((t) => t.channel !== "direct").sort(byTime);
  return eligible.length ? eligible[eligible.length - 1] : latestTouch(rows, at);
}

export interface AttributionSummary {
  first: TouchRecord | null;
  latest: TouchRecord | null;
  latestNonDirect: TouchRecord | null;
  touchCount: number;
  /** Distinct channels in the order the lead first met them. */
  path: Channel[];
}

export function summarize(rows: TouchRecord[], convertedAt?: Date | null): AttributionSummary {
  const eligible = atOrBefore(rows, convertedAt).sort(byTime);
  const path: Channel[] = [];
  for (const t of eligible) if (!path.includes(t.channel)) path.push(t.channel);
  return {
    first: firstTouch(eligible),
    latest: latestTouch(eligible),
    latestNonDirect: latestNonDirectTouch(eligible),
    touchCount: eligible.length,
    path,
  };
}

// ── Click ids for write-back ───────────────────────────────────────────────

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Google accepts a click-conversion upload up to 90 days after the click. */
export const GOOGLE_CLICK_WINDOW_DAYS = 90;

export interface GoogleClick {
  type: "gclid" | "gbraid" | "wbraid";
  value: string;
  clickedAt: Date;
}

/**
 * The click to report a conversion against on Google: the most recent touch
 * carrying a Google click id, within 90 days before `at`. Exactly one id is
 * sent per conversion, so within a touch gclid beats gbraid beats wbraid
 * (iOS traffic arrives with the braids instead of a gclid).
 */
export function pickGoogleClick(rows: TouchRecord[], at: Date): GoogleClick | null {
  const floor = at.getTime() - GOOGLE_CLICK_WINDOW_DAYS * DAY_MS;
  const withId = rows
    .filter((t) => (t.gclid || t.gbraid || t.wbraid) && t.occurred_at.getTime() <= at.getTime() && t.occurred_at.getTime() >= floor)
    .sort(byTime);
  const t = withId[withId.length - 1];
  if (!t) return null;
  if (t.gclid) return { type: "gclid", value: t.gclid, clickedAt: t.occurred_at };
  if (t.gbraid) return { type: "gbraid", value: t.gbraid, clickedAt: t.occurred_at };
  return { type: "wbraid", value: t.wbraid as string, clickedAt: t.occurred_at };
}

export interface MetaClick {
  fbc: string | null;
  fbp: string | null;
  clickedAt: Date | null;
}

/**
 * Meta's browser identifiers for a lead, from its most recent touches.
 *
 * fbc is the pixel's `_fbc` cookie when we have it; otherwise it is rebuilt
 * from the stored fbclid in Meta's documented `fb.1.<ms>.<fbclid>` form, with
 * the touch's own time as the creation time — which is exactly when the click
 * happened, rather than whenever we happen to send.
 */
export function pickMetaClick(rows: TouchRecord[], at: Date): MetaClick {
  const eligible = atOrBefore(rows, at).sort(byTime).reverse();
  const clicked = eligible.find((t) => t.fbc || t.fbclid) ?? null;
  const withFbp = eligible.find((t) => t.fbp) ?? null;
  let fbc: string | null = null;
  if (clicked?.fbc) fbc = clicked.fbc;
  else if (clicked?.fbclid) fbc = `fb.1.${clicked.occurred_at.getTime()}.${clicked.fbclid}`;
  return { fbc, fbp: withFbp?.fbp ?? null, clickedAt: clicked?.occurred_at ?? null };
}

// ── Phone identity for call touches ────────────────────────────────────────

/** Last ten digits — a US number with or without its +1. Null when there are fewer than ten. */
export function phoneLast10(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** sha256 of the last ten digits. Joins a call to a lead without copying the number. */
export function phoneHash(phone: string | null | undefined): string | null {
  const last10 = phoneLast10(phone);
  return last10 ? crypto.createHash("sha256").update(last10).digest("hex") : null;
}
