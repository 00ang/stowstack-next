/**
 * The worker's alarm clock.
 *
 * The worker ticks every minute, but Postgres is Neon: a compute that sees no
 * query for five minutes scales to zero, and one that sees a query every minute
 * never does. Asking the jobs table "is anything due?" once a minute kept the
 * database awake around the clock, burned the month's compute allowance in
 * under three weeks, and took the whole product down with it (2026-09-20).
 *
 * So the question is asked of Redis instead. This key holds one number: the
 * earliest time any job could be due. The worker reads it (an HTTP call to
 * Upstash, no Postgres connection) and goes back to sleep unless it has passed.
 *
 * The one invariant: the alarm is never LATER than the earliest due job. Early
 * is harmless — the worker wakes, finds nothing, and re-arms. Late is a lost
 * job. Everything below exists to keep that invariant under concurrency:
 *
 *   - Writers only ever lower it (`ZADD LT`), so two racing writers keep the
 *     earlier time, whatever order they land in.
 *   - The worker re-arms in three steps — reset, read Postgres, ring — so a job
 *     enqueued while it was re-arming is either visible to its read or rings
 *     after its reset. See `rearm`.
 *
 * Postgres stays the only source of truth. Redis being wrong costs at most an
 * unneeded wake (early) or, if a write to it failed, a delay until the next
 * pass (never more than MAX_SLEEP_MS). Redis being absent or down fails open:
 * the worker behaves as it did before this file existed.
 */

import { Redis } from "@upstash/redis";

const KEY = "jobs:alarm";
/** A sorted set with one member, because ZADD LT is an atomic "lower to". */
const MEMBER = "next";

/**
 * The longest the worker may go without looking at Postgres, however quiet it
 * is. Heals a ring that failed to reach Redis, and bounds how stale the recurring
 * backstops can get.
 */
export const MAX_SLEEP_MS = 6 * 60 * 60_000;

/**
 * How soon to try again when a pass could not read Postgres. Long enough not to
 * hammer a database that is down, short enough that queued work survives it.
 */
export const RETRY_MS = 10 * 60_000;

let client: Redis | null | undefined;

function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** Test seam. */
export function setAlarmClient(r: Redis | null | undefined): void {
  client = r;
}

/**
 * Make sure the worker looks at Postgres no later than `at`.
 *
 * Called after every enqueue, so it must never throw into a request: a failed
 * ring is logged and left for the next pass or MAX_SLEEP_MS to pick up.
 */
export async function ringAt(at: Date | number): Promise<void> {
  const r = redis();
  if (!r) return;
  const score = typeof at === "number" ? at : at.getTime();
  try {
    await r.zadd(KEY, { lt: true }, { score, member: MEMBER });
  } catch (error) {
    console.warn("[jobs/alarm] ring failed; the next pass will catch it:", error);
  }
}

/**
 * When the alarm goes off, or null when that is unknown — Redis not configured,
 * unreachable, or never armed (the first tick after a deploy). Unknown means
 * wake: an idle pass costs one query, a missed one costs a job.
 */
export async function alarmAt(): Promise<number | null> {
  const r = redis();
  if (!r) return null;
  try {
    const score = await r.zscore(KEY, MEMBER);
    return score == null ? null : Number(score);
  } catch (error) {
    console.warn("[jobs/alarm] read failed; waking to be safe:", error);
    return null;
  }
}

/**
 * Set the alarm for the next time anything is due, after a pass.
 *
 * Why three steps and not "read Postgres, then set": a job enqueued between the
 * read and the set would ring first (a no-op — the alarm is already in the past)
 * and then be overwritten by a time that does not include it. Lost.
 *
 * Resetting first closes that window. Any enqueue that commits before the read
 * is in the read. Any that commits after it rings after the reset, and ZADD LT
 * keeps its earlier time over ours. There is no third case.
 *
 * The reset goes to MAX_SLEEP_MS, not somewhere nearer: the ring can only lower
 * the alarm, so wherever the reset lands is the longest the worker can sleep. If
 * the pass dies between reset and ring, that is also the worst-case delay.
 */
export async function rearm(
  nextDue: () => Promise<Date | null>,
  now: number = Date.now()
): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    // A plain ZADD: this is the one write allowed to move the alarm later.
    await r.zadd(KEY, { score: now + MAX_SLEEP_MS, member: MEMBER });
  } catch (error) {
    console.warn("[jobs/alarm] reset failed; leaving the alarm where it was:", error);
    return;
  }

  let due: Date | null;
  try {
    due = await nextDue();
  } catch {
    // Postgres could not answer (it is down, say). Try again in RETRY_MS rather
    // than every minute against a dead database, or not for six hours.
    await ringAt(now + RETRY_MS);
    return;
  }
  await ringAt(Math.min(due?.getTime() ?? Infinity, now + MAX_SLEEP_MS));
}
