/**
 * The read on a proven ad, for an independent operator.
 *
 * A long-running ad is evidence, not an explanation. This turns the evidence
 * into something an operator can use: what the ad is, why it has kept
 * running, how it is built, and how to run their own version honestly. It also
 * corrects the regex classification (offer, unit, angle, format) and adds the
 * facts the library filters on (audience, advertiser scale, market).
 *
 * One request shape serves both paths: the proven-ads.insights job calls it
 * one ad at a time, and a bulk seed sends the same params through the Message
 * Batches API. Never prose without the model — when there is no key, the row
 * keeps its facts and shows no read rather than a generic one.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ADVERTISER_SCALES,
  AD_FORMATS,
  ANGLES,
  AUDIENCES,
  OFFER_TYPES,
  UNIT_TYPES,
  type AdFormat,
  type AdvertiserScale,
  type Angle,
  type Audience,
  type OfferType,
  type ProvenAdInsight,
  type UnitType,
} from "./types";

export const INSIGHT_MODEL = "claude-opus-5-5";

export const RELEVANCE = ["renter", "investor", "b2b", "jobs", "listing", "not_storage"] as const;
export type Relevance = (typeof RELEVANCE)[number];

export const InsightOutput = z.object({
  relevance: z.enum(RELEVANCE),
  study_value: z.literal([1, 2, 3]),
  summary: z.string(),
  why: z.string(),
  hook: z.string(),
  creative: z.string(),
  beats: z.array(z.object({ label: z.string(), text: z.string() })),
  run_it: z.array(z.string()),
  needs: z.array(z.string()),
  best_for: z.array(z.string()),
  watch_out: z.string(),
  offer_type: z.enum(OFFER_TYPES),
  unit_type: z.enum(UNIT_TYPES),
  angle: z.enum(ANGLES),
  format: z.enum(AD_FORMATS),
  audience: z.enum(AUDIENCES),
  advertiser_scale: z.enum(ADVERTISER_SCALES),
  city: z.string(),
  state: z.string(),
  country: z.string(),
});
export type InsightOutput = z.infer<typeof InsightOutput>;

/**
 * The structured-output schema, straight from zod. (The SDK's zod helper
 * turns enums into descriptions; the API enforces real enums, so we send
 * those.)
 */
export const INSIGHT_SCHEMA: Record<string, unknown> = (() => {
  const { $schema: _drop, ...schema } = z.toJSONSchema(InsightOutput) as Record<string, unknown>;
  return schema;
})();

export const INSIGHT_SYSTEM_PROMPT = `You read self-storage ads for StorageAds, the marketing system independent self-storage operators run to fill units. Every ad you see has been running on Meta for at least 60 days. Nobody pays for two months of an ad that isn't renting units, so treat the run length as evidence the ad works, and explain the mechanism.

Be honest about what kind of long runner it is. Some ads run for years because a small operator set a few dollars a day on a one-line "we're here" ad and never touched it. That proves the owner kept paying for presence, not that the copy is strong. Say that plainly when it's the case, and make the lesson the habit (always-on, local, cheap), not the words. Other ads run long because the offer, the hook and the button are doing real work. Say what that work is.

Your reader owns or manages one to five facilities. Busy, skeptical, smart, has been burned by agencies. Write operator to operator, the way one owner would explain an ad to another at a conference bar. Plain words. Short sentences, one idea each. Numbers over adjectives. Concrete over abstract. Contractions are fine.

Never write: optimize, leverage, engagement, funnel, conversion, impressions, ROAS, CPL, CTR, KPI, synergy, solution, platform, unlock, empower, best-in-class, cutting-edge, game-changer, compelling, seamless. No em dashes or en dashes; use a period or a comma. No exclamation marks, emoji or hashtags.

Truth rules:
- You know only what is in the ad, its images and the metadata given. Do not invent facts about the advertiser, the market, prices or results.
- Never claim performance numbers for the ad (clicks, costs, move-ins, rates). The run length and the number of live variants are the only performance evidence you have, and you may cite them.
- Do not copy the ad. Describe what each part does in your own words. Quote at most four consecutive words from it, and only when the exact words are the point.

Fields:
- relevance: "renter" when the ad sells storage space to people who would rent it: self storage, climate units, RV, boat and vehicle storage or parking, portable storage containers, business or wine storage, a storage facility's own moving supplies or truck rental. Otherwise "investor" (storage as an investment, syndications, courses, facilities for sale), "b2b" (software, construction, steel buildings, services sold to operators), "jobs" (hiring), "listing" (a person's marketplace listing, a building, shop or lot for lease), "not_storage" (anything else, including movers, junk removal, cleaning, cars). When it isn't "renter", leave every prose field an empty string or empty list, set study_value to 1, and still fill the classification fields.
- study_value: how much an independent operator can take from this ad. 3: a clear, transferable structure with a specific hook, offer or proof worth copying. 2: solid and ordinary, a sound template with nothing special. 1: a bare presence ad (a name, a place, one generic line), worth knowing about but little to copy.
- summary: one sentence, at most 140 characters. What this ad is, said the way an operator would say it. Lead with the offer or the move.
- why: two or three sentences, at most 420 characters. Why it has kept running: the renter problem it answers, the friction it removes, what makes the offer believable. Specific to this ad, never generic marketing advice.
- hook: at most 110 characters. What stops the scroll in the first second, the opening line or the visual, described rather than quoted.
- creative: at most 200 characters. What the image or video frame shows and how it is laid out, written as a direction someone could shoot or design from. Empty string when no image was provided.
- beats: the ad's structure in reading order, two to five beats. Each beat has a label of one or two words (Hook, Problem, Proof, Offer, Reassurance, Urgency, Action, and so on) and text of at most 90 characters saying what that part does.
- run_it: exactly three steps, each at most 150 characters, telling an independent operator how to run their own version: what to lead with, what photo or short video to make with a phone at their own facility, what to put in the headline and button. Imperative mood. Never tell them to reuse this advertiser's name, photos or words.
- needs: one to four things the operator must really have for this ad to be honest, each at most 40 characters ("A real first-month special", "Online rentals", "Drive-up units", "Reviews worth citing").
- best_for: one to three situations this ad fits, each at most 32 characters ("Lease-up", "Climate vacancy", "Peak moving season", "RV and boat lots", "Small-town market").
- watch_out: one sentence, at most 160 characters, on how this ad goes wrong when copied. Empty string when there is nothing real to say.
- offer_type: first_month_free (any free month, including "first 2 months free"), dollar_move_in, percent_off, free_truck, no_offer, other (a different promotion: free lock, price lock, waived fee, gift card).
- unit_type: the unit the ad leads with: climate_controlled, drive_up, vehicle (RV, boat, car, parking), business, general.
- angle: the main persuasion move: social_proof, convenience, urgency, lifestyle, price, other.
- format: image, video, carousel, text, unknown. Use the format given unless the creative clearly shows otherwise.
- audience: who it's aimed at: movers, declutterers, vehicle_owners, businesses, students, military, general.
- advertiser_scale: national (a REIT or a brand in many states: Public Storage, Extra Space, CubeSmart, U-Haul, StorageMart, Life Storage, SmartStop and the like), regional (a multi-site operator in one region), independent (one to a few facilities).
- city, state, country: only when the ad, the advertiser name or the landing page address states them. state is a two-letter US code, country an ISO two-letter code (US whenever a US state is stated). Empty string when not stated; never guess a state from a city name alone.`;

/** What the model needs to know about one ad. */
export interface InsightSubject {
  advertiser_name: string;
  page_categories?: string[];
  started_at: Date | string;
  days_running: number;
  family_size: number;
  format: string | null;
  publisher_platforms?: string[];
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  cta?: string | null;
  landing_url?: string | null;
  cards?: { title?: string | null; body?: string | null }[];
}

function isoDate(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

function landingLabel(url: string | null | undefined): string {
  if (!url) return "(none)";
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url.slice(0, 120);
  }
}

export function buildInsightText(s: InsightSubject, imageCount: number): string {
  const lines = [
    "AD, from the public Meta Ad Library",
    `advertiser: ${s.advertiser_name}`,
    s.page_categories?.length ? `page categories: ${s.page_categories.join(", ")}` : null,
    `running since: ${isoDate(s.started_at)} (${s.days_running} days)`,
    s.family_size > 1
      ? `live variants: ${s.family_size} ads use this creative, usually one per location`
      : "live variants: 1",
    `format: ${s.format ?? "unknown"}`,
    s.publisher_platforms?.length ? `placements: ${s.publisher_platforms.join(", ")}` : null,
    `headline: ${s.headline?.trim() || "(none)"}`,
    `primary text: ${s.primary_text?.trim() || "(none)"}`,
    `link description: ${s.description?.trim() || "(none)"}`,
    `button: ${s.cta?.trim() || "(none)"}`,
    `landing page: ${landingLabel(s.landing_url)}`,
  ];
  const cards = (s.cards ?? []).filter((c) => c.title || c.body).slice(0, 5);
  if (cards.length) {
    lines.push("cards:");
    cards.forEach((c, i) => lines.push(`  ${i + 1}. ${[c.title, c.body].filter(Boolean).join(" | ")}`));
  }
  lines.push(
    imageCount > 0
      ? `images attached: ${imageCount} (the creative${imageCount > 1 ? " frames or cards" : ""})`
      : "images attached: none, so leave creative empty"
  );
  return lines.filter((l): l is string => l !== null).join("\n");
}

/**
 * The Messages API params for one ad. Image URLs must be fetchable by the
 * API at request time (the Ad Library's signed CDN links last a few days).
 */
export function insightRequestParams(
  s: InsightSubject,
  imageUrls: string[] = []
): Anthropic.MessageCreateParamsNonStreaming {
  const images = imageUrls.slice(0, 3);
  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (url): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "url", url } })
    ),
    { type: "text", text: buildInsightText(s, images.length) },
  ];
  return {
    model: INSIGHT_MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: INSIGHT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: INSIGHT_SCHEMA } },
  };
}

/** Sentence-safe cut: never ends mid-word, never leaves a dangling comma. */
export function clamp(text: string, max: number): string {
  const t = tidy(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const wordEnds = t[max] === " ";
  const space = cut.lastIndexOf(" ");
  const kept = wordEnds ? cut : space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,;:.]+$/, "")}.`;
}

/** House rules the prompt asks for, enforced: no dashes as punctuation, no shouting. */
export function tidy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/!+/g, ".")
    .replace(/\s+/g, " ")
    .replace(/,\s*\./g, ".")
    .trim();
}

export interface ParsedInsight {
  insight: ProvenAdInsight;
  facts: {
    offer_type: OfferType;
    unit_type: UnitType;
    angle: Angle;
    format: AdFormat;
    audience: Audience;
    advertiser_scale: AdvertiserScale;
    city: string | null;
    state: string | null;
    country: string | null;
  };
}

function place(value: string, pattern: RegExp, max: number): string | null {
  const v = value.trim();
  return v && pattern.test(v) ? v.slice(0, max) : null;
}

const NO_PROSE = {
  summary: "",
  why: "",
  hook: "",
  creative: "",
  beats: [],
  run_it: [],
  needs: [],
  best_for: [],
  watch_out: "",
};

/**
 * Validate, clamp and tidy what the model returned. Null when it is unusable:
 * off-schema, or a renter ad with no summary or reasoning.
 */
export function parseInsightOutput(raw: unknown, model: string = INSIGHT_MODEL): ParsedInsight | null {
  const parsed = InsightOutput.safeParse(raw);
  if (!parsed.success) return null;
  const o = parsed.data;

  const facts: ParsedInsight["facts"] = {
    offer_type: o.offer_type,
    unit_type: o.unit_type,
    angle: o.angle,
    format: o.format,
    audience: o.audience,
    advertiser_scale: o.advertiser_scale,
    city: place(o.city, /^[A-Za-z .'-]{2,}$/, 120),
    state: place(o.state.toUpperCase(), /^[A-Z]{2}$/, 2),
    country: place(o.country.toUpperCase(), /^[A-Z]{2}$/, 2),
  };

  if (o.relevance !== "renter") {
    return { insight: { v: 1, relevance: o.relevance, study_value: 1, ...NO_PROSE, model }, facts };
  }

  const summary = clamp(o.summary, 160);
  const why = clamp(o.why, 480);
  if (!summary || !why) return null;

  const insight: ProvenAdInsight = {
    v: 1,
    relevance: "renter",
    study_value: o.study_value,
    summary,
    why,
    hook: clamp(o.hook, 130),
    creative: clamp(o.creative, 230),
    beats: o.beats
      .filter((b) => b.label.trim() && b.text.trim())
      .slice(0, 5)
      .map((b) => ({ label: clamp(b.label, 20).replace(/\.$/, ""), text: clamp(b.text, 110) })),
    run_it: o.run_it.filter((s) => s.trim()).slice(0, 3).map((s) => clamp(s, 170)),
    needs: o.needs.filter((s) => s.trim()).slice(0, 4).map((s) => clamp(s, 44).replace(/\.$/, "")),
    best_for: o.best_for.filter((s) => s.trim()).slice(0, 3).map((s) => clamp(s, 36).replace(/\.$/, "")),
    watch_out: clamp(o.watch_out, 180),
    model,
  };
  return { insight, facts };
}

/** Read the JSON out of a finished message. Null on refusal, truncation or bad JSON. */
export function insightFromMessage(message: Anthropic.Message): ParsedInsight | null {
  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") return null;
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) return null;
  try {
    return parseInsightOutput(JSON.parse(text), message.model || INSIGHT_MODEL);
  } catch {
    return null;
  }
}

/** One ad, one request. Used by the insights job for new rows. */
export async function generateInsight(
  s: InsightSubject,
  imageUrls: string[],
  apiKey: string
): Promise<ParsedInsight | null> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create(insightRequestParams(s, imageUrls));
  return insightFromMessage(message);
}
