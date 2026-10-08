"use client";

import { defOf, LANE_LABEL, nodeReading, pathToMoveIn, PORTS, readiness, readyCount, topo, type FunnelContext, type FunnelGraph } from "@/lib/funnel-graph";
import { NodeIcon } from "./icons";

/**
 * The campaign as a vertical list. Same nodes as the canvas, no horizontal
 * scroll, so a phone can read the funnel and take the next move.
 */
export function ReadOnlyFlow({
  graph,
  ctx,
  selectedId,
  onSelect,
  showBack,
  onBackToCanvas,
}: {
  graph: FunnelGraph;
  ctx: FunnelContext;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showBack?: boolean;
  onBackToCanvas?: () => void;
}) {
  const order = topo(graph);
  const counts = readyCount(graph);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="mx-auto w-full max-w-[560px] overflow-x-hidden px-3 py-3 sm:px-4">
      <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Campaign · read-only</div>
      <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--ic-ink)]">{graph.name ?? "Campaign"}</h2>
      <div className="ic-label mt-1 text-[10.5px] text-[var(--ic-secondary)]">
        {counts.ready} of {counts.total} ready · path to move-in {pathToMoveIn(graph) ? "closed" : "open"}
      </div>
      {showBack && onBackToCanvas && (
        <button type="button" onClick={onBackToCanvas} className="mt-3 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-[13px] font-extrabold">
          Back to the canvas
        </button>
      )}
      <p className="mt-3 border border-dashed border-[var(--ic-instruction)] bg-[var(--ic-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ic-secondary)]">
        Read-only on a phone. The next move below still works here; drag-and-connect editing needs a larger screen.
      </p>
      <div className="mt-3">
        {order.map((n, idx) => {
          const def = defOf(n.type);
          const state = readiness(graph, n);
          const outs = graph.edges.filter((e) => e.from === n.id);
          const next = order[idx + 1];
          const main = outs.find((e) => next && e.to === next.id);
          const others = outs.filter((e) => e !== main);
          return (
            <div key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className={`flex w-full min-w-0 gap-3 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-3 text-left ${
                  selectedId === n.id ? "outline outline-2 outline-offset-1 outline-[var(--ic-selected)]" : ""
                }`}
              >
                <NodeIcon name={def.icon} className="mt-0.5 h-6 w-6 shrink-0" color={def.hue} />
                <span className="min-w-0">
                  <span className="ic-label block text-[9.5px] text-[var(--ic-instruction)]">{LANE_LABEL[def.lane]}</span>
                  <span className="block text-[15px] font-extrabold leading-tight text-[var(--ic-ink)]">{def.title}</span>
                  <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--ic-secondary)]">
                    {nodeReading(n, ctx)}
                    {ctx.sample && <span className="ic-label ml-1 border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}
                  </span>
                  {others.length > 0 && (
                    <span className="mt-1 block text-[12px] font-semibold text-[var(--ic-secondary)]">
                      also sends{" "}
                      {others
                        .map((e) => {
                          const target = byId.get(e.to);
                          return target ? `${defOf(target.type).title}` : "";
                        })
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  <span className={`mt-1.5 flex items-center gap-1.5 text-[12.5px] font-extrabold ${state.state === "ready" ? "" : ""}`}>
                    <i
                      aria-hidden
                      className={`inline-block h-[9px] w-[9px] border-[1.5px] border-[var(--ic-ink)] ${
                        state.state === "ready" ? "border-[var(--color-green)] bg-[var(--color-green)]" : ""
                      }`}
                    />
                    {state.state === "ready" ? "Ready" : `Needs ${state.need}`}
                  </span>
                </span>
              </button>
              {main ? (
                <div className="ic-label ml-5 border-l-2 border-[var(--ic-ink)] py-1 pl-3 text-[10px] text-[var(--ic-secondary)]">
                  {PORTS[defOf(n.type).outputs[main.fromPort]].label}
                </div>
              ) : idx < order.length - 1 ? (
                <div className="h-2" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
