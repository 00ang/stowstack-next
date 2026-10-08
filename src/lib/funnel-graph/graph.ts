import { CATALOG, defOf, emptyParam, needLabel, slugify } from "./catalog";
import { PORTS, article } from "./ports";
import type {
  ConnectResult,
  FunnelEdge,
  FunnelGraph,
  FunnelNode,
  NodeParams,
  NodeType,
  PortType,
  Readiness,
} from "./types";

export function emptyGraph(partial: Partial<FunnelGraph> = {}): FunnelGraph {
  return {
    version: 1,
    name: null,
    status: "draft",
    goal: null,
    nodes: [],
    edges: [],
    ...partial,
  };
}

export function nodeById(graph: FunnelGraph, id: string): FunnelNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function inEdges(graph: FunnelGraph, id: string, port?: number): FunnelEdge[] {
  return graph.edges.filter((e) => e.to === id && (port == null || e.toPort === port));
}

export function outEdges(graph: FunnelGraph, id: string, port?: number): FunnelEdge[] {
  return graph.edges.filter((e) => e.from === id && (port == null || e.fromPort === port));
}

export function reaches(graph: FunnelGraph, from: string, to: string, seen = new Set<string>()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return outEdges(graph, from).some((e) => reaches(graph, e.to, to, seen));
}

/** A node that accepts `incoming` and emits `outgoing`, if one exists. */
export function bridgeNode(incoming: PortType, outgoing: PortType): NodeType | null {
  for (const type of Object.keys(CATALOG) as NodeType[]) {
    const def = CATALOG[type];
    if (def.inputs.some((p) => p.port === incoming) && def.outputs.includes(outgoing)) return type;
  }
  return null;
}

export function canConnect(
  graph: FunnelGraph,
  fromId: string,
  fromPort: number,
  toId: string,
  toPort: number,
): ConnectResult {
  const a = nodeById(graph, fromId);
  const b = nodeById(graph, toId);
  if (!a || !b) return { ok: false, reason: "Nothing to connect." };
  if (a.id === b.id) return { ok: false, reason: "A function can't feed itself." };

  const outType = defOf(a.type).outputs[fromPort];
  const input = defOf(b.type).inputs[toPort];
  if (outType == null) return { ok: false, reason: "That port isn't an output." };
  if (!input) return { ok: false, reason: "That port isn't an input." };
  if (outType !== input.port) {
    const bridge = bridgeNode(outType, input.port);
    const between = bridge ? ` Put ${article(CATALOG[bridge].title)} ${CATALOG[bridge].title} between them.` : "";
    return {
      ok: false,
      reason: `${CATALOG[b.type].title} takes ${PORTS[input.port].phrase}, not ${PORTS[outType].phrase}.${between}`,
    };
  }
  if (graph.edges.some((e) => e.from === a.id && e.fromPort === fromPort && e.to === b.id && e.toPort === toPort)) {
    return { ok: false, reason: "Those two are already connected." };
  }
  if (reaches(graph, b.id, a.id)) return { ok: false, reason: "That would make a loop." };
  return { ok: true };
}

export function readiness(graph: FunnelGraph, node: FunnelNode): Readiness {
  const def = defOf(node.type);
  if (def.anyInput && !def.inputs.some((_, i) => inEdges(graph, node.id, i).length > 0)) {
    return { state: "needs", need: def.anyNeed || PORTS.lead.phrase };
  }
  if (!def.anyInput) {
    for (let i = 0; i < def.inputs.length; i++) {
      const input = def.inputs[i];
      if (input.required && inEdges(graph, node.id, i).length === 0) {
        return { state: "needs", need: PORTS[input.port].phrase };
      }
    }
  }
  for (const p of def.params) {
    if (p.required && emptyParam(node.params[p.key], p.kind)) {
      return { state: "needs", need: needLabel(p) };
    }
  }
  return { state: "ready", need: null };
}

export function readyCount(graph: FunnelGraph): { ready: number; total: number } {
  const ready = graph.nodes.filter((n) => readiness(graph, n).state === "ready").length;
  return { ready, total: graph.nodes.length };
}

const VISIT_SOURCES: NodeType[] = ["meta", "google", "gbp", "missed"];

export function pathToMoveIn(graph: FunnelGraph): boolean {
  const sources = graph.nodes.filter((n) => VISIT_SOURCES.includes(n.type));
  const targets = graph.nodes.filter((n) => n.type === "movein");
  return sources.some((s) => targets.some((t) => reaches(graph, s.id, t.id)));
}

function bumpId(graph: FunnelGraph, prefix: string, field: "nodes" | "edges"): string {
  const nums = graph[field].map((item) => Number(item.id.replace(/\D/g, "")) || 0);
  return `${prefix}${Math.max(0, ...nums) + 1}`;
}

export function addNode(
  graph: FunnelGraph,
  type: NodeType,
  x: number,
  y: number,
  params: NodeParams = {},
  id?: string,
): { graph: FunnelGraph; node: FunnelNode } {
  const node: FunnelNode = {
    id: id ?? bumpId(graph, "n", "nodes"),
    type,
    x: Math.round(x),
    y: Math.round(y),
    params: structuredClone(params),
  };
  if (type === "page") {
    const base = slugify(graph.name ?? "campaign");
    const prior = graph.nodes.some((n) => n.type === "page");
    node.slug = prior ? `${base}-${node.id}` : base;
  }
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node };
}

export function connect(
  graph: FunnelGraph,
  fromId: string,
  fromPort: number,
  toId: string,
  toPort: number,
): { ok: true; graph: FunnelGraph; edge: FunnelEdge } | { ok: false; reason: string } {
  const check = canConnect(graph, fromId, fromPort, toId, toPort);
  if (!check.ok) return check;
  const edge: FunnelEdge = { id: bumpId(graph, "e", "edges"), from: fromId, fromPort, to: toId, toPort };
  return { ok: true, graph: { ...graph, edges: [...graph.edges, edge] }, edge };
}

/** First free slot to the right of `src`, or the canvas origin. */
export function placeAfter(graph: FunnelGraph, src: FunnelNode | undefined, dy = 0): [number, number] {
  let x = src ? src.x + 236 : 40;
  let y = src ? src.y + dy : 50;
  while (graph.nodes.some((n) => Math.abs(n.x - x) < 205 && Math.abs(n.y - y) < 170)) y += 190;
  return [x, y];
}

export function firstOf(graph: FunnelGraph, type: NodeType): FunnelNode | undefined {
  return graph.nodes.find((n) => n.type === type);
}

/** An unconnected output of `port`, optionally limited to one node type. */
export function looseOut(
  graph: FunnelGraph,
  port: PortType,
  type?: NodeType,
): { node: FunnelNode; port: number } | null {
  for (const n of graph.nodes) {
    if (type && n.type !== type) continue;
    const i = defOf(n.type).outputs.indexOf(port);
    if (i >= 0 && outEdges(graph, n.id, i).length === 0) return { node: n, port: i };
  }
  return null;
}

export function topo(graph: FunnelGraph): FunnelNode[] {
  const indeg = new Map(graph.nodes.map((n) => [n.id, inEdges(graph, n.id).length]));
  const queue = graph.nodes.filter((n) => !indeg.get(n.id)).sort((a, b) => a.x - b.x || a.y - b.y);
  const out: FunnelNode[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const e of outEdges(graph, n.id)) {
      indeg.set(e.to, (indeg.get(e.to) ?? 1) - 1);
      if (!indeg.get(e.to)) {
        const next = nodeById(graph, e.to);
        if (next) queue.push(next);
      }
    }
    queue.sort((a, b) => a.x - b.x || a.y - b.y);
  }
  return out.concat(graph.nodes.filter((n) => !out.includes(n)));
}

/** Output index on `type` that emits `port`, or -1. */
export function outputIndex(type: NodeType, port: PortType): number {
  return defOf(type).outputs.indexOf(port);
}

/** Input index on `type` that accepts `port`, or -1. */
export function inputIndex(type: NodeType, port: PortType): number {
  return defOf(type).inputs.findIndex((p) => p.port === port);
}
