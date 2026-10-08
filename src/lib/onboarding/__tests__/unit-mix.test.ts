import { describe, expect, it } from "vitest";
import { buildOntology } from "@/lib/ontology/build";
import { fixture, NOW } from "@/lib/ontology/__tests__/fixture";
import { typedUnitsToPms } from "@/lib/onboarding/unit-mix";

describe("typedUnitsToPms", () => {
  it("turns typed sizes into unit-mix rows and clears the upload move", () => {
    const rows = typedUnitsToPms([
      { type: "Drive-up", size: "10x10", monthlyRate: 119, availableCount: 4 },
      { type: "", size: "", monthlyRate: 0, availableCount: 0 },
      { type: "Parking", size: "Parking", monthlyRate: 89, availableCount: 2 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      unit_type: "10x10",
      width_ft: 10,
      depth_ft: 10,
      sqft: 100,
      total_count: 4,
      occupied_count: 0,
      street_rate: 119,
    });

    const raw = fixture();
    raw.units = rows.map((row, i) => ({
      id: `typed-${i}`,
      unitType: row.unit_type,
      sizeLabel: row.size_label,
      widthFt: row.width_ft,
      depthFt: row.depth_ft,
      total: row.total_count,
      occupied: row.occupied_count,
      streetRate: row.street_rate,
      webRate: row.web_rate,
      features: [],
      lastUpdated: NOW.toISOString(),
    }));
    const ontology = buildOntology(raw, NOW);
    expect(ontology.moves.some((m) => m.rule === "foundation")).toBe(false);
  });

  it("leaves the upload move in place when nothing was typed", () => {
    const raw = fixture();
    raw.units = [];
    expect(buildOntology(raw, NOW).moves.some((m) => m.rule === "foundation")).toBe(true);
    expect(typedUnitsToPms([{ type: "  ", size: "" }])).toEqual([]);
  });
});
