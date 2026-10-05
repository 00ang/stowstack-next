/**
 * Detection — turn PMS snapshots into domain events (MISSION.md s7).
 *
 * The only historical source this product has is `facility_pms_rent_roll`,
 * which carries a `snapshot_date` per upload. Comparing the two most recent
 * snapshots for a facility yields move-ins, move-outs, rate changes and the
 * delinquency ladder.
 *
 * `inventory.available` needs a second source. `facility_pms_units` is upserted
 * CURRENT state, so `captureUnitMix` copies it into `facility_pms_unit_history`
 * whenever the source data has moved, and the last two captures are diffed.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { emit, type EmitResult } from "./bus";
import { diffInventory, diffRentRoll, type RentRollRow, type UnitTypeRow } from "./types";

/** Facilities with at least two rent-roll snapshots — the only ones diffable. */
export async function facilitiesWithHistory(afterId?: string, limit = 25): Promise<string[]> {
  const rows = await db.$queryRaw<{ facility_id: string }[]>`
    SELECT facility_id
    FROM facility_pms_rent_roll
    WHERE (${afterId ?? null}::uuid IS NULL OR facility_id > ${afterId ?? null}::uuid)
    GROUP BY facility_id
    HAVING count(DISTINCT snapshot_date) >= 2
    ORDER BY facility_id ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => r.facility_id);
}

export async function detectForFacility(facilityId: string): Promise<EmitResult> {
  const dates = await db.$queryRaw<{ snapshot_date: Date }[]>`
    SELECT DISTINCT snapshot_date FROM facility_pms_rent_roll
    WHERE facility_id = ${facilityId}::uuid
    ORDER BY snapshot_date DESC LIMIT 2
  `;
  if (dates.length < 2) return { emitted: 0, duplicates: 0, fannedOut: 0 };

  const [curDate, prevDate] = dates.map((d) => d.snapshot_date);
  const load = (d: Date) => db.$queryRaw<RentRollRow[]>`
    SELECT unit, account, tenant_name,
           rent_rate::float8 AS rent_rate,
           days_past_due,
           rental_start::text AS rental_start
    FROM facility_pms_rent_roll
    WHERE facility_id = ${facilityId}::uuid AND snapshot_date = ${d}
  `;

  const [next, prev] = await Promise.all([load(curDate), load(prevDate)]);
  const events = diffRentRoll(prev, next, curDate.toISOString(), facilityId);

  // The facility is the fair-share bucket: one customer's 12,000-unit roll must
  // not monopolise the workers ahead of everybody else's.
  return emit(events, facilityId);
}


/**
 * Copy the facility's current unit mix into history, if it has moved.
 *
 * `captured_at` is the facility's own latest unit-data timestamp — not the time
 * we looked — so running it again records nothing until an upload actually
 * changes the mix, and re-running is a no-op.
 */
export async function captureUnitMix(facilityId: string): Promise<number> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    WITH src AS (
      SELECT unit_type, size_label, total_count, occupied_count, vacant_count, street_rate,
             coalesce(last_updated, created_at) AS ts
      FROM facility_pms_units
      WHERE facility_id = ${facilityId}::uuid
    ),
    mark AS (SELECT max(ts) AS captured_at FROM src)
    INSERT INTO facility_pms_unit_history
      (facility_id, captured_at, unit_type, size_label, total_count, occupied_count, vacant_count, street_rate)
    SELECT ${facilityId}::uuid, mark.captured_at, src.unit_type, src.size_label,
           src.total_count, src.occupied_count, src.vacant_count, src.street_rate
    FROM src CROSS JOIN mark
    WHERE mark.captured_at IS NOT NULL
    ON CONFLICT ON CONSTRAINT pms_unit_history_key DO NOTHING
    RETURNING id
  `;
  return rows.length;
}

/**
 * Emit `inventory.available` for any size that went from nothing free to
 * something free — the moment a unit can be sold before it is vacant a day.
 */
export async function detectInventoryForFacility(facilityId: string): Promise<EmitResult> {
  await captureUnitMix(facilityId);

  const marks = await db.$queryRaw<{ captured_at: Date }[]>`
    SELECT DISTINCT captured_at FROM facility_pms_unit_history
    WHERE facility_id = ${facilityId}::uuid
    ORDER BY captured_at DESC LIMIT 2
  `;
  if (marks.length < 2) return { emitted: 0, duplicates: 0, fannedOut: 0 };

  const [curAt, prevAt] = marks.map((m) => m.captured_at);
  const load = (at: Date) => db.$queryRaw<UnitTypeRow[]>`
    SELECT unit_type, size_label, total_count, occupied_count, vacant_count,
           street_rate::float8 AS street_rate
    FROM facility_pms_unit_history
    WHERE facility_id = ${facilityId}::uuid AND captured_at = ${at}
  `;

  const [next, prev] = await Promise.all([load(curAt), load(prevAt)]);
  return emit(diffInventory(prev, next, curAt.toISOString(), facilityId), facilityId);
}

/** Facilities with a unit mix at all — capture runs for these even before history exists. */
export async function facilitiesWithUnitMix(afterId?: string, limit = 25): Promise<string[]> {
  const rows = await db.$queryRaw<{ facility_id: string }[]>`
    SELECT DISTINCT facility_id FROM facility_pms_units
    WHERE (${afterId ?? null}::uuid IS NULL OR facility_id > ${afterId ?? null}::uuid)
    ORDER BY facility_id ASC LIMIT ${limit}
  `;
  return rows.map((r) => r.facility_id);
}

/**
 * PMS data for this facility just changed: detect now, for this facility only.
 *
 * Detection only ever finds something after an upload moves the data, so it is
 * triggered by the upload rather than by a clock. It used to sweep every
 * facility every two minutes (inventory) and fifteen (rent roll), which kept the
 * database awake around the clock to find nothing (see src/lib/jobs/alarm.ts).
 *
 * Not deduped: two imports a few seconds apart must both be looked at, and a
 * spare run is cheap because detection is idempotent (events dedupe on their
 * source key). Best effort by contract — call sites must not fail an import
 * over it, and the six-hourly sweeps catch anything missed.
 */
export async function scheduleDetection(facilityId: string): Promise<void> {
  for (const queue of ["pms.detect-inventory", "pms.detect-events"]) {
    await enqueue({ queue, payload: { facilityId }, tenantKey: facilityId });
  }
}
