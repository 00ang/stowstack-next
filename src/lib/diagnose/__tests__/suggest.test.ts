import { describe, expect, it } from "vitest";
import { NODE_TYPES, validateGraph, type FunnelContext } from "@/lib/funnel-graph";
import { digestFacility } from "@/lib/diagnose/digest";
import { SUGGESTION_TEMPLATES, buildSuggestedGraph } from "@/lib/diagnose/graphs";
import { maplePicture } from "@/lib/diagnose/sample";
import { blankPicture, type FacilityPicture, type UnitFact } from "@/lib/diagnose/picture";
import { graphForSuggestion, suggestFunnels } from "@/lib/diagnose/suggest";

const goal = { moveIns: 8, month: "October" };
const ctx: FunnelContext = {
  goal,
  offers: [{ key: "stay-offer", name: "Stay a while", deal: "Half off one month", active: true }],
};

function unit(over: Partial<UnitFact> & Pick<UnitFact, "key" | "name" | "empty" | "total">): UnitFact {
  return { sizeKey: over.name.toLowerCase(), streetRate: null, webRate: null, climate: false, ...over };
}

function picture(over: Partial<FacilityPicture>): FacilityPicture {
  return blankPicture(over);
}

describe("suggestFunnels", () => {
  it("maps each gap onto one draft funnel and says why", () => {
    const input = picture({
      units: [
        unit({ key: "ten", name: "10x10", empty: 18, total: 80, webRate: 119 }),
        unit({ key: "climate", name: "10x10 Climate", sizeKey: "10x10", empty: 12, total: 40, webRate: 139, climate: true }),
      ],
      leads30: { total: 9, withContact: 8, waiting: 3, movedIn: 2, reservedOpen: 0 },
      calls: { total30: 11, missed30: 4 },
      snapshot: { at: "2026-10-01", occupancyPct: 78, moveIns: 2, moveOuts: 7, totalUnits: 120, occupiedUnits: 94 },
      intake: {
        role: "Owner",
        stage: null,
        unitsBand: null,
        occupancyBand: null,
        moveBalance: null,
        pain: null,
        adSpendBand: null,
        timeline: null,
        freeText: null,
        onlineRental: "No",
        googleAds: null,
      },
      google: { rating: 3.8, reviewCount: 9, unanswered: 1, unansweredLow: 1, lowestUnanswered: 2 },
    });
    const suggestions = suggestFunnels(input, digestFacility(input), ctx);
    const byId = Object.fromEntries(suggestions.map((s) => [s.id, s]));
    expect(byId.vacant_sizes.template).toBe("vacant-size");
    expect(byId.conversion.template).toBe("recovery");
    expect(byId.retention.template).toBe("stay");
    expect(byId.google.template).toBe("reviews");
    expect(byId.online_rental.template).toBe("rent-online");
    expect(suggestions[0].severity).toBeGreaterThanOrEqual(suggestions[1].severity);
    for (const suggestion of suggestions) {
      expect(suggestion.why.length).toBeGreaterThan(0);
      expect(suggestion.why[0].sourceLabel.length).toBeGreaterThan(0);
      expect(suggestion.metric.length).toBeGreaterThan(0);
      expect(suggestion.targets.length).toBeGreaterThan(0);
      expect(suggestion.name.toLowerCase()).not.toMatch(/optimize|unlock|guaranteed/);
    }
    expect(byId.stay ?? byId.retention.offerKey).toBe("stay-offer");
  });

  it("uses follow-up when the gap is unanswered asks, not missed calls", () => {
    const input = picture({
      leads30: { total: 6, withContact: 6, waiting: 3, movedIn: 1, reservedOpen: 0 },
    });
    const [suggestion] = suggestFunnels(input);
    expect(suggestion.template).toBe("follow-up");
    expect(suggestion.why[0].text).toMatch(/haven't heard back/);
  });
});

describe("buildSuggestedGraph", () => {
  it("builds every template as a paused draft from existing step types", () => {
    for (const template of SUGGESTION_TEMPLATES) {
      const graph = buildSuggestedGraph({
        template,
        sizeKeys: ["ten", "climate"],
        offerKey: "stay-offer",
        goal,
        ctx,
      });
      expect(graph.status).toBe("draft");
      expect(graph.name?.length).toBeGreaterThan(0);
      for (const node of graph.nodes) {
        expect(NODE_TYPES).toContain(node.type);
        if (node.type === "meta" || node.type === "google") {
          expect(node.params.budget === "" || node.params.budget == null).toBe(true);
        }
      }
      const gaps = validateGraph(graph);
      expect(gaps, `${template}: ${gaps.map((g) => g.sentence).join("; ")}`).toEqual([]);
    }
  });

  it("pre-fills the Maple Street empty-size funnel without publishing it", () => {
    const now = new Date("2026-10-11T15:00:00.000Z");
    const input = maplePicture(now);
    const [top] = suggestFunnels(input, digestFacility(input), ctx);
    expect(top.template).toBe("vacant-size");
    expect(top.sample).toBe(true);
    const graph = graphForSuggestion(top, goal, ctx);
    expect(graph.status).toBe("draft");
    expect(graph.nodes.map((n) => n.type)).toEqual(
      expect.arrayContaining(["units", "page", "reserve", "textback", "follow", "movein"]),
    );
    const sizes = graph.nodes.find((n) => n.type === "units")?.params.sizes;
    expect(sizes).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(validateGraph(graph)).toEqual([]);
  });
});
