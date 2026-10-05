import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse, requireAdminKey } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import {
  activityLogWhere,
  isActivityCategory,
  presentActivityLog,
} from "@/lib/activity-log";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "activity-log");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
    const facilityId = url.searchParams.get("facility_id");
    const typeParam = url.searchParams.get("type");
    const includeCron = url.searchParams.get("include_cron") === "1";
    const category = isActivityCategory(typeParam) ? typeParam : null;

    const logs = await db.activity_log.findMany({
      where: activityLogWhere({
        facilityId,
        category,
        includeCron: includeCron || category === "system",
      }),
      orderBy: { created_at: "desc" },
      take: limit,
      skip: offset,
    });

    const presented = logs.map(presentActivityLog);
    return jsonResponse(
      { logs: presented, hasMore: presented.length === limit },
      200,
      origin
    );
  } catch (err) {
    console.error("Activity log error:", err);
    return errorResponse("Failed to fetch activity log", 500, origin);
  }
}
