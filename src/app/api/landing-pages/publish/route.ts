import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { errorResponse, getOrigin, jsonResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { publishPage } from "@/lib/page-blocks/persist";

export const runtime = "nodejs";

/**
 * Publish one landing page. Copies the draft sections into
 * published_snapshot and a version row. The public URL serves that
 * snapshot until the next publish.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "landing-pages-publish");
  if (limited) return limited;
  const origin = getOrigin(req);
  try {
    const body = (await req.json()) as { id?: string };
    const id = body.id;
    if (!id) return errorResponse("Missing page ID", 400, origin);
    const page = await db.landing_pages.findUnique({ where: { id }, select: { facility_id: true } });
    if (!page) return errorResponse("Page not found", 404, origin);
    const denied = await requireFacilityAccess(req, page.facility_id);
    if (denied) return denied;
    const published = await publishPage(id);
    return jsonResponse({ ok: true, ...published, href: `/lp/${published.slug}` }, 200, origin);
  } catch (err) {
    console.error("[landing-pages/publish]", err);
    return errorResponse("The page didn’t publish", 500, origin);
  }
}
