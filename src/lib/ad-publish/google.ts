import { db } from "@/lib/db";
import { GOOGLE_ADS_API_VERSION } from "@/lib/attribution/write-back";
import {
  PartialPublish,
  PlatformRefused,
  budgetDollars,
  step,
  type AdVariation,
  type PlatformConnection,
  type PublishResult,
  type PublishTarget,
} from "./types";

/**
 * Google Ads: budget → campaign (PAUSED) → location → ad group → keywords →
 * responsive search ad. Search campaigns bid to maximise clicks inside the
 * daily budget.
 *
 * Names are derived from the ad's id, so a retry after an unknown outcome is
 * refused by Google as a duplicate name rather than making a second campaign.
 */

export async function refreshGoogleToken(connection: PlatformConnection): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
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
        token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000),
        updated_at: new Date(),
      },
    });
    return data.access_token as string;
  }
  throw new PartialPublish("Google would not refresh the sign-in. Reconnect Google Ads.", {}, false);
}

export async function googleAdsApi(
  customerId: string,
  endpoint: string,
  accessToken: string,
  developerToken: string,
  body: Record<string, unknown>,
  loginCustomerId?: string | null,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  const res = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId.replace(/-/g, "")}/${endpoint}`,
    { method: "POST", headers, body: JSON.stringify(body) },
  );
  let data: { error?: { message?: string; details?: unknown[] }; results?: { resourceName?: string }[] };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Google answered ${res.status} with no readable body`);
  }
  if (data.error) {
    const detail = googleErrorText(data.error);
    if (res.status >= 500) throw new Error(detail);
    throw new PlatformRefused(detail);
  }
  return data;
}

/** The first specific error Google gives, which says far more than the top-level message. */
function googleErrorText(error: { message?: string; details?: unknown[] }): string {
  const details = (error.details ?? []) as { errors?: { message?: string }[] }[];
  const specific = details.flatMap((d) => d.errors ?? []).find((e) => e.message)?.message;
  return specific || error.message || "Google Ads refused the request";
}

/** Trim to whole words within `max` characters; null when even one word won't fit. */
export function fitWords(text: string, max: number): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1);
  const at = cut.lastIndexOf(" ");
  return at > 0 ? cut.slice(0, at).replace(/[,;:–—-]+$/, "").trim() || null : null;
}

function texts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : typeof v === "object" && v && "text" in v ? String((v as { text: unknown }).text ?? "") : ""))
    .filter(Boolean);
}

function unique(list: (string | null)[], max: number): string[] {
  const out: string[] = [];
  for (const s of list) {
    if (!s) continue;
    if (out.some((o) => o.toLowerCase() === s.toLowerCase())) continue;
    out.push(s);
    if (out.length === max) break;
  }
  return out;
}

/**
 * The responsive search ad's text. A Google ad (headlines and descriptions
 * arrays) is used as written; any other ad is cut down from its headline, call
 * to action and copy. Google needs 3–15 headlines of 30 characters and 2–4
 * descriptions of 90.
 */
export function rsaText(content: Record<string, unknown>, cta?: string): { headlines: string[]; descriptions: string[] } {
  const str = (k: string) => (typeof content[k] === "string" ? (content[k] as string) : "");
  const headlines = unique(
    [
      ...texts(content.headlines).map((h) => fitWords(h, 30)),
      fitWords(str("headline"), 30),
      fitWords(cta || str("cta"), 30),
      fitWords(str("description"), 30),
    ],
    15,
  );
  const descriptions = unique(
    [
      ...texts(content.descriptions).map((d) => fitWords(d, 90)),
      fitWords(str("primaryText"), 90),
      fitWords(str("description"), 90),
    ],
    4,
  );
  return { headlines, descriptions };
}

export function keywordList(content: Record<string, unknown>, extra: string[] = []): string[] {
  return unique(
    [...texts(content.keywords), ...extra].map((k) => fitWords(k.replace(/["[\]+]/g, ""), 80)),
    20,
  );
}

/** "123 Main St, Kalamazoo, MI 49001, USA" → Google's AddressInfo. */
export function usAddress(address: string): Record<string, string> | null {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length && /^(usa|us|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return null;
  const tail = parts[parts.length - 1];
  const m = tail.match(/^([A-Za-z]{2})\s*(\d{5})?(?:-\d{4})?$/);
  const out: Record<string, string> = { countryCode: "US" };
  if (m) {
    out.provinceCode = m[1].toUpperCase();
    if (m[2]) out.postalCode = m[2];
    parts.pop();
  } else {
    const zip = tail.match(/\b(\d{5})\b/);
    if (zip) out.postalCode = zip[1];
  }
  if (parts.length >= 2) {
    out.cityName = parts[parts.length - 1];
    out.streetAddress = parts.slice(0, -1).join(", ");
  } else if (parts.length === 1) {
    out.cityName = parts[0];
  }
  return out.cityName || out.postalCode ? out : null;
}

export async function publishToGoogle(
  variation: AdVariation,
  connection: PlatformConnection,
  target: PublishTarget = {},
): Promise<PublishResult> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new PartialPublish("Google Ads isn't set up on StorageAds yet (no developer token).", {}, false);
  }

  let accessToken = connection.access_token!;
  if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
    accessToken = await refreshGoogleToken(connection);
  }

  const customerId = connection.account_id!.replace(/-/g, "");
  const meta = connection.metadata || {};
  const loginCustomerId =
    (typeof meta.loginCustomerId === "string" && meta.loginCustomerId) || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || null;
  const content = variation.content_json as Record<string, unknown>;
  const landingUrl = target.landingUrl || (meta.landingUrl as string) || "https://storageads.com";
  const name = target.name || (typeof content.headline === "string" && content.headline) || "Storage Ad";
  const budget = budgetDollars(target.dailyBudget);
  const isSearch = variation.platform === "google_search" || Array.isArray(content.headlines) || !!target.keywords?.length;
  const tag = variation.id.slice(0, 8);

  const { headlines, descriptions } = rsaText(content, target.cta);
  const keywords = keywordList(content, target.keywords);
  const address = target.radius ? usAddress(target.radius.address) : null;
  if (isSearch) {
    if (headlines.length < 3 || descriptions.length < 2) {
      throw new PartialPublish(
        `A Google ad needs at least 3 headlines and 2 descriptions; this one has ${headlines.length} and ${descriptions.length}.`,
        {},
        false,
      );
    }
    if (!keywords.length) throw new PartialPublish("A Google Search ad needs keywords to show on.", {}, false);
  }
  if (target.radius && !address) {
    throw new PartialPublish("Google needs the facility's street address or ZIP to run near it.", {}, false);
  }

  const call = (endpoint: string, body: Record<string, unknown>) =>
    googleAdsApi(customerId, endpoint, accessToken, developerToken, body, loginCustomerId);
  const created: Record<string, string> = { ...(target.resume ?? {}) };

  const budgetName = await step(created, "budget", async () => {
    const r = await call("campaignBudgets:mutate", {
      operations: [
        {
          create: {
            name: `StorageAds budget — ${name} — ${tag}`,
            amountMicros: String(Math.round(budget * 1_000_000)),
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    });
    return r.results?.[0]?.resourceName;
  });

  const campaign = await step(created, "campaign", async () => {
    const r = await call("campaigns:mutate", {
      operations: [
        {
          create: {
            name: `StorageAds — ${name} — ${tag}`,
            status: "PAUSED",
            advertisingChannelType: isSearch ? "SEARCH" : "DISPLAY",
            campaignBudget: budgetName,
            ...(isSearch ? { targetSpend: {} } : { manualCpc: {} }),
            networkSettings: isSearch
              ? { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false, targetPartnerSearchNetwork: false }
              : { targetGoogleSearch: false, targetSearchNetwork: false, targetContentNetwork: true },
            geoTargetTypeSetting: { positiveGeoTargetType: "PRESENCE" },
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          },
        },
      ],
    });
    return r.results?.[0]?.resourceName;
  });

  if (address && target.radius) {
    await step(created, "location", async () => {
      const r = await call("campaignCriteria:mutate", {
        operations: [
          {
            create: {
              campaign,
              proximity: {
                address,
                radius: Math.min(50, Math.max(1, Math.round(target.radius!.miles))),
                radiusUnits: "MILES",
              },
            },
          },
        ],
      });
      return r.results?.[0]?.resourceName;
    });
  }

  const adGroup = await step(created, "adGroup", async () => {
    const r = await call("adGroups:mutate", {
      operations: [
        {
          create: {
            name: `${(typeof content.angleLabel === "string" && content.angleLabel) || variation.angle || "Ad group"} — ${name} — ${tag}`,
            campaign,
            status: "ENABLED",
            type: isSearch ? "SEARCH_STANDARD" : "DISPLAY_STANDARD",
            ...(isSearch ? {} : { cpcBidMicros: "500000" }),
          },
        },
      ],
    });
    return r.results?.[0]?.resourceName;
  });

  if (isSearch) {
    await step(created, "keywords", async () => {
      const r = await call("adGroupCriteria:mutate", {
        operations: keywords.map((text) => ({
          create: { adGroup, status: "ENABLED", keyword: { text, matchType: "PHRASE" } },
        })),
      });
      return r.results?.length ? String(r.results.length) : undefined;
    });
  }

  const ad = await step(created, "ad", async () => {
    const str = (k: string) => (typeof content[k] === "string" ? (content[k] as string) : "");
    const adBody = isSearch
      ? {
          responsiveSearchAd: {
            headlines: headlines.map((text) => ({ text })),
            descriptions: descriptions.map((text) => ({ text })),
          },
          finalUrls: [landingUrl],
        }
      : {
          responsiveDisplayAd: {
            headlines: [{ text: fitWords(str("headline") || name, 30) ?? "Self storage near you" }],
            longHeadline: { text: fitWords(str("primaryText") || str("headline") || name, 90) ?? name },
            descriptions: [{ text: fitWords(str("description") || str("primaryText"), 90) ?? "Reserve online." }],
            businessName: fitWords(name, 25) ?? "StorageAds",
            callToActionText: target.cta || str("cta") || "Learn More",
            ...(target.imageUrl ? { marketingImages: [{ asset: target.imageUrl }] } : {}),
          },
          finalUrls: [landingUrl],
        };
    const r = await call("adGroupAds:mutate", {
      operations: [{ create: { adGroup, status: "ENABLED", ad: adBody } }],
    });
    return r.results?.[0]?.resourceName;
  });

  const campaignId = campaign.split("/").pop();
  return {
    externalId: ad,
    externalUrl: `https://ads.google.com/aw/campaigns?ocid=${customerId}${campaignId ? `&campaignId=${campaignId}` : ""}`,
    response: {
      ...created,
      campaignStatus: "PAUSED",
      dailyBudget: budget,
      radiusMiles: target.radius?.miles ?? null,
      keywords: isSearch ? keywords.length : 0,
      note: `Created paused at $${budget}/day. Nothing spends until you switch it on in Google Ads.`,
    },
  };
}
