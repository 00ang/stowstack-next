/**
 * Tour booking, reminders and no-show recovery (MISSION.md RESPOND r6/r7).
 *
 * `lead_status` already carried a 'toured' value and the schema anticipated
 * `tour_booked`, but nothing ever booked one — so this is the missing table plus
 * the three messages that make a booked tour actually happen.
 *
 * ## Why the reminders are swept, not pre-scheduled
 *
 * The obvious design is to enqueue two jobs at booking time with a future
 * `run_after`. It is wrong here: the moment somebody reschedules, those jobs are
 * still pointing at the old time, and cancelling them means tracking job ids on
 * the tour row. Sweeping instead means the tour row is the only truth about when
 * the tour is, and `message_log` is the only truth about what we have sent — no
 * third copy of either fact to drift.
 *
 * ## Why the sweeps are nonetheless scheduled at booking time (2026-09-23)
 *
 * The sweeps used to run on a 5- and 15-minute clock, and polling every five
 * minutes kept the database awake around the clock (see src/lib/jobs/alarm.ts).
 * So the booking now enqueues the SWEEP — not the send — for the moments it
 * could find this tour: `scheduleTourFollowUps`. The jobs carry no facts about
 * the tour, only a time to look. A job left pointing at a rescheduled or
 * cancelled tour runs a sweep that finds nothing to do, which is the same
 * outcome the clock had, so the reasoning above still holds in full.
 *
 * ## What is deliberately NOT here
 *
 * Slot availability. Zero facilities in the database have `hours` populated, so
 * generating bookable slots from them would be fiction. A requested time is
 * validated for sanity (future, not absurdly far out, inside a plausible
 * daytime hour in the facility's own zone) and otherwise trusted. When real
 * office hours exist, `withinBookableHours` is the one place to tighten.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { t } from "@/lib/messaging/copy";
import { languageFor } from "@/lib/messaging/language";
import { sendMessage } from "@/lib/messaging/send";
import { normalisePhone } from "@/lib/messaging/types";

/**
 * The facility zone used when a facility has none set.
 *
 * A guess, and a knowingly imperfect one — the facilities on the books span
 * Eastern to Mountain time. It is survivable because tours are stored in absolute
 * time: a wrong zone changes how a time is *printed* and whether the
 * quiet-hours gate thinks it is evening, never when a reminder fires.
 */
export const DEFAULT_TIMEZONE = "America/Chicago";

/** Reminders go out this far ahead, and are considered "due" inside the window. */
export const REMIND_24H_MINUTES = 24 * 60;
export const REMIND_1H_MINUTES = 60;

/**
 * How wide a net each reminder sweep casts.
 *
 * The sweep runs when a tour's reminder falls due, give or take the worker's
 * one-minute tick, so 15 leaves room for a late worker without double-sending —
 * the message-log dedupe key is what makes the overlap safe rather than the
 * window being exact.
 */
export const SWEEP_WINDOW_MINUTES = 15;

/**
 * How long after the appointment somebody is a no-show.
 *
 * Long enough to cover somebody who is simply late and traffic, short enough
 * that "sorry we missed you today" is still true and rebooking is still easy.
 */
export const NO_SHOW_GRACE_MINUTES = 45;

/** Booking sanity bounds. Not office hours — see the module note. */
export const MAX_DAYS_AHEAD = 60;
export const EARLIEST_HOUR = 7;
export const LATEST_HOUR = 20;

export type TourStatus = "booked" | "confirmed" | "completed" | "no_show" | "cancelled";

/** The hour of a moment, in a given zone. Returns null for an unusable zone. */
export function hourInZone(at: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(at);
    const h = parts.find((p) => p.type === "hour")?.value;
    if (h == null) return null;
    // Intl can render midnight as 24 with hour12:false.
    return Number(h) % 24;
  } catch {
    return null;
  }
}

/** Render a tour time the way a person would say it. */
export function formatTourTime(
  at: Date,
  timeZone: string,
  style: "full" | "time" | "relative-day" = "full"
): string {
  const tz = safeZone(timeZone);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
  }).format(at);

  if (style === "time") return time;

  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", month: "short", day: "numeric",
  }).format(at);

  return style === "relative-day" ? `tomorrow at ${time}` : `${day} at ${time}`;
}

function safeZone(timeZone: string | null | undefined): string {
  const tz = timeZone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export interface BookableCheck {
  ok: boolean;
  reason?: "past" | "too-far" | "outside-hours" | "invalid";
}

/**
 * Is this a time somebody could plausibly tour?
 *
 * Sanity only. It rejects the things that are certainly mistakes — a time in the
 * past, a date next year, three in the morning — and trusts everything else,
 * because we have no real office hours to check against.
 */
export function withinBookableHours(
  at: Date,
  timeZone: string,
  now: Date = new Date()
): BookableCheck {
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "invalid" };
  if (at.getTime() <= now.getTime()) return { ok: false, reason: "past" };
  if (at.getTime() - now.getTime() > MAX_DAYS_AHEAD * 86_400_000) {
    return { ok: false, reason: "too-far" };
  }
  const hour = hourInZone(at, safeZone(timeZone));
  if (hour == null) return { ok: false, reason: "invalid" };
  if (hour < EARLIEST_HOUR || hour >= LATEST_HOUR) return { ok: false, reason: "outside-hours" };
  return { ok: true };
}

export interface BookTourInput {
  facilityId: string;
  phone: string;
  scheduledAt: Date;
  name?: string | null;
  sizeLabel?: string | null;
  leadId?: string | null;
  source?: string;
}

export interface BookTourResult {
  booked: boolean;
  id?: string;
  rescheduled?: boolean;
  confirmSent?: boolean;
  reason?: string;
}

/**
 * Book a tour, or move an existing one.
 *
 * A second booking for the same person at the same facility is a reschedule, not
 * a second tour — enforced by a partial unique index on the live statuses, so two
 * concurrent submits cannot both win. The confirmation text goes out inline,
 * because a booking with no confirmation is how a no-show starts.
 */
export async function bookTour(input: BookTourInput): Promise<BookTourResult> {
  const phone = normalisePhone(input.phone);
  if (!phone) return { booked: false, reason: "no-number" };

  const facility = await db.$queryRaw<{ name: string; timezone: string | null }[]>`
    SELECT name, timezone FROM facilities WHERE id = ${input.facilityId}::uuid AND deleted_at IS NULL
  `;
  if (!facility[0]) return { booked: false, reason: "unknown-facility" };
  const tz = safeZone(facility[0].timezone);

  const check = withinBookableHours(input.scheduledAt, tz);
  if (!check.ok) return { booked: false, reason: check.reason };

  // One statement, so a double submit cannot create two live tours. The
  // conflict target is the partial unique index on (facility, phone) WHERE the
  // status is live, which is why the reschedule lands here rather than needing a
  // read-then-write.
  const rows = await db.$queryRaw<{ id: string; created: boolean }[]>`
    INSERT INTO facility_tours
      (facility_id, lead_id, contact_name, contact_phone, size_label, scheduled_at, status, source)
    VALUES (${input.facilityId}::uuid, ${input.leadId ?? null}::uuid, ${input.name ?? null},
            ${phone}, ${input.sizeLabel ?? null}, ${input.scheduledAt}, 'booked', ${input.source ?? "web"})
    ON CONFLICT (facility_id, contact_phone) WHERE status IN ('booked', 'confirmed')
      DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at,
                    contact_name = COALESCE(EXCLUDED.contact_name, facility_tours.contact_name),
                    size_label   = COALESCE(EXCLUDED.size_label, facility_tours.size_label),
                    lead_id      = COALESCE(EXCLUDED.lead_id, facility_tours.lead_id),
                    status       = 'booked',
                    updated_at   = now()
    RETURNING id, (created_at = updated_at) AS created
  `;
  const tour = rows[0];
  if (!tour) return { booked: false, reason: "insert-failed" };

  const outcome = await sendMessage({
    to: phone,
    facilityId: input.facilityId,
    body: t(await languageFor(phone)).tourConfirmed({
      name: input.name ?? null,
      when: formatTourTime(input.scheduledAt, tz, "full"),
      facilityName: facility[0].name,
    }),
    // Keyed on the time as well as the tour: a reschedule is a different fact
    // and deserves its own confirmation, a replayed submit does not.
    dedupeKey: `tourok:${tour.id}:${input.scheduledAt.toISOString()}`,
  });

  // Best effort: a failure here is picked up by the six-hourly
  // `respond.tour-schedule` backstop, and must not fail a booking that happened.
  await scheduleTourFollowUps({
    id: tour.id,
    facilityId: input.facilityId,
    scheduledAt: input.scheduledAt,
  }).catch((error) => console.error("[tour] scheduling follow-ups failed:", tour.id, error));

  return {
    booked: true,
    id: tour.id,
    rescheduled: !tour.created,
    confirmSent: outcome.sent,
  };
}

const MINUTE = 60_000;

/**
 * Enqueue the sweeps that will find this tour: the day-before and hour-before
 * reminders, and the no-show check once the grace period has passed.
 *
 * Keyed on the scheduled time as well as the tour, so a reschedule gets its own
 * jobs and a replayed booking does not double them. A reminder already past its
 * sweep window is skipped — the sweep could not pick the tour up anyway — and
 * one inside it runs now, which is what the old clock would have done.
 */
export async function scheduleTourFollowUps(
  tour: { id: string; facilityId: string; scheduledAt: Date },
  now: number = Date.now()
): Promise<number> {
  const at = tour.scheduledAt.getTime();
  const key = `${tour.id}:${tour.scheduledAt.toISOString()}`;
  const window = SWEEP_WINDOW_MINUTES * MINUTE;
  const plan = [
    { queue: "respond.tour-reminders", key: `tour24:${key}`, due: at - REMIND_24H_MINUTES * MINUTE, window },
    { queue: "respond.tour-reminders", key: `tour1:${key}`, due: at - REMIND_1H_MINUTES * MINUTE, window },
    // One minute past the grace: the sweep's test is strictly "older than".
    { queue: "respond.tour-noshow", key: `tourno:${key}`, due: at + (NO_SHOW_GRACE_MINUTES + 1) * MINUTE, window: Infinity },
  ];

  let created = 0;
  for (const p of plan) {
    if (p.due + p.window <= now) continue;
    const id = await enqueue({
      queue: p.queue,
      dedupeKey: p.key,
      tenantKey: tour.facilityId,
      runAfter: new Date(Math.max(p.due, now)),
    });
    if (id) created++;
  }
  return created;
}

/**
 * The backstop for `scheduleTourFollowUps`: re-derive the jobs for every live
 * tour that could still need one. A no-op for tours already scheduled, and the
 * path by which tours booked before scheduling existed get their jobs.
 */
export async function scheduleLiveTours(): Promise<number> {
  const tours = await db.$queryRaw<{ id: string; facility_id: string; scheduled_at: Date }[]>`
    SELECT id, facility_id, scheduled_at FROM facility_tours
    WHERE status IN ('booked', 'confirmed')
      AND scheduled_at > now() - (${NO_SHOW_GRACE_MINUTES + 60}::int * interval '1 minute')
  `;
  let created = 0;
  for (const tour of tours) {
    created += await scheduleTourFollowUps({
      id: tour.id,
      facilityId: tour.facility_id,
      scheduledAt: new Date(tour.scheduled_at),
    });
  }
  return created;
}

interface DueTour {
  id: string;
  facility_id: string;
  facility_name: string | null;
  timezone: string | null;
  contact_name: string | null;
  contact_phone: string;
  scheduled_at: Date;
}

export interface SweepResult { found: number; sent: number; skipped: number }

/**
 * Tours whose reminder is due.
 *
 * `NOT EXISTS` against `message_log` rather than a `reminded_at` column: the
 * message log is what we actually sent, and a flag can drift from it. The same
 * reasoning as the abandoned-rescue sweep in `./abandoned`.
 */
async function dueForReminder(minutesAhead: number, keyPrefix: string, limit: number) {
  return db.$queryRaw<DueTour[]>`
    SELECT ft.id, ft.facility_id, f.name AS facility_name, f.timezone,
           ft.contact_name, ft.contact_phone, ft.scheduled_at
    FROM facility_tours ft
    JOIN facilities f ON f.id = ft.facility_id
    WHERE ft.status IN ('booked', 'confirmed')
      AND ft.scheduled_at BETWEEN
            now() + (${minutesAhead}::int * interval '1 minute')
              - (${SWEEP_WINDOW_MINUTES}::int * interval '1 minute')
        AND now() + (${minutesAhead}::int * interval '1 minute')
      AND NOT EXISTS (
        SELECT 1 FROM message_log m WHERE m.dedupe_key = ${keyPrefix} || ':' || ft.id
      )
    ORDER BY ft.scheduled_at ASC
    LIMIT ${limit}
  `;
}

async function sendReminders(
  tours: DueTour[],
  keyPrefix: string,
  render: (tour: DueTour, tz: string, lang: string) => string
): Promise<SweepResult> {
  const res: SweepResult = { found: tours.length, sent: 0, skipped: 0 };
  for (const tour of tours) {
    const tz = safeZone(tour.timezone);
    const outcome = await sendMessage({
      to: tour.contact_phone,
      facilityId: tour.facility_id,
      body: render(tour, tz, await languageFor(tour.contact_phone)),
      dedupeKey: `${keyPrefix}:${tour.id}`,
      // Gated in the facility's own zone rather than the server's, so an evening
      // reminder is evening where the person actually is.
      localHour: hourInZone(new Date(), tz) ?? undefined,
    });
    if (outcome.sent) res.sent++;
    else res.skipped++;
  }
  return res;
}

/** The day-before reminder. */
export async function sweepReminders24(limit = 100): Promise<SweepResult> {
  const tours = await dueForReminder(REMIND_24H_MINUTES, "tour24", limit);
  return sendReminders(tours, "tour24", (tour, tz, lang) =>
    t(lang).tourReminder24({
      name: tour.contact_name,
      when: formatTourTime(tour.scheduled_at, tz, "relative-day"),
      facilityName: tour.facility_name ?? "our facility",
    })
  );
}

/** The hour-before reminder, which is the one that actually prevents no-shows. */
export async function sweepReminders1(limit = 100): Promise<SweepResult> {
  const tours = await dueForReminder(REMIND_1H_MINUTES, "tour1", limit);
  return sendReminders(tours, "tour1", (tour, tz, lang) =>
    t(lang).tourReminder1({
      name: tour.contact_name,
      when: formatTourTime(tour.scheduled_at, tz, "time"),
      facilityName: tour.facility_name ?? "our facility",
    })
  );
}

/**
 * Mark the tours nobody turned up for, and try to rebook them (r7).
 *
 * Same day, deliberately: "sorry we missed you today" stops being true tomorrow,
 * and a rebooking conversation is easiest while the plan they made is still
 * fresh. The status write and the text are separate concerns — a tour is a
 * no-show whether or not we manage to text about it.
 */
export async function sweepNoShows(limit = 100): Promise<SweepResult> {
  const tours = await db.$queryRaw<DueTour[]>`
    UPDATE facility_tours ft
    SET status = 'no_show', no_show_at = now(), updated_at = now()
    WHERE ft.id IN (
      SELECT id FROM facility_tours
      WHERE status IN ('booked', 'confirmed')
        AND scheduled_at < now() - (${NO_SHOW_GRACE_MINUTES}::int * interval '1 minute')
      ORDER BY scheduled_at ASC
      LIMIT ${limit}
    )
    RETURNING ft.id, ft.facility_id,
              (SELECT name FROM facilities WHERE id = ft.facility_id) AS facility_name,
              (SELECT timezone FROM facilities WHERE id = ft.facility_id) AS timezone,
              ft.contact_name, ft.contact_phone, ft.scheduled_at
  `;

  const res: SweepResult = { found: tours.length, sent: 0, skipped: 0 };
  for (const tour of tours) {
    const tz = safeZone(tour.timezone);
    // Only while it is still the same day where they are. A tour missed at 6pm
    // that we only notice at 1am should not get "sorry we missed you today".
    const stillToday = sameLocalDay(tour.scheduled_at, new Date(), tz);
    if (!stillToday) { res.skipped++; continue; }

    const outcome = await sendMessage({
      to: tour.contact_phone,
      facilityId: tour.facility_id,
      body: t(await languageFor(tour.contact_phone)).tourNoShow({
        name: tour.contact_name,
        facilityName: tour.facility_name ?? "our facility",
      }),
      dedupeKey: `tourno:${tour.id}`,
      localHour: hourInZone(new Date(), tz) ?? undefined,
    });
    if (outcome.sent) res.sent++;
    else res.skipped++;
  }
  return res;
}

/** Same calendar day in a given zone. */
export function sameLocalDay(a: Date, b: Date, timeZone: string): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(timeZone), year: "numeric", month: "2-digit", day: "numeric",
  });
  return fmt.format(a) === fmt.format(b);
}

/** Operator marks a tour as attended. Moves the lead along too. */
export async function completeTour(tourId: string): Promise<boolean> {
  const rows = await db.$queryRaw<{ lead_id: string | null }[]>`
    UPDATE facility_tours
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE id = ${tourId}::uuid AND status IN ('booked', 'confirmed', 'no_show')
    RETURNING lead_id
  `;
  if (!rows[0]) return false;
  if (rows[0].lead_id) {
    await db.$executeRaw`
      UPDATE partial_leads
      SET lead_status = 'toured', status_updated_at = now(), updated_at = now()
      WHERE id = ${rows[0].lead_id}::uuid AND lead_status NOT IN ('reserved', 'moved_in', 'lost')
    `;
  }
  return true;
}

export async function cancelTour(tourId: string): Promise<boolean> {
  const n = await db.$executeRaw`
    UPDATE facility_tours
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = ${tourId}::uuid AND status IN ('booked', 'confirmed')
  `;
  return n > 0;
}
