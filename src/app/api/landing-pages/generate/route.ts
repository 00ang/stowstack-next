import { NextRequest } from "next/server";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { PageGenerationError, generateLandingPage } from "@/lib/landing-page-generation";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(
    req,
    RATE_LIMIT_TIERS.AUTHENTICATED,
    "landing-pages-generate"
  );
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      facilityId,
      funnelStage = "consideration",
      archetypeKey = null,
      adVariationId = null,
    } = body;

    if (!facilityId)
      return errorResponse("facilityId is required", 400, origin);

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    const result = await generateLandingPage({ facilityId, funnelStage, archetypeKey, adVariationId });
    return jsonResponse(result, 200, origin);
  } catch (err) {
    if (err instanceof PageGenerationError) return errorResponse(err.message, err.status, origin);
    console.error("Landing page generation error:", err);
    return errorResponse("Failed to generate landing page", 500, origin);
  }
}
