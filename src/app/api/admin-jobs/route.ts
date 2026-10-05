import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminKey } from "@/lib/api-helpers";
import { ringAt } from "@/lib/jobs/alarm";

/**
 * Operator window onto the job queue (MISSION.md s1's last acceptance item).
 *
 * The queue, the worker and the schedule all shipped with no way to see them —
 * `/api/cron/jobs?stats=1` needs the cron secret, which an operator does not
 * have. "Is anything stuck?" is the question this answers.
 *
 * `frozen` is the row that matters. A frozen job is one whose outcome is
 * UNKNOWN — a vendor may or may not have acted — so it is deliberately never
 * retried automatically. It waits for a human, and this is where the human
 * finds it.
 */
export const dynamic = "force-dynamic";

interface StatRow { queue: string; status: string; n: number; oldest: Date | null }
interface JobRow {
  id: string; queue: string; status: string; attempts: number; max_attempts: number;
  tenant_key: string | null; progress_done: number; progress_total: number | null;
  last_error: string | null; run_after: Date; updated_at: Date; locked_by: string | null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  try {
    const stats = await db.$queryRaw<StatRow[]>`
      SELECT queue, status, count(*)::int AS n, min(created_at) AS oldest
      FROM jobs
      WHERE status <> 'done' OR finished_at > now() - interval '24 hours'
      GROUP BY queue, status
      ORDER BY queue, status
    `;

    // Anything needing a decision, newest first: frozen (outcome unknown) and
    // failed (exhausted its attempts).
    const attention = await db.$queryRaw<JobRow[]>`
      SELECT id, queue, status, attempts, max_attempts, tenant_key,
             progress_done, progress_total, last_error, run_after, updated_at, locked_by
      FROM jobs
      WHERE status IN ('frozen','failed')
      ORDER BY updated_at DESC
      LIMIT 50
    `;

    const running = await db.$queryRaw<JobRow[]>`
      SELECT id, queue, status, attempts, max_attempts, tenant_key,
             progress_done, progress_total, last_error, run_after, updated_at, locked_by
      FROM jobs
      WHERE status = 'running'
      ORDER BY updated_at ASC
      LIMIT 25
    `;

    // A lease in the past means the worker died mid-pass. The next run reclaims
    // it, so this is informational rather than an alarm — but a number that
    // stays high says the worker itself is unhealthy.
    const [{ n: expired }] = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM jobs
      WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < now()
    `;

    const [{ n: recent }] = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM jobs
      WHERE status = 'done' AND finished_at > now() - interval '1 hour'
    `;

    return NextResponse.json({ stats, attention, running, expiredLeases: expired, doneLastHour: recent });
  } catch (error) {
    console.error("[admin-jobs] failed:", error);
    return NextResponse.json({ error: "Failed to read the job queue" }, { status: 500 });
  }
}

/**
 * Release a frozen or failed job back to the queue.
 *
 * Deliberately manual. Freezing exists because retrying an unknown outcome can
 * mail a second postcard and charge for it twice — so the decision to try again
 * is a person's, made once they know what actually happened at the vendor.
 * Attempts reset so the job gets a real run rather than immediately re-failing.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "A job id is required" }, { status: 400 });
  }

  try {
    const rows = await db.$queryRaw<{ id: string }[]>`
      UPDATE jobs
      SET status = 'pending', attempts = 0, locked_by = NULL, lease_expires_at = NULL,
          run_after = now(), last_error = NULL, finished_at = NULL, updated_at = now()
      WHERE id = ${id}::uuid AND status IN ('frozen','failed')
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: "No frozen or failed job with that id" }, { status: 404 });
    }
    // The worker only looks at Postgres when the alarm says so.
    await ringAt(new Date());
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (error) {
    console.error("[admin-jobs] retry failed:", error);
    return NextResponse.json({ error: "Failed to release the job" }, { status: 500 });
  }
}
