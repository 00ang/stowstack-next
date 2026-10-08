import { defOf } from "./catalog";
import { inEdges, outEdges, reaches } from "./graph";
import type { FunnelGraph, GraphGap, NodeType } from "./types";

const VISIT_TYPES: NodeType[] = ["meta", "google", "gbp"];

/**
 * Structural gaps, in the order a campaign has to work:
 * goal → space → a visit source → every ad reaches a page → every page
 * captures leads → every lead output is connected → a path reaches a
 * move-in → move-ins are reported.
 */
export function validateGraph(graph: FunnelGraph): GraphGap[] {
  const gaps: GraphGap[] = [];

  if (!graph.goal || !(graph.goal.moveIns > 0) || !graph.goal.month) {
    gaps.push({ rule: "goal", sentence: "Set how many move-ins, and by when." });
  }

  if (!graph.nodes.some((n) => n.type === "units")) {
    gaps.push({ rule: "space", sentence: "Add the sizes you want to fill." });
  }

  if (!graph.nodes.some((n) => VISIT_TYPES.includes(n.type))) {
    gaps.push({ rule: "visit", sentence: "Add a channel that sends people to a page." });
  }

  const pages = graph.nodes.filter((n) => n.type === "page");
  for (const n of graph.nodes) {
    defOf(n.type).outputs.forEach((port, i) => {
      if (port !== "ad") return;
      const targets = outEdges(graph, n.id, i);
      const reachesPage =
        targets.length > 0 &&
        pages.some((page) => targets.some((e) => e.to === page.id || reaches(graph, e.to, page.id)));
      if (!reachesPage) {
        gaps.push({
          rule: "ad-to-page",
          nodeId: n.id,
          sentence: `${defOf(n.type).title} never reaches a landing page.`,
        });
      }
    });
  }

  for (const page of graph.nodes.filter((n) => n.type === "page")) {
    const leadPort = defOf("page").outputs.indexOf("lead");
    if (outEdges(graph, page.id, leadPort).length === 0) {
      gaps.push({ rule: "page-leads", nodeId: page.id, sentence: "The landing page doesn't capture a lead." });
    }
  }

  for (const n of graph.nodes) {
    defOf(n.type).outputs.forEach((port, i) => {
      if (port !== "lead") return;
      if (outEdges(graph, n.id, i).length === 0) {
        gaps.push({
          rule: "lead-responder",
          nodeId: n.id,
          sentence: `${defOf(n.type).title} sends leads nowhere.`,
        });
      }
    });
  }

  const channels = graph.nodes.filter((n) => VISIT_TYPES.includes(n.type));
  const moveins = graph.nodes.filter((n) => n.type === "movein");
  const closed = channels.some((c) => moveins.some((m) => reaches(graph, c.id, m.id)));
  if (!closed) {
    gaps.push({ rule: "move-in-path", sentence: "Nothing connects a channel to a move-in." });
  }

  const reported = graph.nodes.some(
    (n) => n.type === "report" && inEdges(graph, n.id).some((e) => graph.nodes.find((m) => m.id === e.from)?.type === "movein"),
  );
  if (!reported) {
    gaps.push({ rule: "report", sentence: "Move-ins aren't reported as cost per move-in." });
  }

  return gaps;
}
