import type { ObjectTypeKey } from "./types";

/**
 * Addresses, and the small normalisers they depend on. Every function here is
 * pure and locale-free, so an address computed on the server is byte-for-byte
 * the address computed in the browser.
 */

/** "10x10 Climate Controlled!" → "10x10-climate-controlled". Never empty. */
export function slugify(input: string, fallback = "item"): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** First six hex characters of a uuid: enough to tell siblings apart, short enough to say. */
export function shortId(id: string): string {
  return id.replace(/[^a-f0-9]/gi, "").slice(0, 6).toLowerCase() || "000000";
}

export function addressOf(type: ObjectTypeKey, slug: string): string {
  return `${type}/${slug}`;
}

const SIZE_RE = /(\d+(?:\.\d+)?)\s*(?:'|’|ft\.?|feet)?\s*[x×X*]\s*(\d+(?:\.\d+)?)/;

/** Trim "10.0" to "10", keep "7.5". */
function num(n: string | number): string {
  const v = typeof n === "number" ? n : parseFloat(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
}

/**
 * The size an object talks about, as a bare key: "10' x 10'" → "10x10".
 * Returns null when no size is stated. Used to link units, leads, tours,
 * tenants, ads and competitor prices that name the same size.
 */
export function sizeKey(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = c.match(SIZE_RE);
    if (m) return `${num(m[1])}x${num(m[2])}`;
  }
  return null;
}

/** Every size key mentioned anywhere in a block of text. */
export function sizeKeysIn(text: string): Set<string> {
  const out = new Set<string>();
  const re = new RegExp(SIZE_RE.source, "g");
  for (const m of text.matchAll(re)) out.add(`${num(m[1])}x${num(m[2])}`);
  return out;
}

/** "10x10" → "10×10", for display. */
export function prettySize(text: string): string {
  return text.replace(/(\d)\s*[xX*]\s*(\d)/g, "$1×$2");
}

/** 129 → "$129", 129.5 → "$129.50". */
export function money(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
}

/** "$1,299.00/mo" → 1299. Null when there is no number. */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO → "Sep 30", in UTC so the server and the browser agree. */
export function monthDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Whole days from `iso` to `now` (never negative). */
export function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86_400_000));
}

/** "a lead", "2 leads". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cut text at a word boundary, no ellipsis glyph tricks: "Great place to…". */
export function excerpt(text: string | null | undefined, max = 90): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,.;:\s]+$/, "")}…`;
}

/** A display name for a raw channel string: "google_ads" → "Google Ads". */
export function channelName(raw: string | null | undefined): string {
  if (!raw) return "direct";
  const known: Record<string, string> = {
    meta: "Meta",
    facebook: "Facebook",
    instagram: "Instagram",
    google: "Google",
    google_ads: "Google Ads",
    gbp: "Google Business",
    organic: "search",
    tiktok: "TikTok",
    direct: "direct",
    referral: "a referral",
    phone: "a call",
    call: "a call",
    walkin: "a walk-in",
    email: "email",
  };
  const key = raw.toLowerCase();
  return known[key] ?? key.replace(/[_-]+/g, " ");
}
