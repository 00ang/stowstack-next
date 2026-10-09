import { describe, it, expect } from "vitest";
import {
  deriveMarketingRoi,
  buildMarketingRoiCsvRows,
  MARKETING_ROI_DEFAULTS,
  DEFAULT_COST_PER_MOVE_IN,
  type MarketingRoiState,
} from "../tools/marketing-roi";

function state(overrides: Partial<MarketingRoiState> = {}): MarketingRoiState {
  return { ...MARKETING_ROI_DEFAULTS, ...overrides };
}

describe("deriveMarketingRoi", () => {
  it("estimates move-ins from budget and cost per move-in", () => {
    const d = deriveMarketingRoi(
      state({ monthlyBudget: 1420, costPerMoveIn: 14.2 }),
    );
    expect(d.estMoveIns).toBe(100);
  });

  it("computes additional monthly and annual revenue", () => {
    const d = deriveMarketingRoi(
      state({ monthlyBudget: 1420, costPerMoveIn: 14.2, avgRate: 100 }),
    );
    expect(d.additionalMonthlyRevenue).toBe(10_000); // 100 move-ins * $100
    expect(d.additionalAnnualRevenue).toBe(120_000);
  });

  it("computes ROAS as revenue over budget", () => {
    const d = deriveMarketingRoi(
      state({ monthlyBudget: 1000, costPerMoveIn: 10, avgRate: 100 }),
    );
    // 100 move-ins * $100 = $10,000 / $1,000 budget = 10x
    expect(d.roas).toBe(10);
  });

  it("derives vacant units from occupancy", () => {
    const d = deriveMarketingRoi(state({ totalUnits: 200, occupancyPct: 80 }));
    expect(d.vacantUnits).toBe(40);
  });

  it("computes months to fill at the current pace", () => {
    const d = deriveMarketingRoi(
      state({
        totalUnits: 200,
        occupancyPct: 80, // 40 vacant
        monthlyBudget: 142,
        costPerMoveIn: 14.2, // 10 move-ins/mo
      }),
    );
    expect(d.monthsToFill).toBeCloseTo(4, 5);
  });

  it("starts from a sample cost per move-in the operator replaces", () => {
    expect(MARKETING_ROI_DEFAULTS.costPerMoveIn).toBe(DEFAULT_COST_PER_MOVE_IN);
  });

  it("guards against divide-by-zero on cost per move-in", () => {
    const d = deriveMarketingRoi(state({ costPerMoveIn: 0, monthlyBudget: 1000 }));
    expect(d.estMoveIns).toBe(0);
    expect(d.additionalMonthlyRevenue).toBe(0);
    expect(d.roas).toBe(0);
    expect(d.monthsToFill).toBe(0);
  });

  it("clamps occupancy to [0, 100]", () => {
    const over = deriveMarketingRoi(state({ totalUnits: 100, occupancyPct: 150 }));
    expect(over.vacantUnits).toBe(0);
    const under = deriveMarketingRoi(state({ totalUnits: 100, occupancyPct: -20 }));
    expect(under.vacantUnits).toBe(100);
  });

  it("coerces non-finite / negative inputs to zero", () => {
    const d = deriveMarketingRoi(
      state({
        monthlyBudget: Number.NaN,
        avgRate: -50,
        totalUnits: -10,
      }),
    );
    expect(d.estMoveIns).toBe(0);
    expect(d.additionalMonthlyRevenue).toBe(0);
    expect(d.vacantUnits).toBe(0);
  });
});

describe("buildMarketingRoiCsvRows", () => {
  it("returns a header row plus the key metrics", () => {
    const s = state({ monthlyBudget: 1420, costPerMoveIn: 14.2, avgRate: 100 });
    const rows = buildMarketingRoiCsvRows(s, deriveMarketingRoi(s));
    expect(rows[0]).toEqual(["Metric", "Value"]);
    const flat = rows.map((r) => r[0]);
    expect(flat).toContain("Estimated move-ins / month");
    expect(flat).toContain("Return on ad spend");
    expect(flat).toContain("Additional annual revenue");
  });
});
