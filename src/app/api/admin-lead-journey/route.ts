import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminKey } from "@/lib/api-helpers";
import { isValidUuid } from "@/lib/validation";
import { loadLeadTouches } from "@/lib/attribution/visitor";
import { summarize } from "@/lib/attribution/touch";
import { buildJourney, touchTitle } from "@/lib/attribution/journey";

/**
 * GET /api/admin-lead-journey?leadId= — one lead's whole story (MISSION.md s12).
 *
 * Touches (visits and calls), status changes, the move-in it was matched to,
 * and every report sent to the ad platforms about it, in time order — plus the
 * attribution answers (first touch, latest non-direct touch) computed from the
 * same rows. Admin only.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId || !isValidUuid(leadId)) {
    return NextResponse.json({ error: "leadId required" }, { status: 400 });
  }

  try {
    const lead = await db.partial_leads.findUnique({
      where: { id: leadId },
      select: {
        id: true, name: true, email: true, phone: true, facility_id: true,
        created_at: true, converted_at: true, lead_status: true,
        monthly_revenue: true, matched_tenant_id: true, visitor_id: true,
        facilities: { select: { name: true } },
      },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const [touches, statusEvents, tenant, reports] = await Promise.all([
      loadLeadTouches(lead.id),
      db.lead_status_events.findMany({
        where: { partial_lead_id: lead.id },
        orderBy: { changed_at: "asc" },
        select: { from_status: true, to_status: true, changed_at: true, source: true },
      }),
      lead.matched_tenant_id
        ? db.tenants.findUnique({
            where: { id: lead.matched_tenant_id },
            select: { unit_number: true, unit_size: true, monthly_rate: true, move_in_date: true },
          })
        : Promise.resolve(null),
      db.conversion_reports.findMany({
        where: { partial_lead_id: lead.id },
        orderBy: { created_at: "asc" },
        select: {
          platform: true, status: true, reason: true, detail: true, click_id_type: true,
          value: true, conversion_at: true, created_at: true,
        },
      }),
    ]);

    const tenantRow = tenant
      ? { ...tenant, monthly_rate: tenant.monthly_rate == null ? null : Number(tenant.monthly_rate) }
      : null;
    const reportRows = reports.map((r) => ({ ...r, value: r.value == null ? null : Number(r.value) }));

    // Attribution is "what brought them before they moved in", so the cut-off is
    // the move-in when there is one.
    const summary = summarize(touches, tenantRow?.move_in_date ?? null);
    const brief = (t: typeof summary.first) =>
      t ? { title: touchTitle(t), campaign: t.utm_campaign, at: t.occurred_at.toISOString() } : null;

    return NextResponse.json({
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        facility: lead.facilities?.name ?? null,
        status: lead.lead_status,
        createdAt: lead.created_at,
        convertedAt: lead.converted_at,
        monthlyRevenue: lead.monthly_revenue == null ? null : Number(lead.monthly_revenue),
        tracked: Boolean(lead.visitor_id) || touches.length > 0,
      },
      summary: {
        first: brief(summary.first),
        latestNonDirect: brief(summary.latestNonDirect),
        touchCount: summary.touchCount,
        path: summary.path,
        movedIn: tenantRow
          ? { unit: tenantRow.unit_number, rate: tenantRow.monthly_rate, date: tenantRow.move_in_date }
          : null,
      },
      journey: buildJourney({ lead, touches, statusEvents, tenant: tenantRow, reports: reportRows }),
    });
  } catch (err) {
    console.error("[admin-lead-journey]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load journey" }, { status: 500 });
  }
}
