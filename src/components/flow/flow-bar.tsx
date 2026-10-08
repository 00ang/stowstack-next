"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { ActionFill } from "@/components/ontology/action-fill";
import { ObjectMark, TypeGlyph } from "@/components/ontology/object-mark";
import { campaignHref, chooseMove, surfaceOf, type FlowMove, type Where } from "@/lib/flow";
import { fnv1a } from "@/lib/ontology/mark";
import { useFlow } from "./flow-context";

/**
 * The next move, pinned to the bottom of every portal page and every tool.
 * One sentence, the reason, one button. Calm by construction: no badge, no
 * count, nothing animated. Pace and the campaign being built ride along on
 * the left, so the operator always knows what they are working toward.
 */

/** Where the operator is, read from the URL. Tools carry ?tool= and ?focus=, the index ?o=. */
export function whereFrom(pathname: string, params: URLSearchParams | null): Where {
  const surface = surfaceOf(pathname);
  if (surface === "tools") {
    return { surface, tool: params?.get("tool") ?? "overview", focus: params?.get("focus") ?? null };
  }
  if (surface === "index") return { surface, focus: params?.get("o") ?? null };
  return { surface };
}

function WhereSync() {
  const flow = useFlow();
  const pathname = usePathname();
  const params = useSearchParams();
  const setWhere = flow?.setWhere;
  const key = `${pathname}?${params?.toString() ?? ""}`;
  useEffect(() => {
    setWhere?.(whereFrom(pathname, params ? new URLSearchParams(params.toString()) : null));
    // key captures both the path and the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setWhere]);
  return null;
}

/** One fill per move, steady for that move, varied across moves. */
function fillFor(id: string): number {
  return fnv1a(id) % 6;
}

function Mark({ move }: { move: FlowMove }) {
  if (move.subject && move.type) return <ObjectMark address={move.subject} type={move.type} size={28} />;
  if (move.type) return <TypeGlyph type={move.type} className="h-7 w-7" />;
  return null;
}

function PaceChip() {
  const flow = useFlow();
  const pace = flow?.pace;
  if (!pace) return null;
  return (
    <div className="min-w-0" title={pace.projection ?? undefined}>
      <div className="ic-label text-[10px] text-[var(--ic-instruction)]">Goal · {pace.monthShort}</div>
      <div className="text-[14px] font-extrabold leading-tight text-[var(--ic-ink)]">
        {pace.target > 0 ? (
          <>
            <span className="text-[var(--ic-selected)]">{pace.actual}</span> of {pace.target}
          </>
        ) : (
          <>{pace.actual} so far</>
        )}
      </div>
    </div>
  );
}

function WorkingChip() {
  const flow = useFlow();
  const working = flow?.working;
  if (!working) return null;
  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <Link href={campaignHref(working.id)} className="min-w-0">
        <div className="ic-label text-[10px] text-[var(--ic-instruction)]">Working on</div>
        <div className="max-w-[14rem] text-[14px] font-extrabold leading-tight text-[var(--ic-ink)] underline-offset-4 hover:underline">
          {working.name}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => flow.setWorking(null)}
        aria-label={`Stop working on ${working.name}`}
        className="mt-0.5 shrink-0 p-0.5 text-[var(--ic-secondary)] hover:text-[var(--ic-ink)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Bar() {
  const flow = useFlow();
  const setShown = flow?.setShown;
  const chosen = useMemo(
    () =>
      flow
        ? chooseMove({ ontology: flow.ontology, pace: flow.pace, working: flow.working, where: flow.where })
        : null,
    [flow],
  );
  const shownId = flow?.override ? null : chosen?.id ?? null;
  useEffect(() => {
    setShown?.(flow?.override ? null : chosen);
    // shownId identifies the move; the object itself is rebuilt each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownId, setShown]);

  if (!flow) return null;
  const { override } = flow;

  if (!override && !flow.ontology) {
    if (!flow.ontologyLoading) return null;
    return (
      <footer aria-label="Next move" className="shrink-0 border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-3">
        <span className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Reading your facility…</span>
      </footer>
    );
  }

  const chips = (
    <div className="hidden shrink-0 items-start gap-5 border-r border-[var(--ic-ink)]/20 pr-5 lg:flex">
      <PaceChip />
      <WorkingChip />
    </div>
  );

  if (override) {
    return (
      <footer
        aria-label="Next move"
        className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-3"
      >
        {chips}
        <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
          <span className="ic-label shrink-0 pt-1 text-[10.5px] text-[var(--ic-instruction)]">Next move</span>
          <div className="min-w-0">
            <div className="text-[16px] font-extrabold leading-tight text-[var(--ic-ink)]">{override.move.sentence}</div>
            <div className="text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">{override.move.reason}</div>
          </div>
        </div>
        {override.total != null && override.total > 0 && (
          <div className="ic-label hidden text-right text-[11px] leading-snug text-[var(--ic-secondary)] sm:block">
            <b className="mr-1 font-sans text-[20px] font-extrabold normal-case tracking-normal text-[var(--ic-selected)]">
              {override.ready}
            </b>
            of {override.total} ready
            <br />
            path to move-in: {override.pathClosed ? "closed" : "open"}
          </div>
        )}
        <ActionFill n={fillFor(override.move.actionLabel)} onClick={override.onDo}>
          {override.move.actionLabel}
        </ActionFill>
      </footer>
    );
  }

  if (!chosen) {
    return (
      <footer
        aria-label="Next move"
        className="flex shrink-0 items-center gap-4 border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-3"
      >
        {chips}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-extrabold leading-tight text-[var(--ic-ink)]">Nothing needs you right now.</div>
          {flow.pace?.projection && (
            <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">{flow.pace.projection}</div>
          )}
        </div>
      </footer>
    );
  }

  return (
    <footer
      aria-label="Next move"
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-3"
    >
      {chips}
      <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
        <span className="ic-label hidden shrink-0 pt-1.5 text-[10.5px] text-[var(--ic-instruction)] sm:block">Next move</span>
        <span className="mt-0.5 shrink-0">
          <Mark move={chosen} />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-extrabold leading-snug text-[var(--ic-ink)]">{chosen.sentence}</div>
          <div className="text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">{chosen.reason}</div>
        </div>
      </div>
      {chosen.here ? (
        <span className="ic-label shrink-0 border border-[var(--ic-ink)] px-2.5 py-2 text-[11px] text-[var(--ic-ink)]">
          You&apos;re on it
        </span>
      ) : (
        <ActionFill href={chosen.href} n={fillFor(chosen.id)} className="shrink-0">
          {chosen.label}
        </ActionFill>
      )}
    </footer>
  );
}

/** The bar plus the URL listener (search params need a Suspense boundary). */
export function FlowBar() {
  return (
    <>
      <Suspense fallback={null}>
        <WhereSync />
      </Suspense>
      <Bar />
    </>
  );
}
