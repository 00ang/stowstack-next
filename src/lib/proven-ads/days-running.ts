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
 * silence is a stopped ad, not a flaky fetch. Person-run sources are never
 * swept — nobody re-observes them on a clock, so a person decides.
 */
export const STALE_AFTER_DAYS = 14;

/**
 * Sources a person runs (typing an ad in, importing a CSV, importing an Ad
 * Library export). Nothing re-observes these on a schedule.
 */
export const PERSON_RUN_SOURCES = ["manual", "csv_import", "meta_ad_library_web"] as const;

const DAY_MS = 86_400_000;

export interface RunWindow {
  started_at: Date | string;
  last_seen_at: Date | string;
  ended_at?: Date | string | null;
  active: boolean;
  /** Adapter id. Person-run sources only count up to the last time anyone saw the ad. */
  source?: string;
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

/** Whole days between two instants, floored at zero. */
function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function isManualSource(source: string): boolean {
  return (PERSON_RUN_SOURCES as readonly string[]).includes(source);
}

/**
 * The last instant we can vouch the ad was running.
 *
 * A stopped ad: the explicit `ended_at` when a source gave us one, otherwise
 * the last time we actually saw it — the conservative choice. A live ad from
 * an automated source: now, because the refresh re-sees it twice a day and the
 * sweep retires it after two weeks of silence. A live ad from a person-run
 * source: the last time someone saw it. Counting those to "now" would claim
 * months nobody observed.
 */
export function confirmedThrough(ad: RunWindow, now: Date = new Date()): Date {
  if (!ad.active) return ad.ended_at ? toDate(ad.ended_at) : toDate(ad.last_seen_at);
  if (ad.source && isManualSource(ad.source)) {
    const seen = toDate(ad.last_seen_at);
    return seen.getTime() < now.getTime() ? seen : now;
  }
  return now;
}

/** Days the ad has run, as far as anyone can vouch. */
export function daysRunning(ad: RunWindow, now: Date = new Date()): number {
  return daysBetween(toDate(ad.started_at), confirmedThrough(ad, now));
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

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "7 months", "1 year 2 months", or "45 days" under two months. */
export function spanLabel(days: number): string {
  if (days < PROVEN_DAYS) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} year${years === 1 ? "" : "s"}`;
  return rest ? `${y} ${rest} month${rest === 1 ? "" : "s"}` : y;
}

/**
 * The sentence shown next to the flag. Plain, specific, and honest about
 * whether the ad is still live and how recently anyone saw it.
 */
export function whyFlagged(ad: RunWindow, now: Date = new Date()): string {
  const days = daysRunning(ad, now);
  const since = shortDate(toDate(ad.started_at));
  const span = spanLabel(days);
  const through = confirmedThrough(ad, now);
  const observed = ad.active && ad.source !== undefined && isManualSource(ad.source);
  const asOf = observed ? ` as of ${shortDate(through)}` : "";

  if (days < PROVEN_DAYS) {
    const left = PROVEN_DAYS - days;
    return `Running ${days} days since ${since}${asOf}. ${left} more day${left === 1 ? "" : "s"} before it counts as proven.`;
  }
  if (ad.active) {
    const lead = observed ? `Running ${span}${asOf}` : `Still running after ${span}`;
    return `${lead} (started ${since}). Nobody pays for ${span} of an ad that isn't bringing in move-ins.`;
  }
  return `Ran ${span} (${since} until it stopped). It earned its budget for ${span} before the advertiser pulled it. The structure worked.`;
}
