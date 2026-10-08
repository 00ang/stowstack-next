import { CATALOG, defOf } from "./catalog";
import { PORTS } from "./ports";
import {
  addNode,
  canConnect,
  connect,
  firstOf,
  inEdges,
  looseOut,
  outEdges,
  outputIndex,
  placeAfter,
  readiness,
} from "./graph";
import type { FunnelContext, FunnelGraph, FunnelNode, MoveAction, NextMove, NodeParams, NodeType, PortType } from "./types";

const REACH: NodeType[] = ["meta", "google", "gbp"];

function move(sentence: string, reason: string, actionLabel: string, action: MoveAction): NextMove {
  return { sentence, reason, actionLabel, action };
}

function withConnects(
  graph: FunnelGraph,
  type: NodeType,
  src: FunnelNode,
  fromPort: number,
  params: NodeParams,
  dy = 0,
): { node: FunnelNode; connects: { fromId: string; fromPort: number; toPort: number }[] } {
  const [x, y] = placeAfter(graph, src, dy);
  const added = addNode(graph, type, x, y, params, previewId(graph));
  const toPort = defOf(type).inputs.findIndex((p) => p.port === defOf(src.type).outputs[fromPort]);
  const connects: { fromId: string; fromPort: number; toPort: number }[] = [];
  if (toPort >= 0) connects.push({ fromId: src.id, fromPort, toPort });
  return { node: added.node, connects };
}

/** Stable id for a node the move would add. The UI applies it as-is. */
function previewId(graph: FunnelGraph): string {
  const nums = graph.nodes.map((n) => Number(n.id.replace(/\D/g, "")) || 0);
  const n = Math.max(0, ...nums) + 1;
  return `n${n}`;
}

function goalReason(graph: FunnelGraph, ctx: FunnelContext): string {
  const goal = graph.goal ?? ctx.goal;
  if (!goal) return "Pick the outcome first. The funnel is built toward it.";
  return `Goal: ${goal.moveIns} move-ins in ${goal.month}. A template built on your vacancy gets you most of the way.`;
}

function budgetOf(graph: FunnelGraph): string {
  const meta = firstOf(graph, "meta");
  const budget = meta?.params.budget;
  return typeof budget === "string" && budget ? budget : "";
}

function leadEnd(graph: FunnelGraph): { node: FunnelNode; port: number } | null {
  for (const n of graph.nodes) {
    if (n.type === "page") continue;
    const i = defOf(n.type).outputs.indexOf("lead");
    if (i >= 0 && outEdges(graph, n.id, i).length === 0) return { node: n, port: i };
  }
  return null;
}

/**
 * The first gap, as one button. Outcome first: the goal, then the one
 * missing function or field on the way to a move-in.
 */
export function nextMove(graph: FunnelGraph, ctx: FunnelContext = {}): NextMove {
  const goal = graph.goal ?? ctx.goal ?? null;

  if (!graph.name) {
    return move(
      "Start a campaign from your goal.",
      goalReason(graph, ctx),
      "Pick a template",
      { kind: "templates" },
    );
  }

  if (graph.status === "published") {
    const budget = budgetOf(graph);
    return move(
      "Switch the Meta campaign on in Ads Manager.",
      `StorageAds created it paused${budget ? ` at $${budget}/day` : ""}. Nothing spends until you do; the page and follow-ups are already live.`,
      "Open Ads Manager",
      { kind: "ads-manager" },
    );
  }

  if (!goal) {
    return move(
      "Set how many move-ins, and by when.",
      "The campaign is judged on move-ins, not clicks.",
      "Set the goal",
      { kind: "edit-goal" },
    );
  }

  const units = firstOf(graph, "units");
  if (!units) {
    const drive = (ctx.units ?? []).filter((u) => u.driveUp && u.empty > 0).sort((a, b) => b.empty - a.empty);
    const fallback = (ctx.units ?? []).find((u) => u.empty > 0);
    const sizes = drive.length ? [drive[0].key] : fallback ? [fallback.key] : [];
    const top = drive[0];
    const added = addNode(graph, "units", 40, 50, { sizes: sizes.length ? sizes : [] }, previewId(graph));
    return move(
      "Pick the sizes to fill.",
      top ? `${top.name} has ${top.empty} empty, the most of any drive-up size.` : "Start from the sizes that are sitting empty.",
      "Add Units",
      { kind: "add", node: added.node, connects: [], focus: true },
    );
  }

  for (const n of graph.nodes) {
    const def = defOf(n.type);
    if (def.anyInput && def.inputs.some((_, i) => inEdges(graph, n.id, i).length > 0)) continue;
    for (let i = 0; i < def.inputs.length; i++) {
      const input = def.inputs[i];
      if (!(input.required || def.anyInput) || inEdges(graph, n.id, i).length > 0) continue;
      const src = graph.nodes.find((m) => {
        if (m.id === n.id) return false;
        const fi = defOf(m.type).outputs.indexOf(input.port);
        return fi >= 0 && canConnect(graph, m.id, fi, n.id, i).ok;
      });
      if (src) {
        const fi = defOf(src.type).outputs.indexOf(input.port);
        return move(
          `Connect ${def.title}.`,
          `It needs ${PORTS[input.port].phrase}, and ${CATALOG[src.type].title} gives it.`,
          `Connect from ${CATALOG[src.type].title}`,
          { kind: "connect", fromId: src.id, fromPort: fi, toId: n.id, toPort: i },
        );
      }
    }
  }

  const hasReach = graph.nodes.some((n) => REACH.includes(n.type));
  const creative = graph.nodes.find((n) => defOf(n.type).outputs.includes("ad"));
  if (!hasReach && !creative) {
    const aud = firstOf(graph, "audience");
    if (!aud) {
      const src = firstOf(graph, "offer") ?? units;
      const { node, connects } = withConnects(graph, "audience", src, 0, { radius: "5", who: "movers" });
      return move(
        "Decide who should see this.",
        "An audience turns the sizes into people within driving distance.",
        "Add an audience",
        { kind: "add", node, connects, focus: false },
      );
    }
    const proven = (ctx.provenAds ?? [])[0];
    const { node, connects } = withConnects(graph, "proven", aud, 0, { src: proven?.key ?? "" });
    const space = outputIndex("units", "space");
    if (space >= 0) connects.push({ fromId: units.id, fromPort: space, toPort: inputPort(node.type, "space") });
    return move(
      "Nothing reaches renters yet.",
      proven ? `${proven.line} is a proven ad you can recreate for your sizes.` : "Recreate a proven ad, or write one, for these sizes.",
      "Recreate a proven ad",
      { kind: "add", node, connects, focus: !proven },
    );
  }

  const ad = looseOut(graph, "ad");
  if (ad) {
    const { node, connects } = withConnects(graph, "meta", ad.node, ad.port, { acct: ctx.metaConnected === false ? "" : "ok" });
    return move(
      `${CATALOG[ad.node.type].title} isn't running anywhere.`,
      "An ad needs a channel. It is created paused, and you switch it on in Ads Manager.",
      "Run it on Meta",
      { kind: "add", node, connects, focus: true },
    );
  }

  const dangling = graph.nodes.find((n) => REACH.includes(n.type) && outEdges(graph, n.id, 0).length === 0);
  if (dangling) {
    const page = firstOf(graph, "page");
    if (page) {
      return move(
        `${CATALOG[dangling.type].title} sends people nowhere yet.`,
        "Send it to the campaign's landing page.",
        "Send to the landing page",
        { kind: "connect", fromId: dangling.id, fromPort: 0, toId: page.id, toPort: 0 },
      );
    }
    const { node, connects } = withConnects(graph, "page", dangling, 0, {});
    return move(
      "Clicks have nowhere to land.",
      "One page per campaign, message-matched to the ad, turns a click into a lead.",
      "Add a landing page",
      { kind: "add", node, connects, focus: false },
    );
  }

  const page = graph.nodes.find((n) => n.type === "page" && outEdges(graph, n.id, 0).length === 0);
  if (page) {
    const { node, connects } = withConnects(graph, "textback", page, 0, {}, 190);
    return move(
      "Leads from the page get no reply.",
      "Speed-to-lead texts within 60 seconds; the call back is what rents the unit.",
      "Add Text back in 60s",
      { kind: "add", node, connects, focus: true },
    );
  }

  if (!firstOf(graph, "follow")) {
    const end = leadEnd(graph);
    if (end) {
      const { node, connects } = withConnects(graph, "follow", end.node, end.port, { steps: "3" });
      return move(
        "Leads who don't answer get one text and nothing after.",
        "A short sequence keeps the unit in front of them for a week.",
        "Add a follow-up",
        { kind: "add", node, connects, focus: false },
      );
    }
  }

  const landing = firstOf(graph, "page");
  if (landing && !firstOf(graph, "reserve") && outEdges(graph, landing.id, 1).length === 0) {
    const { node, connects } = withConnects(graph, "reserve", landing, 1, { src: "storedge" });
    return move(
      "Let people reserve on the page.",
      "A hold on the page means a renter doesn't have to call.",
      "Add Reserve online",
      { kind: "add", node, connects, focus: false },
    );
  }

  const mi = firstOf(graph, "movein");
  if (!mi) {
    const end = leadEnd(graph);
    const hold = looseOut(graph, "hold", "reserve");
    const src = end ?? (hold ? { node: hold.node, port: hold.port } : landing ? { node: landing, port: 0 } : null);
    if (!src) {
      const added = addNode(graph, "movein", 40, 400, { match: "rentroll" }, previewId(graph));
      return move(
        "Judge this campaign on move-ins, not clicks.",
        `Your goal is ${goal.moveIns} move-ins in ${goal.month}. The move-in closes the loop.`,
        "Add the move-in",
        { kind: "add", node: added.node, connects: [], focus: false },
      );
    }
    const { node, connects } = withConnects(graph, "movein", src.node, src.port, { match: "rentroll" });
      if (hold && !(src.node.id === hold.node.id && src.port === hold.port)) {
        const holdIn = defOf("movein").inputs.findIndex((p) => p.port === "hold");
        if (holdIn >= 0) connects.push({ fromId: hold.node.id, fromPort: hold.port, toPort: holdIn });
      }
      const preview: FunnelGraph = {
        ...graph,
        nodes: [...graph.nodes, node],
        edges: [
          ...graph.edges,
          ...connects.map((c, i) => ({ id: `tmp${i}`, from: c.fromId, fromPort: c.fromPort, to: node.id, toPort: c.toPort })),
        ],
      };
      const still = leadEnd(preview);
      if (still && !connects.some((c) => c.fromId === still.node.id && c.fromPort === still.port)) {
        const leadIn = defOf("movein").inputs.findIndex((p) => p.port === "lead");
        if (leadIn >= 0) connects.push({ fromId: still.node.id, fromPort: still.port, toPort: leadIn });
      }
      return move(
        "Judge this campaign on move-ins, not clicks.",
        `Your goal is ${goal.moveIns} move-ins in ${goal.month}. The move-in closes the loop.`,
        "Add the move-in",
        { kind: "add", node, connects, focus: false },
      );
  }

  if (mi) {
    const hold = looseOut(graph, "hold", "reserve");
    if (hold) {
      const holdIn = defOf("movein").inputs.findIndex((p) => p.port === "hold");
      return move(
        "Reservations aren't counted toward the goal.",
        "Connect Reserve online to the move-in.",
        "Connect them",
        { kind: "connect", fromId: hold.node.id, fromPort: hold.port, toId: mi.id, toPort: holdIn },
      );
    }
    const dead = graph.nodes.find((n) => {
      if (n.type === "page" || n.type === "movein") return false;
      const i = defOf(n.type).outputs.indexOf("lead");
      return i >= 0 && outEdges(graph, n.id, i).length === 0;
    });
    if (dead) {
      const i = defOf(dead.type).outputs.indexOf("lead");
      return move(
        `Leads stop at ${CATALOG[dead.type].title}.`,
        "Send them on to the move-in, so a tour or a reply that rents a unit counts toward the goal.",
        "Connect to the move-in",
        { kind: "connect", fromId: dead.id, fromPort: i, toId: mi.id, toPort: 0 },
      );
    }
    if (!firstOf(graph, "report")) {
      const { node, connects } = withConnects(graph, "report", mi, 0, {});
      return move(
        "Show what each move-in cost.",
        "Spend divided by matched move-ins, by channel. The number this campaign is judged on.",
        "Add Cost per move-in",
        { kind: "add", node, connects, focus: false },
      );
    }
  }

  const needing = graph.nodes.find((n) => readiness(graph, n).state === "needs");
  if (needing) {
    const need = readiness(graph, needing).need;
    return move(
      `${CATALOG[needing.type].title} needs ${need}.`,
      "It's the last thing between this function and ready.",
      "Fill it in",
      { kind: "select", nodeId: needing.id, focus: true },
    );
  }

  return move(
    "Ready to publish.",
    "Pages go live and follow-ups switch on. Ad campaigns are created paused; you switch them on in Ads Manager.",
    "Review publish",
    { kind: "publish" },
  );
}

function inputPort(type: NodeType, port: PortType): number {
  return defOf(type).inputs.findIndex((p) => p.port === port);
}

/** Apply an add or connect action. Select and publish leave the graph alone. */
export function applyMove(graph: FunnelGraph, action: MoveAction): FunnelGraph {
  if (action.kind === "add") {
    let next = addNode(graph, action.node.type, action.node.x, action.node.y, action.node.params, action.node.id).graph;
    if (action.node.slug) {
      next = {
        ...next,
        nodes: next.nodes.map((n) => (n.id === action.node.id ? { ...n, slug: action.node.slug } : n)),
      };
    }
    for (const c of action.connects) {
      const linked = connect(next, c.fromId, c.fromPort, action.node.id, c.toPort);
      if (linked.ok) next = linked.graph;
    }
    return next;
  }
  if (action.kind === "connect") {
    const linked = connect(graph, action.fromId, action.fromPort, action.toId, action.toPort);
    return linked.ok ? linked.graph : graph;
  }
  return graph;
}

export function selectTarget(action: MoveAction): string | null {
  if (action.kind === "add") return action.node.id;
  if (action.kind === "connect") return action.toId;
  if (action.kind === "select") return action.nodeId;
  return null;
}
