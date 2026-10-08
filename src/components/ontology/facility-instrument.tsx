"use client";

import Link from "next/link";
import { TYPE_DEFS } from "@/lib/ontology/registry";
import type { ObjectTypeKey, TypeSummary } from "@/lib/ontology/types";
import { TypeGlyph } from "./object-mark";
import { indexHref } from "./use-ontology";

/**
 * The facility as an instrument: one square pane per kind of object, each
 * showing one true reading. Grammar measured from the reference (library entry
 * 006): square panes, a 1px hard hairline, the gap a seventh of the pane, the
 * label top-left at a 7% inset, the reading bottom-left. The panes, hairlines
 * and mono-caps units are Instrument Calm's (entry 008); the colour is each
 * kind's own identity hue, which Angelo chose over the ink-only scheme.
 *
 * Each pane is a door into the index, not a KPI: it names a kind of thing you
 * own, and the number is how many of them are doing their job. The selected
 * pane takes a navy frame and a navy reading.
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
    <ul className="grid grid-cols-2 gap-[12px] min-[360px]:grid-cols-3 sm:grid-cols-4 sm:gap-[15px] md:grid-cols-6" aria-label="Your facility, by kind">
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
      {/* Never truncated (Law #1): a long name wraps rather than losing letters. */}
      <span className="text-[12px] font-bold leading-tight sm:text-[13px]">{def.plural}</span>
      <span className="flex flex-1 items-center justify-center py-1">
        <TypeGlyph type={summary.type} className="h-6 w-6" />
      </span>
      <span className="block leading-none">
        <span
          className={`block text-[20px] font-extrabold tabular-nums tracking-tight sm:text-[22px] ${
            selected ? "text-[var(--ic-selected)]" : ""
          }`}
        >
          {summary.reading.value}
        </span>
        <span className="ic-label mt-1.5 block text-[9.5px] leading-tight tracking-[0.04em] text-[var(--ic-instruction)] sm:text-[10px]">
          {summary.reading.unit}
        </span>
      </span>
    </>
  );
  const cls = `flex aspect-square w-full flex-col bg-[var(--ic-pane)] p-[7%] text-left text-[var(--ic-ink)] transition-colors duration-[240ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ic-selected)] ${
    selected ? "border-[3px] border-[var(--ic-selected)]" : "border border-[var(--ic-ink)] hover:bg-[var(--ic-soft)]"
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
