import { blocksToSections } from "./blocks";
import { draftFromTemplate } from "./templates";
import type { PageDraft, PageFacts } from "./types";

/**
 * The sample facility’s fall page. Headline is deliberately not the ad’s
 * line, so the editor has one real suggestion to try. Every rate is a
 * sample-facility rate from demo-rows, not a result.
 */
export const SAMPLE_AD_HEADLINE = "Room for the whole garage";

export function sampleFallFacts(): PageFacts {
  return {
    facilityName: "Maple Street Storage",
    address: "Maple Street, Springfield",
    phone: null,
    hours: "Office open 7 days. Gate 6am to 10pm.",
    sizes: ["10x20", "10x15", "10x10"],
    offerName: "First Month $1",
    offerDetail: "On 10x20 and 10x15.",
    adHeadline: null,
    units: [
      { key: "10x10", name: "10x10", rate: 119, vacant: 18, total: 80, climate: false, features: ["Drive-up"] },
      { key: "10x15", name: "10x15", rate: 159, vacant: 4, total: 40, climate: false, features: ["Drive-up"] },
      { key: "10x20", name: "10x20", rate: 199, vacant: 6, total: 30, climate: false, features: ["Drive-up"] },
      { key: "10x10 Climate", name: "10x10 Climate", rate: 139, vacant: 12, total: 40, climate: true, features: ["Climate controlled", "Interior"] },
    ],
    photos: [],
    storedgeUrl: null,
  };
}

export function sampleFallDraft(): PageDraft {
  const facts = sampleFallFacts();
  const draft = draftFromTemplate("lease-up", facts);
  const blocks = draft.blocks.map((b) =>
    b.type === "hero"
      ? { ...b, config: { ...b.config, headline: "Fall move season at Maple Street", subheadline: "10x20 drive-up units. First month is $1." } }
      : b,
  );
  return { title: "Fall move season at Maple Street", blocks, storedgeUrl: null };
}

export function sampleFallSections() {
  return blocksToSections(sampleFallDraft().blocks);
}
