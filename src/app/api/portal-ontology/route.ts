import { NextRequest, NextResponse } from "next/server";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { authenticatePortalRequest } from "@/lib/portal-auth";
import { loadFacilityRows } from "@/lib/ontology/load";
import { buildOntology } from "@/lib/ontology/build";

/**
 * GET /api/portal-ontology
 *
 * The facility ontology: every unit, offer, ad, page, link, post, lead, tour,
 * move-in, review and competitor for one facility, each with an address, its
 * links, and the gaps those links reveal. Read-only.
 *
 * Auth, fail-closed, either of:
 *  - portal credentials (accessCode + email, as every portal page sends them),
 *    pinned to that client's facility, or an admin key with ?facilityId=;
 *  - the facility-tools session (the sa_manage cookie the portal and partner
 *    logins mint), scoped to ?facilityId=. This is how the tools' focus bar
 *    reads it.
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "portal-ontology");
  if (limited) return limited;
  const origin = getOrigin(req);
  const facilityParam = req.nextUrl.searchParams.get("facilityId");

  try {
    let facilityId: string | null = null;

    const hasPortalCreds =
      (req.nextUrl.searchParams.has("accessCode") || req.nextUrl.searchParams.has("code")) &&
      req.nextUrl.searchParams.has("email");

    if (hasPortalCreds) {
      const scope = await authenticatePortalRequest(req);
      if (scope instanceof NextResponse) return scope;
      if (scope.kind === "client") facilityId = scope.facilityId;
      else facilityId = facilityParam;
    } else {
      if (!facilityParam) return errorResponse("facilityId required", 400, origin);
      const denied = await requireFacilityAccess(req, facilityParam);
      if (denied) return denied;
      facilityId = facilityParam;
    }

    if (!facilityId) return errorResponse("facilityId required", 400, origin);

    const now = new Date();
    const rows = await loadFacilityRows(facilityId, now);
    if (!rows) return errorResponse("Facility not found", 404, origin);

    return jsonResponse(buildOntology(rows, now), 200, origin);
  } catch (err) {
    console.error("[portal-ontology] failed", err);
    return errorResponse("Couldn't build the facility index", 500, origin);
  }
}
