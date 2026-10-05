/**
 * Turn a proven ad into an original draft for a facility.
 *
 * The structure, angle, offer type and format stay. The words, the name, the
 * photos and the logo do not. Reusing another operator's creative is both a
 * trademark problem and a bad ad — the duplicate has to sound like this
 * facility, at this price, in this town.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ANGLE_LABELS, type AdaptedCopy, type FacilitySnapshot } from "./types";
import type { Angle } from "./types";

export interface SourceCopy {
  advertiser_name: string;
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  cta?: string | null;
  city?: string | null;
  angle?: string | null;
  offer_type?: string | null;
  format?: string | null;
  platform?: string | null;
}

const META_CTAS = new Set([
  "Learn More",
  "Get Quote",
  "Book Now",
  "Contact Us",
  "Sign Up",
  "Shop Now",
  "Apply Now",
]);

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s$%]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export function ngramOverlap(a: string, b: string, n = 6): string | null {
  const left = normalizeWords(a);
  const right = new Set<string>();
  const rw = normalizeWords(b);
  if (rw.length < n || left.length < n) return null;
  for (let i = 0; i <= rw.length - n; i++) {
    right.add(rw.slice(i, i + n).join(" "));
  }
  for (let i = 0; i <= left.length - n; i++) {
    const gram = left.slice(i, i + n).join(" ");
    if (right.has(gram)) return gram;
  }
  return null;
}

/** Tokens we must never emit: the other facility's name, and its city if ours differs. */
export function bannedPhrases(source: SourceCopy, facility: FacilitySnapshot): string[] {
  const out: string[] = [];
  const name = source.advertiser_name?.trim();
  if (name && name.length >= 3) out.push(name);
  if (name) {
    const stripped = name.replace(/,?\s+(inc\.?|llc|ltd|corp\.?|co\.)$/i, "").trim();
    if (stripped && stripped !== name && stripped.length >= 3) out.push(stripped);
  }
  const theirCity = source.city?.trim();
  const ourCity = facility.city?.trim();
  if (theirCity && theirCity.length >= 3 && ourCity && theirCity.toLowerCase() !== ourCity.toLowerCase()) {
    out.push(theirCity);
  }
  return out;
}

export function containsBanned(text: string, phrases: string[]): string | null {
  const hay = text.toLowerCase();
  for (const p of phrases) {
    if (p && hay.includes(p.toLowerCase())) return p;
  }
  return null;
}

export function isVerbatimCopy(adapted: AdaptedCopy, source: SourceCopy): string | null {
  const pairs: [string, string | null | undefined][] = [
    [adapted.headline, source.headline],
    [adapted.primaryText, source.primary_text],
    [adapted.description, source.description],
  ];
  for (const [got, src] of pairs) {
    if (!got || !src) continue;
    if (normalizeWords(got).join(" ") === normalizeWords(src).join(" ") && normalizeWords(src).length >= 3) {
      return got;
    }
    const overlap = ngramOverlap(got, src, 6);
    if (overlap) return overlap;
  }
  return null;
}

export function mapCta(sourceCta: string | null | undefined): string {
  if (!sourceCta) return "Learn More";
  const trimmed = sourceCta.trim();
  if (META_CTAS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes("book") || lower.includes("reserve")) return "Book Now";
  if (lower.includes("quote")) return "Get Quote";
  if (lower.includes("call") || lower.includes("contact")) return "Contact Us";
  return "Learn More";
}

function money(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n)}/mo`;
}

/**
 * Original copy that keeps the source's angle and offer type without using
 * any of its words. Used when Claude is unavailable and as a fallback when
 * a model rewrite fails the scrub.
 */
export function fallbackAdapt(source: SourceCopy, facility: FacilitySnapshot): AdaptedCopy {
  const angle = (source.angle && source.angle in ANGLE_LABELS ? source.angle : "other") as Angle;
  const city = facility.city || facility.location || "town";
  const rate = money(facility.fromRate);
  const offer = facility.specials[0] || null;
  const rating =
    facility.rating && facility.reviewCount
      ? `${facility.rating.toFixed(1)}★ from ${facility.reviewCount} reviews`
      : facility.rating
        ? `${facility.rating.toFixed(1)}★ locally`
        : null;
  const vacant = facility.vacantUnits;

  let primaryText: string;
  let headline: string;
  let description: string;

  switch (angle) {
    case "social_proof":
      headline = rating ? rating.slice(0, 40) : facility.name.slice(0, 40);
      primaryText = rating
        ? `${rating}. ${facility.name} in ${city}${rate ? `, from ${rate}` : ""}.`
        : `${facility.name} in ${city}${rate ? ` — from ${rate}` : ""}.`;
      description = "Rated by neighbors";
      break;
    case "convenience":
      headline = `Storage in ${city}`.slice(0, 40);
      primaryText = `${facility.name} — reserve a unit online. No long lease${rate ? `, from ${rate}` : ""}.`;
      description = "Reserve in minutes";
      break;
    case "urgency":
      headline = vacant && vacant > 0 ? `${vacant} units open` : "Units still open";
      primaryText = `${facility.name} in ${city}${offer ? `. ${offer}` : ""}${rate ? `. From ${rate}` : ""}.`;
      description = "Lock in this rate";
      break;
    case "lifestyle":
      headline = "Room to breathe";
      primaryText = `Clear the house. ${facility.name} in ${city}${rate ? `, climate-controlled from ${rate}` : ""}.`;
      description = "Reclaim your space";
      break;
    case "price":
      headline = (offer || rate || "Simple monthly rates").slice(0, 40);
      primaryText = `${facility.name} in ${city}${rate ? ` from ${rate}` : ""}${offer ? `. ${offer}` : ""}.`;
      description = "See current rates";
      break;
    default:
      headline = facility.name.slice(0, 40);
      primaryText = `${facility.name} in ${city}${rate ? ` — units from ${rate}` : ""}.`;
      description = "Self storage nearby";
  }

  return {
    angle,
    angleLabel: ANGLE_LABELS[angle],
    primaryText: primaryText.slice(0, 220),
    headline: headline.slice(0, 40),
    description: description.slice(0, 30),
    cta: mapCta(source.cta),
    targetingNote: `Adapted from a proven ${source.platform ?? "meta"} ad. Structure and offer kept; copy rewritten for ${facility.name}.`,
  };
}

export function scrubAdapted(
  adapted: AdaptedCopy,
  source: SourceCopy,
  facility: FacilitySnapshot
): { ok: true } | { ok: false; reason: string } {
  const banned = bannedPhrases(source, facility);
  const blob = `${adapted.headline} ${adapted.primaryText} ${adapted.description} ${adapted.targetingNote}`;
  const hit = containsBanned(blob, banned);
  if (hit) return { ok: false, reason: `adapted copy still names "${hit}"` };
  const verbatim = isVerbatimCopy(adapted, source);
  if (verbatim) return { ok: false, reason: `adapted copy reuses source wording: "${verbatim}"` };
  return { ok: true };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse adapted copy as JSON");
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

export function parseAdaptedJson(raw: unknown): AdaptedCopy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const headline = typeof o.headline === "string" ? o.headline.trim() : "";
  const primaryText = typeof o.primaryText === "string" ? o.primaryText.trim() : "";
  if (!headline || !primaryText) return null;
  const angle = typeof o.angle === "string" ? o.angle : "other";
  return {
    angle,
    angleLabel:
      typeof o.angleLabel === "string"
        ? o.angleLabel
        : ANGLE_LABELS[angle as Angle] ?? "Other",
    primaryText,
    headline,
    description: typeof o.description === "string" ? o.description : "",
    cta: mapCta(typeof o.cta === "string" ? o.cta : null),
    targetingNote:
      typeof o.targetingNote === "string"
        ? o.targetingNote
        : `Adapted for a different facility. Structure kept; copy rewritten.`,
  };
}

export const ADAPT_SYSTEM_PROMPT = `You rewrite self-storage ad copy for a DIFFERENT facility.

You are given a source ad that has been running a long time (so the structure, angle, offer type and format are worth keeping) and a target facility.

RULES — never break these:
- Write original copy. Do not reuse the source headline, primary text, or any 6+ word phrase from the source.
- Do not use the source advertiser's name, city (unless it is also the target city), logo, photos, or landing URL.
- Use the target facility's name, city, rates, rating, and current specials.
- Keep the same angle and the same kind of offer (first month free stays first month free — but only if the target actually has that special; otherwise use the target's real special or a clean rate lead).
- Keep Meta field lengths: headline ≤ 40 chars, description ≤ 30 chars, primaryText 80–125 chars when possible.
- CTA must be one of: Learn More, Get Quote, Book Now, Contact Us, Sign Up.
- Return ONLY JSON: { "angle", "angleLabel", "primaryText", "headline", "description", "cta", "targetingNote" }`;

export function buildAdaptUserMessage(source: SourceCopy, facility: FacilitySnapshot): string {
  return [
    "SOURCE AD (structure only — do not copy words or names):",
    `angle: ${source.angle ?? "other"}`,
    `offer_type: ${source.offer_type ?? "unknown"}`,
    `format: ${source.format ?? "unknown"}`,
    `cta_style: ${source.cta ?? "Learn More"}`,
    `source_headline (DO NOT REUSE): ${source.headline ?? "(none)"}`,
    `source_primary (DO NOT REUSE): ${source.primary_text ?? "(none)"}`,
    "",
    "TARGET FACILITY (use these facts):",
    `name: ${facility.name}`,
    `location: ${facility.location}`,
    `city: ${facility.city ?? ""}`,
    `state: ${facility.state ?? ""}`,
    `rating: ${facility.rating ?? "unknown"} (${facility.reviewCount ?? 0} reviews)`,
    `from_rate: ${facility.fromRate != null ? `$${facility.fromRate}/mo` : "unknown"}`,
    `vacant_units: ${facility.vacantUnits ?? "unknown"}`,
    `open_unit_types: ${facility.openUnitTypes.join(", ") || "unknown"}`,
    `specials: ${facility.specials.join(" | ") || "none on file"}`,
    "",
    "Rewrite the ad for the target. JSON only.",
  ].join("\n");
}

export async function rewriteWithClaude(
  source: SourceCopy,
  facility: FacilitySnapshot,
  apiKey: string
): Promise<AdaptedCopy> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: ADAPT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildAdaptUserMessage(source, facility) }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response");
  const parsed = parseAdaptedJson(parseJsonObject(block.text.trim()));
  if (!parsed) throw new Error("Claude returned copy we could not read");
  return parsed;
}

export async function adaptForFacility(
  source: SourceCopy,
  facility: FacilitySnapshot,
  apiKey: string | null
): Promise<{ copy: AdaptedCopy; via: "claude" | "fallback" }> {
  if (apiKey) {
    try {
      const copy = await rewriteWithClaude(source, facility, apiKey);
      const scrub = scrubAdapted(copy, source, facility);
      if (scrub.ok) return { copy, via: "claude" };
    } catch {
      // Fall through — a missing model must not block the draft.
    }
  }
  const copy = fallbackAdapt(source, facility);
  return { copy, via: "fallback" };
}

export function studioPlatform(platform: string | null | undefined): string {
  if (platform === "google") return "google_search";
  if (platform === "tiktok") return "meta_feed";
  return "meta_feed";
}

export function studioFormat(format: string | null | undefined): string {
  if (format === "video") return "video";
  if (format === "carousel") return "carousel";
  if (format === "text") return "text";
  return "static";
}

export async function persistAdaptedDraft(args: {
  facilityId: string;
  provenAdId: string;
  copy: AdaptedCopy;
  format: string | null | undefined;
  platform: string | null | undefined;
}): Promise<{ id: string }> {
  const existingBrief = await db.creative_briefs.findFirst({
    where: { facility_id: args.facilityId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const briefId =
    existingBrief?.id ??
    (
      await db.creative_briefs.create({
        data: {
          facility_id: args.facilityId,
          brief_json: { source: "proven_ads", proven_ad_id: args.provenAdId } as unknown as Prisma.InputJsonValue,
          platform_recommendation: [studioPlatform(args.platform)],
          status: "draft",
        },
      })
    ).id;

  const agg = await db.ad_variations.aggregate({
    where: { facility_id: args.facilityId },
    _max: { version: true },
  });
  const version = (agg._max.version || 0) + 1;

  const row = await db.ad_variations.create({
    data: {
      facility_id: args.facilityId,
      brief_id: briefId,
      platform: studioPlatform(args.platform),
      format: studioFormat(args.format),
      angle: args.copy.angle,
      content_json: {
        ...args.copy,
        source_proven_ad_id: args.provenAdId,
        adapted: true,
      } as unknown as Prisma.InputJsonValue,
      status: "draft",
      version,
      source_proven_ad_id: args.provenAdId,
    },
  });
  return { id: row.id };
}
