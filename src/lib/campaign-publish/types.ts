/**
 * Publishing a campaign: what happened to each function on the canvas.
 *
 * A publish run walks the graph one function at a time on the job queue
 * (`campaign.publish`) and writes each function's result into
 * `funnels.config.publish.nodes[nodeId]` the moment it is known, so the canvas
 * can show progress live and a retry can pick up exactly where it stopped.
 */

export type NodeState =
  /** It is on: the page is live, follow-ups are armed, the setting is saved. */
  | "done"
  /** Made on the ad platform, paused. Nothing spends until the owner switches it on there. */
  | "paused"
  /** Waiting on the owner: connect an account, add an address. Checked again on every run. */
  | "needs"
  /** Waiting on StorageAds: a texting number, a tracking number. */
  | "waiting"
  /** It ran and failed for a reason we know. Safe to retry. */
  | "failed"
  /** The platform never answered part-way through. It may exist there; look before retrying. */
  | "unknown"
  /** Not run, because something it depends on did not finish. */
  | "skipped"
  /** Running now. */
  | "running";

export interface NodeResult {
  state: NodeState;
  /** One plain sentence: what is now true, or what is needed. */
  line: string;
  /** Where to see it or fix it. */
  href?: string;
  hrefLabel?: string;
  /** `href` leaves StorageAds (Ads Manager, Google Ads). */
  external?: boolean;
  /**
   * The StorageAds tool that fixes or shows this, by its owner-tools key.
   * "canvas" means the function's own settings on the canvas.
   */
  fix?: { tool: string; label: string };
  /** Ids this function made, so a rerun finds them instead of making them again. */
  ref?: Record<string, string>;
  /** The raw error, for the operator; `line` is what the owner reads. */
  error?: string;
  at: string;
}

/** What a function says while it is being published. */
export const RUNNING_LINE: Record<string, string> = {
  write: "Writing the ad…",
  proven: "Recreating the ad…",
  page: "Writing the page and putting it live…",
  meta: "Making it in Ads Manager, paused…",
  google: "Writing the search ad and making it in Google Ads, paused…",
  gbp: "Scheduling the post…",
  follow: "Arming the follow-up…",
  textback: "Arming the text-back…",
};

export type RunStatus = "running" | "finished";

export interface PublishState {
  runId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  /** The functions in the order they run. */
  order: string[];
  nodes: Record<string, NodeResult>;
  /** The function being worked on now. */
  current?: string | null;
}

/** States that never run again on their own. */
export const SETTLED: ReadonlySet<NodeState> = new Set(["done", "paused"]);

/** A run counts as having published when nothing failed outright. */
export function runSummary(state: PublishState | null): {
  done: number;
  total: number;
  attention: number;
  failed: number;
} {
  if (!state) return { done: 0, total: 0, attention: 0, failed: 0 };
  const results = state.order.map((id) => state.nodes[id]).filter(Boolean);
  return {
    done: results.filter((r) => SETTLED.has(r.state) || r.state === "waiting").length,
    total: state.order.length,
    attention: results.filter((r) => r.state === "needs" || r.state === "unknown").length,
    failed: results.filter((r) => r.state === "failed" || r.state === "skipped").length,
  };
}
