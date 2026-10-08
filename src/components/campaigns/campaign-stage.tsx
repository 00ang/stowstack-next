"use client";

import { useEffect, useMemo, useState } from "react";
import { useOntology } from "@/components/ontology/use-ontology";
import { ActionFill } from "@/components/ontology/action-fill";
import {
  canConnect,
  defOf,
  nextMove,
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
import { funnelContextFromOntology, goalMonths } from "./context";
import { FunnelCanvas, placeFunction } from "./funnel-canvas";
import { FunnelInspector } from "./inspector";
import { NextMoveBar } from "./next-move-bar";
import { FunnelPalette } from "./palette";
import { PublishDialog } from "./publish-dialog";
import { ReadOnlyFlow } from "./read-only-flow";
import { useCampaignDraft } from "./use-campaign-draft";

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
}: {
  facilityId: string;
  funnelId: string;
  onBack: () => void;
}) {
  const sample = isPortalDemo();
  const narrow = useNarrow();
  const ontology = useOntology({ kind: "manage", facilityId });
  const ctx = useMemo(() => funnelContextFromOntology(ontology.data, sample), [ontology.data, sample]);
  const draft = useCampaignDraft(funnelId, ctx);
  const [readOnly, setReadOnly] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [focusField, setFocusField] = useState(false);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const move = nextMove(draft.graph, ctx);
  const counts = readyCount(draft.graph);
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
        narrow
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
            <button type="button" className="border border-[var(--ic-ink)] px-2 py-1 text-[12px] font-extrabold" onClick={draft.undo} disabled={!draft.canUndo}>
              Undo
            </button>
            <button type="button" className="border border-[var(--ic-ink)] px-2 py-1 text-[12px] font-extrabold" onClick={draft.redo} disabled={!draft.canRedo}>
              Redo
            </button>
            <button type="button" className="border border-[var(--ic-ink)] px-2 py-1 text-[12px] font-extrabold" onClick={() => setReadOnly((v) => !v)}>
              {readOnly ? "Edit view" : "Read-only"}
            </button>
          </>
        )}
        <button type="button" className="border border-[var(--ic-ink)] px-2 py-1 text-[12px] font-extrabold" onClick={() => setTemplatesOpen(true)}>
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
          <p className="p-4 text-sm font-semibold text-[var(--ic-secondary)]">Opening the campaign…</p>
        ) : showList ? (
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
            <ReadOnlyFlow
              graph={draft.graph}
              ctx={ctx}
              selectedId={draft.selectedId}
              onSelect={draft.setSelectedId}
              showBack={!narrow && readOnly}
              onBackToCanvas={() => setReadOnly(false)}
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
                onRefuse={draft.setNotice}
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
            />
          </>
        )}
      </div>

      <div className="ic-label flex shrink-0 items-center justify-between gap-3 border-t border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-1 text-[10.5px] text-[var(--ic-secondary)] sm:px-4">
        <span>
          {counts.ready} of {counts.total} ready · path to move-in: {pathToMoveIn(draft.graph) ? "closed" : "open"}
        </span>
        {draft.graph.status === "published" && <span>Ads created paused</span>}
      </div>

      <NextMoveBar
        move={move}
        ready={counts.ready}
        total={counts.total}
        pathClosed={pathToMoveIn(draft.graph)}
        onDo={() => run(move.action)}
      />

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
          onClose={() => setPublishOpen(false)}
          onConfirm={() => {
            draft.markPublished();
            setPublishOpen(false);
            draft.setNotice("Nothing was sent. Pages would go live and ad campaigns would be created paused.");
          }}
        />
      )}
    </div>
  );
}
