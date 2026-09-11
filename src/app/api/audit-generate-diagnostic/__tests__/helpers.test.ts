import { describe, it, expect } from "vitest";
import {
  letterGrade,
  generateSlug,
  parseCSVLine,
  OCCUPANCY_MAP,
  UNIT_COUNT_MAP,
} from "../route";

/**
 * Pure helpers from the live diagnostic engine. These drive scoring, the
 * shareable slug, and the bulk CSV-intake path — all previously untested.
 */

describe("letterGrade", () => {
  it("maps scores to A-F on the documented boundaries", () => {
    expect(letterGrade(100)).toBe("A");
    expect(letterGrade(90)).toBe("A");
    expect(letterGrade(89)).toBe("B");
    expect(letterGrade(80)).toBe("B");
    expect(letterGrade(79)).toBe("C");
    expect(letterGrade(70)).toBe("C");
    expect(letterGrade(69)).toBe("D");
    expect(letterGrade(60)).toBe("D");
    expect(letterGrade(59)).toBe("F");
    expect(letterGrade(0)).toBe("F");
  });
});

describe("OCCUPANCY_MAP / UNIT_COUNT_MAP", () => {
  it("maps occupancy bands to representative midpoints", () => {
    expect(OCCUPANCY_MAP["Under 50%"]).toBe(45);
    expect(OCCUPANCY_MAP["95%+"]).toBe(97);
    // bands are monotonically increasing
    const vals = Object.values(OCCUPANCY_MAP);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });

  it("maps unit-count bands to representative counts", () => {
    expect(UNIT_COUNT_MAP["Under 100"]).toBe(75);
    expect(UNIT_COUNT_MAP["1,000+"]).toBe(1100);
    const vals = Object.values(UNIT_COUNT_MAP);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});

describe("generateSlug", () => {
  it("slugifies, lowercases, and appends a short random suffix", () => {
    expect(generateSlug("Northline Self-Storage!")).toMatch(
      /^northline-self-storage-[a-z0-9]+$/,
    );
  });

  it("strips leading/trailing separators", () => {
    const slug = generateSlug("  --Northline--  ");
    expect(slug.startsWith("-")).toBe(false);
    expect(slug).toMatch(/^northline-[a-z0-9]+$/);
  });

  it("falls back to 'facility' for empty input", () => {
    expect(generateSlug("")).toMatch(/^facility-[a-z0-9]+$/);
  });

  it("caps the slug base at 40 chars before the suffix", () => {
    const long = "a".repeat(100);
    const base = generateSlug(long).replace(/-[a-z0-9]+$/, "");
    expect(base.length).toBeLessThanOrEqual(40);
  });

  it("produces distinct slugs for the same name (random suffix)", () => {
    expect(generateSlug("Same Name")).not.toBe(generateSlug("Same Name"));
  });
});

describe("parseCSVLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(parseCSVLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("preserves commas inside quoted fields", () => {
    expect(parseCSVLine('name,"Smith, Jane",city')).toEqual([
      "name",
      "Smith, Jane",
      "city",
    ]);
  });

  it("unescapes doubled quotes within a quoted field", () => {
    expect(parseCSVLine('a,"she said ""hi""",b')).toEqual([
      "a",
      'she said "hi"',
      "b",
    ]);
  });

  it("keeps trailing and leading empty fields", () => {
    expect(parseCSVLine("a,,c")).toEqual(["a", "", "c"]);
    expect(parseCSVLine(",a")).toEqual(["", "a"]);
    expect(parseCSVLine("a,")).toEqual(["a", ""]);
  });

  it("returns a single field when there are no commas", () => {
    expect(parseCSVLine("solo")).toEqual(["solo"]);
  });
});
