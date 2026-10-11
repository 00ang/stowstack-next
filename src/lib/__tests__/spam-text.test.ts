import { describe, expect, it } from "vitest";
import { leadTextIsAutomated, looksLikeRandomToken } from "@/lib/spam-text";

describe("looksLikeRandomToken", () => {
  it("flags the tokens from the spam audit request", () => {
    expect(looksLikeRandomToken("PpGLJz0lct")).toBe(true);
    expect(looksLikeRandomToken("JlDSdbF6Rp")).toBe(true);
    expect(looksLikeRandomToken("g8cDAvrmd4")).toBe(true);
  });

  it("leaves real names, brands, and places alone", () => {
    const real = [
      "Pat Owner",
      "Angelo",
      "Blake Burkett",
      "Krzysztof",
      "McDonald",
      "O'Brien",
      "Mary-Jane",
      "Sunset Storage",
      "Extra Space Storage",
      "U-Haul",
      "StorQuest",
      "CubeSmart",
      "iStorage",
      "A-1 Self Storage",
      "SelfStorage",
      "StoreIt247",
      "Austin, TX",
      "Kalamazoo, MI",
      "Dallas",
      "St. Louis",
      "123 Main St",
      "78701",
    ];
    for (const value of real) {
      expect(looksLikeRandomToken(value), value).toBe(false);
    }
  });
});

describe("leadTextIsAutomated", () => {
  it("matches the spam audit request that still got through", () => {
    expect(
      leadTextIsAutomated({
        name: "PpGLJz0lct",
        facilityName: "JlDSdbF6Rp",
        location: "g8cDAvrmd4",
      })
    ).toBe(true);
  });

  it("keeps a normal audit request", () => {
    expect(
      leadTextIsAutomated({
        name: "Pat Owner",
        facilityName: "Sunset Storage",
        location: "Austin, TX",
      })
    ).toBe(false);
  });

  it("keeps a one-word brand and a single given name", () => {
    expect(
      leadTextIsAutomated({
        name: "Krzysztof",
        facilityName: "StorQuest",
        location: "Kalamazoo, MI",
      })
    ).toBe(false);
  });
});
