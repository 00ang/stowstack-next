import { describe, expect, it } from "vitest";
import { libraryPatterns, median, type PatternRow } from "../patterns";

const now = new Date("2026-10-05T00:00:00.000Z");
const row = (startedDaysAgo: number, over: Partial<PatternRow> = {}): PatternRow => ({
  started_at: new Date(now.getTime() - startedDaysAgo * 86_400_000),
  last_seen_at: now,
  ended_at: null,
  active: true,
  source: "meta_ad_library_web",
  offer_type: "no_offer",
  unit_type: "general",
  angle: "price",
  format: "image",
  audience: "movers",
  advertiser_scale: "independent",
  family_size: 1,
  ...over,
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBe(0);
  });
});

describe("libraryPatterns", () => {
  it("counts only proven ads and ranks what they lead with", () => {
    const p = libraryPatterns(
      [
        row(400, { offer_type: "first_month_free" }),
        row(90, { offer_type: "first_month_free" }),
        row(70, { offer_type: "dollar_move_in", format: "video" }),
        row(30, { offer_type: "dollar_move_in" }), // not proven yet
        row(120, { format: "unknown" }),
      ],
      now
    );
    expect(p.total).toBe(4);
    expect(p.overYear).toBe(1);
    expect(p.longestDays).toBe(400);
    expect(p.offers[0]).toMatchObject({ key: "first_month_free", count: 2, share: 0.5 });
    expect(p.offers.find((t) => t.key === "dollar_move_in")?.count).toBe(1);
    expect(p.formats.find((t) => t.key === "unknown")).toBeUndefined();
  });

  it("is empty-safe", () => {
    const p = libraryPatterns([], now);
    expect(p.total).toBe(0);
    expect(p.offers).toEqual([]);
  });
});
