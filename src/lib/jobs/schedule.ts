/**
 * Recurring work (MISSION.md s1).
 *
 * The handlers and the worker existed but nothing created the jobs, so the
 * detection loop would have sat inert. This is the missing half: recurring work
 * as data, seeded by the worker itself at the top of every run.
 *
 * One Vercel cron entry drives everything. Adding a recurring job is a line
 * here, not another entry in `vercel.json` — which matters because there are
 * already 23 of those and each one is a separate function, a separate cold
 * start and a separate thing to notice has stopped.
 *
 * Idempotent by construction: the dedupe key carries the time bucket, so
 * seeding twice inside one interval is a no-op and a worker that runs every
 * minute cannot pile up duplicates.
 */

import { enqueue } from "./queue";

export interface Recurring {
  queue: string;
  everyMs: number;
  payload?: unknown;
  /** Higher-attempt work that must not be abandoned quietly gets more tries. */
  maxAttempts?: number;
}

const MIN = 60_000;

export const RECURRING: Recurring[] = [
  // The waitlist only pays off if the notice goes out within minutes of a unit
  // freeing up, so this runs at the finest interval the worker supports.
  { queue: "pms.detect-inventory", everyMs: 2 * MIN },

  // Rent-roll diffs only change when somebody uploads a new PMS export, so
  // there is nothing to find between uploads. Fifteen minutes is well inside
  // any lifecycle mail window and keeps the worker free for real work.
  { queue: "pms.detect-events", everyMs: 15 * MIN },

  // RESPOND r8. The whole value is speed — the window opens at 10 minutes, so
  // checking every 5 keeps the worst case close to it. The daily email
  // sequence owns anything older than two hours.
  { queue: "respond.abandoned-rescue", everyMs: 5 * MIN },

  // Holds lapse on their own as far as availability is concerned; this only
  // keeps the operator view honest about which are still live.
  { queue: "holds.expire", everyMs: 5 * MIN },

  // RESPOND r5. Not the path — the submit routes answer a lead inline, inside
  // the minute, because that is the entire point. This is the safety net for the
  // case the inline path cannot cover: a submit request that died between
  // writing the lead and answering it. It sweeps for leads with no response at
  // all, so on a healthy system it finds nothing.
  { queue: "respond.speed-to-lead", everyMs: 5 * MIN },

  // RESPOND r6. The 1-hour reminder is the one that prevents a no-show, so the
  // sweep has to be finer than the window it is looking for: every 5 minutes
  // against a 15-minute window leaves room for a missed run without either
  // double-sending (the message-log key prevents that) or missing anybody.
  { queue: "respond.tour-reminders", everyMs: 5 * MIN },

  // RESPOND r7. Nothing is time-critical once the tour has already been missed,
  // and the message only goes out while it is still the same day where they are.
  { queue: "respond.tour-noshow", everyMs: 15 * MIN },

  // Retention. The detectors above complete ~800 times a day and each leaves a
  // `done` row; without this the table grows by ~290k rows a year forever.
  { queue: "jobs.prune", everyMs: 6 * 60 * MIN },

  // Proven Ads. Meta's archive is a daily-scale change, not a minute-scale
  // one. Twice a day keeps start/last-seen honest without spending the
  // worker's budget on a source that barely moves.
  { queue: "proven-ads.refresh", everyMs: 12 * 60 * MIN, maxAttempts: 3 },
];

/** Bucket a timestamp so every seed inside one interval shares a dedupe key. */
export function bucketOf(nowMs: number, everyMs: number): number {
  return Math.floor(nowMs / everyMs);
}

/**
 * Seed anything due. Returns how many jobs were actually created — zero is the
 * normal answer, because most runs fall inside a bucket already seeded.
 */
export async function ensureScheduled(nowMs: number = Date.now()): Promise<number> {
  let created = 0;
  for (const r of RECURRING) {
    const id = await enqueue({
      queue: r.queue,
      dedupeKey: `sched:${bucketOf(nowMs, r.everyMs)}`,
      payload: r.payload ?? {},
      maxAttempts: r.maxAttempts ?? 3,
    });
    if (id) created++;
  }
  return created;
}
