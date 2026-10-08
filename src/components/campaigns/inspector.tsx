"use client";

import { useEffect, useRef } from "react";
import {
  CATALOG,
  PORTS,
  canConnect,
  defOf,
  inEdges,
  nodeAddress,
  nodeReading,
  optionList,
  readiness,
  type FunnelContext,
  type FunnelGraph,
  type NodeParams,
} from "@/lib/funnel-graph";
import Link from "next/link";
import { goalMonths } from "./context";
import { NodeIcon } from "./icons";

/** Where a function's own tool opens, with the object it works on in focus. Absent where there is no tool. */
export type ToolLinkFor = (nodeId: string) => { href: string; label: string } | null;

export function FunnelInspector({
  graph,
  ctx,
  selectedId,
  focus,
  onChange,
  onGoal,
  onConnect,
  onRemove,
  onSelectNode,
  toolLink,
  technical = false,
}: {
  graph: FunnelGraph;
  ctx: FunnelContext;
  selectedId: string | null;
  focus: boolean;
  onChange: (id: string, params: NodeParams) => void;
  onGoal: (moveIns: number, month: string) => void;
  onConnect: (fromId: string, fromPort: number, toId: string, toPort: number) => void;
  onRemove: () => void;
  /** Select a function from the campaign summary (its missing field is focused). */
  onSelectNode?: (id: string) => void;
  toolLink?: ToolLinkFor;
  /** Show the route each function publishes through (the admin view). */
  technical?: boolean;
}) {
  const node = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focus || !node) return;
    const field = rootRef.current?.querySelector<HTMLElement>("[data-needed='true']");
    field?.focus();
  }, [focus, node]);

  if (!node) {
    const needs = graph.nodes.filter((n) => readiness(graph, n).state === "needs");
    const months = goalMonths();
    return (
      <aside ref={rootRef} aria-label="Inspector" className="w-[300px] shrink-0 overflow-y-auto border-l border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Campaign</div>
        <h3 className="mt-1 text-[16px] font-extrabold text-[var(--ic-ink)]">{graph.name ?? "No campaign yet"}</h3>
        <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Goal</div>
        <div className="mt-1 flex gap-2">
          <label className="block flex-1 text-[13px] font-extrabold">
            Move-ins
            <input
              type="number"
              min={1}
              value={graph.goal?.moveIns ?? 12}
              onChange={(e) => onGoal(Math.max(1, Number(e.target.value) || 1), graph.goal?.month ?? months[0])}
              className="mt-1 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1 font-semibold"
            />
          </label>
          <label className="block flex-1 text-[13px] font-extrabold">
            Month
            <select
              value={graph.goal?.month ?? months[0]}
              onChange={(e) => onGoal(graph.goal?.moveIns ?? 12, e.target.value)}
              className="mt-1 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1 font-semibold"
            >
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-[13px] font-semibold text-[var(--ic-secondary)]">
          {ctx.movedIn30 ?? 0} move-ins in the last 30 days
          {ctx.sample && <span className="ic-label ml-1 border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}. Counted by
          move-in date.
        </p>
        <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Still needs you · {needs.length}</div>
        {needs.length === 0 ? (
          <p className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">Nothing. Every function is ready.</p>
        ) : (
          <ul>
            {needs.map((n) => (
              <li key={n.id} className="border-b border-[var(--ic-dither)]/40">
                {onSelectNode ? (
                  <button
                    type="button"
                    onClick={() => onSelectNode(n.id)}
                    className="w-full py-1.5 text-left text-[13px] font-semibold hover:underline hover:underline-offset-4"
                  >
                    <b className="font-extrabold">{defOf(n.type).title}</b> needs {readiness(graph, n).need}
                  </button>
                ) : (
                  <span className="block py-1.5 text-[13px] font-semibold">
                    <b className="font-extrabold">{defOf(n.type).title}</b> needs {readiness(graph, n).need}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    );
  }

  const def = defOf(node.type);
  const state = readiness(graph, node);
  const missing = def.params.find((p) => state.need === p.label.replace(" ($)", "").toLowerCase());

  return (
    <aside ref={rootRef} aria-label="Inspector" className="w-[300px] shrink-0 overflow-y-auto border-l border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
      <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Selected · function</div>
      <div className="mt-1 flex items-center gap-2">
        <NodeIcon name={def.icon} className="h-8 w-8" color={def.hue} />
        <h3 className="text-[16px] font-extrabold text-[var(--ic-ink)]">{def.title}</h3>
      </div>
      <div className="mt-1 break-all font-mono text-[11px] text-[var(--ic-secondary)]">{nodeAddress(node)}</div>
      <div className={`mt-3 flex items-center gap-1.5 border border-[var(--ic-ink)] px-2 py-1.5 text-[13px] font-extrabold ${state.state === "needs" ? "bg-[var(--ic-soft)]" : ""}`}>
        <i aria-hidden className={`inline-block h-[9px] w-[9px] border-[1.5px] ${state.state === "ready" ? "border-[var(--color-green)] bg-[var(--color-green)]" : "border-[var(--ic-ink)]"}`} />
        {state.state === "ready" ? "Ready" : `Needs · ${state.need}`}
      </div>
      <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Reading</div>
      <div className="text-[13px] font-semibold">
        {nodeReading(node, ctx)}
        {ctx.sample && <span className="ic-label ml-1 border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}
      </div>
      {def.inputs.length > 0 && (
        <>
          <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Takes</div>
          {def.inputs.map((input, i) => {
            const incoming = inEdges(graph, node.id, i);
            const candidate = graph.nodes.find((other) => {
              if (other.id === node.id || incoming.length) return false;
              const fi = defOf(other.type).outputs.indexOf(input.port);
              return fi >= 0 && canConnect(graph, other.id, fi, node.id, i).ok;
            });
            const fi = candidate ? defOf(candidate.type).outputs.indexOf(input.port) : -1;
            return (
              <div key={i} className="flex items-center justify-between gap-2 border-b border-[var(--ic-dither)]/40 py-1.5 text-[13px]">
                <span>
                  <i aria-hidden className="mr-1 inline-block h-[9px] w-[9px] border border-[var(--ic-ink)]" style={{ background: PORTS[input.port].hue }} />
                  {PORTS[input.port].label}
                  {!input.required && !def.anyInput ? " (optional)" : ""}
                </span>
                {incoming.length ? (
                  <span>from {incoming.map((e) => defOf(graph.nodes.find((n) => n.id === e.from)?.type ?? "units").title).join(", ")}</span>
                ) : candidate && fi >= 0 ? (
                  <button type="button" className="font-extrabold underline underline-offset-4" onClick={() => onConnect(candidate.id, fi, node.id, i)}>
                    Connect {CATALOG[candidate.type].title}
                  </button>
                ) : (
                  <span className="text-[var(--ic-instruction)]">not connected</span>
                )}
              </div>
            );
          })}
        </>
      )}
      {def.params.length > 0 && (
        <>
          <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Inputs</div>
          {def.params.map((p) => {
            const needed = missing?.key === p.key;
            const value = node.params[p.key];
            if (p.kind === "multi") {
              const selected = Array.isArray(value) ? value : [];
              return (
                <fieldset key={p.key} data-needed={needed ? "true" : undefined} className={`mb-2 ${needed ? "border-l-[3px] border-[var(--ic-selected)] pl-2" : ""}`}>
                  <legend className="text-[13px] font-extrabold">
                    {p.label}
                    {needed ? <span className="ic-label ml-2 text-[10px] text-[var(--ic-selected)]">Needed</span> : null}
                  </legend>
                  {(p.options ? optionList(p.options, ctx) : []).map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 py-0.5 text-[13px] font-semibold">
                      <input
                        type="checkbox"
                        checked={selected.includes(k)}
                        onChange={(e) => {
                          const next = e.target.checked ? [...selected, k] : selected.filter((s) => s !== k);
                          onChange(node.id, { [p.key]: next });
                        }}
                      />
                      {label}
                      {ctx.sample && <span className="ic-label border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}
                    </label>
                  ))}
                </fieldset>
              );
            }
            if (p.kind === "select") {
              return (
                <label key={p.key} className={`mb-2 block text-[13px] font-extrabold ${needed ? "border-l-[3px] border-[var(--ic-selected)] pl-2" : ""}`}>
                  {p.label}
                  {needed ? <span className="ic-label ml-2 text-[10px] text-[var(--ic-selected)]">Needed</span> : null}
                  <select
                    data-needed={needed ? "true" : undefined}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange(node.id, { [p.key]: e.target.value })}
                    className="mt-1 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1 font-semibold"
                  >
                    <option value="">Choose…</option>
                    {(p.options ? optionList(p.options, ctx) : []).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            return (
              <label key={p.key} className={`mb-2 block text-[13px] font-extrabold ${needed ? "border-l-[3px] border-[var(--ic-selected)] pl-2" : ""}`}>
                {p.label}
                {needed ? <span className="ic-label ml-2 text-[10px] text-[var(--ic-selected)]">Needed</span> : null}
                <input
                  data-needed={needed ? "true" : undefined}
                  type={p.kind === "number" ? "number" : "text"}
                  min={p.kind === "number" ? 1 : undefined}
                  placeholder={p.placeholder}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange(node.id, { [p.key]: e.target.value })}
                  className="mt-1 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1 font-semibold"
                />
              </label>
            );
          })}
        </>
      )}
      <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">What publish does</div>
      <p className="text-[13px] font-semibold">{def.publish(node)}</p>
      <div className="ic-label mt-3 text-[10.5px] text-[var(--ic-secondary)]">
        {def.backend === "exists" ? "Works today" : "Partly built"}
      </div>
      {technical && <div className="mt-1 break-all font-mono text-[11px] text-[var(--ic-secondary)]">{def.endpoint}</div>}
      {(() => {
        const link = toolLink?.(node.id);
        if (!link) return null;
        return (
          <>
            <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Work on it</div>
            <Link href={link.href} className="text-[13px] font-extrabold underline underline-offset-4">
              {link.label}
            </Link>
          </>
        );
      })()}
      {def.paused && (
        <p className="mt-2 text-[13px] font-extrabold text-[var(--ic-ink)]">Created paused. It is not live until you switch it on in Ads Manager.</p>
      )}
      <div className="ic-label mt-4 text-[10.5px] text-[var(--ic-instruction)]">Change</div>
      <button type="button" onClick={onRemove} className="font-extrabold underline underline-offset-4">
        Remove {def.title}
      </button>
    </aside>
  );
}
