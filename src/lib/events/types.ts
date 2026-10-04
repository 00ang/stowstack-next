/**
 * Domain events — the vocabulary and the detection rules (MISSION.md s7).
 *
 * Pure. No database, no clock, no randomness. The rules that decide whether a
 * tenant moved out or merely changed unit are the part that must be right, and
 * a DB test would hide them rather than prove them.
 *
 * Everything here is derived by diffing two PMS snapshots. That is the only
 * source of truth this product has about what happened at a facility — there is
 * no live PMS feed yet (MISSION.md s6), and CSV uploads are what land today.
 */

export const EVENT_TYPES = [
  "unit.moved_in",
  "unit.moved_out",
  "tenant.delinquent",
  "unit.rate_changed",
  "inventory.available",
  // MISSION.md s12 — a lead we can trace was matched to a real move-in. Not a
  // snapshot diff like the rest: emitted by `attemptAndPersistLeadMatch` the
  // moment the match is persisted. Keyed by tenant, so a move-in reports once.
  "lead.moved_in",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** The delinquency ladder RETAIN t3 sends on: 5, 10 and 15 days past due. */
export const DELINQUENCY_DAYS = [5, 10, 15] as const;

export interface DetectedEvent {
  type: EventType;
  /** Identity of the FACT. Re-running detection over the same data emits nothing new. */
  sourceKey: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** One row of `facility_pms_rent_roll`, narrowed to what detection reads. */
export interface RentRollRow {
  unit: string;
  account: string | null;
  tenant_name: string | null;
  rent_rate: number | null;
  days_past_due: number | null;
  rental_start: string | null;
}

/** One row of `facility_pms_units` — unit *types*, not individual units. */
export interface UnitTypeRow {
  size_label: string | null;
  unit_type: string;
  vacant_count: number | null;
  total_count: number;
  occupied_count: number;
  street_rate: number | null;
}

const key = (...parts: (string | number | null | undefined)[]) =>
  parts.map((p) => String(p ?? "")).join(":").slice(0, 300);

/** A tenancy is identified by its account when the PMS gives one, else by tenant name. */
const tenancyOf = (r: RentRollRow) => r.account || r.tenant_name || "unknown";

/**
 * Diff two rent rolls for one facility.
 *
 * `prev` may be empty — the first upload for a facility. That case emits NOTHING
 * rather than declaring every occupied unit a fresh move-in, which would fire a
 * welcome kit at every existing tenant the day a customer onboards. That is the
 * single most expensive mistake this function could make, so it is the first
 * branch and it is tested.
 */
export function diffRentRoll(
  prev: RentRollRow[],
  next: RentRollRow[],
  occurredAt: string,
  facilityId: string
): DetectedEvent[] {
  if (prev.length === 0) return [];

  const events: DetectedEvent[] = [];
  const prevByUnit = new Map(prev.map((r) => [r.unit, r]));
  const nextByUnit = new Map(next.map((r) => [r.unit, r]));

  for (const [unit, cur] of nextByUnit) {
    const before = prevByUnit.get(unit);
    const acct = tenancyOf(cur);

    if (!before) {
      events.push({
        type: "unit.moved_in",
        sourceKey: key(facilityId, unit, acct, "in"),
        occurredAt: cur.rental_start || occurredAt,
        payload: { facilityId, unit, account: cur.account, tenantName: cur.tenant_name, rate: cur.rent_rate },
      });
    } else if (tenancyOf(before) !== acct) {
      // The unit changed hands between snapshots. Both facts are true and both
      // have subscribers — a winback for the one who left, a welcome for the
      // one who arrived — so both are emitted rather than netting to "no change".
      events.push({
        type: "unit.moved_out",
        sourceKey: key(facilityId, unit, tenancyOf(before), "out"),
        occurredAt,
        payload: { facilityId, unit, account: before.account, tenantName: before.tenant_name },
      });
      events.push({
        type: "unit.moved_in",
        sourceKey: key(facilityId, unit, acct, "in"),
        occurredAt: cur.rental_start || occurredAt,
        payload: { facilityId, unit, account: cur.account, tenantName: cur.tenant_name, rate: cur.rent_rate },
      });
    } else if (
      before.rent_rate != null &&
      cur.rent_rate != null &&
      Number(before.rent_rate) !== Number(cur.rent_rate)
    ) {
      events.push({
        type: "unit.rate_changed",
        // Keyed by the snapshot, not the amount: a rate that moves up and then
        // back down is two real changes, and both should reach the customer.
        sourceKey: key(facilityId, unit, acct, "rate", occurredAt),
        occurredAt,
        payload: {
          facilityId, unit, account: cur.account,
          from: Number(before.rent_rate), to: Number(cur.rent_rate),
          increase: Number(cur.rent_rate) > Number(before.rent_rate),
        },
      });
    }

    // Delinquency is a ladder, not a state: each threshold newly crossed is its
    // own event, so 5/10/15 escalations fire once each and in order.
    const wasDue = before?.days_past_due ?? 0;
    const nowDue = cur.days_past_due ?? 0;
    for (const day of DELINQUENCY_DAYS) {
      if (nowDue >= day && wasDue < day) {
        events.push({
          type: "tenant.delinquent",
          sourceKey: key(facilityId, unit, acct, "dq", day),
          occurredAt,
          payload: {
            facilityId, unit, account: cur.account, tenantName: cur.tenant_name,
            threshold: day, daysPastDue: nowDue,
          },
        });
      }
    }
  }

  for (const [unit, before] of prevByUnit) {
    if (!nextByUnit.has(unit)) {
      events.push({
        type: "unit.moved_out",
        sourceKey: key(facilityId, unit, tenancyOf(before), "out"),
        occurredAt,
        payload: { facilityId, unit, account: before.account, tenantName: before.tenant_name },
      });
    }
  }

  return events;
}

/**
 * Diff two unit-type tables to find inventory that became available.
 *
 * This is the sold-out waitlist trigger (RESPOND r9 / CONVERT c6): the moment a
 * size goes from nothing available to something available is the moment the
 * unit can be sold before it is vacant a day. Only the zero-to-something edge
 * counts — a size that already had vacancy is not news.
 */
export function diffInventory(
  prev: UnitTypeRow[],
  next: UnitTypeRow[],
  occurredAt: string,
  facilityId: string
): DetectedEvent[] {
  if (prev.length === 0) return [];
  const vacancy = (r: UnitTypeRow) => r.vacant_count ?? Math.max(0, r.total_count - r.occupied_count);
  const label = (r: UnitTypeRow) => r.size_label || r.unit_type;
  const prevBy = new Map(prev.map((r) => [label(r), r]));

  const out: DetectedEvent[] = [];
  for (const cur of next) {
    const before = prevBy.get(label(cur));
    if (!before) continue; // a size we have never seen is new inventory, not a re-opening
    if (vacancy(before) === 0 && vacancy(cur) > 0) {
      out.push({
        type: "inventory.available",
        sourceKey: key(facilityId, label(cur), "avail", occurredAt),
        occurredAt,
        payload: {
          facilityId, sizeLabel: label(cur), unitType: cur.unit_type,
          available: vacancy(cur), streetRate: cur.street_rate == null ? null : Number(cur.street_rate),
        },
      });
    }
  }
  return out;
}
