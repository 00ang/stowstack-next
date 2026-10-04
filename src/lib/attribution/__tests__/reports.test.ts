import { describe, expect, it } from "vitest";
import { groupForAttention, groupTitle, needsAttention, type ReportLike } from "@/lib/attribution/reports";
import { conversionReportsToAttention } from "@/lib/console";

const row = (o: Partial<ReportLike> & { id: string }): ReportLike => ({
  platform: "google", status: "skipped", reason: "no_conversion_action",
  facility_id: "f1", facility_name: "Midtown Storage", updated_at: "2026-10-01T00:00:00.000Z", ...o,
});

describe("needsAttention", () => {
  it("failures always need a person", () => {
    expect(needsAttention({ status: "failed", reason: "rejected" })).toBe(true);
    expect(needsAttention({ status: "failed", reason: "token_unavailable" })).toBe(true);
  });
  it("only fixable skips do — a move-in with no Google click is not work", () => {
    expect(needsAttention({ status: "skipped", reason: "no_conversion_action" })).toBe(true);
    expect(needsAttention({ status: "skipped", reason: "not_configured" })).toBe(true);
    expect(needsAttention({ status: "skipped", reason: "no_click_id" })).toBe(false);
    expect(needsAttention({ status: "skipped", reason: "too_old" })).toBe(false);
    expect(needsAttention({ status: "sent", reason: null })).toBe(false);
  });
});

describe("groupForAttention", () => {
  it("groups by the one fix that clears them, failures first", () => {
    const groups = groupForAttention([
      row({ id: "a" }),
      row({ id: "b", updated_at: "2026-10-03T00:00:00.000Z" }),
      row({ id: "c", platform: "meta", status: "failed", reason: "rejected" }),
      row({ id: "d", reason: "no_click_id" }),
      row({ id: "e", facility_id: "f2", facility_name: "Northside" }),
    ]);
    expect(groups.map((g) => [g.platform, g.status, g.facilityName, g.count])).toEqual([
      ["meta", "failed", "Midtown Storage", 1],
      ["google", "skipped", "Midtown Storage", 2],
      ["google", "skipped", "Northside", 1],
    ]);
    expect(groups[1].reportIds).toEqual(["a", "b"]);
    expect(groups[1].latest).toBe("2026-10-03T00:00:00.000Z");
    expect(groups[1].cause).toBe("no move-in conversion action set on the Google Ads connection");
  });

  it("titles read like a to-do", () => {
    expect(groupTitle({ count: 3, platform: "google", status: "skipped" })).toBe("3 move-ins not reported to Google Ads");
    expect(groupTitle({ count: 1, platform: "meta", status: "failed" })).toBe("1 move-in failed to report to Meta");
  });
});

describe("conversionReportsToAttention", () => {
  const resp = { counts: {}, reports: [row({ id: "a" }), row({ id: "b", facility_id: "f2", facility_name: "Northside" })] };

  it("becomes console attention items pointing at the reports page", () => {
    const items = conversionReportsToAttention(resp);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ source: "reporting", severity: "warning", href: "/admin/conversions", actionLabel: "Fix" });
  });

  it("scopes to one facility on the facility console", () => {
    expect(conversionReportsToAttention(resp, { facilityName: "northside" }).map((i) => i.facilityName)).toEqual(["Northside"]);
  });

  it("is empty when the endpoint has not answered", () => {
    expect(conversionReportsToAttention(null)).toEqual([]);
  });
});
