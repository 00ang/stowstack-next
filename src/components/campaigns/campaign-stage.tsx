"use client";

import { useMemo, useState } from "react";
import { useOntology } from "@/components/ontology/use-ontology";
import {
  nextMove,
  pathToMoveIn,
  readyCount,
  TEMPLATE_KEYS,
  templateBlurb,
  templateMeta,
  type MoveAction,
  type TemplateKey,
} from "@/lib/funnel-graph";
import { funnelContextFromOntology, goalMonths } from "./context";
import { NextMoveBar } from "./next-move-bar";
import { useCampaignDraft } from "./use-campaign-draft";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";

/**
 * One campaign inside the Campaigns tool. The next move sits at the bottom
 * and changes with the graph. The flow itself is filled in by the read-only
 * view and the canvas; this stage owns the goal, the draft, and the move.
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
  const ontology = useOntology({ kind: "manage", facilityId });
  const ctx = useMemo(
    () => funnelContextFromOntology(ontology.data, sample),
    [ontology.data, sample],
  );
  const draft = useCampaignDraft(funnelId, ctx);
  const [focusGoal, setFocusGoal] = useState(false);
  const move = nextMove(draft.graph, ctx);
  const counts = readyCount(draft.graph);
  const months = goalMonths();

  function run(action: MoveAction) {
    if (action.kind === "templates") return;
    if (action.kind === "edit-goal") {
      setFocusGoal(true);
      return;
    }
    if (action.kind === "publish") return;
    if (action.kind === "ads-manager") {
      draft.setNotice("The Meta campaign is paused. Switch it on in Ads Manager. Nothing here spends until you do.");
      return;
    }
    draft.apply(action);
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="text-[13px] font-extrabold text-[var(--ic-ink)] underline underline-offset-4">
          Back to campaigns
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-extrabold text-[var(--ic-ink)]">{draft.graph.name ?? "Campaign"}</h2>
        </div>
        <label className="flex items-center gap-2 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1">
          <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Goal</span>
          <input
            aria-label="Move-ins"
            type="number"
            min={1}
            autoFocus={focusGoal}
            value={draft.graph.goal?.moveIns ?? ctx.goal?.moveIns ?? 12}
            onChange={(e) => draft.setGoal(Math.max(1, Number(e.target.value) || 1), draft.graph.goal?.month ?? months[0])}
            className="w-14 border-0 bg-transparent text-[18px] font-extrabold text-[var(--ic-selected)] outline-none"
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
      </div>

      {draft.notice && (
        <div role="status" className="mb-3 border border-[var(--ic-ink)] bg-[var(--ic-ink)] px-3 py-2 text-[13px] font-semibold text-[var(--ic-pane)]">
          {draft.notice}
          <button type="button" className="ml-3 underline" onClick={() => draft.setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {draft.loading ? (
          <p className="text-sm font-semibold text-[var(--ic-secondary)]">Opening the campaign…</p>
        ) : (
          <ul className="space-y-2">
            {draft.graph.nodes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => draft.setSelectedId(n.id)}
                  className={`w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-left ${
                    draft.selectedId === n.id ? "outline outline-2 outline-[var(--ic-selected)]" : ""
                  }`}
                >
                  <span className="font-extrabold text-[var(--ic-ink)]">{n.type}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TemplateRow
        onPick={(key) => {
          draft.loadTemplate(key);
        }}
      />

      <NextMoveBar
        move={move}
        ready={counts.ready}
        total={counts.total}
        pathClosed={pathToMoveIn(draft.graph)}
        onDo={() => run(move.action)}
      />
    </div>
  );
}

function TemplateRow({ onPick }: { onPick: (key: TemplateKey) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-2 text-left text-[13px] font-extrabold underline underline-offset-4">
        Templates
      </button>
    );
  }
  return (
    <div className="mb-3 space-y-2">
      {TEMPLATE_KEYS.map((key) => {
        const meta = templateMeta(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              onPick(key);
              setOpen(false);
            }}
            className="block w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-left"
          >
            <span className="font-extrabold">{meta.name}</span>
            <span className="mt-1 block text-[13px] font-semibold text-[var(--ic-secondary)]">{templateBlurb(key)}</span>
          </button>
        );
      })}
    </div>
  );
}
