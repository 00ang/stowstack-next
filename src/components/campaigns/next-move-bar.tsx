"use client";

import { ActionFill } from "@/components/ontology/action-fill";
import type { NextMove } from "@/lib/funnel-graph";

/**
 * One suggested move, pinned to the bottom of Campaigns. No badge, no count
 * animation: a sentence, the reason, and one button.
 */
export function NextMoveBar({
  move,
  ready,
  total,
  pathClosed,
  onDo,
}: {
  move: NextMove;
  ready?: number;
  total?: number;
  pathClosed?: boolean;
  onDo: () => void;
}) {
  return (
    <footer
      aria-label="Next move"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-3 sm:px-4"
    >
      <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:flex-1">
        <span className="ic-label shrink-0 pt-1 text-[10.5px] text-[var(--ic-instruction)]">Next move</span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-extrabold leading-tight text-[var(--ic-ink)]">{move.sentence}</div>
          <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">{move.reason}</div>
        </div>
      </div>
      {total != null && total > 0 && (
        <div className="ic-label hidden text-right text-[11px] text-[var(--ic-secondary)] sm:block">
          <b className="mr-1 font-sans text-[20px] font-extrabold normal-case tracking-normal text-[var(--ic-selected)]">{ready}</b>
          of {total} ready
          <br />
          path to move-in: {pathClosed ? "closed" : "open"}
        </div>
      )}
      <ActionFill n={0} onClick={onDo}>
        {move.actionLabel}
      </ActionFill>
    </footer>
  );
}
