/**
 * Recurring work (MISSION.md s1).
 *
 * The handlers and the worker existed but nothing created the jobs, so the
 * detection loop would have sat inert. This is the missing half: recurring work
 * as data, seeded by the worker itself whenever it wakes.
 *
 * One Vercel cron entry drives everything. Adding a recurring job is a line
 * here, not another entry in `vercel.json` — which matters because there are
 * already 23 of those and each one is a separate function, a separate cold
 * start and a separate thing to notice has stopped.
 *
 * Idempotent by construction: the dedupe key carries the time bucket, so
 * seeding twice inside one interval is a no-op and a worker that runs every
 * minute cannot pile up duplicates.
 *
 * What is NOT here any more (2026-09-23). This list used to hold sweeps on 2-,
 * 5- and 15-minute clocks: waitlist detection, abandoned-rental rescue, hold
 * expiry, tour reminders and no-shows, the speed-to-lead net. Every one of them
 * was looking for something whose due time was already known the moment it was
 * created — an upload lands, a tour is booked, a hold is placed, a form is
 * half-filled. Polling for it kept Neon awake 24 hours a day to find, almost
 * always, nothing, and that ran out the month's compute and took the product
 * down. Now the thing that creates the work enqueues it for the moment it falls
 * due (see `schedule*` in src/lib/respond and src/lib/events/detect.ts), and the
 * alarm (./alarm) wakes the worker for it.
 *
 * What is left is backstops: the case where the producer could not enqueue — a
 * request that died between writing its row and scheduling its follow-up — and
 * rows that existed before this change shipped.
 */

import { enqueue } from "./queue";

export interface Recurring {
  queue: string;
  everyMs: number;
  payload?: unknown;
  /** Higher-attempt work that must not be abandoned quietly gets more tries. */
  maxAttempts?: number;
}

const HOUR = 60 * 60_000;

/**
 * All on the same 6-hour clock on purpose: the buckets share boundaries (00, 06,
 * 12 and 18 UTC), so the database wakes once for all of them rather than once
 * for each. A new backstop should join this clock unless it has a reason not to.
 */
const BACKSTOP_MS = 6 * HOUR;

export const RECURRING: Recurring[] = [
  // Uploads trigger detection directly (scheduleDetection). This catches an
  // import path that writes PMS data without calling it — there are several.
  { queue: "pms.detect-inventory", everyMs: BACKSTOP_MS },
  { queue: "pms.detect-events", everyMs: BACKSTOP_MS },

  // Each hold schedules its own expiry. Availability already ignores expired
  // holds, so this was only ever bookkeeping for the operator view.
  { queue: "holds.expire", everyMs: BACKSTOP_MS },

  // RESPOND r5. Each lead schedules its own check two minutes after it lands;
  // this sweep answers anything left unanswered in the last day.
  { queue: "respond.speed-to-lead", everyMs: BACKSTOP_MS },

  // RESPOND r6/r7. Re-derives the reminder and no-show jobs for every live tour.
  // Idempotent per tour and time, so for a tour that already has them it is a
  // no-op; for one booked before this shipped, it is how they get scheduled.
  { queue: "respond.tour-schedule", everyMs: BACKSTOP_MS },

  // Retention. Completed jobs are worth keeping for a week of debugging.
  { queue: "jobs.prune", everyMs: BACKSTOP_MS },

  // RESPOND r8 (abandoned rescue) has no backstop, deliberately: its window
  // closes two hours after the form was touched, so a sweep every six hours
  // would find nothing it is still allowed to send.
];

/** Bucket a timestamp so every seed inside one interval shares a dedupe key. */
export function bucketOf(nowMs: number, everyMs: number): number {
  return Math.floor(nowMs / everyMs);
}

/**
 * Seed anything due, plus the next run of each, parked at its bucket's start.
 * Returns how many jobs were actually created — zero is the normal answer,
 * because most wakes fall inside a bucket already seeded.
 *
 * The parked next run is what keeps the schedule alive: the worker only wakes
 * when the alarm says a job is due, so a recurring job that did not exist yet
 * could never wake it. Enqueueing the next one sets the alarm for it.
 */
export async function ensureScheduled(nowMs: number = Date.now()): Promise<number> {
  let created = 0;
  for (const r of RECURRING) {
    const bucket = bucketOf(nowMs, r.everyMs);
    for (const b of [bucket, bucket + 1]) {
      const id = await enqueue({
        queue: r.queue,
        dedupeKey: `sched:${b}`,
        payload: r.payload ?? {},
        maxAttempts: r.maxAttempts ?? 3,
        // This bucket's run goes now (if it has not happened); the next waits.
        runAfter: b === bucket ? new Date(nowMs) : new Date(b * r.everyMs),
      });
      if (id) created++;
    }
  }
  return created;
}
