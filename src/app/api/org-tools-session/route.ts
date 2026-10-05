import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getOrigin, corsResponse } from "@/lib/api-helpers";
import { getSession } from "@/lib/session-auth";
import { setManageCookie } from "@/lib/manage-session";
import { orgToolFacilityIds } from "@/lib/owner-tools";

/**
 * POST /api/org-tools-session
 *
 * Opens the facility tools (/partner/tools) for a partner org user: mints the
 * manage session for every facility in their org from their partner session
 * (Bearer / x-org-token). Called on each visit, so facilities added to the org
 * since show up. The tools write (publish ads, edit pages), so view-only
 * members don't get them.
 */

const TOOL_ROLES = new Set(["org_admin", "facility_manager"]);

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  const session = await getSession(req);
  if (!session) return errorResponse("Unauthorized", 401, origin);
  if (!TOOL_ROLES.has(session.user.role) && !session.user.is_superadmin) {
    return errorResponse("Ask an admin on your team for manager access to use the facility tools.", 403, origin);
  }

  const facilityIds = await orgToolFacilityIds(session.organization.id);
  const res = jsonResponse({ facilityCount: facilityIds.length }, 200, origin);
  if (facilityIds.length > 0 && !setManageCookie(res, facilityIds, "org")) {
    return errorResponse("Facility tools are not configured (missing MANAGE_SESSION_SECRET)", 500, origin);
  }
  return res;
}
