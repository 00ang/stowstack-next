import { findBlock, makeBlock, textOf, updateBlock } from "./blocks";
import type { Block, InsightInput, PageFix, PageInsight } from "./types";

const STOP = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "on", "in", "your", "you", "at", "with", "from", "this", "that", "are", "our"]);

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9×x]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
  return norm(value)
    .split(" ")
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

/** True when the headline and the ad are the same promise, allowing a shorter or longer line. Words in the facility's name don't count. */
export function headlinesMatch(headline: string, ad: string, facilityName = ""): boolean {
  const h = norm(headline);
  const a = norm(ad);
  if (!h || !a) return true;
  if (h.includes(a) || a.includes(h)) return true;
  const place = new Set(tokens(facilityName));
  const have = new Set(tokens(headline).filter((t) => !place.has(t)));
  const adTokens = tokens(ad).filter((t) => !place.has(t));
  if (!adTokens.length || !have.size) return false;
  return adTokens.some((t) => have.has(t));
}

function clip(value: string, max = 48): string {
  const t = value.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`;
}

function fold(value: string): string {
  return value.toLowerCase().replace(/×/g, "x").replace(/\s+/g, "");
}

function showsPrice(blocks: Block[], input: InsightInput): boolean {
  const units = findBlock(blocks, "units");
  if (!units) return false;
  if (units.config.live === true) {
    const keys = Array.isArray(units.config.sizeKeys) ? (units.config.sizeKeys as string[]) : [];
    const pool = input.units.filter((u) => u.rate != null);
    if (!keys.length) return pool.length > 0;
    const want = new Set(keys.map(fold));
    return pool.some((u) => want.has(fold(u.name)));
  }
  const typed = units.config.units;
  return Array.isArray(typed) && typed.some((row) => {
    const price = row && typeof row === "object" ? (row as { price?: unknown }).price : null;
    return typeof price === "string" && /\$?\d/.test(price);
  });
}

function sizeWithRate(input: InsightInput): string | null {
  const named = input.campaignSizes.find((s) => s.rate != null);
  if (named) return named.name;
  const any = [...input.units].filter((u) => u.rate != null).sort((a, b) => b.vacant - a.vacant)[0];
  return any?.name ?? null;
}

/**
 * The first things wrong with a page, each with one reason from the
 * facility’s own facts and one fix. Empty when the page already says
 * what the campaign says.
 */
export function pageInsights(input: InsightInput): PageInsight[] {
  const out: PageInsight[] = [];
  const hero = findBlock(input.blocks, "hero");
  const headline = textOf(hero, "headline");
  const ad = input.adHeadline?.trim() ?? "";

  if (ad && !headlinesMatch(headline, ad, input.facilityName ?? "")) {
    out.push({
      id: "headline",
      line: `The ad says “${clip(ad)}”. This headline doesn’t.`,
      why: "People who tap that ad should land on the same line.",
      fixLabel: "Use the ad’s line",
      fix: { kind: "set-headline", headline: ad },
    });
  }

  const sized = sizeWithRate(input);
  if (sized && !showsPrice(input.blocks, input)) {
    out.push({
      id: "price",
      line: "This page has no price on it.",
      why: `Pages for ${sized} show the rate.`,
      fixLabel: "Show the rate",
      fix: { kind: "live-units", sizeKeys: input.campaignSizes.length ? input.campaignSizes.map((s) => s.name) : [sized] },
    });
  }

  if (input.offerName && !findBlock(input.blocks, "offer")) {
    out.push({
      id: "offer",
      line: `${clip(input.offerName, 42)} isn’t on the page.`,
      why: "It’s the special this campaign is running.",
      fixLabel: "Add the special",
      fix: { kind: "add-offer", name: input.offerName, detail: input.offerDetail ?? "" },
    });
  }

  if (input.expectsReserve && !findBlock(input.blocks, "reserve")) {
    out.push({
      id: "reserve",
      line: "People can’t reserve on this page.",
      why: "This campaign takes reservations through storEDGE.",
      fixLabel: "Add Reserve",
      fix: { kind: "add", block: "reserve" },
    });
  }

  if (!findBlock(input.blocks, "ask")) {
    out.push({
      id: "ask",
      line: "There’s nowhere to ask.",
      why: "A visit becomes a lead when someone leaves a number.",
      fixLabel: "Add the form",
      fix: { kind: "add", block: "ask" },
    });
  }

  return out;
}

/** Apply one insight’s fix. The next insight, if any, is whatever is still true. */
export function applyFix(blocks: Block[], fix: PageFix): Block[] {
  if (fix.kind === "set-headline") {
    const hero = findBlock(blocks, "hero");
    if (!hero) return [makeBlock("hero", { headline: fix.headline }), ...blocks];
    return updateBlock(blocks, hero.id, { headline: fix.headline });
  }
  if (fix.kind === "live-units") {
    const units = findBlock(blocks, "units");
    if (!units) {
      const heroAt = blocks.findIndex((b) => b.type === "hero");
      const block = makeBlock("units", { headline: "Available units", live: true, sizeKeys: fix.sizeKeys });
      const next = blocks.slice();
      next.splice(heroAt + 1, 0, block);
      return next;
    }
    return updateBlock(blocks, units.id, { live: true, sizeKeys: fix.sizeKeys });
  }
  if (fix.kind === "add-offer") {
    if (findBlock(blocks, "offer")) return blocks;
    const block = makeBlock("offer", { name: fix.name, detail: fix.detail });
    const at = blocks.findIndex((b) => b.type === "units");
    const next = blocks.slice();
    next.splice(at >= 0 ? at : 1, 0, block);
    return next;
  }
  if (findBlock(blocks, fix.block)) return blocks;
  const block = makeBlock(fix.block);
  const next = blocks.slice();
  next.push(block);
  return next;
}
