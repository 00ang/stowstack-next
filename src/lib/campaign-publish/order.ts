import type { FunnelGraph, FunnelNode, NodeType } from "@/lib/funnel-graph";

/**
 * The order a campaign publishes in. Not the graph's own left-to-right order:
 * an ad has to point at its page, so the page is made before the ad that
 * sends people to it, and the page is message-matched to the ad's copy, so the
 * copy is written before the page.
 */
const PHASE: Record<NodeType, number> = {
  units: 0,
  offer: 0,
  audience: 0,
  write: 1,
  proven: 1,
  page: 2,
  reserve: 3,
  tour: 3,
  waitlist: 3,
  textback: 4,
  follow: 4,
  missed: 4,
  meta: 5,
  google: 5,
  gbp: 5,
  movein: 6,
  capi: 6,
  review: 6,
  report: 6,
};

export function publishOrder(graph: FunnelGraph): string[] {
  return [...graph.nodes]
    .sort((a, b) => PHASE[a.type] - PHASE[b.type] || a.x - b.x || a.y - b.y)
    .map((n) => n.id);
}

export function upstream(graph: FunnelGraph, nodeId: string): FunnelNode[] {
  const ids = graph.edges.filter((e) => e.to === nodeId).map((e) => e.from);
  return graph.nodes.filter((n) => ids.includes(n.id));
}

export function downstream(graph: FunnelGraph, nodeId: string): FunnelNode[] {
  const ids = graph.edges.filter((e) => e.from === nodeId).map((e) => e.to);
  return graph.nodes.filter((n) => ids.includes(n.id));
}

/** Every node of these types reachable going back from `nodeId`, nearest first. */
export function findUpstream(graph: FunnelGraph, nodeId: string, types: NodeType[], maxHops = 4): FunnelNode[] {
  const found: FunnelNode[] = [];
  let frontier = [nodeId];
  const seen = new Set(frontier);
  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of upstream(graph, id)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (types.includes(n.type)) found.push(n);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return found;
}

/** The same, going forward. */
export function findDownstream(graph: FunnelGraph, nodeId: string, types: NodeType[], maxHops = 4): FunnelNode[] {
  const found: FunnelNode[] = [];
  let frontier = [nodeId];
  const seen = new Set(frontier);
  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of downstream(graph, id)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (types.includes(n.type)) found.push(n);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return found;
}

/**
 * The tracking a channel's link carries. utm_campaign is the campaign's own id,
 * which is what ties a visit — and the lead it becomes — to this campaign even
 * when the page it lands on is shared or the page id is lost on the way in.
 * The mediums are the ones attribution/touch.ts classifies by.
 */
const CHANNEL_TAGS: Partial<Record<NodeType, { utm_source: string; utm_medium: string }>> = {
  meta: { utm_source: "facebook", utm_medium: "paid_social" },
  google: { utm_source: "google", utm_medium: "cpc" },
  gbp: { utm_source: "google", utm_medium: "organic" },
};

export function trackingUrl(pageUrl: string, channel: NodeType, campaignId: string, nodeId: string): string {
  const tags = CHANNEL_TAGS[channel];
  const url = new URL(pageUrl);
  if (tags) {
    url.searchParams.set("utm_source", tags.utm_source);
    url.searchParams.set("utm_medium", tags.utm_medium);
  }
  url.searchParams.set("utm_campaign", campaignId);
  url.searchParams.set("utm_content", channel === "gbp" ? "gbp" : nodeId);
  return url.toString();
}

export function pageUrl(base: string, slug: string): string {
  return `${base.replace(/\/+$/, "")}/lp/${slug}`;
}
