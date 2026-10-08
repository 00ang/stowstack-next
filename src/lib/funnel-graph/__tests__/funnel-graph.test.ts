import { describe, expect, it } from "vitest";
import {
  CATALOG,
  NODE_TYPES,
  addNode,
  applyMove,
  article,
  buildTemplate,
  canConnect,
  connect,
  emptyGraph,
  emptyParam,
  funnelGraphSchema,
  graphFromRecord,
  inputIndex,
  list,
  nextMove,
  nodeAddress,
  param,
  placeAfter,
  nodeReading,
  optionList,
  pathToMoveIn,
  reaches,
  readiness,
  readGraph,
  readyCount,
  selectTarget,
  slugify,
  templateBlurb,
  templateMeta,
  toPublishPlan,
  topo,
  validateGraph,
  writeGraph,
  type FunnelContext,
  type FunnelGraph,
  type FunnelNode,
  type NodeType,
} from "@/lib/funnel-graph";

const ctx: FunnelContext = {
  sample: true,
  facilityName: "Maple Street Storage",
  goal: { moveIns: 12, month: "October" },
  movedIn30: 4,
  metaConnected: true,
  units: [
    { key: "10x10", name: "10x10 drive-up", empty: 18, driveUp: true },
    { key: "10x15", name: "10x15 drive-up", empty: 4, driveUp: true },
    { key: "10x20", name: "10x20 drive-up", empty: 6, driveUp: true },
    { key: "10x10c", name: "10x10 climate", empty: 12, climate: true },
    { key: "10x30", name: "10x30 drive-up", empty: 0, driveUp: true },
  ],
  offers: [
    { key: "first-month-1", name: "First Month $1", deal: "$1 first month on 10x15, 10x20", active: true },
    { key: "climate-fall", name: "Climate Fall Special", deal: "15% off climate, 3 months", active: true },
    { key: "ended", name: "Summer Half Off", deal: "ended", active: false },
  ],
  provenAds: [
    { key: "drive-right-up", line: "Drive right up to your door." },
    { key: "reserve-2-min", line: "Reserve in 2 minutes." },
  ],
};

function named(partial: Partial<FunnelGraph> = {}): FunnelGraph {
  return emptyGraph({ name: "Fill drive-up units", goal: { moveIns: 12, month: "October" }, ...partial });
}

function node(type: NodeType, id: string, params: FunnelNode["params"] = {}, x = 0, y = 0): FunnelNode {
  return { id, type, x, y, params };
}

describe("canConnect", () => {
  it("refuses a missing end, a self-link, and a port that is not an input or output", () => {
    const graph = named({ nodes: [node("units", "n1", { sizes: ["10x10"] }), node("page", "n2")] });
    expect(canConnect(graph, "nope", 0, "n2", 0)).toEqual({ ok: false, reason: "Nothing to connect." });
    expect(canConnect(graph, "n1", 0, "n1", 0).reason).toBe("A function can't feed itself.");
    expect(canConnect(graph, "n1", 3, "n2", 0).reason).toBe("That port isn't an output.");
    expect(canConnect(graph, "n2", 0, "n1", 0).reason).toBe("That port isn't an input.");
  });

  it("refuses a type mismatch and names a function to put between them", () => {
    const graph = named({
      nodes: [node("meta", "n1", { budget: "25", acct: "ok" }), node("movein", "n2", { match: "rentroll" })],
    });
    const refused = canConnect(graph, "n1", 0, "n2", 0);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toContain("Move-in takes leads coming in, not a source of visits.");
      expect(refused.reason).toContain("Put a Landing page between them.");
    }
  });

  it("refuses a mismatch that has no function to put between the two", () => {
    const graph = named({
      nodes: [node("movein", "n1", { match: "rentroll" }), node("audience", "n2", { radius: "5", who: "movers" })],
    });
    const refused = canConnect(graph, "n1", 0, "n2", 0);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe("Audience takes sizes to sell, not move-ins.");
      expect(refused.reason).not.toContain("between them");
    }
  });

  it("refuses a duplicate and a loop, and allows a legal wire", () => {
    let graph = named({
      nodes: [
        node("units", "n1", { sizes: ["10x10"] }),
        node("audience", "n2", { radius: "5", who: "movers" }),
        node("proven", "n3", { src: "drive-right-up" }),
      ],
    });
    const first = connect(graph, "n1", 0, "n2", 0);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    graph = first.graph;
    expect(canConnect(graph, "n1", 0, "n2", 0).reason).toBe("Those two are already connected.");
    const second = connect(graph, "n2", 0, "n3", 0);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(canConnect(second.graph, "n3", 0, "n1", 0).ok).toBe(false);
    // proven's ad cannot feed units; build a real loop: audience → proven is not a cycle back.
    // units → audience, and audience cannot connect back to units (units has no input).
    // Add page and a visit source to close a cycle the type system allows? visit doesn't flow backward.
    // Lead can cycle: textback → follow → textback.
    const cycle = named({
      nodes: [node("textback", "a", { phone: "555" }), node("follow", "b", { steps: "3" })],
    });
    const ab = connect(cycle, "a", 0, "b", 0);
    expect(ab.ok).toBe(true);
    if (!ab.ok) return;
    expect(canConnect(ab.graph, "b", 0, "a", 0).reason).toBe("That would make a loop.");
  });

  it("stops a reachability walk that revisits a node", () => {
    const graph = named({
      nodes: [node("textback", "a", { phone: "1" }), node("follow", "b", { steps: "3" })],
      edges: [
        { id: "e1", from: "a", fromPort: 0, to: "b", toPort: 0 },
        { id: "e2", from: "b", fromPort: 0, to: "a", toPort: 0 },
      ],
    });
    expect(reaches(graph, "a", "missing")).toBe(false);
    expect(reaches(graph, "a", "a")).toBe(true);
  });
});

describe("readiness", () => {
  it("asks for the one missing input, ports before parameters", () => {
    const bare = named({ nodes: [node("movein", "m")] });
    expect(readiness(bare, bare.nodes[0])).toEqual({ state: "needs", need: "leads or reservations coming in" });

    const held = named({
      nodes: [node("reserve", "r", { src: "storedge" }), node("movein", "m")],
      edges: [{ id: "e1", from: "r", fromPort: 0, to: "m", toPort: 1 }],
    });
    expect(readiness(held, held.nodes[1])).toEqual({ state: "needs", need: "matched from" });

    const matched = named({
      nodes: [node("reserve", "r", { src: "hold" }), node("movein", "m", { match: "api" })],
      edges: [{ id: "e1", from: "r", fromPort: 0, to: "m", toPort: 1 }],
    });
    expect(readiness(matched, matched.nodes[1]).state).toBe("ready");

    const units = named({ nodes: [node("audience", "a")] });
    expect(readiness(units, units.nodes[0])).toEqual({ state: "needs", need: "sizes to sell" });

    const proven = named({
      nodes: [node("audience", "a", { radius: "5", who: "movers" }), node("proven", "p")],
      edges: [{ id: "e1", from: "a", fromPort: 0, to: "p", toPort: 0 }],
    });
    expect(readiness(proven, proven.nodes[1])).toEqual({ state: "needs", need: "start from" });

    const readyProven = named({
      nodes: [node("audience", "a", { radius: "5", who: "movers" }), node("proven", "p", { src: "drive-right-up" })],
      edges: [{ id: "e1", from: "a", fromPort: 0, to: "p", toPort: 0 }],
    });
    expect(readiness(readyProven, readyProven.nodes[1]).state).toBe("ready");

    const budget = named({ nodes: [node("google", "g", { budget: "0" })] });
    expect(readiness(budget, budget.nodes[0]).need).toBe("an ad");
    const priced = named({
      nodes: [node("write", "w", { angle: "lifestyle" }), node("google", "g", { budget: "" })],
      edges: [{ id: "e1", from: "w", fromPort: 0, to: "g", toPort: 0 }],
    });
    expect(readiness(priced, priced.nodes[1]).need).toBe("daily budget");
    const zero = named({
      nodes: [node("write", "w", { angle: "urgency" }), node("google", "g", { budget: "0" })],
      edges: [{ id: "e1", from: "w", fromPort: 0, to: "g", toPort: 0 }],
    });
    expect(readiness(zero, zero.nodes[1]).need).toBe("daily budget");
  });

  it("treats blank strings and empty lists as missing, and a positive number as filled", () => {
    expect(emptyParam(undefined, "text")).toBe(true);
    expect(emptyParam("  ", "text")).toBe(true);
    expect(emptyParam([], "multi")).toBe(true);
    expect(emptyParam(1, "text")).toBe(true);
    expect(emptyParam("12", "number")).toBe(false);
    expect(emptyParam(["10x10"], "multi")).toBe(false);
  });
});

describe("validateGraph", () => {
  it("returns gaps in campaign order", () => {
    const rules = validateGraph(emptyGraph()).map((g) => g.rule);
    expect(rules).toEqual(["goal", "space", "visit", "move-in-path", "report"]);
  });

  it("flags an ad that never reaches a page, a page that captures nothing, and a dangling lead", () => {
    const graph = named({
      nodes: [
        node("units", "u", { sizes: ["10x10"] }, 0, 0),
        node("write", "w", { angle: "lifestyle" }, 100, 0),
        node("meta", "m", { budget: "20", acct: "ok" }, 200, 0),
        node("page", "p", {}, 300, 0),
        node("textback", "t", { phone: "555" }, 400, 0),
      ],
      edges: [{ id: "e1", from: "m", fromPort: 0, to: "p", toPort: 0 }],
    });
    const rules = validateGraph(graph).map((g) => g.rule);
    expect(rules).toContain("ad-to-page");
    expect(rules).toContain("page-leads");
    expect(rules).toContain("lead-responder");
    expect(rules.indexOf("ad-to-page")).toBeLessThan(rules.indexOf("page-leads"));
    expect(rules.indexOf("page-leads")).toBeLessThan(rules.indexOf("lead-responder"));
  });

  it("accepts all three templates", () => {
    for (const key of ["drive", "lease", "shoulder"] as const) {
      const graph = buildTemplate(key, ctx);
      expect(funnelGraphSchema.safeParse(graph).success).toBe(true);
      expect(validateGraph(graph)).toEqual([]);
      expect(pathToMoveIn(graph)).toBe(true);
    }
  });

  it("uses the facility's own sizes and offers when it has them", () => {
    const drive = buildTemplate("drive", ctx);
    const units = drive.nodes.find((n) => n.type === "units");
    expect(units?.params.sizes).toEqual(["10x10", "10x15", "10x20"]);
    const shoulder = buildTemplate("shoulder", ctx);
    expect(shoulder.nodes.find((n) => n.type === "units")?.params.sizes).toEqual(["10x10c"]);
    const lease = buildTemplate("lease", ctx);
    expect(lease.nodes.find((n) => n.type === "offer")?.params.offer).toBe("first-month-1");
    const fallback = buildTemplate("drive");
    expect(fallback.nodes.find((n) => n.type === "proven")?.params.src).toBe("drive-right-up");
    expect(fallback.goal).toEqual({ moveIns: 12, month: "October" });
  });
});

describe("nextMove", () => {
  it("starts from the goal when there is no campaign", () => {
    const m = nextMove(emptyGraph(), ctx);
    expect(m.action.kind).toBe("templates");
    expect(m.reason).toMatch(/12 move-ins in October/);
    const own = nextMove(emptyGraph({ goal: { moveIns: 4, month: "May" } }), {});
    expect(own.reason).toMatch(/4 move-ins in May/);
    const none = nextMove(emptyGraph(), {});
    expect(none.reason).toMatch(/Pick the outcome first/);
  });

  it("points at Ads Manager once a campaign is published, and says the spend is paused", () => {
    const graph = buildTemplate("lease", ctx);
    graph.status = "published";
    const m = nextMove(graph, ctx);
    expect(m.action).toEqual({ kind: "ads-manager" });
    expect(m.reason).toContain("paused");
    expect(m.reason).toContain("$40/day");
    expect(m.sentence.toLowerCase()).not.toContain("live");
    const quiet = nextMove(named({ status: "published", nodes: [], edges: [] }), {});
    expect(quiet.reason).toContain("paused");
    expect(quiet.reason).not.toContain("$");
  });

  it("asks for a goal before any function when the facility has none", () => {
    const m = nextMove(emptyGraph({ name: "New campaign" }), {});
    expect(m.action.kind).toBe("edit-goal");
  });

  it("walks a blank campaign to a publishable graph, one move at a time", () => {
    let graph = named({ nodes: [], edges: [] });
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const m = nextMove(graph, ctx);
      seen.add(m.action.kind === "select" ? `select:${m.sentence}` : m.action.kind);
      if (m.action.kind === "publish") {
        expect(validateGraph(graph)).toEqual([]);
        expect(readyCount(graph).ready).toBe(graph.nodes.length);
        expect(seen.has("add")).toBe(true);
        return;
      }
      if (m.action.kind === "select") {
        graph = {
          ...graph,
          nodes: graph.nodes.map((n) =>
            n.id === m.action.kind && false
              ? n
              : n.id === (m.action.kind === "select" ? m.action.nodeId : "")
                ? { ...n, params: { ...n.params, ...fill(n) } }
                : n,
          ),
        };
        continue;
      }
      graph = applyMove(graph, m.action);
    }
    throw new Error(`never reached publish; last nodes ${graph.nodes.map((n) => n.type).join(",")}`);
  });

  it("connects a function that is already on the canvas", () => {
    const graph = named({
      nodes: [
        node("units", "u", { sizes: ["10x10"] }, 0, 0),
        node("audience", "a", {}, 200, 0),
      ],
    });
    const m = nextMove(graph, ctx);
    expect(m.action).toMatchObject({ kind: "connect", fromId: "u", toId: "a" });
    const next = applyMove(graph, m.action);
    expect(next.edges).toHaveLength(1);
  });

  it("sends a loose channel to the page that already exists", () => {
    const drive = buildTemplate("drive", ctx);
    const meta = drive.nodes.find((n) => n.type === "meta")!;
    const page = drive.nodes.find((n) => n.type === "page")!;
    const cut: FunnelGraph = { ...drive, edges: drive.edges.filter((e) => !(e.from === meta.id && e.to === page.id)) };
    const m = nextMove(cut, ctx);
    expect(m.action).toMatchObject({ kind: "connect", fromId: meta.id, toId: page.id, toPort: 0 });
  });

  it("adds a landing page when a channel has nowhere to send people", () => {
    let graph = named();
    graph = addNode(graph, "units", 0, 0, { sizes: ["10x10"] }).graph;
    graph = addNode(graph, "meta", 200, 0, { budget: "20", acct: "ok" }).graph;
    const m = nextMove(graph, ctx);
    expect(m.sentence).toMatch(/nowhere to land/i);
    expect(m.action.kind).toBe("add");
  });

  it("fills the one field a ready-looking template still needs", () => {
    const drive = buildTemplate("drive", ctx);
    const m = nextMove(drive, ctx);
    expect(m.sentence).toMatch(/Run on Meta needs daily budget/);
    expect(m.action).toMatchObject({ kind: "select", focus: true });
  });
});

describe("toPublishPlan", () => {
  it("lists an endpoint for every kind of function and marks ad channels paused", () => {
    const nodes = NODE_TYPES.map((type, i) => node(type, `n${i + 1}`, sampleParams(type), i * 20, 0));
    const plan = toPublishPlan(named({ nodes }));
    expect(plan).toHaveLength(NODE_TYPES.length);
    for (const step of plan) {
      expect(step.endpoint.length).toBeGreaterThan(3);
      expect(step.summary.length).toBeGreaterThan(8);
    }
    const meta = plan.find((s) => s.title === "Run on Meta");
    const google = plan.find((s) => s.title === "Google Search");
    expect(meta?.paused).toBe(true);
    expect(meta?.summary).toMatch(/paused/i);
    expect(google?.paused).toBe(true);
    expect(google?.summary).toMatch(/paused/i);
    expect(plan.find((s) => s.title === "Landing page")?.paused).toBe(false);
    expect(plan.map((s) => s.endpoint)).toEqual(nodes.map((n) => CATALOG[n.type].endpoint));
  });

  it("orders steps with the flow, not the order nodes were added", () => {
    const drive = buildTemplate("drive", ctx);
    const titles = toPublishPlan(drive).map((s) => s.title);
    expect(titles.indexOf("Units")).toBeLessThan(titles.indexOf("Landing page"));
    expect(titles.indexOf("Landing page")).toBeLessThan(titles.indexOf("Move-in"));
    expect(titles.at(-1)).toBe("Cost per move-in");
  });
});

describe("schema", () => {
  it("reads and writes config.graph without dropping the rest of the config", () => {
    const graph = buildTemplate("drive");
    expect(readGraph(null)).toBeNull();
    expect(readGraph({ landingHero: "x" })).toBeNull();
    expect(readGraph({ graph: { version: 1 } })).toBeNull();
    const stored = writeGraph({ landingHero: "Keep", postConversion: [] }, graph);
    expect(stored.landingHero).toBe("Keep");
    expect(readGraph(stored)?.name).toBe("Fill drive-up units");
    expect(writeGraph(null, graph).graph).toBeTruthy();
    expect(funnelGraphSchema.safeParse({ ...graph, version: 2 }).success).toBe(false);
  });
});

describe("graphFromRecord", () => {
  it("keeps a stored graph", () => {
    const graph = buildTemplate("shoulder");
    const back = graphFromRecord({ id: "1", name: "ignored", config: { graph } });
    expect(back.name).toBe(graph.name);
  });

  it("turns an existing funnel into ad, channel, page, follow-up", () => {
    const graph = graphFromRecord({
      id: "f1",
      name: "Fall Move Season",
      status: "live",
      ad_variations: [
        { id: "a1", platform: "meta", angle: "convenience" },
        { id: "a2", platform: "google_search", angle: "not-an-angle" },
      ],
      landing_pages: [{ id: "p1", slug: "fall-move" }],
      drip_sequence_templates: [
        { id: "d1", sequence_type: "post_conversion", steps: [{}, {}, {}] },
        { id: "d2", sequence_type: "recovery", steps: [{}, {}, {}] },
      ],
    });
    expect(graph.status).toBe("draft");
    const types = graph.nodes.map((n) => n.type);
    expect(types).toContain("write");
    expect(types).toContain("meta");
    expect(types).toContain("google");
    expect(types).toContain("page");
    expect(types).toContain("follow");
    const page = graph.nodes.find((n) => n.type === "page");
    expect(page?.slug).toBe("fall-move");
    expect(graph.edges.some((e) => e.to === page?.id)).toBe(true);
    expect(graph.nodes.find((n) => n.type === "follow")?.params.steps).toBe("3");
    // A channel is never described as live just because the funnel row is.
    expect(nodeReading(graph.nodes.find((n) => n.type === "meta")!, ctx)).not.toMatch(/live/i);
  });

  it("still draws a page and a follow-up when there is no ad yet", () => {
    const graph = graphFromRecord({
      id: "f2",
      name: "Quiet",
      landing_pages: [{ id: "p", slug: "" }],
      drip_sequence_templates: [{ id: "d", sequence_type: "recovery", steps: "nope" }],
    });
    expect(graph.nodes.map((n) => n.type)).toEqual(["page", "follow"]);
    expect(graph.edges).toHaveLength(1);
  });

  it("draws ads with nowhere to land when the funnel has no page", () => {
    const graph = graphFromRecord({
      id: "f3",
      name: "Ads only",
      ad_variations: [{ id: "a", platform: "meta", angle: "urgency" }],
    });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });
});

describe("readings and options", () => {
  it("reads every function, empty and filled", () => {
    for (const type of NODE_TYPES) {
      const empty = nodeReading(node(type, "n1"), ctx);
      const filled = nodeReading(node(type, "n2", sampleParams(type), 0, 0), { ...ctx, goal: undefined, movedIn30: undefined });
      expect(empty.length).toBeGreaterThan(0);
      expect(filled.length).toBeGreaterThan(0);
    }
    expect(nodeReading(node("units", "u", { sizes: ["10x10", "10x20"] }), ctx)).toMatch(/empty across 2 sizes/);
    expect(nodeReading(node("units", "u", { sizes: ["10x10"] }), { ...ctx, unitsSummary: { empty: 54, total: 322 } })).toBe("54 empty of 322");
    expect(
      nodeReading(node("units", "u", { sizes: ["10x10", "10x20"] }), {
        units: [
          { key: "10x10", name: "10x10", empty: 18, total: 80 },
          { key: "10x20", name: "10x20", empty: 6, total: 30 },
        ],
      }),
    ).toBe("24 empty of 110");
    expect(nodeReading(node("units", "u", { sizes: ["missing"] }), ctx)).toMatch(/1 size/);
    expect(nodeReading(node("offer", "o", { offer: "climate-fall" }), ctx)).toMatch(/15%/);
    expect(nodeReading(node("reserve", "r", { src: "hold" }), ctx)).toMatch(/no payment/i);
    expect(nodeReading(node("reserve", "r", { src: "storedge" }), ctx)).toMatch(/storEDGE/);
    expect(nodeReading(node("audience", "a", { radius: "10", who: "look" }), ctx)).toMatch(/like your tenants/);
    expect(nodeReading(node("audience", "a", { radius: "10", who: "nope" }), ctx)).toMatch(/who\?/);
    expect(nodeReading(node("write", "w", { angle: "social_proof" }), ctx)).toMatch(/Trusted Choice/);
    expect(nodeReading(node("movein", "m", { match: "rentroll" }), ctx)).toMatch(/goal 12/);
    expect(nodeReading(node("page", "p", {}, 0, 0), ctx)).toBe("/lp/…");
    const paged = node("page", "p");
    paged.slug = "fall";
    expect(nodeReading(paged, ctx)).toBe("/lp/fall");
  });

  it("builds option lists from the facility, and hides a disconnected account", () => {
    expect(optionList("units", ctx).map((o) => o[0])).toEqual(["10x10", "10x15", "10x20", "10x10c"]);
    expect(optionList("offers", ctx).map((o) => o[0])).not.toContain("ended");
    expect(optionList("proven", ctx)).toHaveLength(2);
    expect(optionList("angles", ctx).length).toBeGreaterThan(0);
    expect(optionList("account", { metaConnected: false })).toEqual([]);
    expect(optionList("account", ctx)[0][0]).toBe("ok");
    expect(optionList("radius", ctx)).toHaveLength(3);
    expect(optionList("who", ctx)).toHaveLength(3);
    expect(optionList("match", ctx)).toHaveLength(2);
    expect(optionList("reserve", ctx)).toHaveLength(2);
    expect(optionList("steps", ctx)).toHaveLength(2);
  });
});

describe("edges of the rules", () => {
  it("names an audience with 'an' and a page with 'a'", () => {
    expect(article("Audience")).toBe("an");
    expect(article("Landing page")).toBe("a");
  });

  it("addresses a node, and slugs an empty title back to campaign", () => {
    expect(nodeAddress(node("units", "n3"))).toBe("units/units-03");
    expect(nodeAddress(node("page", "page"))).toMatch(/pages\/landing-page-/);
    expect(slugify("!!!")).toBe("campaign");
    expect(list(["10x10", 2, ""])).toEqual(["10x10"]);
    expect(list("10x10")).toEqual(["10x10"]);
    expect(list(0)).toEqual([]);
    expect(param(node("units", "u", { sizes: ["a"] }), "sizes")).toBe("");
    expect(inputIndex("movein", "hold")).toBe(1);
    expect(inputIndex("units", "lead")).toBe(-1);
  });

  it("places a node beside another and steps down when the slot is taken", () => {
    const graph = named({ nodes: [node("units", "u", {}, 276, 50)] });
    expect(placeAfter(graph, undefined)).toEqual([40, 50]);
    const src = node("units", "s", {}, 40, 50);
    expect(placeAfter(graph, src)[1]).toBeGreaterThan(50);
  });

  it("gives a second page its own slug and refuses a bad connect", () => {
    const first = addNode(emptyGraph(), "page", 0, 0);
    expect(first.node.slug).toBe("campaign");
    const second = addNode(first.graph, "page", 10, 10);
    expect(second.node.slug).toMatch(/campaign-n/);
    const bad = connect(named(), "missing", 0, "also", 0);
    expect(bad.ok).toBe(false);
    const bumped = addNode(named({ nodes: [node("units", "x")] }), "waitlist", 0, 0);
    expect(bumped.node.id).toBe("n1");
  });

  it("suggests sizes even when the facility has not marked any drive-up", () => {
    const m = nextMove(named(), {});
    expect(m.action.kind).toBe("add");
    expect(m.reason).toMatch(/sitting empty/);
    const climate = nextMove(named(), { units: [{ key: "10x10c", name: "10x10 climate", empty: 12, climate: true }] });
    expect(climate.action.kind).toBe("add");
    if (climate.action.kind === "add") expect(climate.action.node.params.sizes).toEqual(["10x10c"]);
  });

  it("builds the audience off the offer when there is one", () => {
    let graph = named();
    graph = addNode(graph, "units", 0, 0, { sizes: ["10x10"] }, "u").graph;
    graph = addNode(graph, "offer", 200, 0, { offer: "first-month-1" }, "o").graph;
    graph = connect(graph, "u", 0, "o", 0).ok ? connect(graph, "u", 0, "o", 0).graph : graph;
    const linked = connect(named({ nodes: graph.nodes }), "u", 0, "o", 0);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    const m = nextMove(linked.graph, ctx);
    expect(m.sentence).toMatch(/who should see this/i);
    if (m.action.kind === "add") expect(m.action.connects[0].fromId).toBe("o");
  });

  it("recreates a proven ad, or says to write one when the facility has none", () => {
    let graph = named();
    const units = addNode(graph, "units", 0, 0, { sizes: ["10x10"] }, "u");
    graph = units.graph;
    const aud = addNode(graph, "audience", 236, 0, { radius: "5", who: "movers" }, "a");
    graph = connect(aud.graph, "u", 0, "a", 0);
    expect(graph.ok).toBe(true);
    if (!graph.ok) return;
    const none = nextMove(graph.graph, {});
    expect(none.reason).toMatch(/write one/i);
    const some = nextMove(graph.graph, ctx);
    expect(some.reason).toMatch(/Drive right up/);
    if (some.action.kind === "add") expect(some.action.connects.some((c) => c.fromId === "u")).toBe(true);
  });

  it("runs a loose ad on Meta and leaves the account blank when Meta is not connected", () => {
    let graph = named();
    graph = addNode(graph, "units", 0, 0, { sizes: ["10x10"] }, "u").graph;
    graph = addNode(graph, "proven", 200, 0, { src: "drive-right-up" }, "p").graph;
    const m = nextMove(graph, { ...ctx, metaConnected: false });
    expect(m.sentence).toMatch(/isn't running anywhere/);
    if (m.action.kind === "add") expect(m.action.node.params.acct).toBe("");
  });

  it("points a second channel at the page the first one already feeds", () => {
    const drive = buildTemplate("drive", ctx);
    const meta = drive.nodes.find((n) => n.type === "meta")!;
    const page = drive.nodes.find((n) => n.type === "page")!;
    const proven = drive.nodes.find((n) => n.type === "proven")!;
    const graph = addNode(drive, "google", meta.x, meta.y + 190, { budget: "15" }, "g").graph;
    const fed = connect(graph, proven.id, 0, "g", 0);
    expect(fed.ok).toBe(true);
    if (!fed.ok) return;
    const m = nextMove(fed.graph, ctx);
    expect(m.sentence).toMatch(/sends people nowhere yet/);
    expect(m.action).toMatchObject({ kind: "connect", fromId: "g", toId: page.id });
  });

  it("connects a loose hold and a second loose lead when it adds the move-in", () => {
    const drive = buildTemplate("drive", ctx);
    const drop = new Set(drive.nodes.filter((n) => n.type === "movein" || n.type === "report").map((n) => n.id));
    let graph: FunnelGraph = {
      ...drive,
      nodes: drive.nodes.filter((n) => !drop.has(n.id)),
      edges: drive.edges.filter((e) => !drop.has(e.from) && !drop.has(e.to)),
    };
    graph = addNode(graph, "missed", 800, 400, {}, "miss").graph;
    graph = addNode(graph, "tour", 1000, 400, {}, "tour").graph;
    const wired = connect(graph, "miss", 0, "tour", 0);
    expect(wired.ok).toBe(true);
    if (!wired.ok) return;
    const m = nextMove(wired.graph, ctx);
    expect(m.sentence).toMatch(/move-ins, not clicks/);
    if (m.action.kind !== "add") throw new Error(m.sentence);
    const froms = m.action.connects.map((c) => c.fromId);
    expect(froms).toContain(drive.nodes.find((n) => n.type === "follow")!.id);
    expect(froms).toContain(drive.nodes.find((n) => n.type === "reserve")!.id);
    expect(froms).toContain("tour");
  });

  it("connects a hold that is the only thing feeding the move-in", () => {
    const reserve = node("reserve", "r", { src: "storedge" }, 0, 0);
    const graph = named({ nodes: [node("units", "u", { sizes: ["10x10"] }), reserve] });
    // Force the walk past earlier suggestions by using a nearly closed drive and only opening the hold.
    const drive = buildTemplate("drive", ctx);
    const movein = drive.nodes.find((n) => n.type === "movein")!;
    const reserveNode = drive.nodes.find((n) => n.type === "reserve")!;
    const cut: FunnelGraph = {
      ...drive,
      edges: drive.edges.filter((e) => !(e.from === reserveNode.id && e.to === movein.id)),
    };
    const m = nextMove(cut, ctx);
    expect(m.sentence).toMatch(/Reservations aren't counted/);
    expect(m.action).toMatchObject({ kind: "connect", fromId: reserveNode.id, toId: movein.id });
    void graph;
  });

  it("sends a lead that stops short on to the move-in", () => {
    const drive = buildTemplate("drive", ctx);
    const follow = drive.nodes.find((n) => n.type === "follow")!;
    const movein = drive.nodes.find((n) => n.type === "movein")!;
    const cut: FunnelGraph = {
      ...drive,
      edges: drive.edges.filter((e) => !(e.from === follow.id && e.to === movein.id)),
    };
    const m = nextMove(cut, ctx);
    expect(m.sentence).toMatch(/Leads stop at Follow-up/);
    expect(applyMove(cut, m.action).edges.some((e) => e.from === follow.id && e.to === movein.id)).toBe(true);
  });

  it("adds cost per move-in when the path is otherwise closed", () => {
    const drive = buildTemplate("drive", ctx);
    const report = drive.nodes.find((n) => n.type === "report")!;
    const graph: FunnelGraph = {
      ...drive,
      nodes: drive.nodes.filter((n) => n.id !== report.id),
      edges: drive.edges.filter((e) => e.from !== report.id && e.to !== report.id),
    };
    const m = nextMove(graph, ctx);
    expect(m.actionLabel).toMatch(/Cost per move-in/);
  });

  it("adds a move-in with nothing to wire when the canvas has no lead and no page", () => {
    const graph = named({
      nodes: [
        node("units", "u", { sizes: ["10x10"] }, 0, 0),
        node("audience", "a", { radius: "5", who: "movers" }, 200, 0),
        node("proven", "p", { src: "x" }, 400, 0),
        node("meta", "m", { budget: "10", acct: "ok" }, 600, 0),
      ],
      edges: [
        { id: "e1", from: "u", fromPort: 0, to: "a", toPort: 0 },
        { id: "e2", from: "a", fromPort: 0, to: "p", toPort: 0 },
        { id: "e3", from: "p", fromPort: 0, to: "m", toPort: 0 },
        { id: "e4", from: "m", fromPort: 0, to: "u", toPort: 0 },
      ],
    });
    const m = nextMove(graph, ctx);
    expect(m.action.kind).toBe("add");
    if (m.action.kind === "add") expect(m.action.node.type).toBe("movein");
  });

  it("leaves the graph alone for a move it cannot apply", () => {
    const graph = named();
    expect(applyMove(graph, { kind: "publish" })).toBe(graph);
    expect(applyMove(graph, { kind: "templates" })).toBe(graph);
    expect(applyMove(graph, { kind: "connect", fromId: "a", fromPort: 0, toId: "b", toPort: 0 })).toBe(graph);
    const added = addNode(graph, "page", 0, 0, {}, "p");
    const withSlug = applyMove(graph, {
      kind: "add",
      node: { ...added.node, slug: "custom" },
      connects: [{ fromId: "missing", fromPort: 0, toPort: 0 }],
      focus: false,
    });
    expect(withSlug.nodes[0].slug).toBe("custom");
    expect(selectTarget({ kind: "add", node: added.node, connects: [], focus: false })).toBe("p");
    expect(selectTarget({ kind: "connect", fromId: "a", fromPort: 0, toId: "b", toPort: 0 })).toBe("b");
    expect(selectTarget({ kind: "select", nodeId: "z", focus: true })).toBe("z");
    expect(selectTarget({ kind: "publish" })).toBeNull();
  });

  it("describes each template and retargets an offer the facility does not run", () => {
    expect(templateBlurb("drive", ctx)).toMatch(/10x10 drive-up has 18 empty/);
    expect(templateBlurb("drive")).toMatch(/sitting empty/);
    expect(templateBlurb("lease")).toMatch(/Meta and Google/);
    expect(templateBlurb("shoulder")).toMatch(/Climate/);
    expect(templateMeta("lease").name).toBe("Lease-up a new facility");
    const shifted = buildTemplate("lease", {
      offers: [{ key: "real", name: "Half off", deal: "half off", active: true }],
      provenAds: [{ key: "other", line: "Other line" }],
      units: [{ key: "5x5", name: "5x5", empty: 1 }],
    });
    expect(shifted.nodes.find((n) => n.type === "offer")?.params.offer).toBe("real");
    const noClimate = buildTemplate("shoulder", { units: [{ key: "10x10", name: "10x10", empty: 3, driveUp: true }] });
    expect(noClimate.nodes.find((n) => n.type === "units")?.params.sizes).toEqual(["10x10c"]);
    expect(nodeReading(node("movein", "m", { match: "api" }), {})).toMatch(/PMS import/);
    expect(optionList("units", {})).toEqual([]);
  });

  it("maps follow-up length from an existing drip", () => {
    const one = graphFromRecord({
      id: "1",
      name: "N",
      landing_pages: [{ id: "p", slug: "p" }],
      drip_sequence_templates: [{ id: "d", sequence_type: "post_conversion", steps: [{}] }],
    });
    expect(one.nodes.find((n) => n.type === "follow")?.params.steps).toBe("3");
    const five = graphFromRecord({
      id: "1",
      name: "N",
      landing_pages: [{ id: "p", slug: null }],
      drip_sequence_templates: [{ id: "d", steps: [{}, {}, {}, {}, {}] }],
    });
    expect(five.nodes.find((n) => n.type === "follow")?.params.steps).toBe("5");
    const four = graphFromRecord({
      id: "1",
      name: "N",
      ad_variations: [{ id: "a", platform: null, angle: null }],
      landing_pages: [{ id: "p", slug: "p" }, { id: "p2", slug: "q" }],
      drip_sequence_templates: [{ id: "d", steps: [{}, {}, {}, {}] }],
    });
    expect(four.nodes.find((n) => n.type === "follow")?.params.steps).toBe("5");
    expect(four.nodes.filter((n) => n.type === "page")).toHaveLength(2);
  });

  it("sorts a tie on x by y, including after a shared source", () => {
    const side = named({
      nodes: [node("textback", "a", { phone: "1" }, 0, 40), node("follow", "b", { steps: "3" }, 0, 10)],
    });
    expect(topo(side).map((n) => n.id)).toEqual(["b", "a"]);
    const fan = named({
      nodes: [
        node("page", "p", {}, 0, 0),
        node("textback", "t", { phone: "1" }, 10, 30),
        node("tour", "u", {}, 10, 5),
      ],
      edges: [
        { id: "e1", from: "p", fromPort: 0, to: "t", toPort: 0 },
        { id: "e2", from: "p", fromPort: 0, to: "u", toPort: 0 },
      ],
    });
    expect(topo(fan).map((n) => n.id)).toEqual(["p", "u", "t"]);
  });

  it("closes the loop from a loose hold, and from the page when nothing else is loose", () => {
    const holdOnly = named({
      nodes: [
        node("units", "u", { sizes: ["10x10"] }, 0, 0),
        node("page", "p", {}, 200, 0),
        node("textback", "t", { phone: "1" }, 400, 0),
        node("follow", "f", { steps: "3" }, 600, 0),
        node("reserve", "r", { src: "storedge" }, 200, 200),
        node("meta", "m", { budget: "10", acct: "ok" }, 0, 200),
        node("proven", "pr", { src: "x" }, 0, 400),
        node("audience", "a", { radius: "5", who: "movers" }, 0, 600),
      ],
      edges: [
        { id: "e1", from: "u", fromPort: 0, to: "a", toPort: 0 },
        { id: "e2", from: "a", fromPort: 0, to: "pr", toPort: 0 },
        { id: "e3", from: "pr", fromPort: 0, to: "m", toPort: 0 },
        { id: "e4", from: "m", fromPort: 0, to: "p", toPort: 0 },
        { id: "e5", from: "p", fromPort: 0, to: "t", toPort: 0 },
        { id: "e6", from: "t", fromPort: 0, to: "f", toPort: 0 },
        { id: "e7", from: "f", fromPort: 0, to: "t", toPort: 0 },
        { id: "e8", from: "p", fromPort: 1, to: "r", toPort: 0 },
      ],
    });
    const fromHold = nextMove(holdOnly, ctx);
    expect(fromHold.action.kind).toBe("add");
    if (fromHold.action.kind === "add") expect(fromHold.action.connects[0].fromId).toBe("r");

    const pageOnly: FunnelGraph = {
      ...holdOnly,
      nodes: holdOnly.nodes.filter((n) => n.id !== "r"),
      edges: [
        ...holdOnly.edges.filter((e) => e.from !== "r" && e.to !== "r"),
        { id: "e9", from: "p", fromPort: 1, to: "u", toPort: 0 },
      ],
    };
    const fromPage = nextMove(pageOnly, ctx);
    expect(fromPage.action.kind).toBe("add");
    if (fromPage.action.kind === "add") expect(fromPage.action.connects.some((c) => c.fromId === "p")).toBe(true);
  });

  it("keeps a node whose edge points at nothing", () => {
    const graph = named({
      nodes: [node("units", "u", {}, 0, 0)],
      edges: [{ id: "e1", from: "u", fromPort: 0, to: "gone", toPort: 0 }],
    });
    expect(topo(graph).map((n) => n.id)).toEqual(["u"]);
  });
});

describe("topo", () => {
  it("keeps a node that nothing reaches", () => {
    const graph = named({
      nodes: [node("units", "u", {}, 10, 0), node("report", "r", {}, 0, 0)],
    });
    expect(topo(graph).map((n) => n.id).sort()).toEqual(["r", "u"]);
  });
});

function fill(n: FunnelNode): FunnelNode["params"] {
  const out: FunnelNode["params"] = {};
  for (const p of CATALOG[n.type].params) {
    if (!emptyParam(n.params[p.key], p.kind)) continue;
    if (p.kind === "multi") out[p.key] = ["10x10"];
    else if (p.kind === "number") out[p.key] = "25";
    else if (p.options === "who") out[p.key] = "movers";
    else if (p.options === "radius") out[p.key] = "5";
    else if (p.options === "angles") out[p.key] = "convenience";
    else if (p.options === "account") out[p.key] = "ok";
    else if (p.options === "match") out[p.key] = "rentroll";
    else if (p.options === "reserve") out[p.key] = "storedge";
    else if (p.options === "steps") out[p.key] = "3";
    else if (p.options === "offers") out[p.key] = "first-month-1";
    else if (p.options === "proven") out[p.key] = "drive-right-up";
    else out[p.key] = "555-0100";
  }
  return out;
}

function sampleParams(type: NodeType): FunnelNode["params"] {
  return fill(node(type, "x"));
}
