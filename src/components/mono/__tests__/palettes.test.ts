import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE_ID, PALETTES, normalizePaletteId } from "../index";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("PALETTES registry", () => {
  it("ships only cool light, black, and white", () => {
    expect(PALETTES.map((p) => p.id)).toEqual(["cool", "black", "white"]);
  });

  it("ships cool light as the default ground", () => {
    expect(DEFAULT_PALETTE_ID).toBe("cool");
    const cool = PALETTES.find((p) => p.id === "cool");
    expect(cool?.label).toBe("Cool");
    expect(cool?.swatches[0]).toBe("#E0E0E5");
    expect(cool?.swatches[2]).toBe("#C0BFCF");
    expect(PALETTES[0]?.id).toBe("cool");
  });

  it("keeps black as an observatory night and white as a pure white ground", () => {
    const black = PALETTES.find((p) => p.id === "black");
    const white = PALETTES.find((p) => p.id === "white");
    expect(black?.swatches[0]).toBe("#0E0E12");
    expect(black?.swatches[1]).toBe("#E0E0E5");
    expect(white?.swatches[0]).toBe("#FFFFFF");
  });

  it("drops cream, paper, and the retired color themes", () => {
    for (const id of ["paper", "oxblood", "petrol", "blueprint", "eames", "green", "amber", "bw"]) {
      expect(PALETTES.some((p) => (p.id as string) === id)).toBe(false);
    }
  });

  it("maps retired stored ids back onto the three themes", () => {
    expect(normalizePaletteId("paper")).toBe("cool");
    expect(normalizePaletteId("oxblood")).toBe("cool");
    expect(normalizePaletteId("bw")).toBe("white");
    expect(normalizePaletteId("dark")).toBe("black");
    expect(normalizePaletteId("black")).toBe("black");
    expect(normalizePaletteId(null)).toBe("cool");
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
