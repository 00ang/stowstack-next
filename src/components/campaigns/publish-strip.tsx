"use client";

import { defOf, type FunnelGraph } from "@/lib/funnel-graph";
import type { PublishState } from "@/lib/campaign-publish/types";
import { attention, publishMark } from "./use-publish";

/**
 * The publish, under the canvas: progress while it runs, then what's live and
 * what still needs the owner. One line; the canvas blocks carry the detail.
 */
export function PublishStrip({
  graph,
  state,
  stale,
  starting,
  onShow,
  onRetry,
}: {
  graph: FunnelGraph;
  state: PublishState;
  stale: boolean;
  starting: boolean;
  /** Select a function to read its result in the inspector. */
  onShow: (nodeId: string) => void;
  /** Run again. Everything not yet live runs; `retry` adds unknown ones the owner has checked. */
  onRetry: (retry: string[]) => void;
}) {
  const results = state.order.map((id) => state.nodes[id]).filter(Boolean);
  const settled = results.filter((r) => r.state === "done" || r.state === "paused" || r.state === "waiting").length;
  const total = state.order.length;
  const running = state.status === "running" && !stale;
  const current = state.current ? graph.nodes.find((n) => n.id === state.current) : null;
  const asks = attention(state);
  // Unknown outcomes are retried from their own block, after the owner has looked.
  const failed = state.order.filter((id) => {
    const s = state.nodes[id]?.state;
    return s === "failed" || s === "skipped";
  });
  const mark = publishMark(running ? "running" : asks.length ? "needs" : "done");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-[13px] font-semibold sm:px-4"
    >
      <span className="flex min-w-0 items-center gap-2">
        <i
          aria-hidden
          className={`inline-block h-[10px] w-[10px] shrink-0 border-[1.5px] ${mark.pulse ? "animate-pulse" : ""}`}
          style={{ borderColor: mark.edge, background: mark.fill ?? "transparent" }}
        />
        {running ? (
          <span className="min-w-0">
            <b className="font-extrabold">Publishing · {settled} of {total}.</b>{" "}
            {current ? `${defOf(current.type).title}: ${state.nodes[current.id]?.line ?? "working…"}` : "Starting…"}
          </span>
        ) : (
          <span className="min-w-0">
            <b className="font-extrabold">
              {stale && state.status === "running" ? "Publishing stopped" : "Published"} · {settled} of {total} live.
            </b>{" "}
            {asks.length ? `${asks.length === 1 ? "One needs" : `${asks.length} need`} you.` : "Nothing waits on you."}
          </span>
        )}
      </span>
      {!running && asks.length > 0 && (
        <button
          type="button"
          data-fill="2"
          onClick={() => onShow(asks[0].id)}
          className="act-fill inline-flex h-8 items-center px-2.5 text-[12.5px] font-extrabold"
        >
          {defOf(graph.nodes.find((n) => n.id === asks[0].id)?.type ?? "units").title}
        </button>
      )}
      {!running && (failed.length > 0 || stale) && (
        <button
          type="button"
          data-fill="4"
          disabled={starting}
          onClick={() => onRetry([])}
          className="act-fill inline-flex h-8 items-center px-2.5 text-[12.5px] font-extrabold"
        >
          {starting ? "Starting…" : "Try again"}
        </button>
      )}
    </div>
  );
}
