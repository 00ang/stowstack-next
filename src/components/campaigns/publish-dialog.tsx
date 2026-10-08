"use client";

import { defOf, pathToMoveIn, readiness, type FunnelGraph } from "@/lib/funnel-graph";
import { publishOrder } from "@/lib/campaign-publish/order";
import type { PublishState } from "@/lib/campaign-publish/types";
import type { PreflightRow } from "./use-publish";

const CHIP: Record<PreflightRow["state"], string> = {
  ready: "Ready",
  needs: "Needs you",
  waiting: "Waits on us",
};

/**
 * Before a publish: every function in the order it goes live, what it will
 * do, and what it still needs. Anything that needs the owner can be fixed
 * first, or after — a later publish picks it up and leaves the live parts be.
 */
export function PublishDialog({
  graph,
  preflight,
  previous,
  starting,
  error,
  sample,
  fixHref,
  onClose,
  onPublish,
}: {
  graph: FunnelGraph;
  preflight: Record<string, PreflightRow>;
  previous: PublishState | null;
  starting: boolean;
  error: string | null;
  sample: boolean;
  /** A link into the tool that fixes a function, or null where there is none (the canvas itself). */
  fixHref: (tool: string) => string | null;
  onClose: () => void;
  onPublish: () => void;
}) {
  const blocking = graph.nodes.filter((n) => readiness(graph, n).state === "needs");
  const closed = pathToMoveIn(graph);
  const order = publishOrder(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const live = (id: string) => {
    const s = previous?.nodes[id]?.state;
    return s === "done" || s === "paused";
  };
  const needsYou = order.filter((id) => preflight[id]?.state === "needs" && !live(id));
  const again = !!previous && order.some(live);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ic-ink)]/45 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Publish">
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-5">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">{again ? "Publish again" : "Publish"}</div>
        <h2 className="mt-1 text-[20px] font-extrabold leading-tight">{graph.name}</h2>
        <div className="mt-1 text-[14px] font-semibold text-[var(--ic-ink)]">
          {sample
            ? "This is the sample: it walks through a publish, and nothing leaves this tab."
            : again
              ? "What's live stays as it is. Everything else goes live in turn."
              : "Each function goes live in turn. Ads are made paused, so nothing spends until you switch them on."}
        </div>

        {blocking.length > 0 && (
          <div className="mt-3 border-l-4 border-[#6B2340] pl-3">
            <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Finish these first · {blocking.length}</div>
            <ul>
              {blocking.map((n) => (
                <li key={n.id} className="py-1 text-[13.5px] font-semibold">
                  <b className="font-extrabold">{defOf(n.type).title}</b> needs {readiness(graph, n).need}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!closed && (
          <div className="mt-3 text-[13.5px] font-semibold">
            <b className="font-extrabold">Nothing reaches a move-in yet.</b> It can still publish; it just can&apos;t be judged on move-ins.
          </div>
        )}

        <ol className="mt-3 border-t border-[var(--ic-ink)]">
          {order.map((id) => {
            const node = byId.get(id);
            if (!node) return null;
            const def = defOf(node.type);
            const pre = preflight[id] ?? { state: "ready" as const };
            const isLive = live(id);
            const href = pre.fix ? fixHref(pre.fix.tool) : null;
            return (
              <li key={id} className="flex gap-3 border-b border-[var(--ic-dither)]/40 py-2.5">
                <span
                  className={`ic-label mt-0.5 inline-flex h-fit min-w-[84px] justify-center border px-1 py-0.5 text-[9.5px] ${
                    isLive ? "border-[#2F6B3F]" : pre.state === "needs" ? "border-[#6B2340] border-2" : "border-[var(--ic-ink)]"
                  }`}
                >
                  {isLive ? "Live" : CHIP[pre.state]}
                </span>
                <div className="min-w-0 text-[13.5px] leading-snug">
                  <b className="font-extrabold">{def.title}.</b>{" "}
                  <span className="font-semibold">
                    {isLive ? previous?.nodes[id]?.line : pre.state === "ready" ? def.publish(node) : pre.line}
                  </span>
                  {!isLive && pre.state === "needs" && pre.fix && href && (
                    <a href={href} className="ml-1 font-extrabold underline underline-offset-4">
                      {pre.fix.label}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {needsYou.length > 0 && (
          <div className="mt-3 text-[13px] font-semibold text-[var(--ic-ink)]">
            {needsYou.length === 1 ? "One function waits" : `${needsYou.length} functions wait`} for you. Publish now and they
            go live on the next publish, once they have what they need.
          </div>
        )}
        {error && (
          <div role="alert" className="mt-3 border-l-4 border-[#6B2340] pl-3 text-[13.5px] font-extrabold">
            {error}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-fill="1"
            disabled={blocking.length > 0 || starting}
            onClick={onPublish}
            className="act-fill px-4 py-2.5 text-[15px] font-extrabold"
          >
            {starting ? "Starting…" : again ? "Publish again" : "Publish"}
          </button>
          <button type="button" onClick={onClose} className="text-[14px] font-extrabold underline underline-offset-4">
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
