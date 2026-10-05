import { describe, expect, it } from "vitest";
import { PALETTES } from "../index";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("PALETTES registry", () => {
  it("registers the black & white palette so it is selectable in the live TweaksPanel", () => {
    const bw = PALETTES.find((p) => p.id === "bw");
    expect(bw).toBeDefined();
    expect(bw?.label).toBe("Black & White");
    // High-contrast monochrome: white ground, black ink.
    expect(bw?.swatches[0]).toBe("#ffffff");
    expect(bw?.swatches[1]).toBe("#000000");
  });

  it("keeps the original palettes intact (no regression)", () => {
    for (const id of [
      "paper",
      "oxblood",
      "petrol",
      "blueprint",
      "eames",
      "green",
    ]) {
      expect(PALETTES.some((p) => p.id === id)).toBe(true);
    }
  });

  it("drops the all-amber Amber Phosphor palette (gold is banned)", () => {
    expect(PALETTES.some((p) => (p.id as string) === "amber")).toBe(false);
  });

  it("has unique ids and exactly three valid hex swatches per palette", () => {
    const ids = PALETTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PALETTES) {
      expect(p.swatches).toHaveLength(3);
      for (const c of p.swatches) expect(c).toMatch(HEX);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.sub.length).toBeGreaterThan(0);
    }
  });
});
