"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOntology } from "@/components/ontology/use-ontology";
import { ActionFill } from "@/components/ontology/action-fill";
import {
  NODE_TOOL,
  edgeCounts,
  isEmptyFlow,
  type FlowCounts,
  canConnect,
  defOf,
  nextMove,
  nodeSubject,
  pathToMoveIn,
  placeAfter,
  readyCount,
  TEMPLATE_KEYS,
  templateBlurb,
  templateMeta,
  type MoveAction,
  type NodeType,
} from "@/lib/funnel-graph";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import { useFlow } from "@/components/flow/flow-context";
import { funnelContextFromOntology, goalMonths } from "./context";
import { FunnelCanvas, placeFrom, placeFunction } from "./funnel-canvas";
import { FunnelInspector, type ToolLinkFor } from "./inspector";
import { actionHref } from "@/lib/ontology/href";
import type { ToolKey } from "@/lib/ontology/types";
import { NextMoveBar } from "./next-move-bar";
import { FunnelPalette } from "./palette";
import { PublishDialog } from "./publish-dialog";
import { PublishStrip } from "./publish-strip";
import { attention, usePublish } from "./use-publish";
import { ReadOnlyFlow } from "./read-only-flow";
import { useCampaignDraft } from "./use-campaign-draft";

/** What flowed through the campaign in the last 30 days, for the counts on its wires. */
function useFlowCounts(funnelId: string): FlowCounts | null {
  const [counts, setCounts] = useState<FlowCounts | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch(`/api/funnels/flow?id=${encodeURIComponent(funnelId)}&days=30`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { counts?: FlowCounts } | null) => {
        if (!cancel) setCounts(json?.counts ?? null);
      })
      .catch(() => {
        // Counts are a reading on the wires; without them the canvas still works.
        if (!cancel) setCounts(null);
      });
    return () => {
      cancel = true;
    };
  }, [funnelId]);
  return counts;
}

/** The owner tools a publish result may send someone to. */
const TOOL_KEYS: ReadonlySet<string> = new Set<ToolKey>(["ad-publisher", "creative-studio", "gbp", "landing-pages"]);

/** Frameless, square, and each one its own fill (no two neighbours match). */
const TOOL_BUTTON =
  "act-fill inline-flex h-8 items-center px-2.5 text-[12px] font-extrabold";

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

/**
 * The campaign inside the Campaigns tool: palette, canvas, inspector, and
 * one next move. A phone gets the same funnel as a vertical list.
 */
export function CampaignStage({
  facilityId,
  funnelId,
  onBack,
  fill = false,
}: {
  facilityId: string;
  funnelId: string;
  onBack: () => void;
  /** A page of its own (/portal/campaigns/[id]): fill the space instead of the tool panel's. */
  fill?: boolean;
}) {
  const sample = isPortalDemo();
  const narrow = useNarrow();
  // In the portal the thread already holds this facility's ontology; reuse it.
  const flow = useFlow();
  const shared = flow && flow.facilityId === facilityId ? flow : null;
  const own = useOntology(shared ? null : { kind: "manage", facilityId });
  const ontologyData = shared ? shared.ontology : own.data;
  const pace = shared?.pace ?? null;
  const ctx = useMemo(() => {
    const base = funnelContextFromOntology(ontologyData, sample);
    // The month's goal is the campaign's default goal.
    if (pace && pace.target > 0) base.goal = { moveIns: pace.target, month: pace.monthName };
    return base;
  }, [ontologyData, sample, pace]);
  const draft = useCampaignDraft(funnelId, ctx);
  const flowCounts = useFlowCounts(funnelId);
  const edgeLabels = useMemo(
    () => (isEmptyFlow(flowCounts) ? undefined : edgeCounts(draft.graph, flowCounts)),
    [flowCounts, draft.graph],
  );
  const pub = usePublish(funnelId);
  const published = pub.state?.nodes;
  // Where a publish result points to fix it: a tool in the portal. The admin has no portal links.
  const fixHref = (tool: string): string | null => {
    if (!shared || tool === "canvas") return null;
    if (tool === "settings") return "/portal/settings";
    return TOOL_KEYS.has(tool) ? actionHref({ label: "", tool: tool as ToolKey }, null) : null;
  };
  const [readOnly, setReadOnly] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [focusField, setFocusField] = useState(false);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const move = nextMove(draft.graph, ctx);
  const counts = readyCount(draft.graph);
  // In the portal, a function opens its own tool with the object it works on in focus.
  const toolLink: ToolLinkFor = (nodeId) => {
    const node = draft.graph.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    // The page opens in this campaign, not in the old landing-page tool.
    if (node.type === "page") {
      const q = new URLSearchParams({ node: node.id });
      const pageId = typeof node.params.page === "string" ? node.params.page : "";
      if (pageId) q.set("page", pageId);
      else if (node.slug) q.set("slug", node.slug);
      return { href: `/portal/campaigns/${funnelId}/page?${q}`, label: "Open the page" };
    }
    const target = NODE_TOOL[node.type];
    if (!target) return null;
    const subject = nodeSubject(draft.graph, node, ontologyData?.objects ?? []);
    return { href: actionHref({ label: target.label, tool: target.tool }, subject?.address ?? null), label: target.label };
  };
  const months = goalMonths();
  const showList = narrow || readOnly;

  function run(action: MoveAction) {
    setFocusField(false);
    if (action.kind === "templates") {
      setTemplatesOpen(true);
      return;
    }
    if (action.kind === "edit-goal") return;
    if (action.kind === "publish") {
      setPublishOpen(true);
      return;
    }
    if (action.kind === "ads-manager") {
      const made = Object.values(published ?? {}).find((r) => r.state === "paused" && r.href);
      if (made?.href) {
        window.open(made.href, "_blank", "noopener,noreferrer");
        return;
      }
      draft.setNotice("The Meta campaign is paused. Switch it on in Ads Manager. Nothing here spends until you do.");
      return;
    }
    if (action.kind === "select") setFocusField(action.focus);
    draft.apply(action);
  }

  function addType(type: NodeType) {
    const sel = draft.graph.nodes.find((n) => n.id === draft.selectedId);
    const [x, y] = placeAfter(draft.graph, sel);
    const next = placeFunction(draft.graph, type, x, y, sel?.id);
    draft.commit(next);
    const added = next.nodes[next.nodes.length - 1];
    if (added) draft.setSelectedId(added.id);
  }

  // Hand the move to the portal's next-move bar, and remember this as the
  // campaign being built so every other page can point back to it.
  const runRef = useRef(run);
  runRef.current = run;
  const setOverride = shared?.setOverride;
  const setWorking = shared?.setWorking;
  // After a publish, the move is whatever the publish left for the owner:
  // the first function that needs them, or switching on what was made paused.
  const afterPublish = useMemo(() => {
    const state = pub.state;
    if (!state || (state.status === "running" && !pub.stale)) return null;
    const ask = attention(state)[0];
    if (ask) {
      const node = draft.graph.nodes.find((n) => n.id === ask.id);
      if (!node) return null;
      const r = ask.result;
      const href = r.fix ? fixHref(r.fix.tool) : null;
      const title = defOf(node.type).title;
      return {
        key: `ask:${ask.id}:${r.state}:${r.line}`,
        sentence: r.state === "needs" ? `${title} needs you.` : `${title} didn't publish.`,
        reason: r.line,
        label: href && r.fix ? r.fix.label : `Open ${title}`,
        onDo: () => {
          if (href) window.location.href = href;
          else {
            draft.setSelectedId(ask.id);
            setFocusField(true);
          }
        },
      };
    }
    const made = state.order.map((id) => ({ id, r: state.nodes[id] })).find((x) => x.r?.state === "paused" && x.r.href);
    if (made?.r?.href) {
      const node = draft.graph.nodes.find((n) => n.id === made.id);
      const where = node?.type === "google" ? "Google Ads" : "Ads Manager";
      return {
        key: `paused:${made.id}`,
        sentence: `Switch it on in ${where}.`,
        reason: made.r.line,
        label: `Open ${where}`,
        onDo: () => window.open(made.r!.href!, "_blank", "noopener,noreferrer"),
      };
    }
    return null;
    // fixHref is rebuilt each render from `shared`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub.state, pub.stale, draft.graph.nodes, shared]);
  const moveKey = `${move.sentence}|${move.actionLabel}|${counts.ready}/${counts.total}|${pathToMoveIn(draft.graph)}|${afterPublish?.key ?? ""}`;
  useEffect(() => {
    if (!setOverride || draft.loading) return;
    setOverride({
      sentence: afterPublish?.sentence ?? move.sentence,
      reason: afterPublish?.reason ?? move.reason,
      label: afterPublish?.label ?? move.actionLabel,
      ready: counts.ready,
      total: counts.total,
      pathClosed: pathToMoveIn(draft.graph),
      onDo: afterPublish ? afterPublish.onDo : () => runRef.current(move.action),
    });
    // moveKey stands for move, counts, path and the publish's ask, which are rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveKey, setOverride, draft.loading]);

  // A run that put a page live publishes the canvas too (the server marks it; keep the tab in step).
  const graphStatus = draft.graph.status;
  const markPublished = draft.markPublished;
  useEffect(() => {
    const state = pub.state;
    if (!state || state.status !== "finished" || graphStatus === "published") return;
    const live = draft.graph.nodes.some((n) => n.type === "page" && ["done", "paused"].includes(state.nodes[n.id]?.state ?? ""));
    if (live) markPublished();
    // Only the run's status and the graph's own status decide this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub.state?.status, pub.state?.runId, graphStatus, markPublished]);
  useEffect(() => () => setOverride?.(null), [setOverride]);
  useEffect(() => {
    if (!setWorking || draft.loading || !draft.graph.name) return;
    setWorking({ id: funnelId, name: draft.graph.name, status: draft.graph.status, move });
    // moveKey stands for move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setWorking, funnelId, draft.loading, draft.graph.name, draft.graph.status, moveKey]);

  // Arriving from the bar on another page (?do=next): take the move it offered, once.
  const ranFromUrl = useRef(false);
  useEffect(() => {
    if (ranFromUrl.current || draft.loading || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("do") !== "next") return;
    ranFromUrl.current = true;
    url.searchParams.delete("do");
    window.history.replaceState(null, "", url);
    runRef.current(move.action);
    // Runs once, after the campaign has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.loading]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) draft.redo();
        else draft.undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        draft.removeSelected(edgeId);
        setEdgeId(null);
        return;
      }
      if (e.key === "c" && draft.selectedId && !showList) {
        const src = draft.graph.nodes.find((n) => n.id === draft.selectedId);
        if (!src) return;
        const out = defOf(src.type).outputs[0];
        if (!out) {
          draft.setNotice("That function has nothing to send on.");
          return;
        }
        const target = draft.graph.nodes.find((n) => {
          const ti = defOf(n.type).inputs.findIndex((p) => p.port === out);
          return ti >= 0 && canConnect(draft.graph, src.id, 0, n.id, ti).ok;
        });
        if (!target) {
          draft.setNotice("Nothing on the canvas can take what this function sends.");
          return;
        }
        const ti = defOf(target.type).inputs.findIndex((p) => p.port === out);
        draft.connectPorts(src.id, 0, target.id, ti);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, edgeId, showList]);

  return (
    <div
      className={
        fill
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : narrow
            ? "-mx-4 flex h-[calc(100dvh-14.5rem)] min-h-0 flex-col overflow-hidden"
            : "-mx-4 -my-5 flex h-[calc(100dvh-7.5rem)] min-h-[520px] flex-col overflow-hidden md:-mx-6 md:-my-6"
      }
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 sm:px-4">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
          <button type="button" onClick={onBack} className="shrink-0 text-[13px] font-extrabold underline underline-offset-4">
            Campaigns
          </button>
          <span className="shrink-0 text-[var(--ic-instruction)]">›</span>
          <h2 className="min-w-0 text-[15px] font-extrabold leading-snug sm:truncate">{draft.graph.name ?? "Campaign"}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 border border-[var(--ic-ink)] px-2 py-0.5">
          <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Goal</span>
          <input
            aria-label="Move-ins"
            type="number"
            min={1}
            value={draft.graph.goal?.moveIns ?? ctx.goal?.moveIns ?? 12}
            onChange={(e) => draft.setGoal(Math.max(1, Number(e.target.value) || 1), draft.graph.goal?.month ?? months[0])}
            className="w-12 border-0 bg-transparent text-[16px] font-extrabold text-[var(--ic-selected)] outline-none"
          />
          <select
            aria-label="Month"
            value={draft.graph.goal?.month ?? months[0]}
            onChange={(e) => draft.setGoal(draft.graph.goal?.moveIns ?? 12, e.target.value)}
            className="border-0 bg-transparent text-[13px] font-semibold outline-none"
          >
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        {!narrow && (
          <>
            <button type="button" data-fill="3" className={TOOL_BUTTON} onClick={draft.undo} disabled={!draft.canUndo}>
              Undo
            </button>
            <button type="button" data-fill="4" className={TOOL_BUTTON} onClick={draft.redo} disabled={!draft.canRedo}>
              Redo
            </button>
            <button type="button" data-fill="5" className={TOOL_BUTTON} onClick={() => setReadOnly((v) => !v)}>
              {readOnly ? "Edit view" : "Step list"}
            </button>
          </>
        )}
        <button type="button" data-fill="6" className={TOOL_BUTTON} onClick={() => setTemplatesOpen(true)}>
          Templates
        </button>
        <ActionFill n={1} onClick={() => setPublishOpen(true)}>
          Publish
        </ActionFill>
        {draft.saving && <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Saving</span>}
        </div>
      </div>

      {draft.notice && (
        <div role="status" className="flex shrink-0 items-start justify-between gap-3 bg-[var(--ic-ink)] px-3 py-2 text-[13px] font-semibold text-[var(--ic-pane)] sm:px-4">
          <span>{draft.notice}</span>
          <button type="button" className="underline" onClick={() => draft.setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {draft.loading ? (
          <div className="p-4 text-sm font-semibold text-[var(--ic-secondary)]">Opening the campaign…</div>
        ) : showList ? (
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <ReadOnlyFlow
              graph={draft.graph}
              ctx={ctx}
              selectedId={draft.selectedId}
              onSelect={draft.setSelectedId}
              showBack={!narrow && readOnly}
              onBackToCanvas={() => setReadOnly(false)}
              edgeLabels={edgeLabels}
              published={published}
              fixHref={fixHref}
              toolLink={shared ? toolLink : undefined}
            />
          </div>
        ) : (
          <>
            <FunnelPalette onAdd={addType} />
            <div className="min-w-0 flex-1">
              <FunnelCanvas
                graph={draft.graph}
                ctx={ctx}
                focusKey={draft.viewportKey}
                onMove={draft.moveNode}
                onConnectPorts={draft.connectPorts}
                onSelect={(id) => {
                  draft.setSelectedId(id);
                  setEdgeId(null);
                }}
                onDropType={(type, x, y) => {
                  const next = placeFunction(draft.graph, type, x, y, null);
                  draft.commit(next);
                  const added = next.nodes[next.nodes.length - 1];
                  if (added) draft.setSelectedId(added.id);
                }}
                onAddFrom={(type, x, y, fromId, fromPort) => {
                  const next = placeFrom(draft.graph, type, x, y, fromId, fromPort);
                  draft.commit(next);
                  const added = next.nodes[next.nodes.length - 1];
                  if (added) draft.setSelectedId(added.id);
                }}
                suggestFor={(fromId) =>
                  move.action.kind === "add" && move.action.connects.some((c) => c.fromId === fromId) ? move.action.node.type : null
                }
                onRefuse={draft.setNotice}
                edgeLabels={edgeLabels}
                published={published}
              />
            </div>
            <FunnelInspector
              graph={draft.graph}
              ctx={ctx}
              selectedId={draft.selectedId}
              focus={focusField}
              onChange={draft.updateNode}
              onGoal={draft.setGoal}
              onConnect={(fromId, fromPort, toId, toPort) => {
                const reason = draft.connectPorts(fromId, fromPort, toId, toPort);
                if (reason) draft.setNotice(reason);
              }}
              onRemove={() => draft.removeSelected(null)}
              onSelectNode={(id) => {
                draft.setSelectedId(id);
                setFocusField(true);
              }}
              toolLink={shared ? toolLink : undefined}
              technical={!shared}
              published={published}
              fixHref={fixHref}
              onRetry={(id) => void pub.start(draft.graph, [id])}
            />
          </>
        )}
      </div>

      {pub.state && (
        <PublishStrip
          graph={draft.graph}
          state={pub.state}
          stale={pub.stale}
          starting={pub.starting}
          onShow={(id) => {
            draft.setSelectedId(id);
            setFocusField(false);
          }}
          onRetry={(retry) => void pub.start(draft.graph, retry)}
        />
      )}

      <div className="ic-label flex shrink-0 items-center justify-between gap-3 border-t border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-1 text-[10.5px] text-[var(--ic-secondary)] sm:px-4">
        <span>
          {counts.ready} of {counts.total} ready · path to move-in: {pathToMoveIn(draft.graph) ? "closed" : "open"}
          {edgeLabels && (
            <>
              {" "}
              · counts: last {flowCounts?.days} days
              {sample ? " · sample" : ""}
            </>
          )}
        </span>
        {draft.graph.status === "published" && <span>Ads made paused</span>}
      </div>

      {/* In the portal the move rides the portal's own bar; the admin keeps this one. */}
      {!shared && (
        <NextMoveBar
          move={move}
          ready={counts.ready}
          total={counts.total}
          pathClosed={pathToMoveIn(draft.graph)}
          onDo={() => run(move.action)}
        />
      )}

      {templatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ic-ink)]/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-5">
            <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Templates · built from your units</div>
            <h2 className="mt-1 mb-3 text-[20px] font-extrabold">Start from an outcome</h2>
            {TEMPLATE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTemplatesOpen(false);
                  void draft.loadTemplate(key);
                }}
                className="mb-2 block w-full border border-[var(--ic-ink)] px-3 py-2 text-left hover:bg-[var(--ic-soft)]"
              >
                <span className="font-extrabold">{templateMeta(key).name}</span>
                <span className="mt-1 block text-[13px] font-semibold text-[var(--ic-secondary)]">{templateBlurb(key, ctx)}</span>
              </button>
            ))}
            <button type="button" className="font-extrabold underline underline-offset-4" onClick={() => setTemplatesOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {publishOpen && (
        <PublishDialog
          graph={draft.graph}
          preflight={pub.preflight}
          previous={pub.state}
          starting={pub.starting}
          error={pub.error}
          sample={sample}
          fixHref={fixHref}
          onClose={() => setPublishOpen(false)}
          onPublish={async () => {
            if (await pub.start(draft.graph)) {
              setPublishOpen(false);
              draft.setSelectedId(null);
            }
          }}
        />
      )}
    </div>
  );
}
