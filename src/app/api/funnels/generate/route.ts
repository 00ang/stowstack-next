import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { COOKIE_NAME, HEADER_NAME } from "@/lib/manage-session";
import { selfBaseUrl } from "@/lib/self-url";
import { funnelConfigToDripSteps } from "@/lib/drip-sequences";
import { ARCHETYPE_FUNNELS } from "@/components/admin/facility-tabs/ad-studio/types";

export const maxDuration = 120;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Internal fetch helper — calls our own API routes with the caller's own
 * credential, reusing all existing generation logic (brand doctrine, market
 * intel, style refs, compliance, facility learnings, etc.)
 */
async function internalFetch<T>(
  path: string,
  body: Record<string, unknown>,
  auth: Record<string, string>
): Promise<T> {
  const res = await fetch(`${selfBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...auth,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

/* ── POST: Generate a complete funnel by orchestrating existing tools ── */
export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  // Internal calls carry the caller's own credential: an admin's key, or an
  // owner's manage token (read from their cookie and sent as the header the
  // routes also accept), so every step is scoped exactly as if they had
  // called it themselves.
  const adminKey = req.headers.get("x-admin-key");
  const manageToken = req.cookies.get(COOKIE_NAME)?.value || req.headers.get(HEADER_NAME);
  const auth: Record<string, string> = adminKey
    ? { "X-Admin-Key": adminKey }
    : manageToken
      ? { [HEADER_NAME]: manageToken }
      : {};

  try {
    const body = await req.json();
    const {
      facilityId,
      archetype = "social_proof",
      name: funnelName,
      dailyBudget,
    } = body as {
      facilityId: string;
      archetype?: string;
      name?: string;
      dailyBudget?: number;
    };

    if (!facilityId) return errorResponse("facilityId is required", 400, origin);

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    const facility = await db.facilities.findUnique({
      where: { id: facilityId },
      select: { id: true, name: true },
    });
    if (!facility) return errorResponse("Facility not found", 404, origin);

    const template = ARCHETYPE_FUNNELS[archetype];
    if (!template) return errorResponse("Invalid archetype", 400, origin);

    const defaultName = funnelName || `${template.name} — ${facility.name}`;

    // ──────────────────────────────────────────────────────────────
    // Step 1: Create the funnel record first so we have an ID
    // ──────────────────────────────────────────────────────────────
    const funnelConfig = {
      landingHero: template.landingHero,
      landingFeatures: template.landingFeatures,
      postConversion: template.postConversion,
      retargeting: template.retargeting || "",
    };

    const funnel = await db.funnels.create({
      data: {
        facility_id: facilityId,
        name: defaultName,
        archetype,
        config: funnelConfig as unknown as import("@prisma/client").Prisma.InputJsonValue,
        daily_budget: dailyBudget || null,
      },
    });

    // ──────────────────────────────────────────────────────────────
    // Step 2: Generate ad copy via /api/facility-creatives
    // This pulls brand doctrine, market intel, style refs, facility
    // learnings, compliance validation — the whole pipeline.
    // ──────────────────────────────────────────────────────────────
    const copyResult = await internalFetch<{
      variations: Array<{
        id: string;
        angle: string;
        content_json: Record<string, unknown>;
      }>;
      briefId: string;
    }>("/api/facility-creatives", {
      facilityId,
      platform: "meta_feed",
    }, auth);

    // Pick the variation whose angle matches the archetype, or the first one
    const matchingVariation =
      copyResult.variations.find((v) => v.angle === archetype) ||
      copyResult.variations[0];

    // Attach the variation to this funnel
    if (matchingVariation) {
      await db.ad_variations.update({
        where: { id: matchingVariation.id },
        data: {
          funnel_id: funnel.id,
          funnel_config: funnelConfig as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Step 3: Generate image via /api/generate-image
    // Uses the existing template system, brand visual doctrine,
    // style references, and facility context.
    // ──────────────────────────────────────────────────────────────
    let imageResult: { imageUrl?: string } | null = null;
    try {
      const copyContext = matchingVariation
        ? `${(matchingVariation.content_json as Record<string, unknown>).headline || ""} — ${(matchingVariation.content_json as Record<string, unknown>).primaryText || ""}`
        : "";

      imageResult = await internalFetch<{ imageUrl: string }>(
        "/api/generate-image",
        {
          templateId: "ad_hero",
          facilityId,
          aspect: "1:1",
          copyContext,
        },
        auth
      );

      // Attach image to the variation
      if (imageResult?.imageUrl && matchingVariation) {
        await db.ad_variations.update({
          where: { id: matchingVariation.id },
          data: {
            asset_urls: { hero: imageResult.imageUrl } as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
        });
      }
    } catch (imgErr) {
      console.error("[funnels/generate] Image generation failed (non-fatal):", imgErr);
    }

    // ──────────────────────────────────────────────────────────────
    // Step 4: Generate landing page via /api/landing-pages/generate
    // Uses full facility intel (units, reviews, photos, specials,
    // occupancy), funnel stage context, archetype targeting, and
    // message-matches the ad copy for coherence.
    // ──────────────────────────────────────────────────────────────
    const lpResult = await internalFetch<{
      page: {
        id: string;
        slug: string;
        title: string;
        sections: unknown[];
      };
    }>("/api/landing-pages/generate", {
      facilityId,
      funnelStage: "consideration",
      archetypeKey: archetype === "social_proof" ? null : archetype,
      adVariationId: matchingVariation?.id || null,
    }, auth);

    // Attach landing page to funnel
    if (lpResult?.page) {
      await db.landing_pages.update({
        where: { id: lpResult.page.id },
        data: {
          funnel_id: funnel.id,
          variation_ids: matchingVariation ? [matchingVariation.id] : [],
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Step 5: Create drip sequence templates from archetype config
    // ──────────────────────────────────────────────────────────────
    if (template.postConversion?.length) {
      const steps = funnelConfigToDripSteps(template.postConversion);
      await db.drip_sequence_templates.create({
        data: {
          facility_id: facilityId,
          funnel_id: funnel.id,
          variation_id: matchingVariation?.id || null,
          name: `${defaultName} — Post-Conversion`,
          sequence_type: "post_conversion",
          steps: steps as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    // Recovery sequence (standard 1hr/24hr/72hr)
    const recoverySteps = funnelConfigToDripSteps([
      { channel: "email", message: "You were looking at units — still interested?", timing: "Hour 1" },
      { channel: "sms", message: `Don't lose your spot at ${facility.name}. Reserve now.`, timing: "Hour 24" },
      { channel: "email", message: `Special offer: first month free at ${facility.name}.`, timing: "Hour 72" },
    ]);
    await db.drip_sequence_templates.create({
      data: {
        facility_id: facilityId,
        funnel_id: funnel.id,
        name: `${defaultName} — Recovery`,
        sequence_type: "recovery",
        steps: recoverySteps as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    // ──────────────────────────────────────────────────────────────
    // Step 6: Return the complete funnel with all generated pieces
    // ──────────────────────────────────────────────────────────────
    const completeFunnel = await db.funnels.findUnique({
      where: { id: funnel.id },
      include: {
        ad_variations: {
          select: {
            id: true,
            platform: true,
            angle: true,
            content_json: true,
            asset_urls: true,
            status: true,
            compliance_status: true,
          },
        },
        landing_pages: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
          },
        },
        drip_sequence_templates: {
          select: {
            id: true,
            name: true,
            sequence_type: true,
            steps: true,
          },
        },
      },
    });

    return jsonResponse(completeFunnel, 201, origin);
  } catch (err) {
    console.error("[funnels/generate POST]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Funnel generation failed: ${message}`, 500, origin);
  }
}
