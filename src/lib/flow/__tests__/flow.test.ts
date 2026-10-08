import { describe, expect, it } from "vitest";
import { buildOntology } from "@/lib/ontology/build";
import type { Ontology } from "@/lib/ontology/types";
import { fixture, NOW } from "@/lib/ontology/__tests__/fixture";
import { campaignHref, chooseMove, goalPace, isHere, surfaceOf, type WorkingOn } from "@/lib/flow";

function ontology(): Ontology {
  return buildOntology(fixture(), NOW);
}

function noUnits(): Ontology {
  const raw = fixture();
  return buildOntology({ ...raw, units: [] }, NOW);
}

const OCT_7 = new Date("2026-10-07T15:00:00.000Z");

describe("goalPace", () => {
  it("draws a straight line from the month so far", () => {
    const p = goalPace({ month: "2026-10", target: 12, actual: 4 }, OCT_7)!;
    expect(p.monthName).toBe("October");
    expect(p.day).toBe(7);
    expect(p.daysInMonth).toBe(31);
    expect(p.daysLeft).toBe(24);
    expect(p.expectedByNow).toBe(2); // floor(12 × 7 / 31)
    expect(p.projected).toBe(18); // round(4 × 31 / 7)
    expect(p.onTrack).toBe(true);
    expect(p.line).toBe("4 of 12 move-ins in October");
    expect(p.projection).toBe("At this pace, 18 by Oct 31.");
  });

  it("is behind when the move-ins trail the line", () => {
    const p = goalPace({ month: "2026-10", target: 12, actual: 1 }, new Date("2026-10-20T12:00:00Z"))!;
    expect(p.expectedByNow).toBe(7);
    expect(p.onTrack).toBe(false);
    expect(p.projection).toBe("At this pace, 2 by Oct 31.");
  });

  it("says nothing about the end of the month in the first days", () => {
    const p = goalPace({ month: "2026-10", target: 12, actual: 1 }, new Date("2026-10-02T12:00:00Z"))!;
    expect(p.projected).toBeNull();
    expect(p.projection).toBeNull();
  });

  it("stops projecting once the goal is met", () => {
    const p = goalPace({ month: "2026-10", target: 3, actual: 4 }, OCT_7)!;
    expect(p.onTrack).toBe(true);
    expect(p.projection).toBeNull();
  });

  it("reads a zero target as no goal yet", () => {
    const p = goalPace({ month: "2026-10", target: 0, actual: 2 }, OCT_7)!;
    expect(p.target).toBe(0);
    expect(p.line).toBe("2 move-ins in October");
    expect(p.onTrack).toBe(true);
  });

  it("only measures its own month", () => {
    expect(goalPace({ month: "2026-09", target: 12, actual: 4 }, OCT_7)).toBeNull();
    expect(goalPace({ month: "nonsense", target: 12, actual: 4 }, OCT_7)).toBeNull();
    expect(goalPace(null, OCT_7)).toBeNull();
  });

  it("handles a short month and the last day", () => {
    const p = goalPace({ month: "2027-02", target: 10, actual: 9 }, new Date("2027-02-28T23:00:00Z"))!;
    expect(p.daysInMonth).toBe(28);
    expect(p.daysLeft).toBe(0);
    expect(p.expectedByNow).toBe(10);
    expect(p.onTrack).toBe(false);
  });
});

describe("surfaceOf and isHere", () => {
  it("maps portal paths to surfaces", () => {
    expect(surfaceOf("/portal")).toBe("dashboard");
    expect(surfaceOf("/portal/campaigns")).toBe("campaigns");
    expect(surfaceOf("/portal/campaigns/abc-123")).toBe("campaign");
    expect(surfaceOf("/portal/tools")).toBe("tools");
    expect(surfaceOf("/portal/index")).toBe("index");
    expect(surfaceOf("/portal/gbp")).toBe("reviews");
    expect(surfaceOf("/somewhere")).toBe("other");
  });

  it("compares tool and focus inside the tools", () => {
    const where = { surface: "tools" as const, tool: "creative-studio", focus: "units/10x10" };
    expect(isHere("/portal/tools?tool=creative-studio&focus=units/10x10", where)).toBe(true);
    expect(isHere("/portal/tools?tool=creative-studio&focus=units/5x10", where)).toBe(false);
    expect(isHere("/portal/tools?tool=landing-pages&focus=units/10x10", where)).toBe(false);
    expect(isHere("/portal/upload", { surface: "upload" })).toBe(true);
  });
});

describe("chooseMove", () => {
  it("returns nothing before the ontology loads", () => {
    expect(chooseMove({ ontology: null, pace: null, working: null, where: { surface: "dashboard" } })).toBeNull();
  });

  it("puts the unit mix first, everywhere", () => {
    const o = noUnits();
    const working: WorkingOn = { id: "c1", name: "Fill drive-up units", status: "draft", move: null };
    const move = chooseMove({ ontology: o, pace: null, working, where: { surface: "dashboard" } })!;
    expect(move.id.startsWith("foundation:")).toBe(true);
    const onUpload = chooseMove({ ontology: o, pace: null, working, where: { surface: "upload" } })!;
    expect(onUpload.id).toBe(move.id);
    expect(onUpload.here).toBe(move.href.startsWith("/portal/upload"));
  });

  it("follows the object in focus", () => {
    const o = ontology();
    const subject = o.moves[o.moves.length - 1].subject;
    const move = chooseMove({ ontology: o, pace: null, working: null, where: { surface: "index", focus: subject } })!;
    expect(move.subject === subject || move.subject === null).toBe(true);
    expect(move.id).toBe(o.moves.find((m) => m.subject === subject)!.id);
  });

  it("speaks about the tool in hand", () => {
    const o = ontology();
    const tool = o.moves.find((m) => m.action.tool)!.action.tool!;
    const move = chooseMove({ ontology: o, pace: null, working: null, where: { surface: "tools", tool } })!;
    expect(move.href).toContain(`tool=${tool}`);
  });

  it("marks a move that lands where you already are", () => {
    const o = ontology();
    const top = o.moves[0];
    const href = new URL(chooseMove({ ontology: o, pace: null, working: null, where: { surface: "dashboard" } })!.href, "https://x");
    const where = {
      surface: "tools" as const,
      tool: href.searchParams.get("tool"),
      focus: href.searchParams.get("focus"),
    };
    const move = chooseMove({ ontology: o, pace: null, working: null, where })!;
    expect(move.subject).toBe(top.subject.includes("/") ? top.subject : null);
    expect(move.here).toBe(true);
  });

  it("carries the campaign being built to every other page", () => {
    const o = ontology();
    const working: WorkingOn = {
      id: "c1",
      name: "Fill drive-up units",
      status: "draft",
      move: {
        sentence: "Run on Meta needs daily budget.",
        reason: "It's the last thing between this function and ready.",
        actionLabel: "Fill it in",
        action: { kind: "select", nodeId: "n4", focus: true },
      },
    };
    const move = chooseMove({ ontology: o, pace: null, working, where: { surface: "reports" } })!;
    expect(move.source).toBe("campaign");
    expect(move.href).toBe(campaignHref("c1", true));
    expect(move.reason.startsWith("Fill drive-up units.")).toBe(true);
    const inBuilder = chooseMove({ ontology: o, pace: null, working, where: { surface: "campaign" } })!;
    expect(inBuilder.source).not.toBe("campaign");
  });

  it("asks for a goal when there isn't one", () => {
    const o = ontology();
    const pace = goalPace({ month: "2026-10", target: 0, actual: 0 }, OCT_7);
    const move = chooseMove({ ontology: o, pace, working: null, where: { surface: "dashboard" } })!;
    expect(move.source).toBe("goal");
    expect(move.sentence).toBe("Set your move-in goal for October.");
  });

  it("starts a campaign when behind pace with nothing live", () => {
    const o = ontology();
    const quiet: Ontology = { ...o, objects: o.objects.map((x) => (x.type === "campaigns" ? { ...x, status: "draft" } : x)) };
    const pace = goalPace({ month: "2026-10", target: 12, actual: 1 }, new Date("2026-10-20T12:00:00Z"));
    const move = chooseMove({ ontology: quiet, pace, working: null, where: { surface: "dashboard" } })!;
    expect(move.source).toBe("goal");
    expect(move.href).toBe("/portal/campaigns?new=goal");
    expect(move.reason).toContain("At this pace, 2 by Oct 31.");
  });

  it("falls back to the facility's top move when on pace", () => {
    const o = ontology();
    const pace = goalPace({ month: "2026-10", target: 12, actual: 4 }, OCT_7);
    const move = chooseMove({ ontology: o, pace, working: null, where: { surface: "dashboard" } })!;
    expect(move.id).toBe(o.moves[0].id);
  });

  it("is deterministic", () => {
    const a = chooseMove({ ontology: ontology(), pace: null, working: null, where: { surface: "index" } });
    const b = chooseMove({ ontology: ontology(), pace: null, working: null, where: { surface: "index" } });
    expect(a).toEqual(b);
  });
});
