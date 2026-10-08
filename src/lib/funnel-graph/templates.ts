import { connect, emptyGraph } from "./graph";
import type { FunnelContext, FunnelGraph, NodeParams, NodeType } from "./types";

/**
 * Three outcome templates. Structure matches the builder prototype.
 * Lease-up and shoulder season also close on cost per move-in, so each
 * template satisfies validateGraph.
 *
 * Columns and rows are the prototype's grid (236 × 190).
 */

export const TEMPLATE_KEYS = ["drive", "lease", "shoulder"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

type Spec = [NodeType, number, number, NodeParams?];

interface TemplateSpec {
  key: TemplateKey;
  name: string;
  icon: string;
  nodes: Spec[];
  edges: [number, number, number, number][];
}

const SPECS: Record<TemplateKey, TemplateSpec> = {
  drive: {
    key: "drive",
    name: "Fill drive-up units",
    icon: "Building2",
    nodes: [
      ["units", 0, 0, { sizes: ["10x10", "10x15", "10x20"] }],
      ["audience", 1, 0, { radius: "5", who: "movers" }],
      ["proven", 1, 1, { src: "drive-right-up" }],
      ["meta", 1, 2, { acct: "ok" }],
      ["page", 2, 0],
      ["reserve", 2, 1, { src: "storedge" }],
      ["textback", 3, 0, {}],
      ["follow", 3, 1, { steps: "3" }],
      ["movein", 4, 0, { match: "rentroll" }],
      ["report", 4, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 1, 5, 0],
      [4, 0, 6, 0],
      [6, 0, 7, 0],
      [7, 0, 8, 0],
      [5, 0, 8, 1],
      [8, 0, 9, 0],
    ],
  },
  lease: {
    key: "lease",
    name: "Lease-up a new facility",
    icon: "Building2",
    nodes: [
      ["units", 0, 0, { sizes: ["5x5", "5x10", "10x10", "10x10c", "10x15", "10x20"] }],
      ["offer", 0, 1, { offer: "first-month-1" }],
      ["audience", 1, 0, { radius: "10", who: "movers" }],
      ["write", 1, 1, { angle: "lifestyle" }],
      ["meta", 2, 0, { acct: "ok", budget: "40" }],
      ["google", 2, 1, { budget: "20" }],
      ["page", 3, 0],
      ["tour", 3, 1],
      ["follow", 4, 0, { steps: "5" }],
      ["movein", 4, 1, { match: "rentroll" }],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [2, 0, 3, 0],
      [1, 0, 3, 1],
      [3, 0, 4, 0],
      [3, 0, 5, 0],
      [4, 0, 6, 0],
      [5, 0, 6, 0],
      [6, 0, 7, 0],
      [7, 0, 8, 0],
      [8, 0, 9, 0],
      [9, 0, 10, 0],
    ],
  },
  shoulder: {
    key: "shoulder",
    name: "Shoulder season",
    icon: "Tag",
    nodes: [
      ["units", 0, 0, { sizes: ["10x10c"] }],
      ["offer", 0, 1, { offer: "climate-fall" }],
      ["gbp", 2, 1],
      ["audience", 1, 0, { radius: "5", who: "past" }],
      ["proven", 1, 1, { src: "reserve-2-min" }],
      ["meta", 2, 0, { acct: "ok", budget: "15" }],
      ["page", 3, 0],
      ["reserve", 3, 1, { src: "storedge" }],
      ["follow", 4, 0, { steps: "3" }],
      ["movein", 4, 1, { match: "rentroll" }],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [1, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 0, 5, 0],
      [5, 0, 6, 0],
      [2, 0, 6, 0],
      [6, 1, 7, 0],
      [6, 0, 8, 0],
      [8, 0, 9, 0],
      [7, 0, 9, 1],
      [9, 0, 10, 0],
    ],
  },
};

/** Drive-up template leaves the Meta budget blank on purpose: the next move fills it. */
export function buildTemplate(key: TemplateKey, ctx: FunnelContext = {}): FunnelGraph {
  const spec = SPECS[key];
  let graph = emptyGraph({
    name: spec.name,
    status: "draft",
    goal: ctx.goal ?? { moveIns: 12, month: "October" },
  });
  const ids: string[] = [];
  for (const [type, col, row, params] of spec.nodes) {
    const id = `n${ids.length + 1}`;
    ids.push(id);
    const nodeParams = retarget(spec.key, type, params ?? {}, ctx);
    graph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        {
          id,
          type,
          x: 40 + col * 236,
          y: 50 + row * 190,
          params: nodeParams,
          ...(type === "page" ? { slug: slugFor(spec.name, graph.nodes.some((n) => n.type === "page"), id) } : {}),
        },
      ],
    };
  }
  for (const [a, fi, b, ti] of spec.edges) {
    const linked = connect(graph, ids[a], fi, ids[b], ti);
    if (!linked.ok) {
      throw new Error(`${key}: ${spec.nodes[a][0]} → ${spec.nodes[b][0]} refused (${linked.reason})`);
    }
    graph = linked.graph;
  }
  return graph;
}

function slugFor(name: string, prior: boolean, id: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "campaign";
  return prior ? `${base}-${id}` : base;
}

/** When the facility has its own sizes, offers, or proven ads, prefer those keys. */
function retarget(key: TemplateKey, type: NodeType, params: NodeParams, ctx: FunnelContext): NodeParams {
  if (type === "units" && ctx.units?.length) {
    const want = ctx.units.filter((u) => {
      if (u.empty <= 0 && key !== "lease") return false;
      if (key === "drive") return !!u.driveUp && u.empty > 0;
      if (key === "shoulder") return !!u.climate && u.empty > 0;
      return true;
    });
    if (want.length) return { ...params, sizes: want.map((u) => u.key) };
  }
  if (type === "offer" && ctx.offers?.some((o) => o.active)) {
    const active = ctx.offers.filter((o) => o.active);
    const current = typeof params.offer === "string" ? params.offer : "";
    if (!active.some((o) => o.key === current)) return { ...params, offer: active[0].key };
  }
  if (type === "proven" && ctx.provenAds?.length) {
    const current = typeof params.src === "string" ? params.src : "";
    if (!ctx.provenAds.some((p) => p.key === current)) return { ...params, src: ctx.provenAds[0].key };
  }
  return { ...params };
}

export function templateBlurb(key: TemplateKey, ctx: FunnelContext = {}): string {
  if (key === "drive") {
    const drive = (ctx.units ?? []).filter((u) => u.driveUp && u.empty > 0);
    const sizes = drive.length
      ? drive.map((u) => `${u.name} has ${u.empty} empty`).join(", ")
      : "10x10 drive-up has 18 empty, 10x20 has 6, 10x15 has 4";
    return `${sizes}. A proven ad on Meta, then a page where people reserve or get a text back.`;
  }
  if (key === "lease") {
    return "Every size, your opening offer, Meta and Google, and tours. For a building that's mostly empty.";
  }
  return "Climate units with the special you already run: a Google post plus a small Meta budget.";
}

export function templateMeta(key: TemplateKey): { key: TemplateKey; name: string; icon: string } {
  const spec = SPECS[key];
  return { key: spec.key, name: spec.name, icon: spec.icon };
}
