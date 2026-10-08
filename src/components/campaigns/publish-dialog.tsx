"use client";

import { defOf, pathToMoveIn, readiness, toPublishPlan, type FunnelGraph } from "@/lib/funnel-graph";

/** Dry run: one line per function. Nothing is sent. Ad channels say they are created paused. */
export function PublishDialog({
  graph,
  onClose,
  onConfirm,
}: {
  graph: FunnelGraph;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const plan = toPublishPlan(graph);
  const blocking = graph.nodes.filter((n) => readiness(graph, n).state === "needs");
  const closed = pathToMoveIn(graph);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ic-ink)]/45 p-4" role="dialog" aria-modal="true" aria-label="Publish dry run">
      <div className="max-h-[86vh] w-full max-w-xl overflow-y-auto border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-5">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Publish · dry run</div>
        <h2 className="mt-1 text-[20px] font-extrabold">{graph.name}</h2>
        <p className="text-[13px] font-semibold text-[var(--ic-secondary)]">
          This is what would happen, function by function. Nothing below is sent.
        </p>
        {blocking.length > 0 && (
          <div className="mt-3">
            <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Blocking · {blocking.length}</div>
            <ul>
              {blocking.map((n) => (
                <li key={n.id} className="border-b border-[var(--ic-dither)]/40 py-1.5 text-[13px] font-semibold">
                  <b className="font-extrabold">{defOf(n.type).title}</b> needs {readiness(graph, n).need}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!closed && (
          <p className="mt-3 text-[13px] font-semibold">
            <b className="font-extrabold">The path to a move-in is open.</b> Nothing connects a channel to a move-in, so this campaign cannot be judged on move-ins.
          </p>
        )}
        <ul className="mt-3 border-t border-[var(--ic-ink)]">
          {plan.map((step) => (
            <li key={step.nodeId} className="flex gap-2 border-b border-[var(--ic-dither)]/40 py-2 text-[13.5px]">
              <span className="mt-0.5 inline-block h-fit min-w-[68px] border border-[var(--ic-ink)] px-1 text-center font-mono text-[10px] tracking-wider">
                {step.backend === "exists" ? "EXISTS" : "PARTIAL"}
              </span>
              <span>
                <b className="font-extrabold">{step.title}.</b> {step.summary}
                {step.paused ? " The campaign is created paused." : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] font-semibold text-[var(--ic-secondary)]">
          Ad campaigns are created paused. Nothing here marks a channel live.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={blocking.length > 0}
            onClick={onConfirm}
            className="bg-[var(--ic-ink)] px-4 py-2 text-[14px] font-extrabold text-[var(--ic-pane)] disabled:opacity-45"
          >
            Publish (nothing is sent)
          </button>
          <button type="button" onClick={onClose} className="font-extrabold underline underline-offset-4">
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
}
