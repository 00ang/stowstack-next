import { describe, expect, it } from "vitest";
import { parseCityState } from "../facility-snapshot";

describe("parseCityState", () => {
  it("reads City, ST", () => {
    expect(parseCityState("Columbus, OH")).toEqual({ city: "Columbus", state: "OH" });
  });

  it("reads a spelled-out state", () => {
    expect(parseCityState("Austin, Texas")).toEqual({ city: "Austin", state: "TX" });
  });

  it("falls back to the whole string as city", () => {
    expect(parseCityState("Newark")).toEqual({ city: "Newark", state: null });
  });
});
