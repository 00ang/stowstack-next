/**
 * Abandoned-rental rescue by text (MISSION.md RESPOND r8).
 *
 * ⚠️ There is already a recovery system: `/api/cron/process-recovery` is 361
 * lines of multi-step EMAIL recovery driven by `recovery_status`,
 * `recovery_sent_count` and `next_recovery_at`, and it runs daily. This does not
 * replace it and does not touch it.
 *
 * What it adds is the leg that system cannot cover: a text within minutes. Email
 * on a daily cron is the right tool for a nurture sequence and the wrong one for
 * somebody who half-filled a rental form ten minutes ago and is, right now,
 * looking at a competitor's site.
 *
 * Deliberately no new column: `message_log` already records exactly what we sent
 * and when, so `dedupeKey` is both the idempotency guard and the "have we
 * rescued this lead" answer.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { t, type Language } from "@/lib/messaging/copy";
import { languagesFor } from "@/lib/messaging/language";
import { sendMessage } from "@/lib/messaging/send";
import { normalisePhone } from "@/lib/messaging/types";

/**
 * The window.
 *
 * Ten minutes is late enough that they have genuinely stopped rather than
 * stepped away mid-form, and two hours is the point at which "you were just
 * looking at this" stops being true and starts being creepy. Outside the window
 * the email sequence owns the lead.
 */
export const RESCUE_AFTER_MINUTES = 10;
export const RESCUE_BEFORE_MINUTES = 120;

/**
 * Enqueue the rescue sweep for the moment this lead becomes rescuable.
 *
 * Called on every partial-lead write that carries a phone, and deduped per lead,
 * so the first such write schedules it and the rest are no-ops. The job runs
 * `rescueAbandoned`, which re-checks everything at fire time — a lead that
 * finished the form in the meantime is simply not found.
 *
 * This replaced a sweep every five minutes, which kept the database awake
 * around the clock (see src/lib/jobs/alarm.ts). `createdAt` should be the row's
 * own timestamp: the sweep measures the window in database time, and so does
 * the claim, so the two agree. The extra minute is for callers that pass a
 * client clock.
 */
export async function scheduleRescue(lead: {
  id: string;
  createdAt: Date;
  facilityId?: string | null;
}): Promise<void> {
  const due = new Date(lead.createdAt).getTime() + (RESCUE_AFTER_MINUTES + 1) * 60_000;
  await enqueue({
    queue: "respond.abandoned-rescue",
    dedupeKey: `rescue:${lead.id}`,
    tenantKey: lead.facilityId ?? undefined,
    runAfter: new Date(Math.max(due, Date.now())),
  });
}

export interface AbandonedLead {
  id: string;
  facility_id: string | null;
  facility_name: string | null;
  name: string | null;
  phone: string | null;
  unit_size: string | null;
}

export function rescueText(
  input: { name: string | null; unitSize: string | null; facilityName: string },
  language: Language = "en"
): string {
  return t(language).rescue(input);
}

/**
 * Leads worth a text right now.
 *
 * `NOT EXISTS` against `message_log` rather than a flag column: the message log
 * is the record of what we actually sent, and a flag can drift from it.
 */
export async function findAbandoned(limit = 50): Promise<AbandonedLead[]> {
  return db.$queryRaw<AbandonedLead[]>`
    SELECT pl.id, pl.facility_id, f.name AS facility_name, pl.name, pl.phone, pl.unit_size
    FROM partial_leads pl
    LEFT JOIN facilities f ON f.id = pl.facility_id
    WHERE pl.phone IS NOT NULL
      AND pl.deleted_at IS NULL
      AND COALESCE(pl.converted, FALSE) = FALSE
      AND COALESCE(pl.lead_status, 'partial') = 'partial'
      -- Belt and braces. converted and lead_status are the real signal, but
      -- recovery_status is set independently by the landing-page capture path,
      -- and a lead that any one of the three calls finished must never be told
      -- it did not finish. Defence against exactly the drift found in
      -- /api/lead-capture, whose create branch used to set only this one.
      AND COALESCE(pl.recovery_status, 'pending') <> 'converted'
      AND pl.created_at <= now() - (${RESCUE_AFTER_MINUTES}::int * interval '1 minute')
      AND pl.created_at >  now() - (${RESCUE_BEFORE_MINUTES}::int * interval '1 minute')
      AND NOT EXISTS (
        SELECT 1 FROM message_log m WHERE m.dedupe_key = 'rescue:' || pl.id
      )
    ORDER BY pl.created_at ASC
    LIMIT ${limit}
  `;
}

export interface RescueResult { found: number; sent: number; skipped: number }

export async function rescueAbandoned(limit = 50): Promise<RescueResult> {
  const leads = await findAbandoned(limit);
  const res: RescueResult = { found: leads.length, sent: 0, skipped: 0 };
  // One query for the whole batch rather than one per lead.
  const languages = await languagesFor(leads.map((l) => l.phone));

  for (const lead of leads) {
    const to = normalisePhone(lead.phone);
    if (!to) { res.skipped++; continue; }

    const outcome = await sendMessage({
      to,
      facilityId: lead.facility_id ?? undefined,
      body: rescueText(
        {
          name: lead.name,
          unitSize: lead.unit_size,
          facilityName: lead.facility_name ?? "our facility",
        },
        languages.get(to) ?? "en"
      ),
      dedupeKey: `rescue:${lead.id}`,
    });

    if (outcome.sent) {
      res.sent++;
      // Recorded on the lead so the EMAIL sequence and a human both know a text
      // already went out — without changing how that sequence decides anything.
      await db.$executeRaw`
        UPDATE partial_leads
        SET recovery_sent_count = COALESCE(recovery_sent_count, 0) + 1, updated_at = now()
        WHERE id = ${lead.id}::uuid
      `;
    } else {
      res.skipped++;
    }
  }

  return res;
}
