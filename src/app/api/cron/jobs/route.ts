import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { HANDLERS } from "@/lib/jobs/handlers";
import { runJobs } from "@/lib/jobs/runner";
import { nextDueAt, queueStats } from "@/lib/jobs/queue";
import { ensureScheduled } from "@/lib/jobs/schedule";
import { alarmAt, rearm } from "@/lib/jobs/alarm";

/**
 * The worker (MISSION.md s1).
 *
 * Ticks every minute, but only touches Postgres when the alarm says something
 * is due (see src/lib/jobs/alarm.ts). Most ticks end after one Redis read, which
 * is what lets Neon scale to zero between jobs instead of running 24/7.
 *
 * When it does wake, it drains what it can inside its budget. Nothing here
 * needs to finish: a job that cannot complete in one pass persists its cursor
 * and the next minute's invocation resumes it.
 *
 * GET is the trigger, matching every other cron route in this repo — Vercel
 * Cron issues GET, so a POST-only worker would simply never run.
 * `GET ?stats=1` is the read-only view and does no work.
 */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Stop claiming with time left to finish the job in hand and write its result. */
const BUDGET_MS = 300_000;
const HEADROOM_MS = 30_000;

async function handle(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Read-only inspection: what is queued, running or stuck.
  if (new URL(req.url).searchParams.get("stats") === "1") {
    try {
      const at = await alarmAt();
      return NextResponse.json({
        ok: true,
        stats: await queueStats(),
        alarmAt: at == null ? null : new Date(at).toISOString(),
      });
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  }

  // Nothing due: answer from Redis and leave the database asleep. Unknown (no
  // Redis, or never armed) counts as due, so this can only ever skip idle work.
  const at = await alarmAt();
  if (at != null && at > Date.now()) {
    return NextResponse.json({ ok: true, idle: true, alarmAt: new Date(at).toISOString() });
  }

  // One id per invocation so a stuck lease traces back to a specific run.
  const workerId = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Recurring work is seeded here rather than from its own cron entries: one
    // schedule, one function, one thing to watch. Idempotent per time bucket.
    const scheduled = await ensureScheduled();

    const summary = await runJobs({
      workerId,
      budgetMs: BUDGET_MS,
      headroomMs: HEADROOM_MS,
      handlers: HANDLERS,
    });
    return NextResponse.json({ ok: true, workerId, scheduled, ...summary });
  } catch (error) {
    // A throw here means the queue itself is broken (DB unreachable, bad SQL),
    // not that a job failed — jobs handle their own outcomes inside runJobs.
    console.error("[cron/jobs] runner failed:", error);
    return NextResponse.json(
      { ok: false, workerId, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  } finally {
    // Set the alarm for whatever is due next — including work this pass left
    // behind. If the database is what failed, this backs off to RETRY_MS rather
    // than failing against it every minute.
    await rearm(nextDueAt);
  }
}

export const GET = handle;
export const POST = handle;
