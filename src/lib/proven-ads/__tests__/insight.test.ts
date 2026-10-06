import { describe, expect, it } from "vitest";
import {
  INSIGHT_SYSTEM_PROMPT,
  buildInsightText,
  clamp,
  insightRequestParams,
  parseInsightOutput,
  tidy,
} from "../insight";

const good = {
  relevance: "renter",
  study_value: 3,
  summary: "A $1 first month on climate units, sold with one clean photo — and the price on it!",
  why: "It answers the only question a mover has: what does it cost to get in. One price, one unit, one button.",
  hook: "The price is the picture.",
  creative: "Daylight shot of a climate hallway, doors closed, price block lower left.",
  beats: [
    { label: "Hook", text: "Price first." },
    { label: "Proof", text: "Climate units shown." },
    { label: "", text: "dropped" },
  ],
  run_it: ["Shoot your cleanest hallway.", "Put your real move-in price on it.", "Send it to the rental page.", "extra"],
  needs: ["A real move-in special", "Online rentals"],
  best_for: ["Lease-up"],
  watch_out: "",
  offer_type: "dollar_move_in",
  unit_type: "climate_controlled",
  angle: "price",
  format: "image",
  audience: "movers",
  advertiser_scale: "independent",
  city: "Buckeye",
  state: "az",
  country: "us",
};

describe("tidy / clamp", () => {
  it("replaces dashes and exclamation marks", () => {
    expect(tidy("One price — one unit!")).toBe("One price, one unit.");
  });
  it("cuts on a word boundary", () => {
    const out = clamp("one two three four five six seven", 18);
    expect(out.length).toBeLessThanOrEqual(19);
    expect(out).toBe("one two three four.");
  });
});

describe("parseInsightOutput", () => {
  it("keeps a renter ad's read, tidied and trimmed to shape", () => {
    const r = parseInsightOutput(good);
    expect(r?.insight.relevance).toBe("renter");
    expect(r?.insight.summary).not.toMatch(/[—!]/);
    expect(r?.insight.beats).toHaveLength(2);
    expect(r?.insight.run_it).toHaveLength(3);
    expect(r?.facts.state).toBe("AZ");
    expect(r?.facts.country).toBe("US");
    expect(r?.facts.offer_type).toBe("dollar_move_in");
  });

  it("keeps facts but no prose for anything that isn't for renters", () => {
    const r = parseInsightOutput({ ...good, relevance: "investor" });
    expect(r?.insight.relevance).toBe("investor");
    expect(r?.insight.summary).toBe("");
    expect(r?.insight.run_it).toEqual([]);
  });

  it("rejects a renter read with no reasoning", () => {
    expect(parseInsightOutput({ ...good, why: "  " })).toBeNull();
  });

  it("rejects an off-schema payload", () => {
    expect(parseInsightOutput({ ...good, offer_type: "bogo" })).toBeNull();
    expect(parseInsightOutput("nope")).toBeNull();
  });

  it("drops a state that isn't a two-letter code", () => {
    expect(parseInsightOutput({ ...good, state: "Arizona" })?.facts.state).toBeNull();
  });
});

describe("request", () => {
  const subject = {
    advertiser_name: "Verrado Storage",
    started_at: "2026-06-22",
    days_running: 105,
    family_size: 2,
    format: "image",
    headline: "See inside",
    primary_text: "First full month just $1.",
    landing_url: "https://www.example.com/units?utm=1",
  };

  it("states the evidence and never sends the query string", () => {
    const text = buildInsightText(subject, 1);
    expect(text).toMatch(/105 days/);
    expect(text).toMatch(/2 ads use this creative/);
    expect(text).toMatch(/example\.com\/units/);
    expect(text).not.toMatch(/utm/);
  });

  it("puts images before the text and caps them at three", () => {
    const p = insightRequestParams(subject, ["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg", "https://a/4.jpg"]);
    const content = p.messages[0].content as { type: string }[];
    expect(content.filter((b) => b.type === "image")).toHaveLength(3);
    expect(content[content.length - 1].type).toBe("text");
    expect(p.output_config?.format?.type).toBe("json_schema");
  });

  it("holds the house rules in the prompt", () => {
    expect(INSIGHT_SYSTEM_PROMPT).toMatch(/Do not copy the ad/);
    expect(INSIGHT_SYSTEM_PROMPT).toMatch(/Never claim performance numbers/);
    expect(INSIGHT_SYSTEM_PROMPT).toMatch(/No em dashes/);
  });
});
