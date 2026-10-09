import { list, param, type FunnelGraph, type FunnelNode, type NodeType } from "@/lib/funnel-graph";
import { readGraph } from "@/lib/funnel-graph/schema";
import { publishOrder } from "@/lib/campaign-publish/order";
import { followUpDays } from "@/lib/campaign-publish/follow-up";
import { RUNNING_LINE, type NodeResult, type PublishState } from "@/lib/campaign-publish/types";
import { readDemoFunnels } from "./demo-funnels";

/**
 * Publishing in the sample portal. The same answers /api/funnels/publish
 * gives, played out over a few seconds in this tab: each function goes live in
 * turn, the Meta ad is made paused, and Google Ads waits on a connection the
 * sample can't make — so every state a real publish can end in is visible.
 * Nothing leaves the tab.
 */

const STORE = "sa-demo-publish";
/** How long each function takes in the sample, so the canvas visibly fills in. */
const STEP_MS = 650;

type Answer = { status: number; body: unknown };

interface DemoRun {
  runId: string;
  startedAt: number;
  order: string[];
  /** Results that were final before this run (kept as they were). */
  kept: Record<string, NodeResult>;
}

function readRuns(): Record<string, DemoRun> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Record<string, DemoRun>;
  } catch {
    return {};
  }
}

function writeRuns(runs: Record<string, DemoRun>) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(runs));
  } catch {
    /* the answer still plays out for this read */
  }
}

const PROVEN_LINE: Record<string, string> = {
  "drive-right-up": "Drive right up to your door.",
  "whole-garage": "Room for the whole garage.",
  "reserve-2-min": "Moving this month? Reserve in 2 minutes.",
};

function radius(graph: FunnelGraph): string {
  const a = graph.nodes.find((n) => n.type === "audience");
  return (a && param(a, "radius")) || "5";
}

/** What each function says once the sample has "published" it. */
function sampleResult(node: FunnelNode, graph: FunnelGraph, at: string): NodeResult {
  const done = (line: string): NodeResult => ({ state: "done", line, at });
  const type: NodeType = node.type;
  switch (type) {
    case "units":
      return done(`Reads ${list(node.params.sizes).length || 1} sizes from your unit data. Nothing is written.`);
    case "offer":
      return done("Names the running special in the ad and the page. Never invents one.");
    case "audience":
      return done(`Within ${param(node, "radius") || "5"} miles of 1400 Maple Ave, Springfield, IL.`);
    case "write":
      return done("Wrote “Moving this month? We'll have a unit ready.”");
    case "proven":
      return done(`Recreated “${PROVEN_LINE[param(node, "src")] ?? "your best ad"}” for this campaign.`);
    case "page":
      return done(`Live at storageads.com/lp/${node.slug ?? "your-page"}.`);
    case "reserve":
      return done("People can reserve on the page through storEDGE. Reservations come back to you by webhook.");
    case "tour":
      return done("People can book a tour right after they ask. It's confirmed by text, with reminders.");
    case "waitlist":
      return { state: "waiting", line: "The waitlist form isn't on landing pages yet.", at };
    case "textback":
      return done("Every form gets a text within a minute, and the office cell gets the lead to call.");
    case "follow": {
      const n = param(node, "steps") === "5" ? "5" : "3";
      return done(`New leads get ${n} follow-ups over ${followUpDays(n)} days, and they stop when someone reserves.`);
    }
    case "missed":
      return { state: "waiting", line: "Needs a call-tracking number. StorageAds sets these up for you.", at };
    case "meta":
      return {
        state: "paused",
        line: `Made in Ads Manager, paused at $${param(node, "budget") || "10"}/day within ${radius(graph)} miles. Nothing spends until you switch it on.`,
        at,
      };
    case "google":
      return {
        state: "needs",
        line: "Connect Google Ads to make this ad. It's made paused; nothing spends until you switch it on.",
        fix: { tool: "ad-publisher", label: "Connect in Publish Ads" },
        at,
      };
    case "gbp":
      return done("Posts to your Google profile within the hour, linking to the page.");
    case "movein":
      return done("Counts a lead as moved in when they match a new tenant in your rent-roll upload.");
    case "capi":
      return done("Each move-in goes back to Meta, so it looks for renters, not form fills.");
    case "review":
      return done("Asks each new tenant for a Google review a week after they move in.");
    case "report":
      return done("This campaign is judged on cost per move-in, by channel and by move-in date.");
  }
}

function graphFor(id: string): FunnelGraph | null {
  const row = readDemoFunnels().find((r) => r.id === id);
  return row ? readGraph(row.config) : null;
}

function stateOf(run: DemoRun, graph: FunnelGraph, now: number): PublishState {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodes: Record<string, NodeResult> = { ...run.kept };
  const todo = run.order.filter((id) => !run.kept[id] || !["done", "paused"].includes(run.kept[id].state));
  const reached = Math.floor((now - run.startedAt) / STEP_MS);
  todo.forEach((id, i) => {
    const node = byId.get(id);
    if (!node) return;
    const at = new Date(run.startedAt + (i + 1) * STEP_MS).toISOString();
    if (i < reached) nodes[id] = sampleResult(node, graph, at);
    else if (i === reached) nodes[id] = { state: "running", line: RUNNING_LINE[node.type] ?? "Working…", at: new Date(now).toISOString() };
  });
  const finished = reached >= todo.length;
  return {
    runId: run.runId,
    status: finished ? "finished" : "running",
    startedAt: new Date(run.startedAt).toISOString(),
    finishedAt: finished ? new Date(run.startedAt + todo.length * STEP_MS).toISOString() : undefined,
    order: run.order,
    nodes,
    current: finished ? null : todo[reached] ?? null,
  };
}

function summary(state: PublishState | null) {
  if (!state) return { done: 0, total: 0, attention: 0, failed: 0 };
  const rs = state.order.map((id) => state.nodes[id]).filter(Boolean);
  return {
    done: rs.filter((r) => r.state === "done" || r.state === "paused" || r.state === "waiting").length,
    total: state.order.length,
    attention: rs.filter((r) => r.state === "needs" || r.state === "unknown").length,
    failed: rs.filter((r) => r.state === "failed" || r.state === "skipped").length,
  };
}

export function demoPublishAnswer(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const runs = readRuns();
  if (method === "GET") {
    const id = url.searchParams.get("id") ?? "";
    const graph = graphFor(id);
    const run = runs[id];
    const state = graph && run ? stateOf(run, graph, now.getTime()) : null;
    const preflight = Object.fromEntries(
      (graph?.nodes ?? []).map((n) => [
        n.id,
        n.type === "google"
          ? { state: "needs", line: "Connect Google Ads first. The ad is made paused.", fix: { tool: "ad-publisher", label: "Connect in Publish Ads" } }
          : n.type === "missed" || n.type === "waitlist"
            ? { state: "waiting", line: sampleResult(n, graph!, "").line }
            : { state: "ready" },
      ]),
    );
    return { status: 200, body: { state, stale: false, summary: summary(state), preflight, campaignStatus: "draft" } };
  }

  let body: { id?: string } = {};
  try {
    body = raw ? (JSON.parse(raw) as { id?: string }) : {};
  } catch {
    return { status: 400, body: { error: "Invalid JSON body" } };
  }
  const id = body.id ?? "";
  const graph = graphFor(id);
  if (!graph || !graph.nodes.length) return { status: 400, body: { error: "This campaign has nothing on its canvas yet" } };
  const prior = runs[id] ? stateOf(runs[id], graph, now.getTime()) : null;
  if (prior?.status === "running") return { status: 202, body: { runId: prior.runId, joined: true } };
  const run: DemoRun = {
    runId: `demo-run-${now.getTime()}`,
    startedAt: now.getTime(),
    order: publishOrder(graph),
    kept: prior?.nodes ?? {},
  };
  writeRuns({ ...runs, [id]: run });
  return { status: 202, body: { runId: run.runId, joined: false } };
}
