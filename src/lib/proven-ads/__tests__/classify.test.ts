import { describe, expect, it } from "vitest";
import { classify, classifyAngle, classifyFormat, classifyOffer, classifyUnit } from "../classify";

describe("classifyOffer", () => {
  it("detects first month free", () => {
    expect(classifyOffer({ headline: "First month free at Oak Storage" })).toBe("first_month_free");
    expect(classifyOffer({ primary_text: "Get 1st month free when you reserve" })).toBe("first_month_free");
  });

  it("detects $1 move-in", () => {
    expect(classifyOffer({ headline: "$1 move-in special" })).toBe("dollar_move_in");
    expect(classifyOffer({ primary_text: "$1.00 gets you in this week" })).toBe("dollar_move_in");
  });

  it("detects percent off and free truck", () => {
    expect(classifyOffer({ headline: "50% off your first three months" })).toBe("percent_off");
    expect(classifyOffer({ primary_text: "Free moving truck with any unit" })).toBe("free_truck");
  });

  it("returns no_offer when the copy is just a rate", () => {
    expect(classifyOffer({ headline: "Climate units downtown" })).toBe("no_offer");
  });
});

describe("classifyUnit", () => {
  it("reads climate, drive-up, vehicle, business", () => {
    expect(classifyUnit({ primary_text: "Climate-controlled units from $49" })).toBe("climate_controlled");
    expect(classifyUnit({ headline: "Drive-up units, no stairs" })).toBe("drive_up");
    expect(classifyUnit({ headline: "RV and boat storage open" })).toBe("vehicle");
    expect(classifyUnit({ primary_text: "Commercial warehouse space for inventory" })).toBe("business");
  });

  it("defaults to general", () => {
    expect(classifyUnit({ headline: "Storage near you" })).toBe("general");
  });
});

describe("classifyAngle", () => {
  it("picks social proof, convenience, urgency, lifestyle, price", () => {
    expect(classifyAngle({ primary_text: "4.8 stars from 200 reviews" })).toBe("social_proof");
    expect(classifyAngle({ primary_text: "5 minutes from you. No lease." })).toBe("convenience");
    expect(classifyAngle({ headline: "Only 3 units left this week" })).toBe("urgency");
    expect(classifyAngle({ primary_text: "Reclaim your garage. Room to breathe." })).toBe("lifestyle");
    expect(classifyAngle({ headline: "Units from $39/mo" })).toBe("price");
  });
});

describe("classifyFormat", () => {
  it("returns carousel when the source sent multiple bodies", () => {
    expect(classifyFormat({ headline: "A" }, 3)).toBe("carousel");
  });

  it("keeps an explicit format", () => {
    expect(classifyFormat({ format: "video", headline: "Watch this" }, 1)).toBe("video");
  });
});

describe("classify", () => {
  it("fills all four fields together", () => {
    const out = classify({
      headline: "First month free",
      primary_text: "Climate-controlled units, 4.9 stars from neighbors",
    });
    expect(out.offer_type).toBe("first_month_free");
    expect(out.unit_type).toBe("climate_controlled");
    expect(out.angle).toBe("social_proof");
  });
});
