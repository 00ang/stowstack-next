"use client";

import Link from "next/link";
import { TYPE_DEFS } from "@/lib/ontology/registry";
import type { ObjectTypeKey, TypeSummary } from "@/lib/ontology/types";
import { TypeGlyph } from "./object-mark";
import { indexHref } from "./use-ontology";

/**
 * The facility as an instrument: one square pane per kind of object, each
 * showing one true reading. The grammar is measured from the reference
 * (library entry 006): square panes, a 1px hard hairline, the gap a seventh
 * of the pane, the label top-left at a 7% inset, the reading bottom-left.
 * Each pane is a door into the index, not a KPI: it names a kind of thing you
 * own, and the number is how many of them are doing their job.
 *
 * `selected` turns the pane into a solid block (inversion, navy), which is how
 * the index shows the kind you are looking at.
 */
export function FacilityInstrument({
  summaries,
  selected,
  onSelect,
}: {
  summaries: TypeSummary[];
  selected?: ObjectTypeKey | null;
  /** When given, panes select instead of navigating. */
  onSelect?: (type: ObjectTypeKey) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-[14px] sm:grid-cols-4 sm:gap-[15px] md:grid-cols-6" aria-label="Your facility, by kind">
      {summaries.map((s) => (
        <li key={s.type}>
          <Pane summary={s} selected={selected === s.type} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

function Pane({
  summary,
  selected,
  onSelect,
}: {
  summary: TypeSummary;
  selected: boolean;
  onSelect?: (type: ObjectTypeKey) => void;
}) {
  const def = TYPE_DEFS[summary.type];
  const body = (
    <>
      <span className="truncate text-[12px] font-bold leading-none sm:text-[13px]">{def.plural}</span>
      <span className="flex flex-1 items-center justify-center">
        <TypeGlyph type={summary.type} className="h-6 w-6" inverted={selected} />
      </span>
      <span className="block leading-none">
        <span className="block text-[19px] font-extrabold tabular-nums tracking-tight">{summary.reading.value}</span>
        <span
          className={`mt-1 block truncate text-[11px] font-semibold ${
            selected ? "text-[var(--onto-selected-ink)]" : "text-[var(--color-body-text)]"
          }`}
        >
          {summary.reading.unit}
        </span>
      </span>
    </>
  );
  const cls = `flex aspect-square w-full flex-col p-[7%] text-left transition-colors duration-[240ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dark)] ${
    selected
      ? "bg-[var(--onto-selected)] text-[var(--onto-selected-ink)] border border-[var(--onto-selected)]"
      : "border border-[var(--line-hi)] text-[var(--color-dark)] hover:bg-[var(--bg-alt)]"
  }`;
  const label = `${def.plural}: ${summary.reading.value} ${summary.reading.unit}. ${summary.reading.definition}`;

  if (onSelect) {
    return (
      <button type="button" className={cls} aria-pressed={selected} aria-label={label} title={summary.reading.definition} onClick={() => onSelect(summary.type)}>
        {body}
      </button>
    );
  }
  return (
    <Link href={indexHref(null, summary.type)} className={cls} aria-label={label} title={summary.reading.definition}>
      {body}
    </Link>
  );
}
