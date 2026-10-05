/**
 * Match a move-in found in a CSV rent roll to the lead that inquired
 * (MISSION.md s12).
 *
 * Until this, only `/api/v1/tenants` ran lead matching, so a facility that
 * uploads CSVs — every facility today — never had a move-in reach the ad
 * platforms. Detection already notices CSV move-ins (`unit.moved_in`, from
 * diffing two snapshots); this subscribes to that event and runs the same
 * matching the API path uses, which then emits `lead.moved_in` and the
 * write-back follows on its own.
 *
 * Matching needs a phone or an email. Rent rolls usually carry neither, so
 * the CSV mapper accepts both as optional columns, and a move-in without them
 * is left exactly as it was: no tenant row is created for something that
 * cannot be matched, so nothing else in the product changes behaviour for
 * facilities that do not export contact columns.
 */

import { db } from "@/lib/db";
import { attemptAndPersistLeadMatch } from "@/lib/lead-matching";
import { phoneLast10 } from "./touch";

export interface RentRollContactRow {
  unit: string;
  tenant_name: string | null;
  account: string | null;
  phone: string | null;
  email: string | null;
  size_label: string | null;
  rental_start: Date | null;
  rent_rate: number | null;
  snapshot_date: Date;
}

export interface TenantDraft {
  facility_id: string;
  external_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  unit_number: string;
  unit_size: string | null;
  monthly_rate: number;
  move_in_date: Date;
  status: "active";
  metadata: { source: "pms_csv"; eventId: string | null };
}

const cleanEmail = (e: string | null) => {
  const v = (e ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
};

/**
 * The tenant row a CSV move-in becomes — or null when it has no phone or
 * email, because then it cannot be matched and should not be created. Pure.
 */
export function tenantFromRentRoll(facilityId: string, row: RentRollContactRow, eventId: string | null = null): TenantDraft | null {
  const phone = phoneLast10(row.phone) ? (row.phone ?? "").trim() : null;
  const email = cleanEmail(row.email);
  if (!phone && !email) return null;
  return {
    facility_id: facilityId,
    external_id: row.account?.trim() || null,
    name: row.tenant_name?.trim() || "Unknown",
    email,
    phone,
    unit_number: row.unit,
    unit_size: row.size_label,
    monthly_rate: row.rent_rate != null && Number.isFinite(row.rent_rate) ? row.rent_rate : 0,
    move_in_date: row.rental_start ?? row.snapshot_date,
    status: "active",
    metadata: { source: "pms_csv", eventId },
  };
}

export type CsvMatchOutcome =
  | { outcome: "no_rent_roll_row" }
  | { outcome: "no_contact" }
  | { outcome: "matched" | "ambiguous" | "no_match"; tenantId: string; created: boolean };

export interface CsvMoveInPayload {
  eventId?: string;
  facilityId?: string;
  unit?: string;
  account?: string | null;
  tenantName?: string | null;
}

/**
 * Find (or create) the tenant for a CSV move-in and run lead matching on it.
 * Safe to run twice: the tenant is found again rather than duplicated, a lead
 * that is already matched is never a candidate again, and `lead.moved_in` is
 * keyed by tenant so nothing reports twice.
 */
export async function matchCsvMoveIn(p: CsvMoveInPayload): Promise<CsvMatchOutcome> {
  if (!p.facilityId || !p.unit) throw new Error("matchCsvMoveIn needs facilityId and unit");
  const facilityId = p.facilityId;

  const raw = await db.facility_pms_rent_roll.findFirst({
    where: { facility_id: facilityId, unit: p.unit, ...(p.account ? { account: p.account } : {}) },
    orderBy: { snapshot_date: "desc" },
    select: {
      unit: true, tenant_name: true, account: true, phone: true, email: true,
      size_label: true, rental_start: true, rent_rate: true, snapshot_date: true,
    },
  });
  if (!raw) return { outcome: "no_rent_roll_row" };

  const row: RentRollContactRow = { ...raw, rent_rate: raw.rent_rate == null ? null : Number(raw.rent_rate) };
  const draft = tenantFromRentRoll(facilityId, row, p.eventId ?? null);
  if (!draft) return { outcome: "no_contact" };

  // The same person may already be on file from the V1 tenants API or an
  // earlier run of this job. Account number is the PMS's own identity; without
  // one, the same name in the same unit is the same tenancy.
  const existing = draft.external_id
    ? await db.tenants.findFirst({
        where: { facility_id: facilityId, external_id: draft.external_id, deleted_at: null },
        select: { id: true },
      })
    : await db.tenants.findFirst({
        where: {
          facility_id: facilityId, unit_number: draft.unit_number, deleted_at: null, status: "active",
          name: { equals: draft.name, mode: "insensitive" },
        },
        select: { id: true },
      });

  const tenant = existing ?? (await db.tenants.create({ data: draft, select: { id: true } }));

  const result = await attemptAndPersistLeadMatch(
    db,
    {
      id: tenant.id,
      facility_id: facilityId,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      move_in_date: draft.move_in_date,
      monthly_rate: draft.monthly_rate,
    },
    { changedBy: "system:pms_csv" },
  );

  return { outcome: result.status, tenantId: tenant.id, created: !existing };
}
