import { defOf } from "./catalog";
import { topo } from "./graph";
import type { FunnelGraph, PublishStep } from "./types";

/**
 * One line per node: the endpoint publish would call, and whether the
 * platform campaign is created paused. No network calls.
 */
export function toPublishPlan(graph: FunnelGraph): PublishStep[] {
  return topo(graph).map((node) => {
    const def = defOf(node.type);
    return {
      nodeId: node.id,
      title: def.title,
      endpoint: def.endpoint,
      summary: def.publish(node),
      backend: def.backend,
      paused: def.paused,
    };
  });
}
