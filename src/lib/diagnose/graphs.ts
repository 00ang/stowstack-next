import { addNode, connect, emptyGraph } from "@/lib/funnel-graph/graph";
import { buildTemplate } from "@/lib/funnel-graph/templates";
import type { FunnelContext, FunnelGoal, FunnelGraph, NodeParams, NodeType } from "@/lib/funnel-graph/types";

/**
 * Suggested funnels, drawn from the builder's existing step types.
 * Every graph is a draft. Ad budgets are left blank, so nothing spends
 * and nothing publishes until the operator turns it on.
 */

export const SUGGESTION_TEMPLATES = [
  "vacant-size",
  "recovery",
  "follow-up",
  "stay",
  "lease-up",
  "reviews",
  "rent-online",
  "reach",
  "rates",
] as const;

export type SuggestionTemplate = (typeof SUGGESTION_TEMPLATES)[number];

type Step = [NodeType, number, number, NodeParams?];

interface Built {
  name: string;
  steps: Step[];
  edges: [number, number, number, number][];
}

function units(keys: string[]): NodeParams {
  return { sizes: keys };
}

function audience(who: string, radius = "5"): NodeParams {
  return { radius, who };
}

const WRITE: NodeParams = { angle: "convenience" };
const META: NodeParams = { budget: "", acct: "ok" };
const GOOGLE: NodeParams = { budget: "" };
const RESERVE: NodeParams = { src: "storedge" };
const FOLLOW: NodeParams = { steps: "3" };
const TEXT: NodeParams = { phone: "" };
const MOVE: NodeParams = { match: "rentroll" };

function assemble(name: string, goal: FunnelGoal | null, spec: Built): FunnelGraph {
  let graph = emptyGraph({ name, status: "draft", goal });
  const ids: string[] = [];
  for (const [type, col, row, params] of spec.steps) {
    const id = `n${ids.length + 1}`;
    ids.push(id);
    graph = addNode(graph, type, 40 + col * 300, 50 + row * 190, params ?? {}, id).graph;
  }
  for (const [a, fromPort, b, toPort] of spec.edges) {
    const linked = connect(graph, ids[a], fromPort, ids[b], toPort);
    if (!linked.ok) {
      throw new Error(`${name}: ${spec.steps[a][0]} → ${spec.steps[b][0]} refused (${linked.reason})`);
    }
    graph = linked.graph;
  }
  return graph;
}

/** Ad → a page for those sizes → reserve → a text back and a follow-up. */
function vacantSize(keys: string[]): Built {
  return {
    name: "Fill the empty sizes",
    steps: [
      ["units", 0, 0, units(keys)],
      ["audience", 1, 0, audience("movers")],
      ["write", 1, 1, WRITE],
      ["meta", 2, 0, META],
      ["page", 3, 0],
      ["reserve", 3, 1, RESERVE],
      ["textback", 4, 0, TEXT],
      ["follow", 4, 1, FOLLOW],
      ["movein", 5, 0, MOVE],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 1, 5, 0],
      [4, 0, 6, 0],
      [6, 0, 7, 0],
      [7, 0, 8, 0],
      [5, 0, 8, 1],
      [8, 0, 9, 0],
    ],
  };
}

/** Missed calls and reservations that never became a move-in. */
function recovery(keys: string[]): Built {
  return {
    name: "Catch missed calls and holds",
    steps: [
      ["units", 0, 0, units(keys)],
      ["missed", 0, 1],
      ["gbp", 1, 1],
      ["page", 2, 0],
      ["reserve", 2, 1, RESERVE],
      ["textback", 3, 0, TEXT],
      ["follow", 3, 1, FOLLOW],
      ["movein", 4, 0, MOVE],
      ["report", 4, 1],
    ],
    edges: [
      [0, 0, 2, 0],
      [2, 0, 3, 0],
      [3, 1, 4, 0],
      [3, 0, 5, 0],
      [5, 0, 6, 0],
      [1, 0, 6, 0],
      [6, 0, 7, 0],
      [4, 0, 7, 1],
      [7, 0, 8, 0],
    ],
  };
}

/** Reply fast, then keep going until they reserve or move in. */
function followUp(keys: string[]): Built {
  return {
    name: "Answer the people who asked",
    steps: [
      ["units", 0, 0, units(keys)],
      ["audience", 1, 0, audience("past")],
      ["write", 1, 1, WRITE],
      ["meta", 2, 0, META],
      ["page", 3, 0],
      ["textback", 4, 0, TEXT],
      ["follow", 4, 1, FOLLOW],
      ["reserve", 3, 1, RESERVE],
      ["movein", 5, 0, MOVE],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 0, 5, 0],
      [5, 0, 6, 0],
      [6, 0, 8, 0],
      [4, 1, 7, 0],
      [7, 0, 8, 1],
      [8, 0, 9, 0],
    ],
  };
}

/** A stay offer aimed at people who already rented, not at strangers. */
function stay(keys: string[], offerKey: string | null): Built {
  const withOffer = offerKey != null;
  const steps: Step[] = withOffer
    ? [
        ["units", 0, 0, units(keys)],
        ["offer", 0, 1, { offer: offerKey }],
        ["audience", 1, 0, audience("past")],
        ["write", 1, 1, { angle: "urgency" }],
        ["meta", 2, 0, META],
        ["page", 3, 0],
        ["follow", 4, 0, FOLLOW],
        ["movein", 4, 1, MOVE],
        ["report", 5, 1],
      ]
    : [
        ["units", 0, 0, units(keys)],
        ["audience", 1, 0, audience("past")],
        ["write", 1, 1, { angle: "urgency" }],
        ["meta", 2, 0, META],
        ["page", 3, 0],
        ["follow", 4, 0, FOLLOW],
        ["movein", 4, 1, MOVE],
        ["report", 5, 1],
      ];
  const edges: [number, number, number, number][] = withOffer
    ? [
        [0, 0, 1, 0],
        [1, 0, 2, 0],
        [2, 0, 3, 0],
        [1, 0, 3, 1],
        [3, 0, 4, 0],
        [4, 0, 5, 0],
        [5, 0, 6, 0],
        [6, 0, 7, 0],
        [7, 0, 8, 0],
      ]
    : [
        [0, 0, 1, 0],
        [1, 0, 2, 0],
        [0, 0, 2, 1],
        [2, 0, 3, 0],
        [3, 0, 4, 0],
        [4, 0, 5, 0],
        [5, 0, 6, 0],
        [6, 0, 7, 0],
      ];
  return { name: "A reason to stay", steps, edges };
}

/** Ask for the review once they have moved in. */
function reviews(keys: string[]): Built {
  return {
    name: "Ask for a review after move-in",
    steps: [
      ["units", 0, 0, units(keys)],
      ["audience", 1, 0, audience("movers")],
      ["write", 1, 1, { angle: "social_proof" }],
      ["meta", 2, 0, META],
      ["page", 3, 0],
      ["reserve", 3, 1, RESERVE],
      ["movein", 4, 0, MOVE],
      ["review", 4, 1],
      ["report", 5, 0],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 1, 5, 0],
      [4, 0, 6, 0],
      [5, 0, 6, 1],
      [6, 0, 7, 0],
      [6, 0, 8, 0],
    ],
  };
}

/** The page lets them reserve. The follow-up finishes it. */
function rentOnline(keys: string[]): Built {
  return {
    name: "Let them reserve online",
    steps: [
      ["units", 0, 0, units(keys)],
      ["audience", 1, 0, audience("movers")],
      ["write", 1, 1, WRITE],
      ["meta", 2, 0, META],
      ["page", 3, 0],
      ["reserve", 3, 1, RESERVE],
      ["follow", 4, 0, FOLLOW],
      ["movein", 5, 0, MOVE],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [3, 0, 4, 0],
      [4, 1, 5, 0],
      [4, 0, 6, 0],
      [6, 0, 7, 0],
      [5, 0, 7, 1],
      [7, 0, 8, 0],
    ],
  };
}

/** Search plus a wider radius, for a facility people aren't finding. */
function reach(keys: string[]): Built {
  return {
    name: "Reach people who aren't calling",
    steps: [
      ["units", 0, 0, units(keys)],
      ["audience", 1, 0, audience("movers", "10")],
      ["write", 1, 1, WRITE],
      ["google", 2, 0, GOOGLE],
      ["meta", 2, 1, META],
      ["page", 3, 0],
      ["reserve", 3, 1, RESERVE],
      ["follow", 4, 0, FOLLOW],
      ["movein", 4, 1, MOVE],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [1, 0, 2, 0],
      [0, 0, 2, 1],
      [2, 0, 3, 0],
      [2, 0, 4, 0],
      [3, 0, 5, 0],
      [4, 0, 5, 0],
      [5, 1, 6, 0],
      [5, 0, 7, 0],
      [7, 0, 8, 0],
      [6, 0, 8, 1],
      [8, 0, 9, 0],
    ],
  };
}

/** State the rate you mean. No discount is invented. */
function rates(keys: string[]): Built {
  return {
    name: "Show the rate you mean",
    steps: [
      ["units", 0, 0, units(keys)],
      ["gbp", 1, 1],
      ["audience", 1, 0, audience("movers")],
      ["write", 2, 0, WRITE],
      ["meta", 3, 0, META],
      ["page", 4, 0],
      ["reserve", 4, 1, RESERVE],
      ["movein", 5, 0, MOVE],
      ["report", 5, 1],
    ],
    edges: [
      [0, 0, 1, 0],
      [0, 0, 2, 0],
      [2, 0, 3, 0],
      [0, 0, 3, 1],
      [3, 0, 4, 0],
      [1, 0, 5, 0],
      [4, 0, 5, 0],
      [5, 1, 6, 0],
      [5, 0, 7, 0],
      [6, 0, 7, 1],
      [7, 0, 8, 0],
    ],
  };
}

export interface GraphInput {
  template: SuggestionTemplate;
  sizeKeys: string[];
  offerKey: string | null;
  goal: FunnelGoal | null;
  /** Lease-up reuses the builder's lease template, which wants the facility context. */
  ctx?: FunnelContext;
}

export function buildSuggestedGraph(input: GraphInput): FunnelGraph {
  const goal = input.goal;
  const keys = input.sizeKeys;
  if (input.template === "lease-up") {
    const graph = buildTemplate("lease", { ...input.ctx, goal: goal ?? input.ctx?.goal });
    return {
      ...graph,
      name: "Lease-up launch",
      status: "draft",
      goal: goal ?? input.ctx?.goal ?? null,
      nodes: graph.nodes.map((node) =>
        node.type === "meta" || node.type === "google" ? { ...node, params: { ...node.params, budget: "" } } : node,
      ),
    };
  }
  const spec =
    input.template === "vacant-size"
      ? vacantSize(keys)
      : input.template === "recovery"
        ? recovery(keys)
        : input.template === "follow-up"
          ? followUp(keys)
          : input.template === "stay"
            ? stay(keys, input.offerKey)
            : input.template === "reviews"
              ? reviews(keys)
              : input.template === "rent-online"
                ? rentOnline(keys)
                : input.template === "reach"
                  ? reach(keys)
                  : rates(keys);
  return assemble(spec.name, goal, spec);
}
