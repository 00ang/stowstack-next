import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  corsResponse,
  getOrigin,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import {
  PartialPublish,
  publishToGoogle,
  publishToMeta,
  publishToTikTok,
  type AdVariation,
  type PlatformConnection,
  type PublishResult,
} from "@/lib/ad-publish";

/** Paid ads run this far around the facility unless a campaign says otherwise. */
const DEFAULT_RADIUS_MILES = 10;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "publish-ad");
  if (limited) return limited;
  const origin = getOrigin(req);
  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) {
    return errorResponse("facilityId required", 400, origin);
  }
  // Scoped to the facility asked about: an owner reads only its own history.
  const denied = await requireFacilityAccess(req, facilityId);
  if (denied) return denied;

  try {
    const logs = await db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT pl.*, av.content_json, av.angle, av.platform as ad_platform
      FROM publish_log pl
      LEFT JOIN ad_variations av ON av.id = pl.variation_id
      WHERE pl.facility_id = ${facilityId}::uuid
      ORDER BY pl.created_at DESC
    `;
    return jsonResponse({ logs }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(
      `Failed to fetch publish log: ${message}`,
      500,
      origin
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "publish-ad");
  if (limited) return limited;
  const origin = getOrigin(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const { variationId, connectionId, imageUrl, ctaOverride, landingUrl } = body as {
    variationId?: string;
    connectionId?: string;
    imageUrl?: string;
    ctaOverride?: string;
    landingUrl?: string;
  };

  if (!variationId || !connectionId) {
    return errorResponse(
      "variationId and connectionId required",
      400,
      origin
    );
  }

  try {
    const [variation, connection] = await Promise.all([
      db.ad_variations.findUnique({ where: { id: variationId } }),
      db.platform_connections.findUnique({ where: { id: connectionId } }),
    ]);

    if (!variation) {
      return errorResponse("Variation not found", 404, origin);
    }
    if (!connection) {
      return errorResponse("Connection not found", 404, origin);
    }

    // Scope the publish to the variation's facility: admins pass, owners must
    // hold a manage session for this facility.
    const denied = await requireFacilityAccess(req, variation.facility_id);
    if (denied) return denied;

    // Cross-facility guard: never publish a variation through a connection that
    // belongs to a different facility (would post to / spend on another tenant's
    // ad account).
    if (connection.facility_id !== variation.facility_id) {
      return errorResponse(
        "Connection does not belong to this facility",
        403,
        origin
      );
    }

    if (connection.status !== "connected") {
      return errorResponse(
        "Platform not connected. Please reconnect.",
        400,
        origin
      );
    }

    const logEntry = await db.publish_log.create({
      data: {
        facility_id: variation.facility_id,
        variation_id: variationId,
        connection_id: connectionId,
        platform: connection.platform,
        status: "pending",
        request_payload: { variationId, connectionId, imageUrl, ctaOverride, landingUrl },
      },
    });

    const variationData: AdVariation = {
      id: variation.id,
      facility_id: variation.facility_id,
      platform: variation.platform,
      angle: variation.angle,
      content_json: variation.content_json as Record<string, unknown>,
      status: variation.status,
    };

    const connectionData: PlatformConnection = {
      id: connection.id,
      facility_id: connection.facility_id,
      platform: connection.platform,
      status: connection.status,
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      token_expires_at: connection.token_expires_at,
      account_id: connection.account_id,
      page_id: connection.page_id,
      metadata: connection.metadata as Record<string, unknown> | null,
    };

    let result: PublishResult;

    // Run near the facility, never account-wide, whenever its address is known.
    const facility = variation.facility_id
      ? await db.facilities.findUnique({
          where: { id: variation.facility_id },
          select: { google_address: true, location: true, name: true },
        })
      : null;
    const address = facility?.google_address || null;
    const target = {
      imageUrl,
      cta: ctaOverride,
      landingUrl,
      name: facility?.name || undefined,
      radius: address ? { miles: DEFAULT_RADIUS_MILES, address } : undefined,
    };

    try {
      if (connection.platform === "meta") {
        result = await publishToMeta(variationData, connectionData, target);
      } else if (connection.platform === "google_ads") {
        result = await publishToGoogle(variationData, connectionData, target);
      } else if (connection.platform === "tiktok") {
        result = await publishToTikTok(variationData, connectionData, target);
      } else {
        throw new Error(`Unsupported platform: ${connection.platform}`);
      }

      await db.$transaction(async (tx) => {
        await tx.publish_log.update({
          where: { id: logEntry.id },
          data: {
            status: "published",
            external_id: result.externalId,
            external_url: result.externalUrl,
            response_payload: result.response as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.ad_variations.update({
          where: { id: variationId },
          data: { status: "published" },
        });
      });

      // Say what actually happened: Meta and Google campaigns are created
      // paused and spend nothing until the owner switches them on.
      const paused = connection.platform === "meta" || connection.platform === "google_ads";
      const note = (result.response as { note?: unknown } | null)?.note;
      return jsonResponse(
        {
          success: true,
          logId: logEntry.id,
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          platform: connection.platform,
          paused,
          note: typeof note === "string" ? note : null,
        },
        200,
        origin
      );
    } catch (pubErr) {
      const pubMessage =
        pubErr instanceof Error ? pubErr.message : "Unknown error";
      // Keep whatever the platform made before it stopped, so it can be found
      // (and finished) rather than duplicated.
      const partial = pubErr instanceof PartialPublish ? pubErr.created : null;
      await db.publish_log.update({
        where: { id: logEntry.id },
        data: {
          status: pubErr instanceof PartialPublish && pubErr.unknown ? "unknown" : "failed",
          error_message: pubMessage,
          ...(partial && Object.keys(partial).length
            ? { response_payload: { created: partial } as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });
      return errorResponse(
        `Publishing failed: ${pubMessage}`,
        500,
        origin
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Publishing failed: ${message}`, 500, origin);
  }
}
