/**
 * Rescue diagnostics whose audit never generated.
 *
 * `/api/diagnostic-intake` creates the facility at `diagnostic_submitted` and
 * fires audit generation without waiting for it. If that call dies, the
 * prospect was promised an audit that is never coming. This used to be an
 * hourly cron, `/api/cron/retry-diagnostic-audits`, which woke the database
 * 24 times a day to find, almost always, nothing.
 *
 * Now the intake queues one check for the moment its facility would count as
 * stuck (`scheduleDiagnosticRetry`). If generation already happened, the check
 * finds nothing. If it did not, the check retries, and a failed retry is
 * retried by the queue with backoff. A six-hourly sweep catches anything older
 * that slipped past, at the hourly cron's old pace of five per run.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { selfBaseUrl } from "@/lib/self-url";

/** A submission with no audit after this long is stuck. */
export const STUCK_AFTER_MINUTES = 10;

/**
 * How old a submission must be before the six-hourly sweep touches it. Past the
 * span of the per-facility job's own retries, so the two never generate an
 * audit for the same facility at the same time.
 */
export const SWEEP_AFTER_MINUTES = 120;

/** Per sweep — what the hourly cron took, to avoid overwhelming the API. */
export const SWEEP_LIMIT = 5;

/**
 * Past this, a stuck submission is left for a person (the Generate Audit button
 * in /admin/audits) rather than retried automatically. A successful generation
 * emails the prospect "your diagnostic is ready", and that email arriving days
 * or weeks after they asked is worse than a founder following up by hand.
 */
export const AUTO_RETRY_MAX_HOURS = 48;

export interface RetryResult {
  stuck: number;
  retried: number;
  /** No diagnostic answers stored on the facility — nothing to retry with. */
  skipped: number;
  /** Generation was asked for and did not succeed. Worth trying again. */
  failed: string[];
}

/**
 * Retry audit generation for stuck submissions — one facility, or the oldest
 * `limit` past `olderThanMinutes`. Never throws for a single facility's
 * failure; the caller decides whether `failed` is worth a retry.
 */
export async function retryStuckDiagnostics(opts: {
  facilityId?: string;
  olderThanMinutes?: number;
  limit?: number;
} = {}): Promise<RetryResult> {
  const result: RetryResult = { stuck: 0, retried: 0, skipped: 0, failed: [] };

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !process.env.ANTHROPIC_API_KEY) {
    console.warn("[retry-diagnostic-audits] Missing ADMIN_SECRET or ANTHROPIC_API_KEY; skipping");
    return result;
  }

  const appUrl = selfBaseUrl();

  const olderThan = new Date(Date.now() - (opts.olderThanMinutes ?? STUCK_AFTER_MINUTES) * 60_000);
  const newerThan = new Date(Date.now() - AUTO_RETRY_MAX_HOURS * 60 * 60_000);
  const stuck = await db.facilities.findMany({
    where: {
      ...(opts.facilityId ? { id: opts.facilityId } : {}),
      pipeline_status: "diagnostic_submitted",
      shared_audit_slug: null,
      created_at: { lt: olderThan, gt: newerThan },
    },
    select: { id: true, notes: true },
    take: opts.limit ?? SWEEP_LIMIT,
  });
  result.stuck = stuck.length;

  for (const facility of stuck) {
    // The pre-mapped diagnosticJson was stored in notes at intake time.
    let diagnosticJson = null;
    if (facility.notes) {
      try {
        diagnosticJson = JSON.parse(facility.notes).diagnosticJson || null;
      } catch {
        // Notes not JSON — nothing to retry with.
      }
    }
    if (!diagnosticJson) {
      console.error(`[retry-diagnostic-audits] No diagnosticJson in notes for facility ${facility.id}, skipping`);
      result.skipped++;
      continue;
    }

    try {
      const res = await fetch(`${appUrl}/api/audit-generate-diagnostic`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminSecret },
        body: JSON.stringify({ diagnosticJson, facilityId: facility.id }),
      });
      if (res.ok) {
        result.retried++;
      } else {
        console.error(`[retry-diagnostic-audits] Audit generation returned ${res.status} for facility ${facility.id}`);
        result.failed.push(facility.id);
      }
    } catch (err) {
      console.error(`[retry-diagnostic-audits] Failed to retry facility ${facility.id}:`, err);
      result.failed.push(facility.id);
    }
  }

  if (!opts.facilityId && stuck.length > 0) {
    await db.activity_log.create({
      data: {
        type: "cron_completed",
        detail: `[retry-diagnostic-audits] Found ${stuck.length} stuck, retried ${result.retried}`,
        meta: { stuck: stuck.length, retried: result.retried },
      },
    }).catch((err) => console.error("[activity_log] Cron log failed:", err));
  }

  return result;
}

/**
 * Queue the stuck-check for a submission that was just made, for the moment it
 * would count as stuck. One per facility.
 */
export async function scheduleDiagnosticRetry(facilityId: string): Promise<void> {
  await enqueue({
    queue: "audits.retry-diagnostic",
    payload: { facilityId },
    dedupeKey: `diag:${facilityId}`,
    // A minute past the threshold: the check compares against created_at.
    runAfter: new Date(Date.now() + (STUCK_AFTER_MINUTES + 1) * 60_000),
  });
}
