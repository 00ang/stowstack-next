import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { scheduleDetection } from "@/lib/events/detect";
import { jsonResponse, errorResponse, getOrigin, corsResponse, requireAdminKey } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

function parseDate(str: string | null | undefined): string | null {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return str;
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "storedge-import");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { report_type, facility_id, data } = body || {};

    if (!facility_id || !report_type || !data) {
      return errorResponse("facility_id, report_type, and data required", 400, origin);
    }

    let result: Record<string, unknown> = {};

    if (report_type === "consolidated_occupancy") {
      const { units, totals } = data;

      const txResult = await db.$transaction(async (tx) => {
        let unitsSaved = 0;
        for (const u of units) {
          await tx.$executeRaw`
            INSERT INTO facility_pms_units (facility_id, unit_type, size_label, width_ft, depth_ft, sqft, floor, features, total_count, occupied_count, street_rate, actual_avg_rate, web_rate, push_rate, ecri_eligible)
            VALUES (${facility_id}::uuid, ${u.unit_type}, ${u.size_label}, ${u.width_ft}, ${u.depth_ft}, ${u.sqft}, ${u.floor || ""}, ${u.features || []}, ${u.total_count}, ${u.occupied_count}, ${u.street_rate}, ${u.actual_avg_rate}, ${null}, ${null}, ${0})
            ON CONFLICT (facility_id, unit_type) DO UPDATE SET
              size_label = EXCLUDED.size_label, width_ft = EXCLUDED.width_ft, depth_ft = EXCLUDED.depth_ft,
              sqft = EXCLUDED.sqft, floor = EXCLUDED.floor, features = EXCLUDED.features,
              total_count = EXCLUDED.total_count, occupied_count = EXCLUDED.occupied_count,
              street_rate = EXCLUDED.street_rate, actual_avg_rate = COALESCE(EXCLUDED.actual_avg_rate, facility_pms_units.actual_avg_rate),
              last_updated = NOW()
          `;
          unitsSaved++;
        }

        const snapshot = await tx.$queryRaw<Array<Record<string, unknown>>>`
          INSERT INTO facility_pms_snapshots (facility_id, snapshot_date, total_units, occupied_units, occupancy_pct, total_sqft, occupied_sqft, gross_potential, actual_revenue, notes)
          VALUES (${facility_id}::uuid, CURRENT_DATE, ${totals.total_units}, ${totals.occupied}, ${totals.occupancy_pct}, ${totals.total_sqft}, ${totals.occupied_sqft}, ${totals.scheduled_rent}, ${totals.actual_rent}, ${"Imported from storEDGE Consolidated Occupancy"})
          ON CONFLICT (facility_id, snapshot_date) DO UPDATE SET
            total_units = EXCLUDED.total_units, occupied_units = EXCLUDED.occupied_units,
            occupancy_pct = EXCLUDED.occupancy_pct, total_sqft = EXCLUDED.total_sqft,
            occupied_sqft = EXCLUDED.occupied_sqft, gross_potential = EXCLUDED.gross_potential,
            actual_revenue = EXCLUDED.actual_revenue, notes = EXCLUDED.notes, updated_at = NOW()
          RETURNING *
        `;

        await tx.facilities.update({
          where: { id: facility_id },
          data: { pms_uploaded: true, updated_at: new Date() },
        });

        return { units_saved: unitsSaved, snapshot: snapshot[0] };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "rent_roll") {
      const txResult = await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM facility_pms_rent_roll WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
        `;

        let count = 0;
        for (const r of data) {
          const tenantName = [r.first_name, r.last_name].filter(Boolean).join(" ");
          await tx.$executeRaw`
            INSERT INTO facility_pms_rent_roll (facility_id, snapshot_date, unit, size_label, tenant_name, account, rental_start, paid_thru, rent_rate, insurance_premium, total_due, days_past_due)
            VALUES (${facility_id}::uuid, CURRENT_DATE, ${r.unit}, ${r.size}, ${tenantName}, ${r.account}, ${parseDate(r.rental_start)}::date, ${parseDate(r.paid_thru)}::date, ${r.rent_rate || null}, ${r.insurance_premium || null}, ${r.total_due || 0}, ${r.days_past_due || 0})
          `;
          count++;
        }
        return { tenants_imported: count };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "rent_rates_by_tenant") {
      const txResult = await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM facility_pms_tenant_rates WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
        `;

        const today = new Date();
        const byType: Record<string, { rates: number[]; ecriCount: number }> = {};
        let tenantCount = 0;

        for (const r of data) {
          const key = `${r.unit_w}x${r.unit_l} ${r.unit_type} ${r.access_type}`.trim();
          if (!byType[key]) byType[key] = { rates: [], ecriCount: 0 };
          byType[key].rates.push(r.actual_rate);

          let daysAsTenant = 0;
          if (r.moved_in) {
            const parts = r.moved_in.split("/");
            if (parts.length === 3) {
              const moveDate = new Date(
                `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`
              );
              daysAsTenant = Math.floor(
                (today.getTime() - moveDate.getTime()) / (1000 * 60 * 60 * 24)
              );
            }
          }

          const payingBelow = r.rate_variance < 0;
          const longTenure = daysAsTenant >= 180;
          const ecriFlag = payingBelow && longTenure;
          const ecriSuggested = ecriFlag
            ? Math.round((r.actual_rate + Math.abs(r.rate_variance) * 0.8) * 100) / 100
            : null;
          const ecriLift = ecriFlag
            ? Math.round(Math.abs(r.rate_variance) * 0.8 * 100) / 100
            : null;

          if (ecriFlag) byType[key].ecriCount++;

          const sizeLabel = `${r.unit_w}x${r.unit_l}`;
          await tx.$executeRaw`
            INSERT INTO facility_pms_tenant_rates (facility_id, snapshot_date, unit, size_label, unit_type, access_type, tenant_name, moved_in, standard_rate, actual_rate, paid_rate, rate_variance, discount, discount_desc, days_as_tenant, ecri_flag, ecri_suggested, ecri_revenue_lift)
            VALUES (${facility_id}::uuid, CURRENT_DATE, ${r.unit}, ${sizeLabel}, ${r.unit_type}, ${r.access_type}, ${r.tenant_name}, ${parseDate(r.moved_in)}::date, ${r.standard_rate}, ${r.actual_rate}, ${r.paid_rate}, ${r.rate_variance}, ${r.discount}, ${r.discount_description}, ${daysAsTenant}, ${ecriFlag}, ${ecriSuggested}, ${ecriLift})
          `;
          tenantCount++;
        }

        let updated = 0;
        for (const [unitType, info] of Object.entries(byType)) {
          const avgRate =
            info.rates.reduce((s: number, r: number) => s + r, 0) / info.rates.length;
          const roundedAvgRate = Math.round(avgRate * 100) / 100;
          const res = await tx.$executeRaw`
            UPDATE facility_pms_units SET actual_avg_rate = ${roundedAvgRate}, ecri_eligible = ${info.ecriCount}, last_updated = NOW()
            WHERE facility_id = ${facility_id}::uuid AND unit_type = ${unitType}
          `;
          if (typeof res === "number" && res > 0) updated++;
        }
        return { unit_types_updated: updated, tenant_rates_stored: tenantCount };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "aging") {
      const { rows: agingRows, totals } = data;

      const txResult = await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM facility_pms_aging WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
        `;

        let count = 0;
        for (const r of agingRows) {
          const tenantName = [r.first_name, r.last_name].filter(Boolean).join(" ");
          await tx.$executeRaw`
            INSERT INTO facility_pms_aging (facility_id, snapshot_date, unit, tenant_name, bucket_0_30, bucket_31_60, bucket_61_90, bucket_91_120, bucket_120_plus, total, move_out_date)
            VALUES (${facility_id}::uuid, CURRENT_DATE, ${r.unit}, ${tenantName}, ${r.bucket_0_30}, ${r.bucket_31_60}, ${r.bucket_61_90}, ${r.bucket_91_120}, ${r.bucket_120_plus}, ${r.total}, (${parseDate(r.move_out) || null})::date)
          `;
          count++;
        }

        if (totals.total > 0) {
          await tx.$executeRaw`
            UPDATE facility_pms_snapshots SET delinquency_pct = ${null}, updated_at = NOW()
            WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
          `;
        }

        return { aging_records: count, total_outstanding: totals.total };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "annual_revenue") {
      const txResult = await db.$transaction(async (tx) => {
        let count = 0;
        for (const r of data) {
          await tx.$executeRaw`
            INSERT INTO facility_pms_revenue_history (facility_id, year, month, quarter, revenue, monthly_tax, move_ins, move_outs)
            VALUES (${facility_id}::uuid, ${r.year}, ${r.month}, ${r.quarter}, ${r.revenue}, ${r.monthly_tax}, ${r.move_ins}, ${r.move_outs})
            ON CONFLICT (facility_id, year, month) DO UPDATE SET
              quarter = EXCLUDED.quarter, revenue = EXCLUDED.revenue, monthly_tax = EXCLUDED.monthly_tax,
              move_ins = EXCLUDED.move_ins, move_outs = EXCLUDED.move_outs
          `;
          count++;
        }

        const latest = data[data.length - 1];
        if (latest) {
          await tx.$executeRaw`
            UPDATE facility_pms_snapshots SET move_ins_mtd = ${latest.move_ins}, move_outs_mtd = ${latest.move_outs}, updated_at = NOW()
            WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
          `;
        }

        return { months_imported: count };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "length_of_stay") {
      const txResult = await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM facility_pms_length_of_stay WHERE facility_id = ${facility_id}::uuid
        `;

        let count = 0;
        for (const r of data) {
          await tx.$executeRaw`
            INSERT INTO facility_pms_length_of_stay (facility_id, tenant_name, latest_unit, move_in, move_out, days_in_unit, lead_source, lead_category)
            VALUES (${facility_id}::uuid, ${r.tenant_name}, ${r.latest_unit}, ${parseDate(r.move_in)}::date, (${parseDate(r.move_out) || null})::date, ${r.days_in_unit}, ${r.lead_source}, ${r.lead_category})
          `;
          count++;
        }
        return { tenant_records: count };
      }, { maxWait: 10000, timeout: 30000 });

      result = txResult;
    } else if (report_type === "move_in_kpi") {
      const kpiSummary = data
        .map(
          (r: { employee: string; move_ins: number; move_outs: number; net_units: number }) =>
            `${r.employee}: ${r.move_ins} in / ${r.move_outs} out (net ${r.net_units})`
        )
        .join("; ");

      await db.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE facility_pms_snapshots SET notes = COALESCE(notes, '') || E'\nKPI: ' || ${kpiSummary}, updated_at = NOW()
          WHERE facility_id = ${facility_id}::uuid AND snapshot_date = CURRENT_DATE
        `;
      });
      result = { employees: data.length };
    } else {
      return errorResponse(`Unknown report_type: ${report_type}`, 400, origin);
    }

    // Most of these reports move units or the rent roll; detection is cheap and
    // idempotent, so it runs after any of them rather than tracking which.
    await scheduleDetection(facility_id).catch((err) => console.error("[pms] scheduling detection failed:", err));
    return jsonResponse({ success: true, report_type, ...result }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Import failed: ${message}`, 500, origin);
  }
}
