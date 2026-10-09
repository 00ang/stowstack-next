import { slugify } from "@/lib/funnel-graph/catalog";
import { findBlock, makeBlock, textOf } from "./blocks";
import type { Block, PageDraft, PageFacts, PageTemplateKey, UnitFact } from "./types";

export const TEMPLATE_META: Record<PageTemplateKey, { label: string; line: string }> = {
  "lease-up": { label: "Lease-up", line: "The open sizes, the rate, and a way to reserve." },
  climate: { label: "Climate special", line: "Climate units, with the rate beside each size." },
  size: { label: "One size", line: "A single size, its rate, and how many are open." },
  seasonal: { label: "Seasonal offer", line: "The special that’s running, on the sizes it applies to." },
};

function money(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function byNames(units: UnitFact[], names: string[]): UnitFact[] {
  if (!names.length) return units;
  const want = new Set(names.map((n) => n.toLowerCase()));
  const hit = units.filter((u) => want.has(u.name.toLowerCase()) || want.has(u.key.toLowerCase()));
  return hit.length ? hit : units;
}

function accessItems(units: UnitFact[]): { title: string; desc: string }[] {
  const features = [...new Set(units.flatMap((u) => u.features))].slice(0, 6);
  return features.map((title) => ({ title, desc: "" }));
}

function faqItems(facts: PageFacts, names: string[]): { q: string; a: string }[] {
  const items: { q: string; a: string }[] = [];
  if (facts.hours) items.push({ q: "What are the hours?", a: facts.hours });
  if (names.length) {
    items.push({
      q: "Which sizes are on this page?",
      a: `${names.join(", ")}. The rate and how many are open come from the facility’s current units.`,
    });
  }
  items.push({
    q: "How do I reserve?",
    a: facts.storedgeUrl
      ? "Use Reserve on this page. It goes through storEDGE."
      : "Leave your number and the office will call you back.",
  });
  return items;
}

function hero(facts: PageFacts, headline: string, sub: string, photo: string): Block {
  return makeBlock("hero", {
    headline,
    subheadline: sub,
    backgroundImage: photo,
    facilityName: facts.facilityName,
  });
}

function unitsBlock(headline: string, names: string[]): Block {
  return makeBlock("units", { headline, live: true, sizeKeys: names });
}

function location(facts: PageFacts): Block {
  return makeBlock("location", {
    headline: "Find the facility",
    address: facts.address ?? "",
    hours: facts.hours ?? "",
    phone: facts.phone ?? "",
  });
}

function sharedTail(facts: PageFacts, names: string[], units: UnitFact[]): Block[] {
  const blocks: Block[] = [
    makeBlock("reserve", { label: "Reserve a unit" }),
    makeBlock("ask", { headline: "Leave your number. We’ll get back to you." }),
    location(facts),
  ];
  const access = accessItems(units);
  if (access.length) blocks.push(makeBlock("access", { headline: "At the facility", items: access }));
  blocks.push(makeBlock("faq", { headline: "Questions", items: faqItems(facts, names) }));
  if (facts.photos.length) {
    blocks.push(makeBlock("photos", { images: facts.photos.slice(0, 8) }));
  }
  return blocks;
}

function priceLine(units: UnitFact[]): string | null {
  const rated = units.filter((u) => u.rate != null).sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
  if (!rated.length) return null;
  const low = money(rated[0].rate);
  return low ? `From ${low}/mo` : null;
}

function subhead(facts: PageFacts, units: UnitFact[]): string {
  const price = priceLine(units);
  const offer = facts.offerName;
  return [price, offer].filter(Boolean).join(". ");
}

/**
 * A page built only from the facility’s own facts. No reviews, no
 * results, no rate that wasn’t on the unit.
 */
export function blocksForTemplate(key: PageTemplateKey, facts: PageFacts): Block[] {
  const photo = facts.photos[0]?.url ?? "";
  if (key === "climate") {
    const climate = facts.units.filter((u) => u.climate);
    const pool = climate.length ? climate : facts.units;
    const names = pool.map((u) => u.name);
    const headline = facts.adHeadline || `Climate-controlled units at ${facts.facilityName}`;
    return [
      hero(facts, headline, subhead(facts, pool), photo),
      unitsBlock("Climate units", names),
      ...(facts.offerName ? [makeBlock("offer", { name: facts.offerName, detail: facts.offerDetail ?? "" })] : []),
      ...sharedTail(facts, names, pool),
    ];
  }
  if (key === "size") {
    const named = facts.sizes.length ? byNames(facts.units, facts.sizes) : facts.units;
    const one = [...named].sort((a, b) => b.vacant - a.vacant)[0];
    const pool = one ? [one] : [];
    const names = pool.map((u) => u.name);
    const headline = facts.adHeadline || (one ? `${one.name} at ${facts.facilityName}` : facts.facilityName);
    return [
      hero(facts, headline, subhead(facts, pool), photo),
      ...(names.length ? [unitsBlock(one?.name ?? "This size", names)] : []),
      ...(facts.offerName ? [makeBlock("offer", { name: facts.offerName, detail: facts.offerDetail ?? "" })] : []),
      ...sharedTail(facts, names, pool),
    ];
  }
  if (key === "seasonal") {
    const pool = facts.sizes.length ? byNames(facts.units, facts.sizes) : facts.units;
    const names = pool.map((u) => u.name);
    const headline = facts.adHeadline || facts.offerName || `A current offer at ${facts.facilityName}`;
    return [
      hero(facts, headline, subhead(facts, pool), photo),
      ...(facts.offerName ? [makeBlock("offer", { name: facts.offerName, detail: facts.offerDetail ?? "" })] : []),
      ...(names.length ? [unitsBlock("Sizes this offer applies to", names)] : []),
      ...sharedTail(facts, names, pool),
    ];
  }
  const pool = facts.sizes.length ? byNames(facts.units, facts.sizes) : facts.units.filter((u) => u.vacant > 0);
  const shown = pool.length ? pool : facts.units;
  const names = shown.map((u) => u.name);
  const headline = facts.adHeadline || `Open units at ${facts.facilityName}`;
  return [
    hero(facts, headline, subhead(facts, shown), photo),
    ...(names.length ? [unitsBlock("Available units", names)] : []),
    ...(facts.offerName ? [makeBlock("offer", { name: facts.offerName, detail: facts.offerDetail ?? "" })] : []),
    ...sharedTail(facts, names, shown),
  ];
}

/** Which template fits the campaign’s sizes and offer. The ad’s line becomes the headline. */
export function draftFromCampaign(facts: PageFacts): PageDraft {
  const named = facts.sizes.length ? byNames(facts.units, facts.sizes) : facts.units;
  const allClimate = named.length > 0 && named.every((u) => u.climate);
  const key: PageTemplateKey = allClimate ? "climate" : facts.sizes.length === 1 ? "size" : facts.offerName ? "seasonal" : "lease-up";
  const blocks = blocksForTemplate(key, facts);
  const headline = textOf(findBlock(blocks, "hero"), "headline") || facts.facilityName;
  return { title: headline, blocks, storedgeUrl: facts.storedgeUrl };
}

export function draftFromTemplate(key: PageTemplateKey, facts: PageFacts): PageDraft {
  const blocks = blocksForTemplate(key, facts);
  const headline = textOf(findBlock(blocks, "hero"), "headline") || TEMPLATE_META[key].label;
  return { title: headline, blocks, storedgeUrl: facts.storedgeUrl };
}

export function slugFor(title: string, taken: string[] = []): string {
  const base = slugify(title).slice(0, 80) || "page";
  if (!taken.includes(base)) return base;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`.slice(0, 110);
}
