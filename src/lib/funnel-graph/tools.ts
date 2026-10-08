import type { ObjectTypeKey, OntologyObject, ToolKey } from "@/lib/ontology/types";
import { list, param } from "./catalog";
import { firstOf } from "./graph";
import type { FunnelGraph, FunnelNode, NodeType } from "./types";

/**
 * The tool that does each function's work, so a function on the canvas opens
 * that tool with the object it works on already in focus. Functions with no
 * tool of their own (reserve, tour, Tell Meta & Google, cost per move-in) are
 * absent and show no link.
 */
export const NODE_TOOL: Partial<Record<NodeType, { tool: ToolKey; label: string }>> = {
  units: { tool: "occupancy", label: "See these sizes in Occupancy" },
  offer: { tool: "gbp", label: "Post the offer on Google Business" },
  proven: { tool: "proven-ads", label: "Pick the ad in Proven Ads" },
  write: { tool: "creative-studio", label: "Write it in Creative Studio" },
  meta: { tool: "ad-publisher", label: "Open Publish Ads" },
  google: { tool: "google-ads", label: "Open Google Ads" },
  gbp: { tool: "gbp", label: "Write the post in Google Business" },
  page: { tool: "landing-pages", label: "Open the page in Landing Pages" },
  textback: { tool: "lead-nurture", label: "Open Lead Follow-Up" },
  follow: { tool: "lead-nurture", label: "Open Lead Follow-Up" },
  missed: { tool: "call-tracking", label: "Open Call Tracking" },
  movein: { tool: "tenants", label: "Open Tenants" },
  review: { tool: "gbp", label: "Open reviews in Google Business" },
};

function byId(objects: OntologyObject[], type: ObjectTypeKey, id: string): OntologyObject | undefined {
  return objects.find((o) => o.type === type && o.id === id);
}

/** The ontology object a function works on, when the campaign names one. */
export function nodeSubject(graph: FunnelGraph, node: FunnelNode, objects: OntologyObject[]): OntologyObject | null {
  switch (node.type) {
    case "units":
    case "write":
    case "proven":
    case "waitlist": {
      // Ads and the waitlist work on the campaign's sizes; the Units function's
      // first size is the one they are about.
      const units = node.type === "units" ? node : firstOf(graph, "units");
      const sizes = units ? list(units.params.sizes) : [];
      return (sizes.length ? byId(objects, "units", sizes[0]) : undefined) ?? null;
    }
    case "offer":
      return byId(objects, "offers", param(node, "offer")) ?? null;
    case "page":
      return node.slug ? objects.find((o) => o.type === "pages" && o.address === `pages/${node.slug}`) ?? null : null;
    default:
      return null;
  }
}
