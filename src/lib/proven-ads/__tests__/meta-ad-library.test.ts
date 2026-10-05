import { describe, expect, it } from "vitest";
import {
  META_AD_LIBRARY_SOURCE,
  buildArchiveUrl,
  mapMetaAd,
  type MetaArchivedAd,
} from "../adapters/meta-ad-library";

const raw: MetaArchivedAd = {
  id: "111222333",
  page_id: "999",
  page_name: "Riverside Storage",
  ad_creative_bodies: ["First month free on climate-controlled units. Reserve online."],
  ad_creative_link_titles: ["First month free"],
  ad_creative_link_descriptions: ["Units from £45"],
  ad_delivery_start_time: "2026-01-15T08:00:00+0000",
  ad_snapshot_url: "https://www.facebook.com/ads/archive/render_ad/?id=111222333",
  publisher_platforms: ["facebook", "instagram"],
};

describe("mapMetaAd", () => {
  it("maps archive fields onto a draft and classifies the offer", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    const draft = mapMetaAd(raw, "GB", now);
    expect(draft).not.toBeNull();
    expect(draft?.source).toBe(META_AD_LIBRARY_SOURCE);
    expect(draft?.source_ad_id).toBe("111222333");
    expect(draft?.platform).toBe("meta");
    expect(draft?.advertiser_name).toBe("Riverside Storage");
    expect(draft?.headline).toBe("First month free");
    expect(draft?.primary_text).toMatch(/climate-controlled/);
    expect(draft?.snapshot_url).toContain("render_ad");
    expect(draft?.country).toBe("GB");
    expect(draft?.started_at).toBe("2026-01-15");
    expect(draft?.active).toBe(true);
    expect(draft?.offer_type).toBe("first_month_free");
    expect(draft?.unit_type).toBe("climate_controlled");
    expect(draft?.publisher_platforms).toEqual(["facebook", "instagram"]);
  });

  it("marks an ad inactive when delivery has stopped", () => {
    const draft = mapMetaAd(
      { ...raw, ad_delivery_stop_time: "2026-03-01T00:00:00+0000" },
      "GB",
      new Date("2026-04-01T00:00:00.000Z")
    );
    expect(draft?.active).toBe(false);
    expect(draft?.ended_at).toBe("2026-03-01T00:00:00+0000");
  });

  it("drops a row with no id or no start date", () => {
    expect(mapMetaAd({ ...raw, id: undefined }, "GB")).toBeNull();
    expect(mapMetaAd({ ...raw, ad_delivery_start_time: undefined }, "GB")).toBeNull();
  });

  it("calls a multi-card ad a carousel", () => {
    const draft = mapMetaAd(
      {
        ...raw,
        ad_creative_bodies: ["One", "Two", "Three"],
        ad_creative_link_titles: ["A", "B", "C"],
      },
      "IE"
    );
    expect(draft?.format).toBe("carousel");
  });
});

describe("buildArchiveUrl", () => {
  it("requires reached countries and asks for ALL ad types", () => {
    const url = buildArchiveUrl({ searchTerms: "self storage", countries: ["GB", "IE"] }, "TOKEN", null);
    expect(url).toContain("graph.facebook.com/v21.0/ads_archive");
    expect(url).toContain("ad_type=ALL");
    expect(url).toContain("ad_reached_countries");
    expect(decodeURIComponent(url)).toContain('["GB","IE"]');
    expect(url).toContain("search_terms=self+storage");
    expect(url).toContain("access_token=TOKEN");
  });

  it("pages with the after cursor", () => {
    const url = buildArchiveUrl({ searchTerms: "storage" }, "T", "CURSOR123");
    expect(url).toContain("after=CURSOR123");
  });
});
