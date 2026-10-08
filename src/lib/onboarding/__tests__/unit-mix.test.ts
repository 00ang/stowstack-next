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

  it("counts the empty share of a total when the total is given", () => {
    const [row] = typedUnitsToPms([{ type: "10x10", size: "10x10", monthlyRate: 119, totalCount: 80, availableCount: 18 }]);
    expect(row).toMatchObject({ unit_type: "10x10", total_count: 80, occupied_count: 62 });
  });

  it("never counts more empty than there are", () => {
    const [row] = typedUnitsToPms([{ size: "5x5", totalCount: 10, availableCount: 14 }]);
    expect(row).toMatchObject({ total_count: 14, occupied_count: 0 });
  });

  it("keeps climate in the name when the type carries the size", () => {
    const rows = typedUnitsToPms([
      { type: "10x10", size: "10x10", totalCount: 80, availableCount: 18 },
      { type: "10x10 Climate", size: "10x10", totalCount: 40, availableCount: 12 },
    ]);
    expect(rows.map((r) => r.unit_type)).toEqual(["10x10", "10x10 Climate"]);
    expect(rows[1]).toMatchObject({ width_ft: 10, depth_ft: 10, total_count: 40, occupied_count: 28 });
  });

  it("leaves the upload move in place when nothing was typed", () => {
    const raw = fixture();
    raw.units = [];
    expect(buildOntology(raw, NOW).moves.some((m) => m.rule === "foundation")).toBe(true);
    expect(typedUnitsToPms([{ type: "  ", size: "" }])).toEqual([]);
  });
});
