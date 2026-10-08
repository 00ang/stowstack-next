/**
 * Speed-to-lead (MISSION.md RESPOND r5).
 *
 * A storage enquiry is worth about a hundred times more in the first minute than
 * in the first hour, for the same reason a missed call is (`./missed-call`): the
 * person filling in a rental form has three other tabs open. So this runs INLINE
 * on the submit request, not on the queue — the worker ticks once a minute, and a
 * response that arrives a minute late has already lost the race it exists to win.
 * The queue is the durable fallback for a failed inline send.
 *
 * Two messages go out, and both matter:
 *
 *   - the LEAD gets an acknowledgement, so the next sixty seconds feel handled
 *     rather than silent, and so they have a thread to reply into;
 *   - the OPERATOR gets an alert with the number, because the thing that
 *     actually rents a unit is a human calling back, and they cannot call
 *     somebody they have not been told about.
 *
 * ## What counts as a lead
 *
 * Not the `partial-lead` beacon. That endpoint fires repeatedly while somebody
 * is still typing — it is how `r8` knows about abandonment — and texting from it
 * would mean texting people mid-form. The real submit paths are
 * `/api/consumer-lead` and `/api/lead-capture`, both of which set
 * `converted = true` and `lead_status = 'new'`, and both of which call in here.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { t } from "@/lib/messaging/copy";
import { languageFor } from "@/lib/messaging/language";
import { sendMessage } from "@/lib/messaging/send";
import { normalisePhone } from "@/lib/messaging/types";

/**
 * The promise. Not enforced in code — it is the thing the measurement is
 * measured against, and what PROVE reports on.
 */
export const TARGET_SECONDS = 60;

export interface SpeedResult {
  /** The acknowledgement to the lead went out. */
  acked: boolean;
  /** The alert to the operator went out. */
  alerted: boolean;
  /** Milliseconds from submit to first message. Null when neither went. */
  latencyMs: number | null;
  reason?: string;
}

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  unit_size: string | null;
  facility_id: string | null;
  facility_name: string | null;
  operator_phone: string | null;
  converted_at: Date | null;
  first_response_at: Date | null;
}

/**
 * Answer a lead that has just submitted a form.
 *
 * Safe to call twice for the same lead: both sends are keyed on the lead id, so
 * a retried request or a queued fallback after a partial failure cannot produce
 * a second text. Never throws — a failure to text must not fail the form
 * submission the customer is waiting on.
 */
export async function respondToNewLead(leadId: string): Promise<SpeedResult> {
  const idle: SpeedResult = { acked: false, alerted: false, latencyMs: null };

  const rows = await db.$queryRaw<LeadRow[]>`
    SELECT pl.id, pl.name, pl.phone, pl.unit_size, pl.facility_id,
           f.name AS facility_name,
           -- A campaign's own alert phone (its Text-back function) wins over the facility's.
           COALESCE(NULLIF(fu.config->>'alertPhone', ''), f.contact_phone) AS operator_phone,
           pl.converted_at, pl.first_response_at
    FROM partial_leads pl
    LEFT JOIN facilities f ON f.id = pl.facility_id
    LEFT JOIN landing_pages lp ON lp.id = pl.landing_page_id
    LEFT JOIN funnels fu ON fu.id = COALESCE(pl.funnel_id, lp.funnel_id)
    WHERE pl.id = ${leadId}::uuid AND pl.deleted_at IS NULL
    LIMIT 1
  `;
  const lead = rows[0];
  if (!lead) return { ...idle, reason: "no-lead" };

  const facilityName = lead.facility_name ?? "our facility";
  const leadPhone = normalisePhone(lead.phone);

  let acked = false;
  let alerted = false;

  // 1 — the lead. Their own language if we know it.
  if (leadPhone) {
    const outcome = await sendMessage({
      to: leadPhone,
      facilityId: lead.facility_id ?? undefined,
      body: t(await languageFor(leadPhone)).leadAck({
        name: lead.name,
        unitSize: lead.unit_size,
        facilityName,
      }),
      dedupeKey: `ack:${lead.id}`,
    });
    acked = outcome.sent;
  }

  // 2 — the operator. A separate send with its own key, so one failing does not
  // suppress the other: the alert is the half that actually rents the unit.
  const operatorPhone = normalisePhone(lead.operator_phone);
  if (operatorPhone) {
    const outcome = await sendMessage({
      to: operatorPhone,
      facilityId: lead.facility_id ?? undefined,
      body: t(await languageFor(operatorPhone)).operatorAlert({
        name: lead.name,
        phone: leadPhone ?? lead.phone,
        unitSize: lead.unit_size,
        facilityName,
      }),
      dedupeKey: `alert:${lead.id}`,
    });
    alerted = outcome.sent;
  }

  if (!acked && !alerted) {
    return { ...idle, reason: leadPhone || operatorPhone ? "send-failed" : "no-numbers" };
  }

  // 3 — the measurement. `COALESCE` keeps the FIRST response, so a retry cannot
  // rewrite history into looking faster or slower than it was. Measured from
  // `converted_at` (the submit) and not `created_at`, which is when they first
  // touched the form and can be an hour earlier.
  const stamped = await db.$queryRaw<{ latency_ms: number | null }[]>`
    UPDATE partial_leads
    SET first_response_at = COALESCE(first_response_at, now()),
        updated_at = now()
    WHERE id = ${lead.id}::uuid
    RETURNING EXTRACT(EPOCH FROM (first_response_at - COALESCE(converted_at, created_at))) * 1000
              AS latency_ms
  `;

  const latencyMs = stamped[0]?.latency_ms;
  return { acked, alerted, latencyMs: latencyMs == null ? null : Math.round(Number(latencyMs)) };
}

/**
 * The same thing, for a caller that must not be broken by it.
 *
 * Used from the submit routes: the customer is waiting on that response, and a
 * messaging failure is our problem to log, not theirs to see.
 */
export async function respondToNewLeadSafely(leadId: string): Promise<SpeedResult> {
  try {
    return await respondToNewLead(leadId);
  } catch (error) {
    console.error("[speed-to-lead] failed for", leadId, error);
    return { acked: false, alerted: false, latencyMs: null, reason: "threw" };
  }
}

/** How long after a lead lands its safety check runs. */
export const CHECK_AFTER_MINUTES = 2;

/**
 * Enqueue the safety net for a lead that was just written.
 *
 * The inline answer is the path; this is the net under it, for a submit request
 * that died between writing the lead and answering it. It runs the same sweep
 * that used to run every five minutes — `unansweredLeads` — but only when a lead
 * has actually arrived, instead of keeping the database awake around the clock
 * to find nothing (see src/lib/jobs/alarm.ts).
 *
 * Call it BEFORE the inline attempt, so the only gap left is the one between
 * two statements; the six-hourly `respond.speed-to-lead` backstop covers that.
 * Safe alongside the inline path: every send is keyed on the lead, so a lead
 * that was answered is never texted twice.
 */
export async function scheduleSpeedCheck(leadId: string, tenantKey?: string | null): Promise<void> {
  await enqueue({
    queue: "respond.speed-to-lead",
    dedupeKey: `speedcheck:${leadId}`,
    tenantKey: tenantKey ?? undefined,
    runAfter: new Date(Date.now() + CHECK_AFTER_MINUTES * 60_000),
  });
}

/** Leads that were never answered. The gap this module exists to close. */
export async function unansweredLeads(limit = 50): Promise<{ id: string }[]> {
  return db.$queryRaw<{ id: string }[]>`
    SELECT id FROM partial_leads
    WHERE lead_status = 'new'
      AND deleted_at IS NULL
      AND first_response_at IS NULL
      AND COALESCE(converted_at, created_at) > now() - interval '1 day'
    ORDER BY COALESCE(converted_at, created_at) ASC
    LIMIT ${limit}
  `;
}
