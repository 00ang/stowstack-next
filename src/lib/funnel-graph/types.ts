/**
 * A campaign as a graph of functions. Stored on `funnels.config.graph`
 * (the existing JSON column). Nothing here talks to the network.
 *
 * Ports carry one kind of object: Space, Audience, Ad, Visit, Lead, Hold,
 * Move-in. A connection is legal only when the output's kind is the kind
 * the input accepts.
 */

export const PORT_TYPES = ["space", "audience", "ad", "visit", "lead", "hold", "move-in"] as const;
export type PortType = (typeof PORT_TYPES)[number];

export const NODE_TYPES = [
  "units",
  "offer",
  "waitlist",
  "audience",
  "proven",
  "write",
  "meta",
  "google",
  "gbp",
  "page",
  "reserve",
  "textback",
  "follow",
  "tour",
  "missed",
  "movein",
  "capi",
  "review",
  "report",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const LANES = ["space", "reach", "convert", "respond", "prove"] as const;
export type Lane = (typeof LANES)[number];

/** Param values are strings, or a list of strings for a multi-select. */
export type ParamValue = string | string[];
export type NodeParams = Record<string, ParamValue>;

export interface FunnelNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  params: NodeParams;
  /** Landing-page slug, set when the node is a page. */
  slug?: string;
}

export interface FunnelEdge {
  id: string;
  from: string;
  fromPort: number;
  to: string;
  toPort: number;
}

export interface FunnelGoal {
  moveIns: number;
  month: string;
}

export interface FunnelGraph {
  version: 1;
  /** Null until the operator has started a campaign. */
  name: string | null;
  status: "draft" | "published";
  goal: FunnelGoal | null;
  nodes: FunnelNode[];
  edges: FunnelEdge[];
}

/** Facts the rules may cite. Readings from this are sample when `sample` is set. */
export interface FunnelContext {
  sample?: boolean;
  facilityName?: string;
  goal?: FunnelGoal;
  movedIn30?: number;
  units?: { key: string; name: string; empty: number; driveUp?: boolean; climate?: boolean }[];
  offers?: { key: string; name: string; deal: string; active: boolean }[];
  provenAds?: { key: string; line: string }[];
  /** Connected ad accounts, if known. */
  metaConnected?: boolean;
}

export interface ConnectRefusal {
  ok: false;
  reason: string;
}

export interface ConnectOk {
  ok: true;
}

export type ConnectResult = ConnectOk | ConnectRefusal;

export interface Readiness {
  state: "ready" | "needs";
  /** The one missing input, when state is "needs". */
  need: string | null;
}

export type GapRule =
  | "goal"
  | "space"
  | "visit"
  | "ad-to-page"
  | "page-leads"
  | "lead-responder"
  | "move-in-path"
  | "report";

export interface GraphGap {
  rule: GapRule;
  sentence: string;
  nodeId?: string;
}

export type MoveAction =
  | { kind: "templates" }
  | { kind: "edit-goal" }
  | { kind: "add"; node: FunnelNode; connects: { fromId: string; fromPort: number; toPort: number }[]; focus: boolean }
  | { kind: "connect"; fromId: string; fromPort: number; toId: string; toPort: number }
  | { kind: "select"; nodeId: string; focus: boolean }
  | { kind: "publish" }
  | { kind: "ads-manager" };

export interface NextMove {
  sentence: string;
  reason: string;
  actionLabel: string;
  action: MoveAction;
}

export interface PublishStep {
  nodeId: string;
  title: string;
  /** Module or route this node calls. No request is made. */
  endpoint: string;
  summary: string;
  backend: "exists" | "partial";
  /** Ad platforms are created paused. The step must say so. */
  paused: boolean;
}
