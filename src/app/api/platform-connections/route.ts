import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { signOAuthState } from "@/lib/oauth-state";
import { safeReturnTo } from "@/lib/oauth-return";
import { parseWriteBackSettings, readWriteBackSettings } from "@/lib/attribution/connection-settings";

/** `returnTo`: the app path the owner started from, carried in the signed state. */
function getOAuthUrl(platform: string, facilityId: string, returnTo: string | null = null): string | null {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_ENV === "production"
      ? "https://www.storageads.com"
      : null) ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const state = signOAuthState({ facilityId, platform, ...(returnTo ? { returnTo } : {}) });

  if (platform === "meta") {
    const appId = process.env.META_APP_ID;
    if (!appId) return null;
    const redirectUri = `${baseUrl}/api/auth/meta/callback`;
    const scopes = [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
    ].join(",");
    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;
  }

  if (platform === "google_ads") {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const scopes = ["https://www.googleapis.com/auth/adwords"].join(" ");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code&access_type=offline&prompt=consent`;
  }

  if (platform === "tiktok") {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) return null;
    const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;
    const scopes = ["video.publish", "video.upload", "user.info.basic"].join(
      ","
    );
    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
  }

  return null;
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "platform-connections");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireFacilityAccess(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  // Where the connect flow should come back to (Publish Ads, wherever it was opened).
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  if (!facilityId) return errorResponse("facilityId required", 400, origin);

  try {
    const connections = await db.platform_connections.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true,
        facility_id: true,
        platform: true,
        status: true,
        account_id: true,
        account_name: true,
        page_id: true,
        page_name: true,
        created_at: true,
        updated_at: true,
        token_expires_at: true,
        metadata: true,
      },
    });

    const platforms = [
      {
        id: "meta",
        name: "Meta (Facebook & Instagram)",
        description:
          "Publish ads to Facebook Feed, Instagram Feed, and Instagram Stories",
        configured: !!process.env.META_APP_ID,
        connectUrl: getOAuthUrl("meta", facilityId, returnTo),
        icon: "meta",
      },
      {
        id: "google_ads",
        name: "Google Ads",
        description: "Publish Search and Display ads to Google Ads",
        configured: !!process.env.GOOGLE_ADS_CLIENT_ID,
        connectUrl: getOAuthUrl("google_ads", facilityId, returnTo),
        icon: "google",
      },
      {
        id: "tiktok",
        name: "TikTok",
        description:
          "Post organic content to target local audiences on TikTok",
        configured: !!process.env.TIKTOK_CLIENT_KEY,
        connectUrl: getOAuthUrl("tiktok", facilityId, returnTo),
        icon: "tiktok",
      },
    ];

    return jsonResponse({ connections, platforms }, 200, origin);
  } catch {
    return errorResponse("Failed to fetch connections", 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "platform-connections");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { connectionId } = body || {};
    if (!connectionId)
      return errorResponse("connectionId required", 400, origin);

    // Scope the disconnect to the connection's facility: admins pass, owners
    // must hold a manage session for that facility.
    const existing = await db.platform_connections.findUnique({
      where: { id: connectionId },
      select: { facility_id: true },
    });
    if (!existing)
      return errorResponse("Connection not found", 404, origin);

    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    await db.platform_connections.update({
      where: { id: connectionId },
      data: {
        status: "disconnected",
        access_token: null,
        refresh_token: null,
      },
    });

    return jsonResponse({ success: true }, 200, origin);
  } catch {
    return errorResponse("Failed to disconnect", 500, origin);
  }
}

/**
 * PATCH — move-in reporting settings on one connection (MISSION.md s12):
 * `{ connectionId, settings: { pixelId? | moveInConversionActionId? | loginCustomerId? } }`.
 * Merged into `metadata`; a field sent empty is removed. Only those keys can be
 * written here, so OAuth data in `metadata` is out of reach of this endpoint.
 */
export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "platform-connections");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json().catch(() => null);
    const { connectionId, settings } = (body || {}) as { connectionId?: string; settings?: unknown };
    if (!connectionId) return errorResponse("connectionId required", 400, origin);

    const existing = await db.platform_connections.findUnique({
      where: { id: connectionId },
      select: { facility_id: true, platform: true },
    });
    if (!existing) return errorResponse("Connection not found", 404, origin);

    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    const parsed = parseWriteBackSettings(existing.platform, settings);
    if (!parsed.ok) return errorResponse(parsed.error, 400, origin);

    const rows = await db.$queryRaw<{ metadata: unknown }[]>`
      UPDATE platform_connections
      SET metadata = (COALESCE(metadata, '{}'::jsonb) - ${parsed.unset}::text[]) || ${JSON.stringify(parsed.set)}::jsonb,
          updated_at = NOW()
      WHERE id = ${connectionId}::uuid
      RETURNING metadata
    `;

    return jsonResponse(
      { success: true, settings: readWriteBackSettings(existing.platform, rows[0]?.metadata) },
      200,
      origin,
    );
  } catch {
    return errorResponse("Failed to save settings", 500, origin);
  }
}

