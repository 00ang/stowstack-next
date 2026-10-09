import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  v1CorsResponse,
  v1Json,
  v1Error,
  requireApiAuth,
  isErrorResponse,
  requireScope,
  requireOrgFacility,
} from "@/lib/v1-auth";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidUuid } from "@/lib/validation";
import { enrollIfMovedOut } from "@/lib/moveout-trigger";
import { attemptAndPersistLeadMatch } from "@/lib/lead-matching";
import { markTenantChurned } from "@/lib/retention-outcomes";
import { askHowTheyHeard } from "@/lib/attribution/heard-ask";

export async function OPTIONS() {
  return v1CorsResponse();
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-tenants");
  if (limited) return limited;
  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "tenants:read");
  if (scopeErr) return scopeErr;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const facilityId = url.searchParams.get("facilityId");

  if (id && !isValidUuid(id)) return v1Error("Invalid id format", 400);
  if (facilityId && !isValidUuid(facilityId)) return v1Error("Invalid facilityId format", 400);

  try {
    if (id) {
      const rows = await db.$queryRaw<Record<string, unknown>[]>`
        SELECT t.id, t.facility_id, t.external_id, t.name, t.email, t.phone,
               t.unit_number, t.unit_size, t.unit_type, t.monthly_rate,
               t.move_in_date, t.lease_end_date, t.autopay_enabled, t.has_insurance,
               t.balance, t.status, t.days_delinquent, t.last_payment_date,
               t.moved_out_date, t.move_out_reason, t.created_at, t.updated_at
        FROM tenants t
        JOIN facilities f ON f.id = t.facility_id
        WHERE t.id = ${id}::uuid AND f.organization_id = ${orgId}::uuid
      `;
      if (!rows.length) return v1Error("Tenant not found", 404);

      const payments = await db.$queryRaw`
        SELECT id, amount, payment_date, due_date, method, status, days_late, created_at
        FROM tenant_payments WHERE tenant_id = ${id}::uuid ORDER BY payment_date DESC LIMIT 20
      `;

      return v1Json({ tenant: rows[0], payments });
    }

    if (!facilityId) return v1Error("facilityId or id is required");

    const facility = await requireOrgFacility(facilityId, orgId);
    if (facility instanceof Response) return facility;

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;
    const status = url.searchParams.get("status");

    let tenants: Record<string, unknown>[];
    let countRows: { total: number }[];

    if (status) {
      tenants = await db.$queryRaw`
        SELECT t.id, t.external_id, t.name, t.email, t.phone,
               t.unit_number, t.unit_size, t.unit_type, t.monthly_rate,
               t.move_in_date, t.autopay_enabled, t.has_insurance,
               t.balance, t.status, t.days_delinquent, t.last_payment_date,
               t.created_at, t.updated_at
        FROM tenants t WHERE t.facility_id = ${facilityId}::uuid AND t.status = ${status}
        ORDER BY t.name ASC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await db.$queryRaw`
        SELECT COUNT(*)::int AS total FROM tenants t
        WHERE t.facility_id = ${facilityId}::uuid AND t.status = ${status}
      `;
    } else {
      tenants = await db.$queryRaw`
        SELECT t.id, t.external_id, t.name, t.email, t.phone,
               t.unit_number, t.unit_size, t.unit_type, t.monthly_rate,
               t.move_in_date, t.autopay_enabled, t.has_insurance,
               t.balance, t.status, t.days_delinquent, t.last_payment_date,
               t.created_at, t.updated_at
        FROM tenants t WHERE t.facility_id = ${facilityId}::uuid
        ORDER BY t.name ASC LIMIT ${limit} OFFSET ${offset}
      `;
      countRows = await db.$queryRaw`
        SELECT COUNT(*)::int AS total FROM tenants t WHERE t.facility_id = ${facilityId}::uuid
      `;
    }

    const total = countRows[0]?.total || 0;
    return v1Json({ tenants, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    return v1Error("Failed to fetch tenants", 500);
  }
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-tenants");
  if (limited) return limited;
  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "tenants:write");
  if (scopeErr) return scopeErr;

  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const fId = body?.facilityId || url.searchParams.get("facilityId");
  const tenantList = body?.tenants;

  if (!fId || !Array.isArray(tenantList) || !tenantList.length) {
    return v1Error("facilityId and tenants[] are required");
  }
  if (!isValidUuid(fId)) return v1Error("Invalid facilityId format", 400);

  const facility = await requireOrgFacility(fId, orgId);
  if (facility instanceof Response) return facility;

  try {
    let imported = 0;
    let enrolled = 0;
    let matched = 0;
    const errors: { name: string; error: string }[] = [];

    for (const t of tenantList) {
      if (!t.name) {
        errors.push({ name: t.name, error: "name required" });
        continue;
      }

      try {
        const inserted = await db.$queryRaw<Array<{ id: string }>>`
          INSERT INTO tenants (facility_id, external_id, name, email, phone, unit_number,
                               unit_size, unit_type, monthly_rate, move_in_date,
                               autopay_enabled, has_insurance, balance, status,
                               moved_out_date, move_out_reason)
          VALUES (${fId}::uuid, ${t.externalId || null}, ${t.name}, ${t.email || null}, ${t.phone || null},
                  ${t.unitNumber || null}, ${t.unitSize || null}, ${t.unitType || null},
                  ${t.monthlyRate || null}, ${t.moveInDate || null}::date,
                  ${t.autopayEnabled || false}, ${t.hasInsurance || false},
                  ${t.balance || 0}, ${t.status || "active"},
                  ${t.movedOutDate || null}::date, ${t.moveOutReason || null})
          ON CONFLICT (facility_id, external_id)
          WHERE external_id IS NOT NULL
          DO UPDATE SET
            name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
            unit_number = EXCLUDED.unit_number, unit_size = EXCLUDED.unit_size,
            unit_type = EXCLUDED.unit_type, monthly_rate = EXCLUDED.monthly_rate,
            autopay_enabled = EXCLUDED.autopay_enabled, has_insurance = EXCLUDED.has_insurance,
            balance = EXCLUDED.balance, status = EXCLUDED.status,
            moved_out_date = EXCLUDED.moved_out_date, move_out_reason = EXCLUDED.move_out_reason,
            updated_at = NOW()
          RETURNING id
        `;
        imported++;

        if (inserted.length && t.status === "moved_out") {
          try {
            const result = await enrollIfMovedOut(db, inserted[0].id);
            if (result.enrolled) enrolled++;
          } catch {
            // Enrollment failure is non-fatal; import already succeeded.
          }
          try {
            await markTenantChurned(db, inserted[0].id);
          } catch {
            // Outcome tracking failure is non-fatal.
          }
        }

        // Attribution: when an active tenant lands via PMS import, try to
        // match them to a partial_lead and close the loop. Skip already
        // moved-out tenants (no inquiry-to-move-in flow).
        if (
          inserted.length &&
          (t.status === "active" || !t.status) &&
          t.moveInDate
        ) {
          try {
            const matchResult = await attemptAndPersistLeadMatch(
              db,
              {
                id: inserted[0].id,
                facility_id: fId,
                name: t.name,
                email: t.email,
                phone: t.phone,
                move_in_date: t.moveInDate,
                monthly_rate: t.monthlyRate ?? null,
              },
              { changedBy: `api_key:${apiKey.id}` },
            );
            if (matchResult.linked) matched++;
          } catch {
            // Match failure is non-fatal; import already succeeded.
          }
          // Ask a new tenant how they found the facility, when the owner has that on.
          await askHowTheyHeard({
            id: inserted[0].id,
            facility_id: fId,
            name: t.name,
            email: t.email ?? null,
            phone: t.phone ?? null,
            move_in_date: t.moveInDate,
          });
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ name: t.name, error: message });
      }
    }

    return v1Json({ imported, enrolled, matched, total: tenantList.length, errors });
  } catch {
    return v1Error("Failed to import tenants", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-tenants");
  if (limited) return limited;
  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "tenants:write");
  if (scopeErr) return scopeErr;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return v1Error("id query param is required");
  if (!isValidUuid(id)) return v1Error("Invalid id format", 400);

  const body = await request.json().catch(() => null);
  if (!body) return v1Error("No valid fields to update");

  const ALLOWED_COLUMNS: Record<string, string> = {
    name: "name",
    email: "email",
    phone: "phone",
    unitNumber: "unit_number",
    unitSize: "unit_size",
    unitType: "unit_type",
    monthlyRate: "monthly_rate",
    moveInDate: "move_in_date",
    autopayEnabled: "autopay_enabled",
    hasInsurance: "has_insurance",
    balance: "balance",
    status: "status",
    daysDelinquent: "days_delinquent",
    movedOutDate: "moved_out_date",
    moveOutReason: "move_out_reason",
  };

  const setClauses: Prisma.Sql[] = [];

  for (const [bodyKey, dbCol] of Object.entries(ALLOWED_COLUMNS)) {
    if (body[bodyKey] !== undefined) {
      setClauses.push(Prisma.sql`${Prisma.raw(dbCol)} = ${body[bodyKey]}`);
    }
  }

  if (!setClauses.length) return v1Error("No valid fields to update");
  setClauses.push(Prisma.sql`updated_at = NOW()`);

  const setFragment = Prisma.join(setClauses, ", ");

  const movedOutTouched =
    body.movedOutDate !== undefined ||
    body.moveOutReason !== undefined ||
    body.status === "moved_out";

  try {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      UPDATE tenants SET ${setFragment}
       FROM facilities f
       WHERE tenants.id = ${id}::uuid
         AND tenants.facility_id = f.id
         AND f.organization_id = ${orgId}::uuid
       RETURNING tenants.id, tenants.facility_id, tenants.name, tenants.email,
                 tenants.unit_number, tenants.unit_size, tenants.status, tenants.updated_at
    `;
    if (!rows.length) return v1Error("Tenant not found", 404);

    let enrolled = false;
    if (movedOutTouched) {
      try {
        const result = await enrollIfMovedOut(db, id);
        enrolled = result.enrolled;
      } catch {
        // Enrollment failure is non-fatal; update already succeeded.
      }
      try {
        await markTenantChurned(db, id);
      } catch {
        // Outcome tracking failure is non-fatal.
      }
    }

    return v1Json({ tenant: rows[0], moveoutEnrolled: enrolled });
  } catch {
    return v1Error("Failed to update tenant", 500);
  }
}
