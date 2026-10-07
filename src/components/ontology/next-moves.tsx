"use client";

import Link from "next/link";
import type { Move, Ontology } from "@/lib/ontology/types";
import { ObjectMark } from "./object-mark";
import { ActionFill } from "./action-fill";
import { actionHref, indexHref } from "./use-ontology";

/**
 * What the links reveal, one sentence each, with one way to close it. Calm by
 * construction: no badge, no count in red, nothing animated. When there is
 * nothing to do, it says so and gets out of the way.
 */
export function NextMoves({
  ontology,
  limit = 5,
  toolsBase = "/portal/tools",
}: {
  ontology: Ontology;
  limit?: number;
  toolsBase?: string;
}) {
  const moves = ontology.moves.slice(0, limit);
  const more = ontology.moves.length - moves.length;
  const names = new Map(ontology.objects.map((o) => [o.address, o]));

  if (moves.length === 0) {
    return (
      <div className="border-t-[1.5px] border-[var(--color-dark)] pt-3 text-sm font-semibold text-[var(--color-body-text)]">
        Nothing needs you right now.
      </div>
    );
  }

  return (
    <div className="border-t-[1.5px] border-[var(--color-dark)]">
      <ol>
        {moves.map((m, i) => (
          <MoveRow key={m.id} move={m} n={i} known={names.has(m.subject)} toolsBase={toolsBase} />
        ))}
      </ol>
      {more > 0 && (
        <div className="pt-3 text-[13px] font-semibold text-[var(--color-body-text)]">
          {more} more in the{" "}
          <Link href="/portal/index" className="font-bold text-[var(--color-dark)] underline underline-offset-4">
            index
          </Link>
          .
        </div>
      )}
    </div>
  );
}

function MoveRow({ move, n, known, toolsBase }: { move: Move; n: number; known: boolean; toolsBase: string }) {
  return (
    <li className="flex flex-col gap-3 border-b border-[var(--line-dim)] py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {known ? (
          <Link href={indexHref(move.subject)} className="mt-0.5" aria-label="Open in the index">
            <ObjectMark address={move.subject} type={move.type} size={24} />
          </Link>
        ) : (
          <ObjectMark address={move.subject} type={move.type} size={24} className="mt-0.5" />
        )}
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-snug text-[var(--color-dark)]">{move.sentence}</div>
          <div className="mt-1 text-[13px] font-medium leading-snug text-[var(--color-body-text)]">{move.reason}</div>
        </div>
      </div>
      <ActionFill href={actionHref(move.action, known ? move.subject : null, toolsBase)} n={n} className="self-start sm:self-center">
        {move.action.label}
      </ActionFill>
    </li>
  );
}
