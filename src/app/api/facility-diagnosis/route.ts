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
import { loadFacilityPicture } from "@/lib/diagnose/load";

/**
 * GET /api/facility-diagnosis?facilityId=
 *
 * The picture the diagnose layer reads: intake, PMS, calls, ad results,
 * Google, the move-in ledger. Read-only. The digest itself runs in the
 * browser so a new answer or upload can be compared with the last read.
 *
 * Auth matches /api/portal-ontology: portal credentials, an admin key,
 * or the facility-tools session.
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-diagnosis");
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
    const picture = await loadFacilityPicture(facilityId, new Date());
    if (!picture) return errorResponse("Facility not found", 404, origin);
    return jsonResponse({ picture }, 200, origin);
  } catch (err) {
    console.error("[facility-diagnosis] failed", err);
    return errorResponse("Couldn't read this facility", 500, origin);
  }
}
