import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { askHowTheyHeard } from "@/lib/attribution/heard-ask";

// Convert BigInt values to numbers in raw query results
function serializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInts);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = serializeBigInts(v);
    }
    return result;
  }
  return obj;
}

const ESCALATION_STAGES = [
  "late_notice",
  "second_notice",
  "pre_lien",
  "lien_filed",
  "auction_scheduled",
  "auction_complete",
];
const ESCALATION_THRESHOLDS: Record<string, number> = {
  late_notice: 1,
  second_notice: 8,
  pre_lien: 15,
  lien_filed: 31,
  auction_scheduled: 46,
  auction_complete: 61,
};

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "tenants");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireFacilityAccess(req);
  if (denied) return denied;

  try {
    const facilityId = req.nextUrl.searchParams.get("facilityId");
    const status = req.nextUrl.searchParams.get("status");
    const delinquent = req.nextUrl.searchParams.get("delinquent");
    const includeAnalytics = req.nextUrl.searchParams.get("includeAnalytics");
    const tenantId = req.nextUrl.searchParams.get("tenantId");

    if (tenantId) {
      const tenants = await db.$queryRaw<unknown[]>`
        SELECT t.*, f.name as facility_name, f.location as facility_location
        FROM tenants t JOIN facilities f ON f.id = t.facility_id
        WHERE t.id = ${tenantId}::uuid
      `;
      if (!tenants.length)
        return errorResponse("Tenant not found", 404, origin);

      // Re-guard against the tenant's OWN facility: the blanket check above
      // only validated the ?facilityId param, so without this a session
      // scoped to facility A could read any tenant by id (cross-tenant IDOR).
      // 404 (not the denial response) so unauthorized callers can't confirm
      // a tenant id exists.
      const tenantFacilityId = (tenants[0] as { facility_id: string })
        .facility_id;
      const tenantDenied = await requireFacilityAccess(req, tenantFacilityId);
      if (tenantDenied) return errorResponse("Tenant not found", 404, origin);

      const payments = await db.tenant_payments.findMany({
        where: { tenant_id: tenantId },
        orderBy: { payment_date: "desc" },
        take: 50,
      });
      const escalations = await db.delinquency_escalations.findMany({
        where: { tenant_id: tenantId },
        orderBy: { stage_entered_at: "desc" },
      });
      const churn = await db.churn_predictions.findUnique({
        where: { tenant_id: tenantId },
      });
      const upsells = await db.upsell_opportunities.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ["identified", "queued", "sent"] },
        },
        orderBy: { monthly_uplift: "desc" },
      });
      const comms = await db.tenant_communications.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: "desc" },
        take: 20,
      });

      return jsonResponse(
        {
          tenant: tenants[0],
          payments,
          escalations,
          churn,
          upsells,
          communications: comms,
        },
        200,
        origin,
      );
    }

    const whereParts: Prisma.Sql[] = [Prisma.sql`1=1`];

    if (facilityId) {
      whereParts.push(Prisma.sql`t.facility_id = ${facilityId}::uuid`);
    }
    if (status) {
      whereParts.push(Prisma.sql`t.status = ${status}`);
    }
    if (delinquent === "true") {
      whereParts.push(Prisma.sql`t.days_delinquent > 0`);
    }

    const whereClause = Prisma.join(whereParts, " AND ");

    const tenants = await db.$queryRaw<unknown[]>`
      SELECT t.*, f.name as facility_name, f.location as facility_location,
         cp.risk_score, cp.risk_level, cp.retention_status,
         COALESCE(uo.upsell_count, 0) as upsell_count,
         COALESCE(uo.upsell_potential, 0) as upsell_potential,
         de.current_stage, de.stage_entered_at as escalation_started
       FROM tenants t
       JOIN facilities f ON f.id = t.facility_id
       LEFT JOIN churn_predictions cp ON cp.tenant_id = t.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) as upsell_count, COALESCE(SUM(monthly_uplift), 0) as upsell_potential
         FROM upsell_opportunities WHERE tenant_id = t.id AND status IN ('identified','queued','sent')
       ) uo ON true
       LEFT JOIN LATERAL (
         SELECT stage as current_stage, stage_entered_at
         FROM delinquency_escalations WHERE tenant_id = t.id
         ORDER BY stage_entered_at DESC LIMIT 1
       ) de ON true
       WHERE ${whereClause}
       ORDER BY t.days_delinquent DESC, t.name ASC
    `;

    const facilityFilter = facilityId
      ? Prisma.sql`WHERE t.facility_id = ${facilityId}::uuid`
      : Prisma.empty;

    const stats = await db.$queryRaw<unknown[]>`
      SELECT
         COUNT(*) as total_tenants,
         COUNT(*) FILTER (WHERE t.status = 'active') as active_tenants,
         COUNT(*) FILTER (WHERE t.status = 'delinquent') as delinquent_tenants,
         COUNT(*) FILTER (WHERE t.days_delinquent > 0) as late_count,
         COUNT(*) FILTER (WHERE t.days_delinquent > 30) as severe_late_count,
         COUNT(*) FILTER (WHERE t.autopay_enabled = true) as autopay_count,
         SUM(t.monthly_rate) FILTER (WHERE t.status = 'active') as total_mrr,
         SUM(t.balance) FILTER (WHERE t.balance > 0) as total_outstanding,
         AVG(t.days_delinquent) FILTER (WHERE t.days_delinquent > 0) as avg_days_late,
         COUNT(*) FILTER (WHERE cp.risk_level IN ('high','critical')) as at_risk_count,
         COALESCE(SUM(t.monthly_rate) FILTER (WHERE cp.risk_level IN ('high','critical')), 0) as at_risk_revenue
       FROM tenants t
       LEFT JOIN churn_predictions cp ON cp.tenant_id = t.id
       ${facilityFilter}
    `;

    const upsellFacilityFilter = facilityId
      ? Prisma.sql`AND facility_id = ${facilityId}::uuid`
      : Prisma.empty;

    const upsellStats = await db.$queryRaw<unknown[]>`
      SELECT COALESCE(SUM(monthly_uplift), 0) as total_upsell_potential,
              COUNT(*) as total_upsell_opps
       FROM upsell_opportunities
       WHERE status = 'identified'
       ${upsellFacilityFilter}
    `;

    const paymentsFacilityFilter = facilityId
      ? Prisma.sql`WHERE tp.facility_id = ${facilityId}::uuid`
      : Prisma.empty;

    const recentPayments = await db.$queryRaw<unknown[]>`
      SELECT tp.*, t.name as tenant_name, t.unit_number
       FROM tenant_payments tp
       JOIN tenants t ON t.id = tp.tenant_id
       ${paymentsFacilityFilter}
       ORDER BY tp.payment_date DESC
       LIMIT 20
    `;

    const result: Record<string, unknown> = {
      tenants,
      stats: {
        ...((stats as Array<Record<string, unknown>>)[0] || {}),
        ...((upsellStats as Array<Record<string, unknown>>)[0] || {}),
      },
      recentPayments,
    };

    if (includeAnalytics === "true") {
      const analyticsFacilityFilter = facilityId
        ? Prisma.sql`AND facility_id = ${facilityId}::uuid`
        : Prisma.empty;

      const monthlyCollections = await db.$queryRaw<unknown[]>`
        SELECT date_trunc('month', payment_date)::date as month,
                SUM(amount) FILTER (WHERE status = 'paid') as collected,
                SUM(amount) FILTER (WHERE status IN ('pending','failed','late')) as outstanding,
                COUNT(*) as payment_count
         FROM tenant_payments
         WHERE payment_date >= NOW() - INTERVAL '6 months'
         ${analyticsFacilityFilter}
         GROUP BY date_trunc('month', payment_date)
         ORDER BY month
      `;

      const methodBreakdown = await db.$queryRaw<unknown[]>`
        SELECT method, COUNT(*) as count, SUM(amount) as total
         FROM tenant_payments
         WHERE payment_date >= NOW() - INTERVAL '6 months'
         ${analyticsFacilityFilter}
         GROUP BY method
         ORDER BY total DESC
      `;

      const collectionRate = await db.$queryRaw<unknown[]>`
        SELECT
           COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
           COUNT(*) as total_count,
           ROUND(COUNT(*) FILTER (WHERE status = 'paid')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) as rate
         FROM tenant_payments
         WHERE payment_date >= NOW() - INTERVAL '30 days'
         ${analyticsFacilityFilter}
      `;

      result.analytics = {
        monthlyCollections,
        methodBreakdown,
        collectionRate: (collectionRate as unknown[])[0],
      };
    }

    return jsonResponse(serializeBigInts(result), 200, origin);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      origin,
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "tenants");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { tenants: bulkTenants, action } = body;

    if (action === "auto_escalate") {
      const { facilityId } = body;
      const escalateDenied = await requireFacilityAccess(req, facilityId);
      if (escalateDenied) return escalateDenied;
      const escalateFacilityFilter = facilityId
        ? Prisma.sql`AND t.facility_id = ${facilityId}::uuid`
        : Prisma.empty;

      const delinquent = await db.$queryRaw<
        Array<{
          id: string;
          facility_id: string;
          days_delinquent: number;
          status: string;
        }>
      >`
        SELECT t.* FROM tenants t WHERE t.days_delinquent > 0 AND t.status IN ('active','delinquent')
         ${escalateFacilityFilter}
      `;

      const escalated = await db.$transaction(async (tx) => {
        let count = 0;
        for (const t of delinquent) {
          const current = await tx.delinquency_escalations.findFirst({
            where: { tenant_id: t.id },
            orderBy: { stage_entered_at: "desc" },
            select: { stage: true },
          });

          const currentIdx = current
            ? ESCALATION_STAGES.indexOf(current.stage)
            : -1;

          let targetStage: string | null = null;
          for (let i = ESCALATION_STAGES.length - 1; i >= 0; i--) {
            if (
              t.days_delinquent >= ESCALATION_THRESHOLDS[ESCALATION_STAGES[i]]
            ) {
              targetStage = ESCALATION_STAGES[i];
              break;
            }
          }

          if (
            targetStage &&
            ESCALATION_STAGES.indexOf(targetStage) > currentIdx
          ) {
            const nextIdx = ESCALATION_STAGES.indexOf(targetStage) + 1;
            const nextStageAt =
              nextIdx < ESCALATION_STAGES.length
                ? new Date(Date.now() + 7 * 86400000)
                : null;

            await tx.delinquency_escalations.create({
              data: {
                tenant_id: t.id,
                facility_id: t.facility_id,
                stage: targetStage,
                next_stage_at: nextStageAt,
                automated: true,
              },
            });

            if (t.status !== "delinquent") {
              await tx.tenants.update({
                where: { id: t.id },
                data: { status: "delinquent", updated_at: new Date() },
              });
            }
            count++;
          }
        }
        return count;
      }, { maxWait: 10000, timeout: 30000 });

      return jsonResponse(
        { escalated, message: `Escalated ${escalated} tenants` },
        200,
        origin,
      );
    }

    if (Array.isArray(bulkTenants)) {
      const facility_id = body.facility_id;
      if (!facility_id)
        return errorResponse(
          "facility_id required for bulk import",
          400,
          origin,
        );

      const bulkDenied = await requireFacilityAccess(req, facility_id);
      if (bulkDenied) return bulkDenied;

      let imported = 0;
      let skipped = 0;
      const errors: Array<{
        name: string;
        unit: string;
        error: string;
      }> = [];

      for (const t of bulkTenants) {
        try {
          if (!t.name || !t.unit_number) {
            skipped++;
            continue;
          }
          await db.$queryRaw`
            INSERT INTO tenants (facility_id, external_id, name, email, phone, unit_number, unit_size, unit_type,
              monthly_rate, move_in_date, autopay_enabled, has_insurance, insurance_monthly, balance, status)
            VALUES (${facility_id}::uuid, ${t.external_id || null}, ${t.name}, ${t.email || null}, ${t.phone || null},
              ${t.unit_number}, ${t.unit_size || null}, ${t.unit_type || "standard"},
              ${parseFloat(t.monthly_rate) || 0}, ${t.move_in_date || new Date().toISOString().slice(0, 10)},
              ${t.autopay_enabled === true || t.autopay_enabled === "true"},
              ${t.has_insurance === true || t.has_insurance === "true"},
              ${parseFloat(t.insurance_monthly) || 0}, ${parseFloat(t.balance) || 0}, ${t.status || "active"})
            ON CONFLICT (facility_id, external_id) WHERE external_id IS NOT NULL
            DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
              unit_number = EXCLUDED.unit_number, unit_size = EXCLUDED.unit_size, monthly_rate = EXCLUDED.monthly_rate,
              autopay_enabled = EXCLUDED.autopay_enabled, has_insurance = EXCLUDED.has_insurance,
              balance = EXCLUDED.balance, status = EXCLUDED.status, updated_at = NOW()
            RETURNING id
          `;
          imported++;
          // Only with a stated move-in date: a row without one is dated today,
          // and an old tenant must never get a "welcome".
          if (t.move_in_date && t.email && (!t.status || t.status === "active")) {
            const row = await db.tenants.findFirst({
              where: { facility_id, name: t.name, unit_number: t.unit_number, deleted_at: null },
              select: { id: true },
              orderBy: { created_at: "desc" },
            });
            if (row) {
              await askHowTheyHeard({ id: row.id, facility_id, name: t.name, email: t.email, phone: t.phone, move_in_date: t.move_in_date });
            }
          }
        } catch (err) {
          errors.push({
            name: t.name,
            unit: t.unit_number,
            error: err instanceof Error ? err.message : "Unknown error",
          });
          skipped++;
        }
      }

      return jsonResponse({ imported, skipped, errors }, 200, origin);
    }

    const {
      facility_id,
      external_id,
      name,
      email,
      phone,
      unit_number,
      unit_size,
      unit_type,
      monthly_rate,
      move_in_date,
      autopay_enabled,
      has_insurance,
      insurance_monthly,
      balance,
      status: tenantStatus,
    } = body;

    if (!facility_id || !name || !unit_number) {
      return errorResponse(
        "facility_id, name, and unit_number are required",
        400,
        origin,
      );
    }

    const createDenied = await requireFacilityAccess(req, facility_id);
    if (createDenied) return createDenied;

    const rows = await db.$queryRaw<unknown[]>`
      INSERT INTO tenants (facility_id, external_id, name, email, phone, unit_number, unit_size, unit_type,
        monthly_rate, move_in_date, autopay_enabled, has_insurance, insurance_monthly, balance, status)
      VALUES (${facility_id}::uuid, ${external_id || null}, ${name}, ${email || null}, ${phone || null},
        ${unit_number}, ${unit_size || null}, ${unit_type || "standard"},
        ${monthly_rate || 0}, ${move_in_date || new Date().toISOString().slice(0, 10)},
        ${autopay_enabled || false}, ${has_insurance || false}, ${insurance_monthly || 0}, ${balance || 0}, ${tenantStatus || "active"})
      ON CONFLICT (facility_id, external_id) WHERE external_id IS NOT NULL
      DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
        unit_number = EXCLUDED.unit_number, unit_size = EXCLUDED.unit_size, monthly_rate = EXCLUDED.monthly_rate,
        autopay_enabled = EXCLUDED.autopay_enabled, has_insurance = EXCLUDED.has_insurance,
        balance = EXCLUDED.balance, status = EXCLUDED.status, updated_at = NOW()
      RETURNING *
    `;

    const created = (rows as { id?: string }[])[0];
    if (created?.id && move_in_date && email && (!tenantStatus || tenantStatus === "active")) {
      await askHowTheyHeard({ id: created.id, facility_id, name, email, phone, move_in_date });
    }

    return jsonResponse({ tenant: (rows as unknown[])[0] }, 200, origin);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      origin,
    );
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "tenants");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { id, ids, action, ...updates } = body;

    if (Array.isArray(ids) && ids.length > 0) {
      // Authorize every facility represented in the batch.
      const idTenants = await db.tenants.findMany({
        where: { id: { in: ids } },
        select: { facility_id: true },
      });
      if (idTenants.length === 0) return errorResponse("Not found", 404, origin);
      const idFacilityIds = [...new Set(idTenants.map((t) => t.facility_id))];
      for (const fid of idFacilityIds) {
        const batchDenied = await requireFacilityAccess(req, fid);
        if (batchDenied) return batchDenied;
      }

      if (action === "batch_status") {
        const { status: batchStatus } = updates;
        await db.$executeRaw`
          UPDATE tenants SET status = ${batchStatus}, updated_at = NOW() WHERE id = ANY(${ids}::uuid[])
        `;
        return jsonResponse({ updated: ids.length }, 200, origin);
      }
      if (action === "batch_move_out") {
        const today = new Date().toISOString().slice(0, 10);
        await db.$transaction(async (tx) => {
          await tx.$executeRaw`
            UPDATE tenants SET status = 'moved_out', moved_out_date = ${today}::date, move_out_reason = 'voluntary', updated_at = NOW()
            WHERE id = ANY(${ids}::uuid[])
          `;
          for (const tid of ids) {
            const t = await tx.tenants.findUnique({ where: { id: tid } });
            if (t) {
              await tx.$executeRaw`
                INSERT INTO moveout_remarketing (tenant_id, facility_id, moved_out_date, move_out_reason, sequence_status, next_send_at)
                VALUES (${tid}::uuid, ${t.facility_id}::uuid, ${t.moved_out_date || today}::date, ${t.move_out_reason || "voluntary"}, 'active', NOW() + INTERVAL '3 days')
                ON CONFLICT (tenant_id) DO NOTHING
              `;
            }
          }
        }, { maxWait: 10000, timeout: 30000 });
        return jsonResponse({ updated: ids.length }, 200, origin);
      }
      if (action === "batch_autopay_invite") {
        for (const tid of ids) {
          await db.$executeRaw`
            INSERT INTO tenant_communications (tenant_id, facility_id, channel, type, subject, status)
            SELECT ${tid}::uuid, facility_id, 'email', 'general', 'Autopay enrollment invitation', 'sent'
            FROM tenants WHERE id = ${tid}::uuid
          `;
        }
        return jsonResponse({ sent: ids.length }, 200, origin);
      }
      return errorResponse("Unknown batch action", 400, origin);
    }

    if (!id) return errorResponse("id or ids required", 400, origin);

    const existingTenant = await db.tenants.findUnique({
      where: { id },
      select: { facility_id: true },
    });
    if (!existingTenant) return errorResponse("Not found", 404, origin);
    const idDenied = await requireFacilityAccess(req, existingTenant.facility_id);
    if (idDenied) return idDenied;

    if (action === "record_payment") {
      const { amount, payment_date, due_date, method } = updates;
      const daysLate =
        due_date && payment_date
          ? Math.max(
              0,
              Math.floor(
                (new Date(payment_date).getTime() -
                  new Date(due_date).getTime()) /
                  86400000,
              ),
            )
          : 0;

      const rows = await db.$transaction(async (tx) => {
        const inserted = await tx.$queryRaw<unknown[]>`
          INSERT INTO tenant_payments (tenant_id, facility_id, amount, payment_date, due_date, method, status, days_late)
          SELECT ${id}::uuid, facility_id, ${amount}, ${payment_date}::date, ${due_date}::date, ${method || "manual"}, ${daysLate > 0 ? "late" : "paid"}, ${daysLate}
          FROM tenants WHERE id = ${id}::uuid
          RETURNING *
        `;

        await tx.$executeRaw`
          UPDATE tenants SET balance = GREATEST(0, balance - ${amount}), last_payment_date = ${payment_date}::date,
            days_delinquent = CASE WHEN balance - ${amount} <= 0 THEN 0 ELSE days_delinquent END,
            status = CASE WHEN balance - ${amount} <= 0 THEN 'active' ELSE status END,
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        return inserted;
      });

      return jsonResponse(
        { payment: (rows as unknown[])[0] || null },
        200,
        origin,
      );
    }

    if (action === "move_out") {
      const { moved_out_date, move_out_reason } = updates;
      const moveDate =
        moved_out_date || new Date().toISOString().slice(0, 10);
      const reason = move_out_reason || "voluntary";

      const rows = await db.$transaction(async (tx) => {
        const updated = await tx.$queryRaw<
          Array<{ id: string; facility_id: string; moved_out_date: Date; move_out_reason: string }>
        >`
          UPDATE tenants SET status = 'moved_out', moved_out_date = ${moveDate}::date, move_out_reason = ${reason}, updated_at = NOW()
          WHERE id = ${id}::uuid RETURNING *
        `;

        if (updated.length) {
          const tenant = updated[0];
          await tx.$executeRaw`
            INSERT INTO moveout_remarketing (tenant_id, facility_id, moved_out_date, move_out_reason, sequence_status, next_send_at)
            VALUES (${id}::uuid, ${tenant.facility_id}::uuid, ${tenant.moved_out_date}::date, ${tenant.move_out_reason}, 'active', NOW() + INTERVAL '3 days')
            ON CONFLICT (tenant_id) DO NOTHING
          `;
        }

        return updated;
      });

      return jsonResponse(
        { tenant: (rows as unknown[])[0] || null },
        200,
        origin,
      );
    }

    if (action === "escalate") {
      const current = await db.delinquency_escalations.findFirst({
        where: { tenant_id: id },
        orderBy: { stage_entered_at: "desc" },
        select: { stage: true },
      });
      const currentIdx = current
        ? ESCALATION_STAGES.indexOf(current.stage)
        : -1;
      const nextIdx = currentIdx + 1;
      if (nextIdx >= ESCALATION_STAGES.length) {
        return jsonResponse({ error: "Already at final stage" }, 200, origin);
      }

      const nextStage = ESCALATION_STAGES[nextIdx];
      const futureIdx = nextIdx + 1;
      const nextStageAt =
        futureIdx < ESCALATION_STAGES.length
          ? new Date(Date.now() + 7 * 86400000)
          : null;

      const tenant = await db.tenants.findUnique({
        where: { id },
        select: { facility_id: true },
      });
      if (!tenant) return errorResponse("Tenant not found", 404, origin);

      const esc = await db.delinquency_escalations.create({
        data: {
          tenant_id: id,
          facility_id: tenant.facility_id,
          stage: nextStage,
          next_stage_at: nextStageAt,
          automated: false,
          notes: updates.notes || null,
        },
      });

      return jsonResponse({ escalation: esc }, 200, origin);
    }

    if (action === "de_escalate") {
      const latest = await db.delinquency_escalations.findFirst({
        where: { tenant_id: id },
        orderBy: { stage_entered_at: "desc" },
        select: { id: true },
      });
      if (latest) {
        await db.delinquency_escalations.delete({
          where: { id: latest.id },
        });
      }
      return jsonResponse({ ok: true }, 200, origin);
    }

    const allowed = [
      "name",
      "email",
      "phone",
      "unit_number",
      "unit_size",
      "monthly_rate",
      "autopay_enabled",
      "has_insurance",
      "balance",
      "days_delinquent",
      "status",
    ];
    const setParts: Prisma.Sql[] = [];
    for (const [k, v] of Object.entries(updates)) {
      if (allowed.includes(k)) {
        setParts.push(Prisma.sql`${Prisma.raw(k)} = ${v}`);
      }
    }
    if (setParts.length === 0)
      return errorResponse("No valid fields to update", 400, origin);
    setParts.push(Prisma.sql`updated_at = NOW()`);

    const setClause = Prisma.join(setParts, ", ");

    const rows = await db.$queryRaw<unknown[]>`
      UPDATE tenants SET ${setClause} WHERE id = ${id}::uuid RETURNING *
    `;

    return jsonResponse(
      { tenant: (rows as unknown[])[0] || null },
      200,
      origin,
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      origin,
    );
  }
}
