import { NextRequest } from "next/server";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { getManageScope } from "@/lib/manage-session";
import { orgAllowsVideo } from "@/lib/plan-limits";
import { db } from "@/lib/db";

/**
 * GET /api/manage/session
 *
 * Returns the facility(ies) the current manage session is scoped to, for the
 * facility tools to render, with what each facility's plan unlocks
 * (videoEnabled). Auth is the manage token itself (cookie or x-manage-token
 * header) — no facilityId param, because the scope defines it. `notes` is not
 * returned: it holds staff notes and the raw audit intake.
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const origin = getOrigin(req);

  const scope = getManageScope(req);
  if (!scope || scope.facilityIds.length === 0) {
    return errorResponse("No active manage session", 401, origin);
  }

  const facilities = await db.facilities.findMany({
    where: { id: { in: scope.facilityIds }, deleted_at: null },
    select: {
      id: true,
      name: true,
      contact_name: true,
      contact_email: true,
      contact_phone: true,
      website: true,
      google_address: true,
      occupancy_range: true,
      total_units: true,
      biggest_issue: true,
      google_rating: true,
      review_count: true,
      google_phone: true,
      google_maps_url: true,
      organizations: { select: { plan: true, subscription_status: true, trial_ends_at: true } },
    },
    orderBy: { name: "asc" },
  });

  const normalized = facilities.map(({ organizations, ...f }) => ({
    ...f,
    google_rating: f.google_rating != null ? Number(f.google_rating) : null,
    videoEnabled: orgAllowsVideo(organizations),
  }));

  return jsonResponse(
    { mode: scope.mode, facilities: normalized },
    200,
    origin
  );
}
