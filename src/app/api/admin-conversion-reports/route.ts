import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminKey } from "@/lib/api-helpers";
import { isValidUuid } from "@/lib/validation";
import { enqueue } from "@/lib/jobs/queue";
import { ACTIONABLE_SKIP_REASONS } from "@/lib/attribution/reports";

/**
 * Move-in reports (MISSION.md s12) — every move-in we tried to report to Meta
 * or Google, and the retry for the ones that did not go.
 *
 * GET  ?status=attention|failed|skipped|sent|all (default attention) &facilityId= &limit=
 * POST { action: "retry", reportIds: string[] } — re-queue reports that were
 *      not sent. Safe to press twice: each report carries the same event/order
 *      id on every attempt, and a sent report is never re-sent.
 */
export const dynamic = "force-dynamic";

const QUEUE: Record<string, string> = { meta: "prove.meta-conversion", google: "prove.google-conversion" };

export async function GET(req: NextRequest) {
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "attention";
  const facilityId = sp.get("facilityId");
  const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? 100) || 100));

  const where: Prisma.conversion_reportsWhereInput = {};
  if (facilityId && isValidUuid(facilityId)) where.facility_id = facilityId;
  if (status === "attention") {
    where.OR = [{ status: "failed" }, { status: "skipped", reason: { in: [...ACTIONABLE_SKIP_REASONS] } }];
  } else if (status === "failed" || status === "skipped" || status === "sent") {
    where.status = status;
  }

  try {
    const [rows, counts] = await Promise.all([
      db.conversion_reports.findMany({
        where,
        orderBy: { updated_at: "desc" },
        take: limit,
        select: {
          id: true, platform: true, status: true, reason: true, detail: true, click_id_type: true,
          value: true, conversion_at: true, sent_at: true, attempts: true, updated_at: true,
          facility_id: true, partial_lead_id: true,
          facilities: { select: { name: true } },
          lead: { select: { name: true, email: true, phone: true } },
        },
      }),
      db.conversion_reports.groupBy({
        by: ["status"],
        where: facilityId && isValidUuid(facilityId) ? { facility_id: facilityId } : undefined,
        _count: { _all: true },
      }),
    ]);

    return NextResponse.json({
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      reports: rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        status: r.status,
        reason: r.reason,
        detail: r.detail,
        click_id_type: r.click_id_type,
        value: r.value == null ? null : Number(r.value),
        conversion_at: r.conversion_at,
        sent_at: r.sent_at,
        attempts: r.attempts,
        updated_at: r.updated_at,
        facility_id: r.facility_id,
        facility_name: r.facilities?.name ?? null,
        lead_id: r.partial_lead_id,
        lead_name: r.lead?.name || r.lead?.email || r.lead?.phone || null,
      })),
    });
  } catch (err) {
    console.error("[admin-conversion-reports]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to load move-in reports" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { action?: string; reportIds?: unknown } | null;
  if (body?.action !== "retry") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const ids = Array.isArray(body.reportIds) ? body.reportIds.filter((x): x is string => typeof x === "string" && isValidUuid(x)) : [];
  if (!ids.length || ids.length > 100) {
    return NextResponse.json({ error: "reportIds must list 1–100 reports" }, { status: 400 });
  }

  try {
    const reports = await db.conversion_reports.findMany({
      where: { id: { in: ids } },
      select: { id: true, platform: true, status: true, partial_lead_id: true, tenant_id: true, facility_id: true },
    });

    const stamp = Date.now();
    let queued = 0;
    let skipped = 0;
    for (const r of reports) {
      const queue = QUEUE[r.platform];
      // Never re-send a report that went; never retry what has nothing to retry with.
      if (r.status === "sent" || !queue || !r.partial_lead_id || !r.tenant_id) { skipped++; continue; }
      const id = await enqueue({
        queue,
        payload: { leadId: r.partial_lead_id, tenantId: r.tenant_id, facilityId: r.facility_id },
        dedupeKey: `retry:${r.id}:${stamp}`,
        tenantKey: r.facility_id ?? undefined,
      });
      if (id) queued++;
    }
    return NextResponse.json({ queued, skipped: skipped + (ids.length - reports.length) });
  } catch (err) {
    console.error("[admin-conversion-reports] retry", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Failed to queue retries" }, { status: 500 });
  }
}
