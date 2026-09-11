/**
 * Marketing ROI for self-storage — pure logic, no React.
 *
 * Plug in facility size, occupancy, average rate, monthly ad budget, and your
 * cost per move-in; get the move-ins that budget buys, the incremental monthly
 * and annual revenue, and the return on ad spend.
 *
 * Conservative by design: "additional revenue" counts only the first month of
 * rent from one month's move-ins. Real return is higher — tenants stay for
 * months, absorb rate increases, and add insurance and fee income — but the
 * floor keeps the projection honest.
 */

import { nonNeg } from "./format";
import { usd0, usd2 } from "./format";
import type { CsvRow } from "./csv";

export interface MarketingRoiState {
  totalUnits: number;
  occupancyPct: number;
  avgRate: number; // monthly
  monthlyBudget: number;
  costPerMoveIn: number;
}

/** Default cost per move-in, from the platform average. */
export const DEFAULT_COST_PER_MOVE_IN = 14.2;

export const MARKETING_ROI_DEFAULTS: MarketingRoiState = {
  totalUnits: 150,
  occupancyPct: 78,
  avgRate: 95,
  monthlyBudget: 1500,
  costPerMoveIn: DEFAULT_COST_PER_MOVE_IN,
};

export interface MarketingRoiResult {
  vacantUnits: number;
  estMoveIns: number;
  additionalMonthlyRevenue: number;
  additionalAnnualRevenue: number;
  roas: number;
  monthsToFill: number;
}

function clampOccupancy(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function deriveMarketingRoi(s: MarketingRoiState): MarketingRoiResult {
  const totalUnits = Math.round(nonNeg(s.totalUnits));
  const occupancyPct = clampOccupancy(s.occupancyPct);
  const avgRate = nonNeg(s.avgRate);
  const monthlyBudget = nonNeg(s.monthlyBudget);
  const costPerMoveIn = nonNeg(s.costPerMoveIn);

  const vacantUnits = Math.max(0, Math.round(totalUnits * (1 - occupancyPct / 100)));
  const estMoveIns = costPerMoveIn > 0 ? Math.round(monthlyBudget / costPerMoveIn) : 0;
  const additionalMonthlyRevenue = estMoveIns * avgRate;
  const additionalAnnualRevenue = additionalMonthlyRevenue * 12;
  const roas = monthlyBudget > 0 ? additionalMonthlyRevenue / monthlyBudget : 0;
  const monthsToFill = estMoveIns > 0 ? vacantUnits / estMoveIns : 0;

  return {
    vacantUnits,
    estMoveIns,
    additionalMonthlyRevenue,
    additionalAnnualRevenue,
    roas,
    monthsToFill,
  };
}

/** Rows for the CSV export. Pure (no DOM) so it can be unit-tested. */
export function buildMarketingRoiCsvRows(
  s: MarketingRoiState,
  d: MarketingRoiResult,
): CsvRow[] {
  return [
    ["Metric", "Value"],
    ["Total units", String(Math.round(nonNeg(s.totalUnits)))],
    ["Current occupancy", `${clampOccupancy(s.occupancyPct).toFixed(0)}%`],
    ["Vacant units", String(d.vacantUnits)],
    ["Average monthly rate", usd0(s.avgRate)],
    ["Monthly ad budget", usd0(s.monthlyBudget)],
    ["Cost per move-in", usd2(s.costPerMoveIn)],
    ["Estimated move-ins / month", String(d.estMoveIns)],
    ["Additional monthly revenue", usd0(d.additionalMonthlyRevenue)],
    ["Additional annual revenue", usd0(d.additionalAnnualRevenue)],
    ["Return on ad spend", `${d.roas.toFixed(1)}x`],
    [
      "Months to fill vacancy at this pace",
      d.monthsToFill > 0 ? d.monthsToFill.toFixed(1) : "n/a",
    ],
  ];
}
