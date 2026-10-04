import { describe, expect, it } from "vitest";
import {
  callTouch,
  classify,
  firstTouch,
  latestNonDirectTouch,
  latestTouch,
  parseVisit,
  phoneHash,
  phoneLast10,
  pickGoogleClick,
  pickMetaClick,
  shouldRecord,
  summarize,
  type TouchRecord,
} from "@/lib/attribution/touch";

const OWN = ["storageads.com"];
const LP = "https://storageads.com/lp/midtown-storage";

const touch = (o: Partial<TouchRecord> & { occurred_at: Date }): TouchRecord => ({
  kind: "visit",
  channel: "direct",
  source: null,
  url: null,
  referrer: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  gclid: null,
  gbraid: null,
  wbraid: null,
  fbclid: null,
  fbc: null,
  fbp: null,
  ttclid: null,
  msclkid: null,
  ...o,
});
const d = (iso: string) => new Date(iso);

describe("classify — click ids the platforms add themselves win", () => {
  it("gclid, gbraid and wbraid are all paid Google search", () => {
    expect(classify({ gclid: "g" }, null)).toEqual({ channel: "paid_search", source: "google" });
    expect(classify({ gbraid: "b" }, null)).toEqual({ channel: "paid_search", source: "google" });
    expect(classify({ wbraid: "w" }, null)).toEqual({ channel: "paid_search", source: "google" });
  });

  it("a click id outranks a contradictory utm_medium", () => {
    expect(classify({ gclid: "g", utm_medium: "email" }, null).channel).toBe("paid_search");
  });

  it("msclkid is Microsoft, ttclid is TikTok", () => {
    expect(classify({ msclkid: "m" }, null)).toEqual({ channel: "paid_search", source: "microsoft" });
    expect(classify({ ttclid: "t" }, null)).toEqual({ channel: "paid_social", source: "tiktok" });
  });
});

describe("classify — fbclid alone is not proof of a paid click", () => {
  // Meta appends fbclid to every outbound link, organic posts included.
  it("bare fbclid is organic social", () => {
    expect(classify({ fbclid: "f" }, null)).toEqual({ channel: "organic_social", source: "meta" });
  });

  it("fbclid with a paid medium is paid social", () => {
    expect(classify({ fbclid: "f", utm_source: "facebook", utm_medium: "paid_social" }, null))
      .toEqual({ channel: "paid_social", source: "meta" });
  });

  it("cpc on a Meta source is paid social, not search", () => {
    expect(classify({ utm_source: "instagram", utm_medium: "cpc" }, null))
      .toEqual({ channel: "paid_social", source: "meta" });
  });
});

describe("classify — utm_medium", () => {
  it("maps the mediums we put on our own links", () => {
    expect(classify({ utm_source: "google", utm_medium: "cpc" }, null).channel).toBe("paid_search");
    expect(classify({ utm_source: "gdn", utm_medium: "display" }, null).channel).toBe("paid_other");
    expect(classify({ utm_source: "drip", utm_medium: "email" }, null).channel).toBe("email");
    expect(classify({ utm_source: "postcard", utm_medium: "sms" }, null).channel).toBe("email");
  });

  it("a tagged Google Business Profile link is organic search", () => {
    expect(classify({ utm_source: "google", utm_medium: "organic" }, null))
      .toEqual({ channel: "organic_search", source: "google" });
    expect(classify({ utm_source: "google", utm_medium: "gbp" }, null).channel).toBe("organic_search");
  });

  it("an unknown medium with a source is a referral from that source", () => {
    expect(classify({ utm_source: "sparefoot", utm_medium: "listing" }, null))
      .toEqual({ channel: "referral", source: "sparefoot" });
  });
});

describe("classify — the referrer, when nothing else says", () => {
  it("search engines are organic search", () => {
    expect(classify({}, "https://www.google.com/")).toEqual({ channel: "organic_search", source: "google" });
    expect(classify({}, "https://www.google.co.uk/search?q=x")).toEqual({ channel: "organic_search", source: "google" });
    expect(classify({}, "https://www.bing.com/search")).toEqual({ channel: "organic_search", source: "bing" });
  });

  it("social hosts, including link shims, are organic social", () => {
    expect(classify({}, "https://l.facebook.com/l.php")).toEqual({ channel: "organic_social", source: "meta" });
    expect(classify({}, "https://t.co/abc")).toEqual({ channel: "organic_social", source: "x" });
  });

  it("our own host is direct — it is navigation, not a source", () => {
    expect(classify({}, "https://storageads.com/lp/other", OWN)).toEqual({ channel: "direct", source: null });
    expect(classify({}, "https://www.storageads.com/", OWN)).toEqual({ channel: "direct", source: null });
  });

  it("matches our own host even when the request host carries a port", () => {
    expect(classify({}, "http://localhost:3000/lp/x", ["localhost:3000"])).toEqual({ channel: "direct", source: null });
  });

  it("anything else is a referral named after its host", () => {
    expect(classify({}, "https://www.yelp.com/biz/x")).toEqual({ channel: "referral", source: "yelp.com" });
  });

  it("no referrer and no params is direct", () => {
    expect(classify({}, null)).toEqual({ channel: "direct", source: null });
    expect(classify({}, "not a url")).toEqual({ channel: "direct", source: null });
  });

  it("a host that merely contains a search engine's name is not one", () => {
    expect(classify({}, "https://notgoogle.com/").channel).toBe("referral");
  });
});

describe("parseVisit", () => {
  it("reads params from the URL, never from anything else", () => {
    const t = parseVisit({
      url: `${LP}?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123`,
      referrer: "https://www.google.com/",
      ownHosts: OWN,
    });
    expect(t).toMatchObject({
      kind: "visit", channel: "paid_search", source: "google",
      utm_source: "google", utm_medium: "cpc", utm_campaign: "spring", gclid: "abc123",
      referrer: "https://www.google.com/",
    });
  });

  it("captures the iOS braids and Microsoft's id that the old capture dropped", () => {
    const t = parseVisit({ url: `${LP}?gbraid=GB1&wbraid=WB1&msclkid=MS1` });
    expect(t.gbraid).toBe("GB1");
    expect(t.wbraid).toBe("WB1");
    expect(t.msclkid).toBe("MS1");
  });

  it("carries the Meta cookies through when the request had them", () => {
    const t = parseVisit({ url: LP, fbc: "fb.1.1700000000000.X", fbp: "fb.1.1700000000000.123" });
    expect(t.fbc).toBe("fb.1.1700000000000.X");
    expect(t.fbp).toBe("fb.1.1700000000000.123");
  });

  it("survives a malformed URL as a direct visit", () => {
    const t = parseVisit({ url: "%%%" });
    expect(t.channel).toBe("direct");
    expect(t.gclid).toBeNull();
  });

  it("clips oversized values instead of failing the insert", () => {
    const t = parseVisit({ url: `${LP}?utm_campaign=${"x".repeat(500)}` });
    expect(t.utm_campaign?.length).toBe(200);
  });

  it("treats empty params as absent", () => {
    const t = parseVisit({ url: `${LP}?utm_source=&gclid=` });
    expect(t.utm_source).toBeNull();
    expect(t.gclid).toBeNull();
    expect(t.channel).toBe("direct");
  });
});

describe("shouldRecord — no row for a bare direct revisit", () => {
  it("always records a browser's first visit, even direct", () => {
    expect(shouldRecord({ channel: "direct" }, true)).toBe(true);
  });
  it("records any later visit that carries a source", () => {
    expect(shouldRecord({ channel: "organic_search" }, false)).toBe(true);
    expect(shouldRecord({ channel: "paid_social" }, false)).toBe(true);
  });
  it("skips a direct revisit — it cannot change any attribution answer", () => {
    expect(shouldRecord({ channel: "direct" }, false)).toBe(false);
  });
});

describe("first and latest touch are questions, not overwritten fields", () => {
  const history = [
    touch({ occurred_at: d("2026-09-10T12:00:00Z"), channel: "paid_social", source: "meta", fbclid: "F1" }),
    touch({ occurred_at: d("2026-09-01T12:00:00Z"), channel: "organic_search", source: "google" }),
    touch({ occurred_at: d("2026-09-20T12:00:00Z"), channel: "paid_search", source: "google", gclid: "G1" }),
    touch({ occurred_at: d("2026-09-25T12:00:00Z"), channel: "direct" }),
  ];

  it("first touch is the earliest, whatever order rows arrive in", () => {
    expect(firstTouch(history)?.channel).toBe("organic_search");
  });

  it("latest touch respects the conversion time", () => {
    expect(latestTouch(history)?.channel).toBe("direct");
    expect(latestTouch(history, d("2026-09-21T00:00:00Z"))?.channel).toBe("paid_search");
  });

  it("latest non-direct skips direct revisits", () => {
    expect(latestNonDirectTouch(history)?.channel).toBe("paid_search");
  });

  it("latest non-direct falls back to latest when every touch is direct", () => {
    const allDirect = [touch({ occurred_at: d("2026-09-01T00:00:00Z") })];
    expect(latestNonDirectTouch(allDirect)).toBe(allDirect[0]);
  });

  it("summarize ignores touches after the conversion and keeps the path in order", () => {
    const s = summarize(history, d("2026-09-21T00:00:00Z"));
    expect(s.touchCount).toBe(3);
    expect(s.first?.channel).toBe("organic_search");
    expect(s.latest?.channel).toBe("paid_search");
    expect(s.path).toEqual(["organic_search", "paid_social", "paid_search"]);
  });

  it("an empty history has answers of null, not errors", () => {
    expect(summarize([])).toEqual({ first: null, latest: null, latestNonDirect: null, touchCount: 0, path: [] });
  });
});

describe("pickGoogleClick", () => {
  const at = d("2026-10-01T12:00:00Z");

  it("takes the most recent Google click before the conversion", () => {
    const rows = [
      touch({ occurred_at: d("2026-09-01T00:00:00Z"), gclid: "OLD" }),
      touch({ occurred_at: d("2026-09-20T00:00:00Z"), gclid: "NEW" }),
      touch({ occurred_at: d("2026-10-02T00:00:00Z"), gclid: "AFTER" }),
    ];
    expect(pickGoogleClick(rows, at)?.value).toBe("NEW");
  });

  it("prefers gclid, then gbraid, then wbraid within one touch", () => {
    const rows = [touch({ occurred_at: d("2026-09-20T00:00:00Z"), gbraid: "B", wbraid: "W" })];
    expect(pickGoogleClick(rows, at)).toMatchObject({ type: "gbraid", value: "B" });
    rows[0].gclid = "G";
    expect(pickGoogleClick(rows, at)).toMatchObject({ type: "gclid", value: "G" });
  });

  it("ignores clicks older than Google's 90-day upload window", () => {
    const rows = [touch({ occurred_at: d("2026-06-01T00:00:00Z"), gclid: "STALE" })];
    expect(pickGoogleClick(rows, at)).toBeNull();
  });

  it("returns null when no touch carries a Google id", () => {
    expect(pickGoogleClick([touch({ occurred_at: d("2026-09-20T00:00:00Z"), fbclid: "F" })], at)).toBeNull();
  });
});

describe("pickMetaClick", () => {
  const at = d("2026-10-01T12:00:00Z");

  it("uses the pixel's _fbc cookie when we stored one", () => {
    const rows = [touch({ occurred_at: d("2026-09-20T00:00:00Z"), fbc: "fb.1.123.COOKIE", fbclid: "F" })];
    expect(pickMetaClick(rows, at).fbc).toBe("fb.1.123.COOKIE");
  });

  it("rebuilds fbc from fbclid with the click's own time", () => {
    const clickAt = d("2026-09-20T00:00:00Z");
    const rows = [touch({ occurred_at: clickAt, fbclid: "F1" })];
    expect(pickMetaClick(rows, at)).toEqual({ fbc: `fb.1.${clickAt.getTime()}.F1`, fbp: null, clickedAt: clickAt });
  });

  it("takes fbp from the latest touch that has it, independently of the click", () => {
    const rows = [
      touch({ occurred_at: d("2026-09-10T00:00:00Z"), fbp: "fb.1.1.OLD" }),
      touch({ occurred_at: d("2026-09-20T00:00:00Z"), fbp: "fb.1.1.NEW" }),
    ];
    expect(pickMetaClick(rows, at)).toEqual({ fbc: null, fbp: "fb.1.1.NEW", clickedAt: null });
  });
});

describe("phone identity", () => {
  it("normalises to the last ten digits", () => {
    expect(phoneLast10("+1 (269) 555-0142")).toBe("2695550142");
    expect(phoneLast10("269.555.0142")).toBe("2695550142");
    expect(phoneLast10("555-0142")).toBeNull();
  });

  it("hashes the same number the same way however it was typed", () => {
    expect(phoneHash("+12695550142")).toBe(phoneHash("(269) 555-0142"));
    expect(phoneHash("+12695550142")).toMatch(/^[0-9a-f]{64}$/);
    expect(phoneHash(null)).toBeNull();
  });
});

describe("callTouch", () => {
  const link = { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "fall-promo", utm_content: null, utm_term: null };

  it("a number on a campaign inherits that campaign's channel", () => {
    expect(callTouch(link)).toMatchObject({
      kind: "call", channel: "paid_social", source: "meta", utm_campaign: "fall-promo",
    });
  });

  it("a number on no campaign is a call, never direct", () => {
    expect(callTouch(null)).toMatchObject({ kind: "call", channel: "call", source: null, utm_source: null });
  });

  it("a campaign link with an unrecognised medium is still attributed to its source", () => {
    expect(callTouch({ ...link, utm_source: "yard-sign", utm_medium: "offline" }))
      .toMatchObject({ channel: "referral", source: "yard-sign" });
  });
});

