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

function mapCtaToMeta(cta: string): string {
  const map: Record<string, string> = {
    "Learn More": "LEARN_MORE",
    "Get Quote": "GET_QUOTE",
    "Book Now": "BOOK_TRAVEL",
    "Contact Us": "CONTACT_US",
    "Sign Up": "SIGN_UP",
  };
  return map[cta] || "LEARN_MORE";
}

async function metaApi(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`https://graph.facebook.com/v21.0/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, ...body }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

interface PlatformConnection {
  id: string;
  facility_id: string | null;
  platform: string;
  status: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  account_id: string | null;
  page_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface AdVariation {
  id: string;
  facility_id: string | null;
  platform: string;
  angle: string | null;
  content_json: Record<string, unknown>;
  status: string | null;
}

async function publishToMeta(
  variation: AdVariation,
  connection: PlatformConnection,
  imageUrl?: string,
  ctaOverride?: string,
  landingUrlOverride?: string
) {
  const accessToken = connection.access_token!;
  const accountId = connection.account_id!;
  const adAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;
  const content = variation.content_json as Record<string, string>;
  const facilityName = content.headline || "Storage Ad";
  const metadata = connection.metadata || {};
  const landingUrl =
    landingUrlOverride || (metadata.landingUrl as string) || "https://storageads.com";

  if (!connection.page_id) {
    throw new Error(
      "No Facebook Page connected. Reconnect Meta and ensure a Page is linked."
    );
  }

  let imageHash: string | null = null;
  if (imageUrl) {
    const uploadData = await metaApi(
      `${adAccountId}/adimages`,
      accessToken,
      { url: imageUrl }
    );
    if (uploadData.images) {
      const firstKey = Object.keys(uploadData.images)[0];
      imageHash = uploadData.images[firstKey]?.hash;
    }
  }

  const campaignData = await metaApi(
    `${adAccountId}/campaigns`,
    accessToken,
    {
      name: `StorageAds \u2014 ${facilityName}`,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
    }
  );
  const campaignId = campaignData.id;

  const adSetData = await metaApi(
    `${adAccountId}/adsets`,
    accessToken,
    {
      name: `${facilityName} \u2014 ${content.angleLabel || variation.angle || "Ad Set"}`,
      campaign_id: campaignId,
      status: "PAUSED",
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      daily_budget: 1000,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        geo_locations: { countries: ["US"] },
        age_min: 25,
        age_max: 65,
      },
    }
  );
  const adSetId = adSetData.id;

  const linkData: Record<string, unknown> = {
    message: content.primaryText || "",
    link: landingUrl,
    name: content.headline || "",
    description: content.description || "",
    call_to_action: {
      type: mapCtaToMeta(ctaOverride || content.cta || ""),
      value: { link: landingUrl },
    },
  };
  if (imageHash) linkData.image_hash = imageHash;

  const creativeData = await metaApi(
    `${adAccountId}/adcreatives`,
    accessToken,
    {
      name: `Creative \u2014 ${facilityName}`,
      object_story_spec: {
        page_id: connection.page_id,
        link_data: linkData,
      },
    }
  );
  const creativeId = creativeData.id;

  const adData = await metaApi(`${adAccountId}/ads`, accessToken, {
    name: `Ad \u2014 ${content.angleLabel || variation.angle || ""} \u2014 ${facilityName}`,
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: "PAUSED",
  });

  return {
    externalId: adData.id as string,
    externalUrl: `https://business.facebook.com/adsmanager/manage/campaigns?act=${accountId}&campaign_ids=${campaignId}`,
    response: {
      campaignId,
      adSetId,
      creativeId,
      adId: adData.id,
      status: "PAUSED",
      note: "Campaign created as PAUSED. Review targeting and budget in Ads Manager, then activate when ready.",
    },
  };
}

async function refreshGoogleToken(connection: PlatformConnection) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      refresh_token: connection.refresh_token || "",
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();

  if (data.access_token) {
    await db.platform_connections.update({
      where: { id: connection.id },
      data: {
        access_token: data.access_token,
        token_expires_at: new Date(
          Date.now() + (data.expires_in || 3600) * 1000
        ),
        updated_at: new Date(),
      },
    });
    return data.access_token as string;
  }
  throw new Error("Failed to refresh Google token");
}

async function googleAdsApi(
  customerId: string,
  endpoint: string,
  accessToken: string,
  developerToken: string,
  body: Record<string, unknown>
) {
  const cleanCustomerId = customerId.replace(/-/g, "");
  const res = await fetch(
    `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(
      data.error.message || JSON.stringify(data.error.details?.[0] || data.error)
    );
  }
  return data;
}

async function publishToGoogle(
  variation: AdVariation,
  connection: PlatformConnection,
  imageUrl?: string,
  ctaOverride?: string
) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error(
      "Google Ads developer token not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN in env."
    );
  }

  let accessToken = connection.access_token!;
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date()
  ) {
    accessToken = await refreshGoogleToken(connection);
  }

  const customerId = connection.account_id!;
  const cleanCustomerId = customerId.replace(/-/g, "");
  const content = variation.content_json as Record<string, string>;
  const metadata = connection.metadata || {};
  const landingUrl =
    (metadata.landingUrl as string) || "https://storageads.com";
  const facilityName = content.headline || "Storage Ad";

  // Step 1: Create a campaign budget
  const budgetResult = await googleAdsApi(
    cleanCustomerId,
    "campaignBudgets:mutate",
    accessToken,
    developerToken,
    {
      operations: [
        {
          create: {
            name: `StorageAds Budget — ${facilityName} — ${Date.now()}`,
            amountMicros: "10000000", // $10/day default
            deliveryMethod: "STANDARD",
          },
        },
      ],
    }
  );
  const budgetResourceName = budgetResult.results?.[0]?.resourceName;

  // Step 2: Create a campaign
  const isSearch = variation.platform === "google_search";
  const campaignResult = await googleAdsApi(
    cleanCustomerId,
    "campaigns:mutate",
    accessToken,
    developerToken,
    {
      operations: [
        {
          create: {
            name: `StorageAds — ${facilityName}`,
            status: "PAUSED",
            advertisingChannelType: isSearch ? "SEARCH" : "DISPLAY",
            campaignBudget: budgetResourceName,
            ...(isSearch
              ? {
                  networkSettings: {
                    targetGoogleSearch: true,
                    targetSearchNetwork: true,
                    targetContentNetwork: false,
                  },
                }
              : {
                  networkSettings: {
                    targetGoogleSearch: false,
                    targetSearchNetwork: false,
                    targetContentNetwork: true,
                  },
                }),
            biddingStrategyType: "MAXIMIZE_CLICKS",
          },
        },
      ],
    }
  );
  const campaignResourceName = campaignResult.results?.[0]?.resourceName;

  // Step 3: Create an ad group
  const adGroupResult = await googleAdsApi(
    cleanCustomerId,
    "adGroups:mutate",
    accessToken,
    developerToken,
    {
      operations: [
        {
          create: {
            name: `${content.angleLabel || variation.angle || "Ad Group"} — ${facilityName}`,
            campaign: campaignResourceName,
            status: "ENABLED",
            type: isSearch ? "SEARCH_STANDARD" : "DISPLAY_STANDARD",
            ...(isSearch ? {} : { cpcBidMicros: "500000" }), // $0.50 for display
          },
        },
      ],
    }
  );
  const adGroupResourceName = adGroupResult.results?.[0]?.resourceName;

  // Step 4: Create the ad
  let adPayload: Record<string, unknown>;
  if (isSearch) {
    // Responsive Search Ad
    const headlines = [
      content.headline || facilityName,
      ctaOverride || content.cta || "Reserve Your Unit Today",
      content.description?.slice(0, 30) || "Secure & Convenient Storage",
    ].map((text, i) => ({ text: text.slice(0, 30), pinnedField: i === 0 ? "HEADLINE_1" : undefined }));

    const descriptions = [
      content.primaryText || "",
      content.description || "",
    ]
      .filter(Boolean)
      .map((text) => ({ text: text.slice(0, 90) }));

    adPayload = {
      ad: {
        responsiveSearchAd: {
          headlines,
          descriptions,
        },
        finalUrls: [landingUrl],
      },
    };
  } else {
    // Responsive Display Ad
    adPayload = {
      ad: {
        responsiveDisplayAd: {
          headlines: [{ text: (content.headline || facilityName).slice(0, 30) }],
          longHeadline: { text: (content.primaryText || content.headline || facilityName).slice(0, 90) },
          descriptions: [{ text: (content.description || content.primaryText || "").slice(0, 90) }],
          businessName: "StorageAds",
          callToActionText: ctaOverride || content.cta || "Learn More",
          ...(imageUrl ? { marketingImages: [{ asset: imageUrl }] } : {}),
        },
        finalUrls: [landingUrl],
      },
    };
  }

  const adResult = await googleAdsApi(
    cleanCustomerId,
    "adGroupAds:mutate",
    accessToken,
    developerToken,
    {
      operations: [
        {
          create: {
            adGroup: adGroupResourceName,
            status: "ENABLED",
            ...adPayload,
          },
        },
      ],
    }
  );

  const adResourceName = adResult.results?.[0]?.resourceName;

  return {
    externalId: adResourceName || null,
    externalUrl: `https://ads.google.com/aw/ads?ocid=${cleanCustomerId}`,
    response: {
      status: "campaign_created",
      campaignResourceName,
      adGroupResourceName,
      adResourceName,
      budgetResourceName,
      campaignStatus: "PAUSED",
      note: "Campaign created as PAUSED with $10/day budget. Review targeting in Google Ads, then activate when ready.",
    },
  };
}

async function refreshTikTokToken(connection: PlatformConnection) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  const res = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey || "",
        client_secret: clientSecret || "",
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token || "",
      }),
    }
  );
  const data = await res.json();

  if (data.access_token) {
    await db.platform_connections.update({
      where: { id: connection.id },
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token || undefined,
        token_expires_at: new Date(
          Date.now() + (data.expires_in || 86400) * 1000
        ),
        updated_at: new Date(),
      },
    });
    return data.access_token as string;
  }
  return null;
}

async function publishToTikTok(
  variation: AdVariation,
  connection: PlatformConnection,
  imageUrl?: string
) {
  const content = variation.content_json as Record<string, string>;

  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date()
  ) {
    const newToken = await refreshTikTokToken(connection);
    if (newToken) connection.access_token = newToken;
  }

  const caption = [
    content.primaryText || content.headline || "",
    "",
    content.description || "",
    "",
    "#selfstorage #storage #moving #storageunit #declutter #organization",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2200);

  if (!imageUrl) {
    throw new Error(
      "TikTok requires an image or video. Select an image before publishing."
    );
  }

  const initRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/content/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: [imageUrl],
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    }
  );
  const initData = await initRes.json();

  if (initData.error?.code && initData.error.code !== "ok") {
    throw new Error(
      `TikTok post failed: ${initData.error.message || initData.error.code}`
    );
  }

  const connMeta = connection.metadata || {};
  return {
    externalId: (initData.data?.publish_id as string) || null,
    externalUrl: (connMeta.username as string)
      ? `https://www.tiktok.com/@${connMeta.username}`
      : "https://www.tiktok.com",
    response: {
      publishId: initData.data?.publish_id,
      status: "posted",
      note: "Photo posted to TikTok. It may take a few minutes to appear on the profile.",
    },
  };
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "publish-ad");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireFacilityAccess(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) {
    return errorResponse("facilityId required", 400, origin);
  }

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

    let result: {
      externalId: string | null;
      externalUrl: string | null;
      response: Record<string, unknown>;
    };

    try {
      if (connection.platform === "meta") {
        result = await publishToMeta(variationData, connectionData, imageUrl, ctaOverride, landingUrl);
      } else if (connection.platform === "google_ads") {
        result = await publishToGoogle(
          variationData,
          connectionData,
          imageUrl,
          ctaOverride
        );
      } else if (connection.platform === "tiktok") {
        result = await publishToTikTok(
          variationData,
          connectionData,
          imageUrl
        );
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
      await db.publish_log.update({
        where: { id: logEntry.id },
        data: { status: "failed", error_message: pubMessage },
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
