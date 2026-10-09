import { defOf } from "./catalog";
import type { FunnelGraph, NodeType } from "./types";

/**
 * What flowed through a campaign in its window, counted from the facility's
 * own records (touches, leads, enrollments, tours, tenants), and the label
 * each wire carries. A wire is labelled with what left the function at its
 * start: visits out of a channel, leads out of the page, leads answered out
 * of text-back, and so on. Wires that carry configuration (sizes, an
 * audience, an ad) carry no count.
 */
export interface FlowCounts {
  days: number;
  visits: { meta: number; google: number; gbp: number; tiktok: number; other: number };
  /** Leads captured on the campaign's pages or tagged to the campaign. */
  leads: number;
  /** Of those, how many got a first reply. */
  answered: number;
  /** Of those, how many are in a follow-up sequence. */
  enrolled: number;
  /** Of those, how many booked or took a tour. */
  toured: number;
  /** Of those, how many reserved (a hold). */
  holds: number;
  /** Of those, how many moved in. */
  moveIns: number;
}

function n(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** The count a node puts on the wire leaving its output `port`, or null when there is none to show. */
function countOut(type: NodeType, port: number, c: FlowCounts): string | null {
  switch (type) {
    case "meta":
      return n(c.visits.meta, "visit");
    case "google":
      return n(c.visits.google, "visit");
    case "gbp":
      return n(c.visits.gbp, "visit");
    case "page":
      // Output 0 is leads; output 1 is visits going on to reserve (counted as holds there).
      return port === 0 ? n(c.leads, "lead") : null;
    case "textback":
      return `${c.answered.toLocaleString("en-US")} answered`;
    case "follow":
      return `${c.enrolled.toLocaleString("en-US")} in follow-up`;
    case "tour":
      return `${c.toured.toLocaleString("en-US")} toured`;
    case "reserve":
      return n(c.holds, "hold");
    case "movein":
      return n(c.moveIns, "move-in");
    default:
      return null;
  }
}

/** Edge id → label, for every wire that carries a count. */
export function edgeCounts(graph: FunnelGraph, counts: FlowCounts | null): Record<string, string> {
  if (!counts) return {};
  const out: Record<string, string> = {};
  for (const e of graph.edges) {
    const from = graph.nodes.find((x) => x.id === e.from);
    if (!from || !defOf(from.type).outputs[e.fromPort]) continue;
    const label = countOut(from.type, e.fromPort, counts);
    if (label) out[e.id] = label;
  }
  return out;
}

/** Nothing has flowed yet: a draft campaign, or one with no pages or leads in the window. */
export function isEmptyFlow(c: FlowCounts | null): boolean {
  if (!c) return true;
  const v = c.visits;
  return v.meta + v.google + v.gbp + v.tiktok + v.other + c.leads === 0;
}

/** Which channel bucket a touch belongs to, from its classified channel and source (src/lib/attribution/touch.ts). */
export function visitBucket(channel: string, source: string | null): keyof FlowCounts["visits"] {
  const s = (source ?? "").toLowerCase();
  if (s === "meta" || s === "facebook" || s === "instagram") return "meta";
  if (s === "tiktok") return "tiktok";
  if (s === "google" && channel === "paid_search") return "google";
  if (s === "google") return "gbp";
  return "other";
}
