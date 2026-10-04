import { describe, expect, it } from "vitest";
import { buildJourney, reportDetail, reportTitle, touchDetail, touchTitle } from "@/lib/attribution/journey";
import type { TouchRecord } from "@/lib/attribution/touch";

const d = (iso: string) => new Date(iso);
const touch = (o: Partial<TouchRecord> & { occurred_at: Date }): TouchRecord => ({
  kind: "visit", channel: "direct", source: null, url: null, referrer: null,
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
  gclid: null, gbraid: null, wbraid: null, fbclid: null, fbc: null, fbp: null, ttclid: null, msclkid: null,
  ...o,
});

describe("touch wording", () => {
  it("names channel and source", () => {
    expect(touchTitle({ kind: "visit", channel: "paid_search", source: "google" })).toBe("Paid search · Google");
    expect(touchTitle({ kind: "visit", channel: "direct", source: null })).toBe("Direct");
  });

  it("marks a call that came through a campaign number", () => {
    expect(touchTitle({ kind: "call", channel: "paid_social", source: "meta" })).toBe("Call · Paid social · Meta");
    expect(touchTitle({ kind: "call", channel: "call", source: null })).toBe("Call");
  });

  it("shows campaign, click ids and landing path", () => {
    const t = touch({
      occurred_at: d("2026-09-01T00:00:00Z"), utm_campaign: "fall", gclid: "G", gbraid: "B",
      url: "https://storageads.com/lp/midtown?gclid=G",
    });
    expect(touchDetail(t)).toBe("campaign fall · gclid, gbraid · /lp/midtown");
  });
});

describe("report wording", () => {
  it("says what happened and why, in operator words", () => {
    const base = { detail: null, conversion_at: null, created_at: d("2026-10-02T00:00:00Z") };
    expect(reportTitle({ platform: "google", status: "skipped" })).toBe("Not reported to Google Ads");
    expect(reportDetail({ ...base, platform: "google", status: "skipped", reason: "no_conversion_action", click_id_type: "gclid", value: 129 }))
      .toBe("no move-in conversion action set on the Google Ads connection · $129.00 · matched on gclid");
    expect(reportTitle({ platform: "meta", status: "sent" })).toBe("Reported to Meta");
  });
});

describe("buildJourney", () => {
  const input = {
    lead: { created_at: d("2026-09-10T15:00:00Z"), converted_at: d("2026-09-10T15:05:00Z") },
    touches: [
      touch({ occurred_at: d("2026-09-10T15:00:00Z"), channel: "paid_search", source: "google", gclid: "G" }),
      touch({ occurred_at: d("2026-09-01T09:00:00Z"), channel: "organic_search", source: "google" }),
    ],
    statusEvents: [
      { from_status: "new", to_status: "moved_in", changed_at: d("2026-09-20T00:00:00Z"), source: "pms_import" },
      { from_status: "partial", to_status: "new", changed_at: d("2026-09-10T15:05:00Z"), source: "form" },
    ],
    tenant: { unit_number: "B12", unit_size: "10x10", monthly_rate: 129, move_in_date: d("2026-09-18T00:00:00Z") },
    reports: [{
      platform: "meta", status: "sent", reason: null, detail: null, click_id_type: "none",
      value: 129, conversion_at: d("2026-09-18T17:00:00Z"), created_at: d("2026-09-20T00:01:00Z"),
    }],
  };

  it("puts everything in time order, cause before effect on ties", () => {
    const j = buildJourney(input);
    expect(j.map((i) => i.kind)).toEqual(["touch", "touch", "lead", "status", "move_in", "report"]);
    expect(j[0].title).toBe("Organic search · Google");
  });

  it("does not repeat the move-in as a bare status when the tenant row says more", () => {
    const j = buildJourney(input);
    expect(j.filter((i) => i.kind === "status").map((i) => i.title)).toEqual(["Status: new"]);
    expect(j.find((i) => i.kind === "move_in")).toMatchObject({ title: "Moved in — unit B12", detail: "10x10 · $129.00/mo" });
  });

  it("keeps the moved_in status when there is no matched tenant to show instead", () => {
    const j = buildJourney({ ...input, tenant: null });
    expect(j.some((i) => i.kind === "status" && i.title === "Status: moved in")).toBe(true);
  });

  it("an untracked lead still has a journey — the submission itself", () => {
    const j = buildJourney({ ...input, touches: [], statusEvents: [], tenant: null, reports: [] });
    expect(j).toEqual([{ kind: "lead", at: "2026-09-10T15:05:00.000Z", title: "Submitted their details", detail: "" }]);
  });
});
