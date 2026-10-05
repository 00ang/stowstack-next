import { describe, expect, it } from "vitest";
import { draftFromManual, parseCsv, splitCsvLine } from "../adapters/manual";

describe("splitCsvLine", () => {
  it("honours quoted commas", () => {
    expect(splitCsvLine('Oak Storage,"First month free, no lease",2026-01-01')).toEqual([
      "Oak Storage",
      "First month free, no lease",
      "2026-01-01",
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(splitCsvLine('"He said ""go"""')).toEqual(['He said "go"']);
  });
});

describe("draftFromManual", () => {
  it("requires advertiser and start date", () => {
    expect(draftFromManual({})).toEqual({ error: "advertiser_name is required" });
    expect(draftFromManual({ advertiser_name: "Oak" })).toEqual({
      error: "started_at is required (YYYY-MM-DD)",
    });
  });

  it("classifies copy when the admin leaves offer/unit blank", () => {
    const r = draftFromManual({
      advertiser_name: "Oak Storage",
      started_at: "2026-01-15",
      headline: "First month free",
      primary_text: "Climate-controlled units near downtown",
      city: "Austin",
      state: "tx",
      platform: "meta",
    });
    expect("draft" in r).toBe(true);
    if (!("draft" in r)) return;
    expect(r.draft.offer_type).toBe("first_month_free");
    expect(r.draft.unit_type).toBe("climate_controlled");
    expect(r.draft.state).toBe("TX");
    expect(r.draft.source).toBe("manual");
    expect(r.draft.active).toBe(true);
  });

  it("honours an explicit ended flag", () => {
    const r = draftFromManual({
      advertiser_name: "Oak",
      started_at: "2026-01-01",
      active: "false",
    });
    if (!("draft" in r)) throw new Error("expected draft");
    expect(r.draft.active).toBe(false);
  });
});

describe("parseCsv", () => {
  it("reads a header + rows and reports bad lines", () => {
    const csv = [
      "advertiser_name,started_at,headline,primary_text,platform",
      "Oak Storage,2026-01-01,First month free,Climate units downtown,meta",
      ",,",
      "Missing Start,,A headline,Body,meta",
    ].join("\n");
    const { drafts, errors } = parseCsv(csv);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].advertiser_name).toBe("Oak Storage");
    expect(drafts[0].source).toBe("csv_import");
    expect(errors.some((e) => e.includes("started_at"))).toBe(true);
  });

  it("rejects a file with only a header", () => {
    expect(parseCsv("advertiser_name,started_at\n").errors[0]).toMatch(/header row/);
  });
});
