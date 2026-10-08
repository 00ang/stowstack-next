import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, errorResponse, getOrigin, jsonResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { visitBucket, type FlowCounts } from "@/lib/funnel-graph/flow-counts";

/**
 * GET /api/funnels/flow?id=<funnelId>&days=30
 *
 * What flowed through one campaign in the window, for the counts on its
 * canvas wires: visits to its pages by channel (touches), the leads its pages
 * captured or that were tagged to it, and how many of those were answered,
 * followed up, toured, held a unit and moved in. Read-only. Access is checked
 * against the campaign's own facility.
 */

const DAY = 86_400_000;
const HOLD_STATES = new Set(["reserved", "hold", "held"]);
const MOVED_STATES = new Set(["moved_in", "converted"]);

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "funnel-flow");
  if (limited) return limited;
  const origin = getOrigin(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("id is required", 400, origin);
  const days = Math.min(90, Math.max(1, Math.round(Number(url.searchParams.get("days")) || 30)));

  try {
    const funnel = await db.funnels.findUnique({ where: { id }, select: { id: true, facility_id: true } });
    const denied = await requireFacilityAccess(req, funnel?.facility_id ?? null);
    if (denied) return denied;
    if (!funnel) return errorResponse("Campaign not found", 404, origin);

    const since = new Date(Date.now() - days * DAY);
    const pages = await db.landing_pages.findMany({ where: { funnel_id: id }, select: { id: true } });
    const pageIds = pages.map((p) => p.id);

    const [touches, leads] = await Promise.all([
      pageIds.length
        ? db.touches.groupBy({
            by: ["channel", "source"],
            where: { kind: "visit", landing_page_id: { in: pageIds }, occurred_at: { gte: since } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { channel: string; source: string | null; _count: { _all: number } }[]),
      db.partial_leads.findMany({
        where: {
          deleted_at: null,
          created_at: { gte: since },
          OR: [{ funnel_id: id }, ...(pageIds.length ? [{ landing_page_id: { in: pageIds } }] : [])],
        },
        select: { id: true, first_response_at: true, lead_status: true, matched_tenant_id: true, converted: true },
      }),
    ]);

    const leadIds = leads.map((l) => l.id);
    const [enrolled, toured] = leadIds.length
      ? await Promise.all([
          db.nurture_enrollments.findMany({ where: { lead_id: { in: leadIds } }, select: { lead_id: true }, distinct: ["lead_id"] }),
          db.facility_tours.findMany({
            where: { lead_id: { in: leadIds }, status: { not: "cancelled" } },
            select: { lead_id: true },
            distinct: ["lead_id"],
          }),
        ])
      : [[], []];

    const visits: FlowCounts["visits"] = { meta: 0, google: 0, gbp: 0, tiktok: 0, other: 0 };
    for (const t of touches) visits[visitBucket(t.channel, t.source)] += t._count._all;

    const status = (s: string | null) => (s ?? "").toLowerCase();
    const counts: FlowCounts = {
      days,
      visits,
      leads: leads.length,
      answered: leads.filter((l) => l.first_response_at).length,
      enrolled: enrolled.length,
      toured: toured.length,
      holds: leads.filter((l) => HOLD_STATES.has(status(l.lead_status))).length,
      moveIns: leads.filter((l) => l.converted || l.matched_tenant_id || MOVED_STATES.has(status(l.lead_status))).length,
    };
    return jsonResponse({ counts }, 200, origin);
  } catch {
    return errorResponse("Couldn't count this campaign", 500, origin);
  }
}
