import { describe, expect, it } from "vitest";
import {
  META_AD_LIBRARY_WEB_SOURCE,
  adLibraryUrl,
  cleanLandingUrl,
  groupFamilies,
  libraryDate,
  libraryFormat,
  mapObservation,
  previewUrls,
  previewUrlsFromRaw,
  type LibraryObservation,
} from "../adapters/meta-ad-library-web";

const base: LibraryObservation = {
  id: "1000063348451416",
  cc: 1,
  page_id: "1524129977695548",
  page: "Big Jim Self Storage",
  start: 1718607600, // 2024-06-17 midnight Pacific
  end: 1791183600,
  active: true,
  plat: ["FACEBOOK", "INSTAGRAM"],
  body: "Now open. 267 climate-controlled units, 50% off the 1st month on most sizes.",
  title: "New climate building",
  cta: "Call now",
  fmt: "IMAGE",
  link: "https://www.bigjim.example/units?utm_source=fb&fbclid=abc",
  likes: 209,
  pcats: ["Storage"],
};

describe("libraryDate", () => {
  it("reads midnight Pacific as that calendar day, summer and winter", () => {
    expect(libraryDate(1718607600)).toBe("2024-06-17"); // 07:00Z (PDT)
    expect(libraryDate(1735718400)).toBe("2025-01-01"); // 08:00Z (PST)
  });
  it("refuses nonsense", () => {
    expect(libraryDate(0)).toBeNull();
    expect(libraryDate(Number.NaN)).toBeNull();
  });
});

describe("cleanLandingUrl", () => {
  it("drops tracking parameters", () => {
    expect(cleanLandingUrl(base.link)).toBe("https://www.bigjim.example/units");
  });
  it("unwraps facebook's redirect", () => {
    const wrapped = "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Frent%3Fx%3D1&h=AT0";
    expect(cleanLandingUrl(wrapped)).toBe("https://example.com/rent");
  });
  it("rejects non-web schemes", () => {
    expect(cleanLandingUrl("tel:5551234")).toBeNull();
  });
});

describe("libraryFormat", () => {
  it("maps Meta display formats", () => {
    expect(libraryFormat({ fmt: "IMAGE" })).toBe("image");
    expect(libraryFormat({ fmt: "VIDEO" })).toBe("video");
    expect(libraryFormat({ fmt: "CAROUSEL" })).toBe("carousel");
    expect(libraryFormat({ fmt: "DCO", cards: [{ vprev: "x" }] })).toBe("video");
    expect(libraryFormat({ fmt: "DCO", cards: [{}] })).toBe("image");
  });
});

describe("mapObservation", () => {
  const observed = new Date("2026-10-05T19:00:00.000Z");

  it("maps an observation onto a person-run draft that links back to the library", () => {
    const d = mapObservation(base, observed, { size: 3, members: ["a", "b", "c"] });
    expect(d?.source).toBe(META_AD_LIBRARY_WEB_SOURCE);
    expect(d?.source_ad_id).toBe(base.id);
    expect(d?.snapshot_url).toBe(adLibraryUrl(base.id));
    expect(d?.started_at).toBe("2024-06-17");
    expect(d?.last_seen_at).toBe(observed.toISOString());
    expect(d?.landing_url).toBe("https://www.bigjim.example/units");
    expect(d?.publisher_platforms).toEqual(["facebook", "instagram"]);
    expect(d?.family_size).toBe(3);
    expect(d?.media_refs).toBeNull();
    expect(d?.offer_type).toBe("percent_off");
    expect(d?.unit_type).toBe("climate_controlled");
  });

  it("reads dynamic-creative ads from their cards, not the template tokens", () => {
    const d = mapObservation(
      {
        ...base,
        fmt: "DCO",
        body: "{{product.brand}}",
        title: "{{product.name}}",
        cards: [{ title: "See inside Verrado storage", body: "First full month just $1." }],
      },
      observed
    );
    expect(d?.headline).toBe("See inside Verrado storage");
    expect(d?.primary_text).toBe("First full month just $1.");
  });

  it("drops rows with no id or start", () => {
    expect(mapObservation({ ...base, id: "" }, observed)).toBeNull();
    expect(mapObservation({ ...base, start: 0 }, observed)).toBeNull();
  });
});

describe("groupFamilies", () => {
  const loc = (id: string, start: number, street: string, city: string): LibraryObservation => ({
    id,
    page_id: "storeease",
    page: "StoreEase Self Storage",
    start,
    cc: 1,
    body: `Looking for storage near you? Get One Month Free when you rent online today at our ${street} location in ${city}.`,
    title: "Rent Online Today, Get One Month Free",
  });

  it("collapses one operator's per-location copies and keeps the longest-running", () => {
    const fams = groupFamilies([
      loc("b", 1750000000, "4245 Richmond Avenue", "Houston, TX"),
      loc("a", 1740000000, "8772 W Atlantic Avenue", "Delray Beach, FL"),
      { ...loc("c", 1745000000, "8851 Courson Blvd", "Leeds, AL"), cc: 4 },
    ]);
    expect(fams).toHaveLength(1);
    expect(fams[0].representative.id).toBe("a");
    expect(fams[0].members).toEqual(["a", "c", "b"]);
    expect(fams[0].size).toBe(6);
  });

  it("keeps different creatives from the same advertiser apart", () => {
    const fams = groupFamilies([
      loc("a", 1740000000, "1 Main St", "Austin, TX"),
      {
        id: "z",
        page_id: "storeease",
        start: 1741000000,
        body: "Boat and RV parking with power hookups, gated and lit, near the lake.",
      },
    ]);
    expect(fams).toHaveLength(2);
  });

  it("never merges across advertisers", () => {
    const a = loc("a", 1740000000, "1 Main St", "Austin, TX");
    const b = { ...loc("b", 1740000000, "1 Main St", "Austin, TX"), page_id: "other" };
    expect(groupFamilies([a, b])).toHaveLength(2);
  });
});

describe("previewUrls", () => {
  it("takes resized frames first, then posters and cards, three at most, https only", () => {
    const urls = previewUrls({
      images: [{ o: "https://cdn/o1.jpg", r: "https://cdn/r1.jpg" }, null],
      videos: [{ prev: "https://cdn/v1.jpg" }],
      cards: [{ img: "https://cdn/c1.jpg" }, { img: "http://cdn/insecure.jpg" }, { vprev: "https://cdn/c2.jpg" }],
    });
    expect(urls).toEqual(["https://cdn/r1.jpg", "https://cdn/v1.jpg", "https://cdn/c1.jpg"]);
  });

  it("round-trips through the stored row", () => {
    const d = mapObservation({ ...base, images: [{ r: "https://cdn/r.jpg" }] }, new Date());
    expect(previewUrlsFromRaw(d?.raw)).toEqual(["https://cdn/r.jpg"]);
    expect(previewUrlsFromRaw(null)).toEqual([]);
  });
});
