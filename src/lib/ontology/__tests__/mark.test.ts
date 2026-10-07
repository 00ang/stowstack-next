import { describe, expect, it } from "vitest";
import { GLYPH_PATHS, MARK_GLYPHS, fnv1a, markFor } from "@/lib/ontology/mark";

describe("markFor", () => {
  it("gives the same address the same mark, every time", () => {
    expect(markFor("units/10x10-climate")).toEqual(markFor("units/10x10-climate"));
    expect(fnv1a("units/10x10-climate")).toBe(fnv1a("units/10x10-climate"));
  });

  it("tells siblings apart", () => {
    const marks = new Set<string>();
    for (let i = 0; i < 500; i++) marks.add(JSON.stringify(markFor(`leads/lead-${i.toString(16).padStart(6, "0")}`)));
    expect(marks.size).toBeGreaterThan(495);
  });

  it("never leaves more than one cell open", () => {
    for (let i = 0; i < 2000; i++) {
      const open = markFor(`ads/meta-${i}`).filter((c) => c.glyph === "open").length;
      expect(open).toBeLessThanOrEqual(1);
    }
  });

  it("draws every glyph but the open cell", () => {
    for (const g of MARK_GLYPHS) expect(GLYPH_PATHS[g].length > 0).toBe(g !== "open");
  });
});
