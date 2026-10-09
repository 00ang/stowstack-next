import { readGraph } from "./schema";
import type { FunnelGraph, NodeParams, NodeType } from "./types";

/**
 * An existing funnel row, as the list API returns it. Converted to
 * ad → page → follow-up when it has no stored graph, so every campaign
 * opens without anyone retyping it.
 */
export interface FunnelRecord {
  id: string;
  name: string;
  status?: string | null;
  config?: unknown;
  ad_variations?: { id: string; platform?: string | null; angle?: string | null; status?: string | null }[];
  landing_pages?: { id: string; slug?: string | null; status?: string | null; title?: string | null }[];
  drip_sequence_templates?: { id: string; sequence_type?: string | null; steps?: unknown }[];
}

const ANGLES = new Set(["convenience", "social_proof", "urgency", "lifestyle"]);

export function graphFromRecord(record: FunnelRecord): FunnelGraph {
  const stored = readGraph(record.config);
  if (stored) return stored;

  const ads = record.ad_variations ?? [];
  const pages = record.landing_pages ?? [];
  const drips = record.drip_sequence_templates ?? [];
  const nodes: FunnelGraph["nodes"] = [];
  const edges: FunnelGraph["edges"] = [];
  let n = 1;
  let e = 1;
  const id = () => `n${n++}`;
  const eid = () => `e${e++}`;

  const adNodes = ads.map((ad, i) => {
    const angle = ad.angle && ANGLES.has(ad.angle) ? ad.angle : "convenience";
    const node = {
      id: id(),
      type: "write" as NodeType,
      x: 40,
      y: 50 + i * 190,
      params: { angle },
    };
    nodes.push(node);
    return { node, platform: (ad.platform ?? "").toLowerCase() };
  });

  const pageNodes = pages.map((page, i) => {
    const node = {
      id: id(),
      type: "page" as NodeType,
      x: 40 + 2 * 236,
      y: 50 + i * 190,
      params: (page.id ? { page: page.id } : {}) as NodeParams,
      slug: page.slug || undefined,
    };
    nodes.push(node);
    return node;
  });

  const channelFor = (platform: string): NodeType => (platform.includes("google") ? "google" : "meta");
  adNodes.forEach((ad, i) => {
    const page = pageNodes[Math.min(i, pageNodes.length - 1)];
    if (!page) return;
    const channelType = channelFor(ad.platform);
    const channel: FunnelGraph["nodes"][number] = {
      id: id(),
      type: channelType,
      x: 40 + 236,
      y: ad.node.y,
      params: channelType === "meta" ? { acct: "ok" } : {},
    };
    nodes.push(channel);
    edges.push({ id: eid(), from: ad.node.id, fromPort: 0, to: channel.id, toPort: 0 });
    edges.push({ id: eid(), from: channel.id, fromPort: 0, to: page.id, toPort: 0 });
  });

  const follow = drips.find((d) => d.sequence_type !== "recovery") ?? drips[0];
  if (follow && pageNodes[0]) {
    const steps = Array.isArray(follow.steps) ? String(Math.min(follow.steps.length, 5) || 3) : "3";
    const node = {
      id: id(),
      type: "follow" as NodeType,
      x: 40 + 3 * 236,
      y: 50,
      params: { steps: steps === "4" ? "5" : steps === "1" || steps === "2" ? "3" : steps === "5" ? "5" : "3" },
    };
    nodes.push(node);
    edges.push({ id: eid(), from: pageNodes[0].id, fromPort: 0, to: node.id, toPort: 0 });
  }

  return {
    version: 1,
    name: record.name,
    status: "draft",
    goal: null,
    nodes,
    edges,
  };
}
