import type { FunnelGraph } from "@/lib/funnel-graph";

/** Layered left-to-right layout for a template or a converted funnel. */
export async function layoutGraph(graph: FunnelGraph): Promise<FunnelGraph> {
  if (graph.nodes.length === 0) return graph;
  try {
    const elkModule = await import("elkjs/lib/elk.bundled.js");
    const ELK = elkModule.default;
    const elk = new ELK();
    const laid = await elk.layout({
      id: "funnel",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "28",
        // Wide enough between columns for a wire's count to sit clear of both ends.
        "elk.layered.spacing.nodeNodeBetweenLayers": "104",
      },
      children: graph.nodes.map((n) => ({ id: n.id, width: 220, height: 168 })),
      edges: graph.edges.map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] })),
    });
    const pos = new Map((laid.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
    return {
      ...graph,
      nodes: graph.nodes.map((n) => ({
        ...n,
        x: Math.round(pos.get(n.id)?.x ?? n.x),
        y: Math.round(pos.get(n.id)?.y ?? n.y),
      })),
    };
  } catch {
    return graph;
  }
}
