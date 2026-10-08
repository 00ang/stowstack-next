import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { attributeSpendToVariations } from "@/lib/attribution";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { META_API_VERSION } from "@/lib/ad-publish/types";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "campaign-spend");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const facilityId = url.searchParams.get("facilityId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!facilityId)
      return errorResponse("facilityId is required", 400, origin);

    const where: Record<string, unknown> = { facility_id: facilityId };
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      where.date = dateFilter;
    }

    const rows = await db.campaign_spend.findMany({
      where,
      orderBy: [{ date: "desc" }, { campaign_name: "asc" }],
      select: {
        id: true,
        platform: true,
        date: true,
        campaign_name: true,
        campaign_id: true,
        utm_campaign: true,
        spend: true,
        impressions: true,
        clicks: true,
        created_at: true,
      },
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.spend += Number(r.spend) || 0;
        acc.impressions += r.impressions || 0;
        acc.clicks += r.clicks || 0;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0 }
    );

    return jsonResponse({ spend: rows, totals }, 200, origin);
  } catch {
    return errorResponse("Failed to fetch campaign spend", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "campaign-spend");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { facilityId, startDate, endDate } = body || {};

    if (!facilityId)
      return errorResponse("facilityId is required", 400, origin);

    const connection = await db.platform_connections.findFirst({
      where: {
        facility_id: facilityId,
        platform: "meta",
        status: "connected",
      },
      select: {
        id: true,
        access_token: true,
        account_id: true,
        token_expires_at: true,
      },
    });

    if (!connection) {
      return errorResponse(
        "No connected Meta account for this facility. Connect Meta in Settings first.",
        400,
        origin
      );
    }

    if (
      connection.token_expires_at &&
      new Date(connection.token_expires_at) < new Date()
    ) {
      return errorResponse(
        "Meta access token has expired. Please reconnect in Settings.",
        400,
        origin
      );
    }

    const end =
      endDate || new Date().toISOString().split("T")[0];
    const start =
      startDate ||
      new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

    const metaUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/act_${connection.account_id}/insights`
    );
    metaUrl.searchParams.set(
      "fields",
      "campaign_name,campaign_id,spend,impressions,clicks"
    );
    metaUrl.searchParams.set("time_increment", "1");
    metaUrl.searchParams.set(
      "time_range",
      JSON.stringify({ since: start, until: end })
    );
    metaUrl.searchParams.set("level", "campaign");
    metaUrl.searchParams.set("limit", "500");
    metaUrl.searchParams.set("access_token", connection.access_token || "");

    const metaRes = await fetch(metaUrl.toString());

    if (!metaRes.ok) {
      const _errData = await metaRes.json().catch(() => ({}));
      return errorResponse(
        "Meta API request failed",
        502,
        origin
      );
    }

    const metaData = await metaRes.json();
    const rows = metaData.data || [];

    if (rows.length === 0) {
      return jsonResponse(
        {
          success: true,
          synced: 0,
          message: "No campaign data found for this date range.",
        },
        200,
        origin
      );
    }

    // A campaign published from the canvas tags its links with the canvas
    // campaign's id (src/lib/campaign-publish). Give its spend the same tag, so
    // spend and leads join on it in /api/attribution. Other campaigns keep the
    // slug of their name.
    const published = await db.publish_log.findMany({
      where: { facility_id: facilityId, platform: "meta", status: "published" },
      select: { request_payload: true, response_payload: true },
    });
    const funnelOf = new Map<string, string>();
    for (const log of published) {
      const funnelId = (log.request_payload as { funnelId?: unknown } | null)?.funnelId;
      const campaignId = (log.response_payload as { campaignId?: unknown } | null)?.campaignId;
      if (typeof funnelId === "string" && typeof campaignId === "string") funnelOf.set(campaignId, funnelId);
    }

    let synced = 0;
    for (const row of rows) {
      const utmCampaign =
        (row.campaign_id && funnelOf.get(String(row.campaign_id))) ||
        (row.campaign_name || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");

      await db.$executeRaw`
        INSERT INTO campaign_spend (facility_id, platform, date, campaign_name, campaign_id, utm_campaign, spend, impressions, clicks, updated_at)
        VALUES (${facilityId}::uuid, 'meta', ${row.date_start}::date, ${row.campaign_name || null}, ${row.campaign_id || `unknown-${row.date_start}`}, ${utmCampaign || null}, ${parseFloat(row.spend) || 0}, ${parseInt(row.impressions) || 0}, ${parseInt(row.clicks) || 0}, NOW())
        ON CONFLICT (facility_id, platform, campaign_id, date) DO UPDATE SET
          campaign_name = EXCLUDED.campaign_name,
          utm_campaign = EXCLUDED.utm_campaign,
          spend = EXCLUDED.spend,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          updated_at = NOW()
      `;
      synced++;
    }

    // Attribute spend to specific ad variations (fire-and-forget)
    attributeSpendToVariations(facilityId).catch((err) =>
      console.error("[attribution] Failed:", (err as Error).message)
    );

    return jsonResponse(
      { success: true, synced, dateRange: { start, end } },
      200,
      origin
    );
  } catch {
    return errorResponse("Failed to sync campaign spend", 500, origin);
  }
}
