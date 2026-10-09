import { describe, expect, it } from "vitest";
import { buildTemplate } from "@/lib/funnel-graph";
import { findDownstream, findUpstream, publishOrder, trackingUrl } from "../order";
import { followUpDays, followUpSteps } from "../follow-up";
import { preflight, type PreflightFacts } from "../preflight";
import { runSummary, type PublishState } from "../types";

const graph = buildTemplate("lease");
const id = (type: string) => graph.nodes.find((n) => n.type === type)!.id;

describe("publish order", () => {
  const order = publishOrder(graph);
  const at = (type: string) => order.indexOf(id(type));

  it("writes the ad before the page that matches it, and makes the page before the ads that point at it", () => {
    expect(at("write")).toBeLessThan(at("page"));
    expect(at("page")).toBeLessThan(at("meta"));
    expect(at("page")).toBeLessThan(at("google"));
    expect(at("follow")).toBeLessThan(at("meta"));
    expect(at("report")).toBe(order.length - 1);
  });

  it("covers every function once", () => {
    expect(new Set(order).size).toBe(graph.nodes.length);
  });

  it("finds the ad above a channel and the page below it", () => {
    expect(findUpstream(graph, id("meta"), ["write", "proven"]).map((n) => n.type)).toContain("write");
    expect(findDownstream(graph, id("meta"), ["page"], 1).map((n) => n.type)).toEqual(["page"]);
  });
});

describe("tracking", () => {
  it("tags each channel's link with the campaign, in the mediums attribution classifies", () => {
    const meta = new URL(trackingUrl("https://storageads.com/lp/fall", "meta", "f-1", "n3"));
    expect(Object.fromEntries(meta.searchParams)).toEqual({
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "f-1",
      utm_content: "n3",
    });
    const google = new URL(trackingUrl("https://storageads.com/lp/fall", "google", "f-1", "n4"));
    expect(google.searchParams.get("utm_medium")).toBe("cpc");
    const gbp = new URL(trackingUrl("https://storageads.com/lp/fall", "gbp", "f-1", "n5"));
    expect(gbp.searchParams.get("utm_medium")).toBe("organic");
    expect(gbp.searchParams.get("utm_content")).toBe("gbp");
  });
});

describe("follow-up", () => {
  it("runs 3 steps over 7 days, or 5 over 14", () => {
    expect(followUpSteps("3")).toHaveLength(3);
    expect(followUpDays("3")).toBe(7);
    expect(followUpSteps("5")).toHaveLength(5);
    expect(followUpDays("5")).toBe(14);
  });

  it("never invents an offer, and only texts in daytime hours", () => {
    for (const s of followUpSteps("5")) {
      expect(s.body).not.toMatch(/% off|free month|half/i);
      if (s.channel === "sms") expect(s.send_window).toEqual({ start: "09:00", end: "20:00" });
    }
    expect(followUpSteps("3").map((s) => s.step_number)).toEqual([1, 2, 3]);
  });
});

describe("preflight", () => {
  const all: PreflightFacts = {
    address: true,
    meta: true,
    googleAds: true,
    gbp: true,
    storedge: true,
    googleAccess: true,
    texting: true,
  };

  it("is ready when everything is connected", () => {
    const p = preflight(graph, all);
    expect(Object.values(p).every((r) => r.state === "ready")).toBe(true);
  });

  it("asks for each missing connection with the place to fix it", () => {
    const p = preflight(graph, { ...all, meta: false, address: false });
    expect(p[id("meta")]).toMatchObject({ state: "needs", fix: { tool: "ad-publisher" } });
    expect(p[id("audience")]).toMatchObject({ state: "needs", fix: { tool: "settings" } });
  });

  it("says what waits on StorageAds rather than the owner", () => {
    const p = preflight(graph, { ...all, googleAccess: false, texting: false });
    expect(p[id("google")].state).toBe("waiting");
    expect(p[id("follow")].state).toBe("waiting");
  });
});

describe("runSummary", () => {
  it("counts live, paused and waiting as done, and needs and unknown as the owner's", () => {
    const state: PublishState = {
      runId: "r",
      status: "finished",
      startedAt: "",
      order: ["a", "b", "c", "d", "e"],
      nodes: {
        a: { state: "done", line: "", at: "" },
        b: { state: "paused", line: "", at: "" },
        c: { state: "needs", line: "", at: "" },
        d: { state: "unknown", line: "", at: "" },
        e: { state: "failed", line: "", at: "" },
      },
    };
    expect(runSummary(state)).toEqual({ done: 2, total: 5, attention: 2, failed: 1 });
  });
});
