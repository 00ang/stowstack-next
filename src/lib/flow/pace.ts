/**
 * Pace against the month's move-in goal. The "what happens if nothing
 * changes" reading: a straight line from the move-ins so far to the end of
 * the month. It is labelled as pace everywhere it appears, never as a
 * forecast, and it says nothing until there are enough days to draw a line.
 *
 * Months are UTC, the same months /api/client-goals counts in.
 */

export interface GoalState {
  /** "YYYY-MM", as /api/client-goals returns it. */
  month: string;
  target: number;
  actual: number;
}

export interface Pace {
  monthName: string;
  /** "Oct", for the short end-of-month date. */
  monthShort: string;
  target: number;
  actual: number;
  day: number;
  daysInMonth: number;
  daysLeft: number;
  /** Move-ins a straight line to the target would have by today (whole number, rounded down). */
  expectedByNow: number;
  /** Move-ins at the current pace by month end, or null this early in the month. */
  projected: number | null;
  onTrack: boolean;
  /** "4 of 12 move-ins in October". */
  line: string;
  /** "At this pace, 9 by Oct 31." or null. */
  projection: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A line drawn from fewer days than this is noise, so pace says nothing yet. */
export const MIN_DAYS_TO_PROJECT = 5;

function parseMonth(month: string): { year: number; index: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const index = Number(m[2]) - 1;
  if (index < 0 || index > 11) return null;
  return { year: Number(m[1]), index };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Pace for the goal's month as of `now`. Null when there is no goal row or the
 * goal is for a month other than `now`'s (pace only means something in the
 * month it measures).
 */
export function goalPace(goal: GoalState | null, now: Date): Pace | null {
  if (!goal) return null;
  const parsed = parseMonth(goal.month);
  if (!parsed) return null;
  if (parsed.year !== now.getUTCFullYear() || parsed.index !== now.getUTCMonth()) return null;

  const target = Math.max(0, Math.floor(goal.target));
  const actual = Math.max(0, Math.floor(goal.actual));
  const daysInMonth = new Date(Date.UTC(parsed.year, parsed.index + 1, 0)).getUTCDate();
  const day = now.getUTCDate();
  const daysLeft = daysInMonth - day;
  const monthName = MONTHS[parsed.index];
  const monthShort = monthName.slice(0, 3);

  const expectedByNow = target > 0 ? Math.floor((target * day) / daysInMonth) : 0;
  const projected = day >= MIN_DAYS_TO_PROJECT ? Math.round((actual * daysInMonth) / day) : null;
  const onTrack = target === 0 ? true : actual >= target || actual >= expectedByNow;

  const line =
    target > 0
      ? `${actual} of ${plural(target, "move-in")} in ${monthName}`
      : `${plural(actual, "move-in")} in ${monthName}`;
  const projection =
    target > 0 && actual < target && projected != null
      ? `At this pace, ${projected} by ${monthShort} ${daysInMonth}.`
      : null;

  return {
    monthName,
    monthShort,
    target,
    actual,
    day,
    daysInMonth,
    daysLeft,
    expectedByNow,
    projected,
    onTrack,
    line,
    projection,
  };
}
