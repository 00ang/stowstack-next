/**
 * Proven Ads — the one rule that matters, kept free of I/O.
 *
 * "No one runs an ad that long if it isn't working." Everything in the
 * library hangs off how long an ad has been running, so this is computed from
 * the stored facts (start, last seen, ended, active) at read time rather than
 * persisted — a stored number is right the moment it is written and wrong by
 * tomorrow.
 */

/** Days an ad must have run to be flagged. Two months, per the product brief. */
export const PROVEN_DAYS = 60;

/**
 * How long an automated-source ad may go unseen before we stop believing it is
 * running. Meta's archive returns active ads on every refresh, so two weeks of
 * silence is a stopped ad, not a flaky fetch. Manual rows are never swept —
 * nobody is re-observing them, so a person decides.
 */
export const STALE_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

export interface RunWindow {
  started_at: Date | string;
  last_seen_at: Date | string;
  ended_at?: Date | string | null;
  active: boolean;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Whole days between two instants, floored at zero. */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * Days the ad has run.
 *
 * Active ads count up to `now`. Inactive ads are frozen at the moment they
 * stopped — the explicit `ended_at` when a source gave us one, otherwise the
 * last time we actually saw it running, which is the conservative choice.
 */
export function daysRunning(ad: RunWindow, now: Date = new Date()): number {
  const start = toDate(ad.started_at);
  if (ad.active) return daysBetween(start, now);
  const end = ad.ended_at ? toDate(ad.ended_at) : toDate(ad.last_seen_at);
  return daysBetween(start, end);
}

export function isProven(ad: RunWindow, now: Date = new Date()): boolean {
  return daysRunning(ad, now) >= PROVEN_DAYS;
}

/**
 * An automated-source ad we have not seen for STALE_AFTER_DAYS is treated as
 * stopped. Pure so the sweep's rule is testable without a table.
 */
export function shouldMarkInactive(
  ad: Pick<RunWindow, "last_seen_at" | "active"> & { source: string },
  now: Date = new Date(),
  staleAfterDays: number = STALE_AFTER_DAYS
): boolean {
  if (!ad.active) return false;
  if (isManualSource(ad.source)) return false;
  return daysBetween(toDate(ad.last_seen_at), now) >= staleAfterDays;
}

export function isManualSource(source: string): boolean {
  return source === "manual" || source === "csv_import";
}

/**
 * The sentence shown next to the flag. Plain, specific, and honest about
 * whether the ad is still live — an ad that ran 90 days and stopped is still
 * worth copying, but the reader should know which case they are looking at.
 */
export function whyFlagged(ad: RunWindow, now: Date = new Date()): string {
  const days = daysRunning(ad, now);
  const since = toDate(ad.started_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const months = Math.floor(days / 30);
  const span = months >= 2 ? `${months} months` : `${days} days`;

  if (days < PROVEN_DAYS) {
    const left = PROVEN_DAYS - days;
    return `Running ${days} days since ${since}. ${left} more day${left === 1 ? "" : "s"} before it counts as proven.`;
  }
  if (ad.active) {
    return `Still running after ${span} (started ${since}). Nobody pays for ${span} of an ad that isn't bringing in move-ins.`;
  }
  return `Ran ${span} (${since} until it stopped). It earned its budget for ${span} before the advertiser pulled it — the structure worked.`;
}
