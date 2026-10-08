import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PartialPublish,
  budgetDollars,
  fitWords,
  keywordList,
  metaTargeting,
  publishToGoogle,
  publishToMeta,
  rsaText,
  usAddress,
  type AdVariation,
  type PlatformConnection,
} from "@/lib/ad-publish";

const conn = (platform: string, extra: Partial<PlatformConnection> = {}): PlatformConnection => ({
  id: "conn-1",
  facility_id: "fac-1",
  platform,
  status: "connected",
  access_token: "tok",
  refresh_token: "ref",
  token_expires_at: null,
  account_id: "123-456-7890",
  page_id: "page-1",
  metadata: null,
  ...extra,
});

const metaAd: AdVariation = {
  id: "abcdef12-0000-4000-8000-000000000001",
  facility_id: "fac-1",
  platform: "meta_feed",
  angle: "convenience",
  content_json: { headline: "Moving this month?", primaryText: "10x10s ready today.", description: "Reserve online", cta: "Learn More" },
  status: "approved",
};

const rsa: AdVariation = {
  id: "abcdef12-0000-4000-8000-000000000002",
  facility_id: "fac-1",
  platform: "google_search",
  angle: "rsa",
  content_json: {
    headlines: [{ text: "Storage Near Kalamazoo" }, { text: "10x10 Units Available" }, { text: "Reserve Online Today" }],
    descriptions: [{ text: "Clean, gated, drive-up units five minutes from downtown." }, { text: "Reserve in two minutes. No deposit." }],
    keywords: ["storage units kalamazoo", "self storage near me"],
  },
  status: "approved",
};

/** A fetch that answers each call in turn and records what it was asked. */
function scripted(replies: (Record<string, unknown> | Error | { status: number; body: Record<string, unknown> })[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    const next = replies.shift();
    if (next instanceof Error) throw next;
    if (next && "status" in next && "body" in next) {
      return new Response(JSON.stringify(next.body), { status: next.status as number });
    }
    return new Response(JSON.stringify(next ?? {}), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("text that fits", () => {
  it("cuts at a word, never mid-word, and drops what can't fit", () => {
    expect(fitWords("Clean gated drive-up storage near downtown", 30)).toBe("Clean gated drive-up storage");
    expect(fitWords("Supercalifragilisticexpialidociousness", 10)).toBeNull();
    expect(fitWords("  ", 30)).toBeNull();
  });

  it("uses a Google ad as written, and needs three headlines and two descriptions", () => {
    const t = rsaText(rsa.content_json);
    expect(t.headlines).toEqual(["Storage Near Kalamazoo", "10x10 Units Available", "Reserve Online Today"]);
    expect(t.descriptions).toHaveLength(2);
    // A Meta ad cut down for Google: no duplicates, nothing over 30.
    const cut = rsaText(metaAd.content_json);
    expect(cut.headlines.every((h) => h.length <= 30)).toBe(true);
    expect(new Set(cut.headlines.map((h) => h.toLowerCase())).size).toBe(cut.headlines.length);
  });

  it("cleans keywords of match-type punctuation", () => {
    expect(keywordList({ keywords: ['"storage units"', "[self storage]", "+boat storage"] })).toEqual([
      "storage units",
      "self storage",
      "boat storage",
    ]);
  });

  it("reads a US address into Google's parts", () => {
    expect(usAddress("1400 Maple Ave, Springfield, IL 62701, USA")).toEqual({
      countryCode: "US",
      provinceCode: "IL",
      postalCode: "62701",
      cityName: "Springfield",
      streetAddress: "1400 Maple Ave",
    });
    expect(usAddress("Mattawan, MI")).toEqual({ countryCode: "US", provinceCode: "MI", cityName: "Mattawan" });
    expect(usAddress("")).toBeNull();
  });

  it("keeps a budget a platform will take", () => {
    expect(budgetDollars(undefined)).toBe(10);
    expect(budgetDollars(0)).toBe(10);
    expect(budgetDollars(40)).toBe(40);
    expect(budgetDollars(0.2)).toBe(1);
  });
});

describe("Meta", () => {
  it("targets a radius around the facility, and says how Advantage+ audience applies", () => {
    const t = metaTargeting({ radius: { miles: 10, address: "1400 Maple Ave, Springfield, IL" } });
    expect(t.geo_locations).toEqual({
      custom_locations: [{ address_string: "1400 Maple Ave, Springfield, IL", radius: 10, distance_unit: "mile" }],
    });
    expect(t.targeting_automation).toEqual({ advantage_audience: 1 });
    // The old account-wide default keeps its ages, so it must turn Advantage+ audience off explicitly.
    expect(metaTargeting({}).targeting_automation).toEqual({ advantage_audience: 0 });
  });

  it("makes every level paused, at the campaign's budget, pointing at its page", async () => {
    const calls = scripted([{ id: "cmp" }, { id: "set" }, { id: "cre" }, { id: "ad" }]);
    const out = await publishToMeta(metaAd, conn("meta"), {
      dailyBudget: 40,
      radius: { miles: 10, address: "1400 Maple Ave, Springfield, IL" },
      landingUrl: "https://storageads.com/lp/fall?utm_campaign=f1",
    });
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual(["campaigns", "adsets", "adcreatives", "ads"]);
    expect(calls[0].url).toContain("/v25.0/act_123-456-7890/");
    expect(calls[0].body).toMatchObject({ status: "PAUSED", is_adset_budget_sharing_enabled: false, special_ad_categories: [] });
    expect(calls[1].body).toMatchObject({ status: "PAUSED", daily_budget: 4000, campaign_id: "cmp" });
    const link = (calls[2].body.object_story_spec as { link_data: { link: string } }).link_data.link;
    expect(link).toBe("https://storageads.com/lp/fall?utm_campaign=f1");
    expect(calls[3].body).toMatchObject({ status: "PAUSED", adset_id: "set" });
    expect(out.response).toMatchObject({ campaignId: "cmp", adSetId: "set", creativeId: "cre", adId: "ad", dailyBudget: 40 });
  });

  it("resumes from what an earlier attempt made instead of making it again", async () => {
    const calls = scripted([{ id: "cre" }, { id: "ad" }]);
    await publishToMeta(metaAd, conn("meta"), { resume: { campaignId: "cmp", adSetId: "set" } });
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual(["adcreatives", "ads"]);
  });

  it("is unknown when Meta stops answering mid-way, with what it made so far", async () => {
    scripted([{ id: "cmp" }, new Error("socket hang up")]);
    const err = await publishToMeta(metaAd, conn("meta")).catch((e) => e);
    expect(err).toBeInstanceOf(PartialPublish);
    expect(err.unknown).toBe(true);
    expect(err.created).toEqual({ campaignId: "cmp" });
  });

  it("is a definite failure when Meta refuses", async () => {
    scripted([{ id: "cmp" }, { status: 400, body: { error: { message: "Invalid targeting" } } }]);
    const err = await publishToMeta(metaAd, conn("meta")).catch((e) => e);
    expect(err.unknown).toBe(false);
    expect(err.message).toBe("Invalid targeting");
    expect(err.created).toEqual({ campaignId: "cmp" });
  });
});

describe("Google", () => {
  beforeEach(() => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev";
  });
  afterEach(() => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  const ok = (name: string) => ({ results: [{ resourceName: name }] });

  it("makes a paused search campaign near the facility, with its keywords and ad", async () => {
    const calls = scripted([ok("b/1"), ok("customers/1/campaigns/77"), ok("crit/1"), ok("ag/1"), { results: [{}, {}] }, ok("ad/1")]);
    const out = await publishToGoogle(rsa, conn("google_ads", { metadata: { loginCustomerId: "999-000-1111" } }), {
      dailyBudget: 20,
      radius: { miles: 5, address: "1400 Maple Ave, Springfield, IL 62701" },
      landingUrl: "https://storageads.com/lp/fall?utm_campaign=f1",
    });
    expect(calls.map((c) => c.url.split("/").slice(-1)[0])).toEqual([
      "campaignBudgets:mutate",
      "campaigns:mutate",
      "campaignCriteria:mutate",
      "adGroups:mutate",
      "adGroupCriteria:mutate",
      "adGroupAds:mutate",
    ]);
    expect(calls[0].url).toContain("/v25/customers/1234567890/");
    const budget = (calls[0].body.operations as { create: Record<string, unknown> }[])[0].create;
    expect(budget.amountMicros).toBe("20000000");
    const campaign = (calls[1].body.operations as { create: Record<string, unknown> }[])[0].create;
    expect(campaign).toMatchObject({
      status: "PAUSED",
      advertisingChannelType: "SEARCH",
      targetSpend: {},
      containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
    });
    const proximity = (calls[2].body.operations as { create: { proximity: Record<string, unknown> } }[])[0].create.proximity;
    expect(proximity).toMatchObject({ radius: 5, radiusUnits: "MILES" });
    expect(calls[4].body.operations).toHaveLength(2);
    const ad = (calls[5].body.operations as { create: { ad: { finalUrls: string[] } } }[])[0].create.ad;
    expect(ad.finalUrls).toEqual(["https://storageads.com/lp/fall?utm_campaign=f1"]);
    expect(out.externalUrl).toContain("campaignId=77");
  });

  it("refuses an ad Google would reject, before calling Google at all", async () => {
    const calls = scripted([]);
    const thin = { ...rsa, content_json: { headlines: [{ text: "One" }], descriptions: [], keywords: ["storage"] } };
    const err = await publishToGoogle(thin, conn("google_ads")).catch((e) => e);
    expect(err).toBeInstanceOf(PartialPublish);
    expect(err.unknown).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
