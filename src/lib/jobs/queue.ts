/**
 * Durable job queue — the database half (MISSION.md s1).
 *
 * Postgres-backed on purpose. This repo already runs on Neon and Vercel cron;
 * adding a broker would add a service to operate, a second failure domain and a
 * second place for credentials to rot, to buy semantics `FOR UPDATE SKIP
 * LOCKED` already gives us. If throughput ever outgrows a table, the seam is
 * this file.
 */

import { db } from "@/lib/db";
import { ringAt } from "./alarm";
import {
  type JobRow,
  type JobStatus,
  backoffMs,
  errorText,
  leaseUntil,
} from "./types";

/** How long a claimed job stays claimed before another worker may take it. */
export const LEASE_MS = 5 * 60_000;

export interface EnqueueInput {
  queue: string;
  payload?: unknown;
  /** Unique per queue. Enqueueing the same key twice is a no-op, not a duplicate. */
  dedupeKey?: string;
  /** Fair-share bucket — usually an organization or facility id. */
  tenantKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
  progressTotal?: number;
}

/**
 * Add work. Idempotent when `dedupeKey` is given.
 *
 * ON CONFLICT DO NOTHING rather than an upsert: if the job is already queued or
 * already ran, re-enqueueing must not resurrect it or reset its cursor. The
 * caller gets null and should treat that as "already handled".
 *
 * Rings the alarm after the insert commits, never before: the order is what
 * lets `rearm` promise that no enqueue is lost (see ./alarm).
 */
export async function enqueue(input: EnqueueInput): Promise<string | null> {
  const runAfter = input.runAfter ?? new Date();
  const rows = await db.$queryRaw<{ id: string }[]>`
    INSERT INTO jobs (queue, payload, dedupe_key, tenant_key, run_after, max_attempts, progress_total)
    VALUES (
      ${input.queue},
      ${JSON.stringify(input.payload ?? {})}::jsonb,
      ${input.dedupeKey ?? null},
      ${input.tenantKey ?? null},
      ${runAfter},
      ${input.maxAttempts ?? 5},
      ${input.progressTotal ?? null}
    )
    ON CONFLICT (queue, dedupe_key) DO NOTHING
    RETURNING id
  `;
  const id = rows[0]?.id ?? null;
  if (id) await ringAt(runAfter);
  return id;
}

/**
 * The earliest moment the worker has anything to do: a pending job coming due,
 * or a running job's lease running out (the crash path). Null when the queue is
 * empty. This is what the alarm is set to after every pass.
 */
export async function nextDueAt(): Promise<Date | null> {
  const rows = await db.$queryRaw<{ at: Date | null }[]>`
    SELECT LEAST(
      (SELECT min(run_after) FROM jobs WHERE status = 'pending'),
      (SELECT min(lease_expires_at) FROM jobs WHERE status = 'running')
    ) AS at
  `;
  const at = rows[0]?.at;
  return at ? new Date(at) : null;
}

/**
 * Claim one job.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes concurrent workers safe: two workers
 * racing take different rows instead of blocking or double-running one.
 *
 * The ordering is the fair-share rule (MISSION.md s2). Straight FIFO lets one
 * tenant with a 50,000-piece drop occupy every worker until it drains, which is
 * exactly the "one portfolio customer's Tuesday makes fifty customers' Wednesday
 * late" failure. Ordering by how much work a tenant already has running gives
 * every tenant a turn, while still letting one burst into idle capacity when
 * nobody else is waiting.
 */
export async function claim(workerId: string, queues?: string[]): Promise<JobRow | null> {
  const lease = leaseUntil(Date.now(), LEASE_MS);
  const filter = queues?.length ? queues : null;

  const rows = await db.$queryRaw<JobRow[]>`
    WITH inflight AS (
      SELECT tenant_key, count(*)::int AS n
      FROM jobs
      WHERE status = 'running'
      GROUP BY tenant_key
    ),
    candidate AS (
      SELECT j.id
      FROM jobs j
      LEFT JOIN inflight f ON f.tenant_key IS NOT DISTINCT FROM j.tenant_key
      WHERE j.status = 'pending'
        AND j.run_after <= now()
        AND (${filter}::text[] IS NULL OR j.queue = ANY(${filter}::text[]))
      ORDER BY coalesce(f.n, 0) ASC, j.run_after ASC, j.created_at ASC
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    )
    UPDATE jobs
    SET status = 'running',
        locked_by = ${workerId},
        lease_expires_at = ${lease},
        updated_at = now()
    WHERE id IN (SELECT id FROM candidate)
    RETURNING *
  `;
  return rows[0] ?? null;
}

/**
 * Return jobs whose lease expired to the pending pool.
 *
 * This is the crash path. A worker killed mid-pass leaves a row `running`
 * forever; without this the job is lost silently, which is worse than failing.
 * The attempt is counted, so a job that reliably kills its worker eventually
 * lands in `failed` instead of looping.
 */
export async function reclaimExpired(limit = 50): Promise<number> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE jobs
    SET status = 'pending',
        attempts = attempts + 1,
        locked_by = NULL,
        lease_expires_at = NULL,
        run_after = now(),
        last_error = coalesce(last_error, 'lease expired — worker died mid-pass'),
        updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < now()
      ORDER BY lease_expires_at ASC
      LIMIT ${limit}
    )
    RETURNING id
  `;
  return rows.length;
}

/** Persist progress and hand the job back to the pool to be resumed. */
export async function saveProgress(id: string, cursor: unknown, progressDone?: number): Promise<void> {
  await db.$executeRaw`
    UPDATE jobs
    SET status = 'pending',
        cursor = ${JSON.stringify(cursor ?? null)}::jsonb,
        progress_done = coalesce(${progressDone ?? null}::int, progress_done),
        locked_by = NULL,
        lease_expires_at = NULL,
        run_after = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function complete(id: string, progressDone?: number): Promise<void> {
  await db.$executeRaw`
    UPDATE jobs
    SET status = 'done',
        progress_done = coalesce(${progressDone ?? null}::int, progress_done),
        locked_by = NULL,
        lease_expires_at = NULL,
        finished_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

export async function retryLater(id: string, attempt: number, err: unknown): Promise<void> {
  const delay = backoffMs(attempt);
  await db.$executeRaw`
    UPDATE jobs
    SET status = 'pending',
        attempts = ${attempt},
        last_error = ${errorText(err)},
        locked_by = NULL,
        lease_expires_at = NULL,
        run_after = now() + (${delay}::int * interval '1 millisecond'),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

/** Terminal states. `frozen` is never retried automatically — a human decides. */
export async function terminate(
  id: string,
  status: Extract<JobStatus, "failed" | "frozen">,
  attempt: number,
  err: unknown
): Promise<void> {
  await db.$executeRaw`
    UPDATE jobs
    SET status = ${status},
        attempts = ${attempt},
        last_error = ${errorText(err)},
        locked_by = NULL,
        lease_expires_at = NULL,
        finished_at = now(),
        updated_at = now()
    WHERE id = ${id}::uuid
  `;
}

/** Operator view — what /admin needs to answer "is anything stuck". */
export async function queueStats(): Promise<{ queue: string; status: string; n: number }[]> {
  return db.$queryRaw<{ queue: string; status: string; n: number }[]>`
    SELECT queue, status, count(*)::int AS n
    FROM jobs
    WHERE status <> 'done' OR finished_at > now() - interval '24 hours'
    GROUP BY queue, status
    ORDER BY queue, status
  `;
}
