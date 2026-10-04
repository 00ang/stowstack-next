/**
 * Handler registry (MISSION.md s1).
 *
 * A queue name maps to exactly one handler. Anything claimed for a queue with
 * no handler is frozen rather than failed — an unregistered queue is a deploy
 * problem, and freezing keeps the work resumable once the handler ships.
 *
 * To add a queue: write the handler, register it here, and enqueue with that
 * name. A handler MUST:
 *   - be safe to run twice (the worker can die after the work and before the
 *     write, and the job will come back);
 *   - check `ctx.shouldYield()` between units and return `{ kind: "more" }`
 *     with a cursor rather than pushing through — that is the whole point;
 *   - throw `OutcomeUnknown` when it cannot tell whether an external side
 *     effect happened. Never guess, and never retry an unknown.
 */

import { db } from "@/lib/db";
import type { JobHandler } from "./types";
import { notifyWaitlist } from "@/lib/respond/waitlist";
import { expireHolds } from "@/lib/respond/hold";
import { textBackMissedCall } from "@/lib/respond/missed-call";
import { rescueAbandoned } from "@/lib/respond/abandoned";
import { respondToNewLead, unansweredLeads } from "@/lib/respond/speed-to-lead";
import { sweepNoShows, sweepReminders1, sweepReminders24 } from "@/lib/respond/tour";
import { reportMoveInToGoogle, reportMoveInToMeta } from "@/lib/attribution/write-back";
import {
  detectForFacility,
  detectInventoryForFacility,
  facilitiesWithHistory,
  facilitiesWithUnitMix,
} from "@/lib/events/detect";

/**
 * Resumability proof. Counts to `payload.to` in chunks, yielding whenever the
 * runner says time is short, and resumes from `cursor.at`.
 *
 * This exists so the resume path is exercised by something with no external
 * dependencies — the mechanism can be trusted before a real queue rides on it.
 * It does no I/O and is safe to leave registered.
 */
const chunkedCounter: JobHandler = async (ctx) => {
  const to = Number((ctx.payload as { to?: number } | null)?.to ?? 0);
  const chunk = Number((ctx.payload as { chunk?: number } | null)?.chunk ?? 100);
  let at = Number((ctx.cursor as { at?: number } | null)?.at ?? 0);

  while (at < to) {
    at = Math.min(to, at + chunk);
    if (at < to && ctx.shouldYield()) {
      return { kind: "more", cursor: { at }, progressDone: at };
    }
  }
  return { kind: "done", progressDone: at };
};

/**
 * Turn PMS snapshots into domain events, facility by facility (MISSION.md s7).
 *
 * Resumable on purpose, and this is the first real use of it: a portfolio
 * account is twenty facilities of up to 12,000 units each, and diffing them all
 * in one 300s invocation is exactly the shape of work that used to die halfway
 * with nothing to show. The cursor is the last facility id processed, so a
 * timeout costs one facility's work rather than all of it.
 */
const detectPmsEvents: JobHandler = async (ctx) => {
  let after = (ctx.cursor as { after?: string } | null)?.after;
  let emitted = Number((ctx.cursor as { emitted?: number } | null)?.emitted ?? 0);

  for (;;) {
    const batch = await facilitiesWithHistory(after, 25);
    if (batch.length === 0) return { kind: "done", progressDone: emitted };

    for (const facilityId of batch) {
      const res = await detectForFacility(facilityId);
      emitted += res.emitted;
      after = facilityId;
      if (ctx.shouldYield()) {
        return { kind: "more", cursor: { after, emitted }, progressDone: emitted };
      }
    }
  }
};

/**
 * Capture the unit mix and emit `inventory.available` (RESPOND r9 / CONVERT c6).
 *
 * Separate from `pms.detect-events` on purpose: this one is cheap, has no
 * dependency on rent-roll history, and wants to run often — the waitlist only
 * pays off if the notice goes out within minutes of a unit freeing up.
 */
const detectInventory: JobHandler = async (ctx) => {
  let after = (ctx.cursor as { after?: string } | null)?.after;
  let emitted = Number((ctx.cursor as { emitted?: number } | null)?.emitted ?? 0);

  for (;;) {
    const batch = await facilitiesWithUnitMix(after, 25);
    if (batch.length === 0) return { kind: "done", progressDone: emitted };

    for (const facilityId of batch) {
      emitted += (await detectInventoryForFacility(facilityId)).emitted;
      after = facilityId;
      if (ctx.shouldYield()) {
        return { kind: "more", cursor: { after, emitted }, progressDone: emitted };
      }
    }
  }
};

/**
 * Retention (added 2026-09-04 after watching the queue in production).
 *
 * The recurring detectors complete cleanly ~800 times a day, and every one left
 * a `done` row behind — about 290,000 rows a year, growing with each recurring
 * job added. Completed work is worth keeping long enough to debug an incident
 * and no longer.
 *
 * Deletes in bounded batches and yields between them: a single unbounded DELETE
 * would hold a long transaction against the same table the worker is claiming
 * from, which is how a tidy-up job takes down the thing it is tidying.
 */
const RETAIN_DAYS = 7;
const PRUNE_BATCH = 2_000;

const pruneJobs: JobHandler = async (ctx) => {
  let removed = Number((ctx.cursor as { removed?: number } | null)?.removed ?? 0);

  for (;;) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      DELETE FROM jobs WHERE id IN (
        SELECT id FROM jobs
        WHERE status = 'done' AND finished_at < now() - (${RETAIN_DAYS}::int * interval '1 day')
        LIMIT ${PRUNE_BATCH}
      ) RETURNING id
    `;
    removed += rows.length;
    if (rows.length < PRUNE_BATCH) return { kind: "done", progressDone: removed };
    if (ctx.shouldYield()) return { kind: "more", cursor: { removed }, progressDone: removed };
  }
};

/**
 * RESPOND r9 — text the waitlist when a unit frees up.
 *
 * The first subscriber with a real handler. Everything upstream of it already
 * existed: the PMS diff, the event, the fan-out, the queue's retry and freeze
 * semantics. This just decides what to say and to whom.
 */
const waitlistNotify: JobHandler = async (ctx) => {
  const p = (ctx.payload ?? {}) as {
    eventId?: string; facilityId?: string; sizeLabel?: string | null;
    available?: number; streetRate?: number | null;
  };
  if (!p.eventId || !p.facilityId) {
    // A malformed payload is a bug upstream, not something to retry into.
    return { kind: "unknown", reason: "waitlist job missing eventId or facilityId" };
  }
  const res = await notifyWaitlist({
    eventId: p.eventId,
    facilityId: p.facilityId,
    sizeLabel: p.sizeLabel ?? null,
    available: Number(p.available ?? 1),
    streetRate: p.streetRate == null ? null : Number(p.streetRate),
  });
  return { kind: "done", progressDone: res.sent };
};

/**
 * Mark lapsed holds (MISSION.md s10). Availability already ignores expired
 * holds, so this is bookkeeping for the operator view rather than correctness —
 * which is precisely why it belongs on the queue and not in the request path.
 */
const expireStaleHolds: JobHandler = async () => ({
  kind: "done",
  progressDone: await expireHolds(),
});

/**
 * Durable fallback for r3. The inline send on the status webhook is the path;
 * this only runs when that failed, so it must stay idempotent — the dedupe key
 * on the message log is what stops it texting somebody a second time.
 */
const missedCallTextBack: JobHandler = async (ctx) => {
  const callSid = (ctx.payload as { callSid?: string } | null)?.callSid;
  if (!callSid) return { kind: "unknown", reason: "missed-call job has no callSid" };
  const res = await textBackMissedCall(callSid);
  return { kind: "done", progressDone: res.sent ? 1 : 0 };
};

/**
 * RESPOND r8 — text somebody who abandoned a rental part-way through.
 *
 * Runs often because the value is entirely in the speed; the existing daily
 * email sequence in `/api/cron/process-recovery` owns everything after two
 * hours and is untouched by this.
 */
const abandonedRescue: JobHandler = async () => ({
  kind: "done",
  progressDone: (await rescueAbandoned()).sent,
});

/**
 * RESPOND r5 — durable fallback for the inline speed-to-lead response.
 *
 * Two jobs in one: a `leadId` payload retries one specific lead whose inline
 * send failed, and no payload sweeps for leads that were never answered at all
 * — which catches the case the inline path cannot, a submit request that died
 * between writing the lead and answering it.
 */
const speedToLead: JobHandler = async (ctx) => {
  const leadId = (ctx.payload as { leadId?: string } | null)?.leadId;
  if (leadId) {
    const res = await respondToNewLead(leadId);
    return { kind: "done", progressDone: res.acked || res.alerted ? 1 : 0 };
  }

  let answered = 0;
  for (const lead of await unansweredLeads()) {
    const res = await respondToNewLead(lead.id);
    if (res.acked || res.alerted) answered++;
  }
  return { kind: "done", progressDone: answered };
};

/**
 * RESPOND r6 — tour reminders.
 *
 * Both windows in one job: they read the same table, and splitting them would
 * double the queue traffic to save nothing. Each reminder has its own dedupe key
 * on the message log, so the 24-hour and 1-hour messages are independent.
 */
const tourReminders: JobHandler = async () => {
  const a = await sweepReminders24();
  const b = await sweepReminders1();
  return { kind: "done", progressDone: a.sent + b.sent };
};

/**
 * RESPOND r7 — no-show recovery.
 *
 * Marks the tours nobody attended and offers to rebook, same day only. Slower
 * than the reminders because nothing is time-critical once the appointment has
 * already been missed.
 */
const tourNoShows: JobHandler = async () => ({
  kind: "done",
  progressDone: (await sweepNoShows()).sent,
});

export const HANDLERS: Record<string, JobHandler> = {
  "respond.tour-reminders": tourReminders,
  "respond.tour-noshow": tourNoShows,
  "respond.speed-to-lead": speedToLead,
  "demo.chunked": chunkedCounter,
  "respond.abandoned-rescue": abandonedRescue,
  "respond.missed-call": missedCallTextBack,
  "holds.expire": expireStaleHolds,
  "respond.waitlist-notify": waitlistNotify,
  "pms.detect-events": detectPmsEvents,
  "pms.detect-inventory": detectInventory,
  "jobs.prune": pruneJobs,
  // MISSION.md s12 — subscribers to `lead.moved_in`. Retry-safe: each report
  // carries the same event/order id on every attempt and the platforms drop
  // the duplicate, so a timeout is retried rather than frozen.
  "prove.meta-conversion": reportMoveInToMeta,
  "prove.google-conversion": reportMoveInToGoogle,
};
