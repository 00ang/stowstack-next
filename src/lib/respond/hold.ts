/**
 * Unit reservation locks (MISSION.md s10).
 *
 * Two callers must not book the same unit. The PMS knows how many of a size are
 * vacant, but it is updated by upload — minutes to hours behind — so it cannot
 * arbitrate a race happening on two phone calls right now. Real availability is
 * PMS vacancy minus the holds we are carrying ourselves.
 *
 * A hold is a short lease, not a booking. Somebody who says "let me think about
 * it" must not keep a unit off the market forever.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";

/** Long enough to finish a phone call and pay; short enough not to strand a unit. */
export const HOLD_MINUTES = 30;

export interface Availability {
  sizeLabel: string | null;
  vacant: number;
  held: number;
  available: number;
}

/**
 * What is genuinely bookable for a size right now.
 *
 * Expired holds are excluded by the `expires_at > now()` predicate rather than
 * by a sweep, so availability is correct the instant a hold lapses — waiting for
 * a cleanup job would keep a free unit invisible.
 */
export async function availabilityFor(facilityId: string, sizeLabel: string | null): Promise<Availability> {
  const rows = await db.$queryRaw<{ vacant: number; held: number }[]>`
    SELECT
      COALESCE((
        SELECT SUM(GREATEST(0, u.total_count - u.occupied_count))::int
        FROM facility_pms_units u
        WHERE u.facility_id = ${facilityId}::uuid
          AND (${sizeLabel}::text IS NULL OR u.size_label = ${sizeLabel}::text)
      ), 0) AS vacant,
      COALESCE((
        SELECT count(*)::int FROM unit_hold h
        WHERE h.facility_id = ${facilityId}::uuid
          AND h.status = 'active'
          AND h.expires_at > now()
          AND (${sizeLabel}::text IS NULL OR h.size_label = ${sizeLabel}::text)
      ), 0) AS held
  `;
  const { vacant, held } = rows[0];
  return { sizeLabel, vacant, held, available: Math.max(0, vacant - held) };
}

export type HoldResult =
  | { held: true; id: string; expiresAt: Date }
  | { held: false; reason: "none-available" | "already-held" };

/**
 * Take a hold, if one is genuinely free.
 *
 * The insert is conditional on availability inside a single statement, so two
 * concurrent callers cannot both pass a check-then-insert race. `SELECT ... WHERE
 * NOT EXISTS`-style gating in the same round trip is what makes this a lock
 * rather than a suggestion.
 */
export async function placeHold(input: {
  facilityId: string;
  sizeLabel: string | null;
  phone?: string | null;
  name?: string | null;
  waitlistId?: string | null;
  source?: "waitlist" | "call" | "web";
  minutes?: number;
}): Promise<HoldResult> {
  const minutes = input.minutes ?? HOLD_MINUTES;

  // One person should not accumulate holds on the same size by replying twice.
  if (input.phone) {
    const existing = await db.$queryRaw<{ id: string; expires_at: Date }[]>`
      SELECT id, expires_at FROM unit_hold
      WHERE facility_id = ${input.facilityId}::uuid
        AND held_for_phone = ${input.phone}
        AND status = 'active' AND expires_at > now()
        AND (size_label IS NOT DISTINCT FROM ${input.sizeLabel})
      LIMIT 1
    `;
    if (existing.length > 0) return { held: false, reason: "already-held" };
  }

  const rows = await db.$queryRaw<{ id: string; expires_at: Date }[]>`
    INSERT INTO unit_hold (facility_id, size_label, held_for_phone, held_for_name, waitlist_id, source, expires_at)
    SELECT ${input.facilityId}::uuid, ${input.sizeLabel}, ${input.phone ?? null}, ${input.name ?? null},
           ${input.waitlistId ?? null}::uuid, ${input.source ?? "web"},
           now() + (${minutes}::int * interval '1 minute')
    WHERE (
      COALESCE((
        SELECT SUM(GREATEST(0, u.total_count - u.occupied_count))::int FROM facility_pms_units u
        WHERE u.facility_id = ${input.facilityId}::uuid
          AND (${input.sizeLabel}::text IS NULL OR u.size_label = ${input.sizeLabel}::text)
      ), 0)
      -
      COALESCE((
        SELECT count(*)::int FROM unit_hold h
        WHERE h.facility_id = ${input.facilityId}::uuid AND h.status = 'active' AND h.expires_at > now()
          AND (${input.sizeLabel}::text IS NULL OR h.size_label = ${input.sizeLabel}::text)
      ), 0)
    ) > 0
    RETURNING id, expires_at
  `;

  if (rows.length === 0) return { held: false, reason: "none-available" };

  // The hold knows when it lapses, so it books its own bookkeeping for then
  // instead of a sweep polling for it every five minutes. Best effort: the
  // six-hourly `holds.expire` backstop catches anything this misses.
  await enqueue({
    queue: "holds.expire",
    dedupeKey: `hold:${rows[0].id}`,
    tenantKey: input.facilityId,
    runAfter: new Date(new Date(rows[0].expires_at).getTime() + 60_000),
  }).catch((error) => console.error("[hold] scheduling expiry failed:", rows[0].id, error));

  return { held: true, id: rows[0].id, expiresAt: rows[0].expires_at };
}

export async function releaseHold(id: string, status: "released" | "converted" = "released"): Promise<boolean> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE unit_hold SET status = ${status}, updated_at = now()
    WHERE id = ${id}::uuid AND status = 'active'
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Mark lapsed holds so the operator view is honest.
 *
 * Availability already ignores them, so this is bookkeeping rather than
 * correctness — which is exactly why it runs on the queue and not in the
 * request path.
 */
export async function expireHolds(limit = 500): Promise<number> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE unit_hold SET status = 'expired', updated_at = now()
    WHERE id IN (
      SELECT id FROM unit_hold WHERE status = 'active' AND expires_at <= now()
      ORDER BY expires_at ASC LIMIT ${limit}
    )
    RETURNING id
  `;
  return rows.length;
}
