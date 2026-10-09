import {
  META_API_VERSION,
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
 * Meta: campaign → ad set → (image) → creative → ad, every level PAUSED.
 * Nothing spends until the owner switches it on in Ads Manager.
 *
 * With a radius the ad set runs within that many miles of the facility's
 * address. Without one it keeps the old account-wide default (US, 25–65),
 * which only the hand-publish path can still reach.
 */

export function mapCtaToMeta(cta: string): string {
  const map: Record<string, string> = {
    "Learn More": "LEARN_MORE",
    "Get Quote": "GET_QUOTE",
    "Book Now": "BOOK_TRAVEL",
    "Contact Us": "CONTACT_US",
    "Sign Up": "SIGN_UP",
  };
  return map[cta] || "LEARN_MORE";
}

export async function metaApi(endpoint: string, accessToken: string, body: Record<string, unknown>) {
  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, ...body }),
  });
  let data: Record<string, unknown> & { error?: { message?: string; error_user_msg?: string } };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Meta answered ${res.status} with no readable body`);
  }
  if (data.error) {
    const message = data.error.error_user_msg || data.error.message || "Meta refused the request";
    // A 5xx from Meta is "try again", and the object may exist: not a definite no.
    if (res.status >= 500) throw new Error(message);
    throw new PlatformRefused(message);
  }
  return data as Record<string, unknown> & { id?: string; images?: Record<string, { hash?: string }> };
}

/** The ad set's targeting. A radius around the facility, or the old default. */
export function metaTargeting(target: PublishTarget): Record<string, unknown> {
  if (target.radius) {
    return {
      geo_locations: {
        custom_locations: [
          {
            address_string: target.radius.address,
            radius: Math.min(50, Math.max(1, Math.round(target.radius.miles))),
            distance_unit: "mile",
          },
        ],
      },
      age_min: 18,
      // v23+: say explicitly how Advantage+ audience applies. Location is never expanded.
      targeting_automation: { advantage_audience: 1 },
    };
  }
  return {
    geo_locations: { countries: ["US"] },
    age_min: 25,
    age_max: 65,
    // Non-default ages need an explicit setting since v23.
    targeting_automation: { advantage_audience: 0 },
  };
}

export async function publishToMeta(
  variation: AdVariation,
  connection: PlatformConnection,
  target: PublishTarget = {},
): Promise<PublishResult> {
  const accessToken = connection.access_token!;
  const accountId = connection.account_id!;
  const adAccountId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const content = variation.content_json as Record<string, string>;
  const facilityName = target.name || content.headline || "Storage Ad";
  const metadata = connection.metadata || {};
  const landingUrl = target.landingUrl || (metadata.landingUrl as string) || "https://storageads.com";
  const budget = budgetDollars(target.dailyBudget);

  if (!connection.page_id) {
    throw new PartialPublish("No Facebook Page is connected. Reconnect Meta and pick a Page.", {}, false);
  }

  const created: Record<string, string> = { ...(target.resume ?? {}) };

  const campaignId = await step(created, "campaignId", async () => {
    const r = await metaApi(`${adAccountId}/campaigns`, accessToken, {
      name: `StorageAds — ${facilityName}`,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: [],
      // Budgets live on the ad set; v24+ requires this to be said out loud.
      is_adset_budget_sharing_enabled: false,
    });
    return r.id;
  });

  const adSetId = await step(created, "adSetId", async () => {
    const r = await metaApi(`${adAccountId}/adsets`, accessToken, {
      name: `${facilityName} — ${content.angleLabel || variation.angle || "Ad Set"}`,
      campaign_id: campaignId,
      status: "PAUSED",
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      daily_budget: Math.round(budget * 100),
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting: metaTargeting(target),
    });
    return r.id;
  });

  let imageHash: string | undefined = created.imageHash;
  if (target.imageUrl && !imageHash) {
    imageHash = await step(created, "imageHash", async () => {
      const r = await metaApi(`${adAccountId}/adimages`, accessToken, { url: target.imageUrl });
      const first = r.images ? Object.values(r.images)[0] : undefined;
      return first?.hash;
    });
  }

  const creativeId = await step(created, "creativeId", async () => {
    const linkData: Record<string, unknown> = {
      message: content.primaryText || "",
      link: landingUrl,
      name: content.headline || "",
      description: content.description || "",
      call_to_action: {
        type: mapCtaToMeta(target.cta || content.cta || ""),
        value: { link: landingUrl },
      },
    };
    if (imageHash) linkData.image_hash = imageHash;
    const r = await metaApi(`${adAccountId}/adcreatives`, accessToken, {
      name: `Creative — ${facilityName}`,
      object_story_spec: { page_id: connection.page_id, link_data: linkData },
    });
    return r.id;
  });

  const adId = await step(created, "adId", async () => {
    const r = await metaApi(`${adAccountId}/ads`, accessToken, {
      name: `Ad — ${content.angleLabel || variation.angle || ""} — ${facilityName}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: "PAUSED",
    });
    return r.id;
  });

  return {
    externalId: adId,
    externalUrl: `https://business.facebook.com/adsmanager/manage/campaigns?act=${accountId.replace(/^act_/, "")}&selected_campaign_ids=${campaignId}`,
    response: {
      ...created,
      status: "PAUSED",
      dailyBudget: budget,
      radiusMiles: target.radius?.miles ?? null,
      note: `Created paused at $${budget}/day. Nothing spends until you switch it on in Ads Manager.`,
    },
  };
}
