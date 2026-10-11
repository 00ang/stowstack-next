import { db } from "@/lib/db";
import { loadFacilityRows } from "@/lib/ontology/load";
import { pictureFromFacility, type PictureExtras } from "./from-rows";
import type { FacilityPicture, RateFacts, SnapshotFacts } from "./picture";

/**
 * Read one facility's picture from the database. Null when the facility
 * is gone. A source with no rows stays null. A source that exists and is
 * quiet comes through as zero.
 */

const DAY = 86_400_000;
const MISSED = ["no-answer", "busy", "failed", "canceled"];

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function loadFacilityPicture(facilityId: string, now = new Date()): Promise<FacilityPicture | null> {
  const since = new Date(now.getTime() - 30 * DAY);
  const [raw, facility] = await Promise.all([
    loadFacilityRows(facilityId, now),
    db.facilities.findFirst({
      where: { id: facilityId, deleted_at: null },
      select: { intake_answers: true, jev_scores: true, occupancy_range: true },
    }),
  ]);
  if (!raw || !facility) return null;

  const [tracking, snapshotRow, spendCount, spendSum, perf, stageRows, touchAny, rateRows] = await Promise.all([
    db.call_tracking_numbers.count({ where: { facility_id: facilityId } }),
    db.facility_pms_snapshots.findFirst({
      where: { facility_id: facilityId },
      orderBy: { snapshot_date: "desc" },
    }),
    db.campaign_spend.count({ where: { facility_id: facilityId, date: { gte: since } } }),
    db.campaign_spend.aggregate({
      where: { facility_id: facilityId, date: { gte: since } },
      _sum: { impressions: true, clicks: true, spend: true },
    }),
    db.creative_performance.findMany({
      where: { facility_id: facilityId },
      orderBy: { period: "desc" },
      take: 80,
    }),
    db.funnel_stage_metrics.findMany({
      where: { funnels: { facility_id: facilityId } },
      orderBy: { period: "desc" },
      take: 400,
    }),
    db.touches.findFirst({ where: { facility_id: facilityId }, select: { id: true } }),
    db.facility_pms_tenant_rates.findMany({
      where: { facility_id: facilityId },
      orderBy: { snapshot_date: "desc" },
      take: 400,
      select: { snapshot_date: true, standard_rate: true, actual_rate: true },
    }),
  ]);

  let calls: PictureExtras["calls"] = null;
  if (tracking > 0) {
    const [total30, missed30] = await Promise.all([
      db.call_logs.count({ where: { facility_id: facilityId, started_at: { gte: since } } }),
      db.call_logs.count({
        where: { facility_id: facilityId, started_at: { gte: since }, status: { in: MISSED } },
      }),
    ]);
    calls = { total30, missed30 };
  }

  const latestPeriod = perf[0]?.period ?? null;
  const perfSlice = latestPeriod ? perf.filter((row) => row.period === latestPeriod) : [];
  const perfSum = perfSlice.reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.clicks += row.clicks ?? 0;
      acc.leads += row.leads ?? 0;
      acc.moveIns += row.move_ins ?? 0;
      acc.spend += Number(row.spend ?? 0);
      return acc;
    },
    { impressions: 0, clicks: 0, leads: 0, moveIns: 0, spend: 0 },
  );

  const sinceDay = since.toISOString().slice(0, 10);
  const dailyStages = stageRows.filter((row) => row.period.length > 7 && row.period >= sinceDay);
  const monthStages = stageRows.filter((row) => row.period.length === 7 && row.period >= sinceDay.slice(0, 7));
  const stageSlice = dailyStages.length ? dailyStages : monthStages;
  const stageSum = (stage: string) => stageSlice.filter((row) => row.stage === stage).reduce((n, row) => n + (row.count ?? 0), 0);

  let ads: PictureExtras["ads"] = null;
  if (spendCount > 0) {
    ads = {
      impressions30: spendSum._sum.impressions ?? 0,
      clicks30: spendSum._sum.clicks ?? 0,
      spend30: num(spendSum._sum.spend) ?? 0,
      leads30: perfSlice.length ? perfSum.leads : stageSlice.length ? stageSum("form_submit") : null,
      moveIns30: perfSlice.length ? perfSum.moveIns : stageSlice.length ? stageSum("move_in") : null,
    };
  } else if (perfSlice.length) {
    ads = {
      impressions30: perfSum.impressions,
      clicks30: perfSum.clicks,
      spend30: perfSum.spend,
      leads30: perfSum.leads,
      moveIns30: perfSum.moveIns,
    };
  } else if (stageSlice.length) {
    ads = {
      impressions30: stageSum("impression"),
      clicks30: stageSum("click"),
      spend30: null,
      leads30: stageSum("form_submit"),
      moveIns30: stageSum("move_in"),
    };
  }

  let visitors30: number | null = null;
  if (touchAny) {
    visitors30 = await db.touches.count({
      where: { facility_id: facilityId, kind: "visit", occurred_at: { gte: since } },
    });
  }

  let snapshot: SnapshotFacts | null = null;
  if (snapshotRow) {
    snapshot = {
      at: snapshotRow.snapshot_date.toISOString(),
      occupancyPct: num(snapshotRow.occupancy_pct),
      moveIns: snapshotRow.move_ins_mtd,
      moveOuts: snapshotRow.move_outs_mtd,
      totalUnits: snapshotRow.total_units,
      occupiedUnits: snapshotRow.occupied_units,
    };
  }

  let rates: RateFacts | null = null;
  if (rateRows.length) {
    const latest = rateRows[0].snapshot_date.toISOString().slice(0, 10);
    const slice = rateRows.filter((row) => row.snapshot_date.toISOString().slice(0, 10) === latest);
    const gaps: number[] = [];
    let compared = 0;
    for (const row of slice) {
      const standard = num(row.standard_rate);
      const actual = num(row.actual_rate);
      if (standard == null || actual == null) continue;
      compared += 1;
      if (actual < standard) gaps.push(standard - actual);
    }
    if (compared > 0) {
      rates = { compared, belowStandard: gaps.length, medianGap: median(gaps) };
    }
  }

  const intake =
    facility.intake_answers && typeof facility.intake_answers === "object" && !Array.isArray(facility.intake_answers)
      ? (facility.intake_answers as Record<string, unknown>)
      : null;

  const extras: PictureExtras = {
    intake,
    jev: facility.jev_scores,
    occupancyRange: facility.occupancy_range,
    snapshot,
    calls,
    ads,
    visitors30,
    rates,
  };
  return pictureFromFacility(raw, extras, { now });
}
