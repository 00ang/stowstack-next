import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { adaptForFacility, persistAdaptedDraft } from "@/lib/proven-ads/adapt";
import { loadFacilitySnapshot } from "@/lib/proven-ads/facility-snapshot";
import { readInsight } from "@/lib/proven-ads/present";

export const maxDuration = 60;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

function provenIdOf(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // api / proven-ads / :id / duplicate
  const idx = parts.indexOf("proven-ads");
  return idx >= 0 ? parts[idx + 1] ?? null : null;
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.EXPENSIVE_API, "proven-ads-duplicate");
  if (limited) return limited;

  const origin = getOrigin(req);
  let body: { facilityId?: string };
  try {
    body = (await req.json()) as { facilityId?: string };
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const facilityId = body.facilityId;
  if (!facilityId) return errorResponse("facilityId required", 400, origin);

  const denied = await requireFacilityAccess(req, facilityId);
  if (denied) return denied;

  const id = provenIdOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  const ad = await db.proven_ads.findUnique({ where: { id } });
  if (!ad) return errorResponse("Proven ad not found", 404, origin);

  const facility = await loadFacilitySnapshot(facilityId);
  if (!facility) return errorResponse("Facility not found", 404, origin);

  try {
    const { copy, via } = await adaptForFacility(
      {
        advertiser_name: ad.advertiser_name,
        headline: ad.headline,
        primary_text: ad.primary_text,
        description: ad.description,
        cta: ad.cta,
        city: ad.city,
        angle: ad.angle,
        offer_type: ad.offer_type,
        format: ad.format,
        platform: ad.platform,
        read: (() => {
          const read = readInsight(ad.insight);
          return read && read.relevance === "renter" ? { why: read.why, beats: read.beats } : null;
        })(),
      },
      facility,
      process.env.ANTHROPIC_API_KEY ?? null
    );

    const draft = await persistAdaptedDraft({
      facilityId,
      provenAdId: ad.id,
      copy,
      format: ad.format,
      platform: ad.platform,
    });

    return jsonResponse(
      {
        variationId: draft.id,
        facilityId,
        via,
        copy,
        studioUrl: `/admin/studio/ad-generator?variation=${draft.id}`,
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Adaptation failed";
    return errorResponse(message, 500, origin);
  }
}
