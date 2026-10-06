/**
 * What the library as a whole says. Pure: counts over the proven rows the
 * caller hands in, no I/O, no invented numbers. Every figure here is a count
 * of ads in the library, and the page labels it that way.
 */

import { daysRunning, isProven, type RunWindow } from "./days-running";

export interface PatternRow extends RunWindow {
  offer_type: string | null;
  unit_type: string | null;
  angle: string | null;
  format: string;
  audience: string | null;
  advertiser_scale: string | null;
  family_size: number;
}

export interface Tally {
  key: string;
  count: number;
  /** Share of the proven ads this tally counts over, 0–1. */
  share: number;
  /** Median days running among the ads with this value. */
  medianDays: number;
}

export interface LibraryPatterns {
  /** Proven ads counted. */
  total: number;
  /** Proven ads that have run a year or more. */
  overYear: number;
  /** Median days running across the proven set. */
  medianDays: number;
  /** The longest run in the set, in days. */
  longestDays: number;
  offers: Tally[];
  angles: Tally[];
  formats: Tally[];
  units: Tally[];
  audiences: Tally[];
  scales: Tally[];
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function tally(rows: { days: number; key: string | null }[], total: number): Tally[] {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.key || r.key === "unknown") continue;
    const list = groups.get(r.key) ?? [];
    list.push(r.days);
    groups.set(r.key, list);
  }
  return Array.from(groups.entries())
    .map(([key, days]) => ({
      key,
      count: days.length,
      share: total ? days.length / total : 0,
      medianDays: median(days),
    }))
    .sort((a, b) => b.count - a.count || b.medianDays - a.medianDays);
}

export function libraryPatterns(rows: PatternRow[], now: Date = new Date()): LibraryPatterns {
  const proven = rows
    .filter((r) => isProven(r, now))
    .map((r) => ({ row: r, days: daysRunning(r, now) }));
  const total = proven.length;
  const days = proven.map((p) => p.days);
  const by = (pick: (r: PatternRow) => string | null) =>
    tally(
      proven.map((p) => ({ days: p.days, key: pick(p.row) })),
      total
    );

  return {
    total,
    overYear: days.filter((d) => d >= 365).length,
    medianDays: median(days),
    longestDays: days.length ? Math.max(...days) : 0,
    offers: by((r) => r.offer_type),
    angles: by((r) => r.angle),
    formats: by((r) => r.format),
    units: by((r) => r.unit_type),
    audiences: by((r) => r.audience),
    scales: by((r) => r.advertiser_scale),
  };
}
