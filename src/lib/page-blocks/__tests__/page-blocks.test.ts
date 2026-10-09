import { describe, expect, it } from "vitest";
import { askSizeOptions } from "@/components/landing/block-page";
import { applyFix, findBlock, headlinesMatch, pageInsights, sectionsToBlocks, textOf } from "../index";
import { blocksToSections } from "../blocks";
import { nextVersion, publicView, sameSnapshot, shouldFreezePrevious, snapshotOf } from "../publish";
import { draftFromCampaign, draftFromTemplate } from "../templates";
import { SAMPLE_AD_HEADLINE, sampleFallDraft, sampleFallFacts } from "../sample";
import type { InsightInput, PageFacts } from "../types";

const facts: PageFacts = {
  facilityName: "Maple Street Storage",
  address: "Maple Street, Springfield",
  phone: "555-0100",
  hours: "Gate 6am to 10pm.",
  sizes: ["10x20"],
  offerName: "First Month $1",
  offerDetail: "On 10x20.",
  adHeadline: "Room for the whole garage",
  units: [
    { key: "10x20", name: "10x20", rate: 199, vacant: 6, total: 30, climate: false, features: ["Drive-up"] },
    { key: "10x10 Climate", name: "10x10 Climate", rate: 139, vacant: 12, total: 40, climate: true, features: ["Climate controlled"] },
  ],
  photos: [],
  storedgeUrl: "https://storedge.example/maple",
};

function input(over: Partial<InsightInput> = {}): InsightInput {
  const draft = draftFromCampaign(facts);
  return {
    blocks: draft.blocks,
    campaignSizes: [{ name: "10x20", rate: 199 }],
    units: facts.units,
    adHeadline: facts.adHeadline,
    offerName: facts.offerName,
    offerDetail: facts.offerDetail,
    expectsReserve: true,
    ...over,
  };
}

describe("page blocks", () => {
  it("round-trips blocks through sections, including a section the editor doesn't own", () => {
    const draft = draftFromTemplate("size", facts);
    const sections = blocksToSections(draft.blocks);
    sections.push({ section_type: "trust_bar", sort_order: sections.length, config: { items: [{ text: "Drive-up" }] } });
    const back = sectionsToBlocks(sections);
    expect(back.map((b) => b.type)).toContain("units");
    expect(back.find((b) => b.type === "custom")?.config.section_type).toBe("trust_bar");
    const again = blocksToSections(back);
    expect(again.find((s) => s.section_type === "trust_bar")?.config).toEqual({ items: [{ text: "Drive-up" }] });
    expect(findBlock(back, "units")?.config.live).toBe(true);
  });

  it("builds a lease-up page from facility facts and never invents a testimonial", () => {
    const draft = draftFromTemplate("lease-up", facts);
    expect(draft.blocks.map((b) => b.type)).toEqual(
      expect.arrayContaining(["hero", "units", "offer", "reserve", "ask", "location"]),
    );
    expect(draft.blocks.some((b) => b.type === "custom" || JSON.stringify(b.config).toLowerCase().includes("testimonial"))).toBe(false);
    const units = findBlock(draft.blocks, "units");
    expect(units?.config.live).toBe(true);
    expect(units?.config.sizeKeys).toEqual(["10x20"]);
    expect(JSON.stringify(units?.config)).not.toMatch(/\$199/);
  });

  it("uses the ad's line as the headline when the draft comes from the campaign", () => {
    const draft = draftFromCampaign(facts);
    expect(textOf(findBlock(draft.blocks, "hero"), "headline")).toBe("Room for the whole garage");
    expect(draft.storedgeUrl).toBe(facts.storedgeUrl);
  });
});

describe("insight rules", () => {
  it("matches a headline that carries the ad's line", () => {
    expect(headlinesMatch("Room for the whole garage", "Room for the whole garage")).toBe(true);
    expect(headlinesMatch("Room for the whole garage — Maple Street", "Room for the whole garage")).toBe(true);
    expect(headlinesMatch("Fall move season at Maple Street", SAMPLE_AD_HEADLINE)).toBe(false);
    expect(headlinesMatch("Fall move season at Maple Street", "Storage on Maple Street", "Maple Street Storage")).toBe(false);
    expect(headlinesMatch("Storage on Maple Street", "Storage on Maple Street", "Maple Street Storage")).toBe(true);
  });

  it("says the page has no price, and the fix puts the campaign size's rate on it", () => {
    const bare = input({
      blocks: input().blocks.filter((b) => b.type !== "units"),
    });
    const first = pageInsights(bare)[0];
    expect(first?.id === "headline" || first?.id === "price").toBe(true);
    const price = pageInsights(bare).find((i) => i.id === "price");
    expect(price?.line).toBe("This page has no price on it.");
    expect(price?.why).toBe("Pages for 10x20 show the rate.");
    const fixed = applyFix(bare.blocks, price!.fix);
    expect(pageInsights({ ...bare, blocks: fixed }).some((i) => i.id === "price")).toBe(false);
    expect(findBlock(fixed, "units")?.config.live).toBe(true);
  });

  it("flags a headline that doesn't match the ad, and a missing Reserve, each with one fix", () => {
    const sample = sampleFallDraft();
    const insights = pageInsights({
      blocks: sample.blocks.filter((b) => b.type !== "reserve"),
      campaignSizes: [{ name: "10x20", rate: 199 }],
      units: sampleFallFacts().units,
      adHeadline: SAMPLE_AD_HEADLINE,
      offerName: "First Month $1",
      offerDetail: "On 10x20 and 10x15.",
      expectsReserve: true,
    });
    expect(insights[0]).toMatchObject({
      id: "headline",
      line: "The ad says “Room for the whole garage”. This headline doesn’t.",
      fixLabel: "Use the ad’s line",
    });
    const reserve = insights.find((i) => i.id === "reserve");
    expect(reserve?.why).toMatch(/storEDGE/);
    const withLine = applyFix(sample.blocks, insights[0].fix);
    expect(textOf(findBlock(withLine, "hero"), "headline")).toBe(SAMPLE_AD_HEADLINE);
    const withReserve = applyFix(
      sample.blocks.filter((b) => b.type !== "reserve"),
      reserve!.fix,
    );
    expect(findBlock(withReserve, "reserve")).toBeTruthy();
  });

  it("stays quiet when the page already says what the campaign says", () => {
    expect(pageInsights(input())).toEqual([]);
  });
});

describe("publishing and versioning", () => {
  const draft = draftFromCampaign(facts);
  const snap = snapshotOf({
    title: draft.title,
    metaTitle: null,
    metaDescription: null,
    storedgeWidgetUrl: draft.storedgeUrl,
    editor: "blocks",
    blocks: draft.blocks,
  });

  it("serves the snapshot after publish, and keeps serving it while the draft changes", () => {
    const edited = applyFix(draft.blocks, { kind: "set-headline", headline: "A different line entirely" });
    const view = publicView({
      status: "published",
      title: "A different line entirely",
      metaTitle: null,
      metaDescription: null,
      storedgeWidgetUrl: null,
      themeEditor: "blocks",
      sections: blocksToSections(edited).map((s, i) => ({ ...s, id: `s${i}` })),
      snapshot: snap,
    });
    expect(view?.fromSnapshot).toBe(true);
    expect(view?.title).toBe(draft.title);
    const hero = view?.sections.find((s) => s.section_type === "hero");
    expect(hero?.config.headline).toBe("Room for the whole garage");
  });

  it("hides a draft that has never been published", () => {
    expect(
      publicView({
        status: "draft",
        title: draft.title,
        metaTitle: null,
        metaDescription: null,
        storedgeWidgetUrl: null,
        themeEditor: "blocks",
        sections: [],
        snapshot: null,
      }),
    ).toBeNull();
  });

  it("keeps serving sections for a page published before versioning", () => {
    const sections = blocksToSections(draft.blocks);
    const view = publicView({
      status: "published",
      title: draft.title,
      metaTitle: "meta",
      metaDescription: null,
      storedgeWidgetUrl: null,
      themeEditor: "legacy",
      sections: sections.map((s, i) => ({ ...s, id: `s${i}` })),
      snapshot: null,
    });
    expect(view?.fromSnapshot).toBe(false);
    expect(view?.editor).toBe("legacy");
    expect(view?.sections).toHaveLength(sections.length);
  });

  it("freezes the live copy on the first draft edit, and versions only when the snapshot changes", () => {
    expect(shouldFreezePrevious({ status: "published", hasSnapshot: false, publishing: false })).toBe(true);
    expect(shouldFreezePrevious({ status: "published", hasSnapshot: true, publishing: false })).toBe(false);
    expect(shouldFreezePrevious({ status: "published", hasSnapshot: false, publishing: true })).toBe(false);
    expect(shouldFreezePrevious({ status: "draft", hasSnapshot: false, publishing: false })).toBe(false);

    const first = nextVersion({ lastVersion: 0, previous: null, next: snap });
    expect(first).toEqual({ version: 1, write: true });
    const again = nextVersion({ lastVersion: 1, previous: snap, next: snap });
    expect(again).toEqual({ version: 1, write: false });
    const changed = snapshotOf({
      title: "Updated",
      metaTitle: null,
      metaDescription: null,
      storedgeWidgetUrl: null,
      editor: "blocks",
      blocks: draft.blocks,
    });
    expect(sameSnapshot(snap, changed)).toBe(false);
    expect(nextVersion({ lastVersion: 1, previous: snap, next: changed })).toEqual({ version: 2, write: true });
  });
});

describe("ask size options", () => {
  it("keeps two unit types that share a size label", () => {
    const options = askSizeOptions([
      { key: "10x10", name: "10x10", size: "10' x 10'", rate: 119, vacant: 18, total: 80, features: ["Drive-up"], climate: false },
      { key: "10x10 Climate", name: "10x10 Climate", size: "10' x 10'", rate: 139, vacant: 12, total: 40, features: ["Climate controlled"], climate: true },
    ]);
    expect(options.map((o) => o.key)).toEqual(["10x10", "10x10 Climate"]);
    expect(new Set(options.map((o) => o.label)).size).toBe(2);
    expect(options[0].label).toMatch(/Drive-up/);
    expect(options[1].label).toMatch(/Climate/);
  });
});
