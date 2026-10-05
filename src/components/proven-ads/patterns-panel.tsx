"use client";

import { useState } from "react";
import type { LibraryPatterns, Tally } from "@/lib/proven-ads/patterns";
import { Eyebrow, KIND, ink, span, tint, type Kind } from "./shared";

type Filterable = "offer_type" | "angle" | "unit_type" | "format";

const LISTS: { field: Filterable; kind: Kind; title: string; pick: (p: LibraryPatterns) => Tally[] }[] = [
  { field: "offer_type", kind: "offer", title: "What they offer", pick: (p) => p.offers },
  // "Other" is the model saying none of the five; it isn't a pattern.
  { field: "angle", kind: "angle", title: "What they lead with", pick: (p) => p.angles.filter((t) => t.key !== "other") },
  { field: "unit_type", kind: "unit", title: "Which unit they sell", pick: (p) => p.units },
  { field: "format", kind: "format", title: "How the ad is made", pick: (p) => p.formats },
];

function pct(share: number): string {
  const v = share * 100;
  return v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`;
}

/**
 * What the library says as a whole. Every number is a count of proven ads in
 * the library, labelled as such; each row is also a filter.
 */
export function PatternsPanel({
  patterns,
  active,
  onPick,
}: {
  patterns: LibraryPatterns;
  active: Partial<Record<Filterable, string>>;
  onPick: (field: Filterable, value: string) => void;
}) {
  const [all, setAll] = useState(false);
  const stats = [
    { value: patterns.total.toLocaleString("en-US"), label: "proven ads in the library" },
    { value: patterns.overYear.toLocaleString("en-US"), label: "running a year or more" },
    { value: span(patterns.medianDays), label: "median run" },
    { value: span(patterns.longestDays, true), label: "longest run" },
  ];

  return (
    <section
      aria-labelledby="pa-patterns"
      className="rounded-[4px] border border-[var(--border-subtle)] px-4 py-5 sm:px-5"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 id="pa-patterns" className="text-[15px]" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
          What&apos;s working
        </h2>
        <div className="text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
          Counts of proven ads in this library. Pick a row to see those ads.
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-[var(--border-subtle)] pb-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="sr-only">{s.label}</dt>
            <dd>
              <div
                className="text-[24px] leading-none"
                style={{ color: "var(--color-dark)", fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}
              >
                {s.value}
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
                {s.label}
              </div>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {LISTS.map((list, n) => {
          const rows = list.pick(patterns).slice(0, 5);
          const hue = KIND[list.kind].hue;
          const top = rows[0]?.share || 1;
          return (
            <div key={list.field} className={`min-w-0 ${n > 0 && !all ? "hidden sm:block" : ""}`}>
              <Eyebrow hue={hue === "var(--color-dark)" ? undefined : hue} className="mb-2">
                {list.title}
              </Eyebrow>
              <ul className="space-y-1">
                {rows.map((r) => {
                  const on = active[list.field] === r.key;
                  const label = KIND[list.kind].labels[r.key] ?? r.key;
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => onPick(list.field, r.key)}
                        title={`${r.count.toLocaleString("en-US")} ads · median run ${span(r.medianDays)}`}
                        className="group relative block w-full overflow-hidden rounded-[3px] px-2 py-1.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                        style={{
                          background: on ? tint(hue, 18) : "transparent",
                          outlineColor: ink(hue),
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 transition-[width] duration-200"
                          style={{ width: `${Math.max(4, (r.share / top) * 100)}%`, background: tint(hue, on ? 0 : 10) }}
                        />
                        <span className="relative flex items-baseline justify-between gap-2">
                          <span
                            className="truncate text-[13px]"
                            style={{ color: "var(--color-dark)", fontWeight: on ? 800 : 650 }}
                          >
                            {label}
                          </span>
                          <span
                            className="shrink-0 text-[12px]"
                            style={{ color: ink(hue), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
                          >
                            {pct(r.share)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setAll((a) => !a)}
        aria-expanded={all}
        className="mt-4 w-full rounded-[4px] py-2.5 text-[13px] sm:hidden"
        style={{ background: tint(KIND.angle.hue, 12), color: ink(KIND.angle.hue), fontWeight: 750 }}
      >
        {all ? "Show less" : "What they lead with, the unit and the format"}
      </button>
    </section>
  );
}
