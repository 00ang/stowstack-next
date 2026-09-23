/**
 * Shared PMS import pipeline (M7).
 *
 * One place that turns a parsed CSV into the `facility_pms_*` tables the
 * customer dashboard reads. Used by BOTH:
 *   - the admin upload tab → `/api/pms-data` POST (explicit, column-mapped), and
 *   - the portal auto-parse path → `/api/portal-upload` POST (auto-detected),
 *     plus the founder approval action (`process_report`).
 *
 * The column-detection / CSV-tokenizing primitives live in
 * `@/lib/pms-column-mapper`; this module owns report-type *detection*, anomaly
 * checks, summary math, and the actual Prisma writes. Keeping the writes here
 * (instead of inline in the route) is what lets the two upload surfaces share
 * one trustworthy importer.
 *
 * CSV only, by design (the plan phases PDF/XLSX for later).
 */

import { db } from "@/lib/db";
import { scheduleDetection } from "@/lib/events/detect";
import {
  type UploadType,
  EXPECTED_COLUMNS,
  autoMapColumns,
  parseCSVText,
  mapRows,
} from "@/lib/pms-column-mapper";

export type { UploadType };

/**
 * Columns that MUST map for an import of a given type to be trustworthy. Also
 * used to disambiguate report types during auto-detection: an aging file is
 * distinguished from a rent roll by carrying an aging bucket, and a revenue
 * file by carrying year/month/revenue.
 */
const REQUIRED_COLUMNS: Record<UploadType, string[]> = {
  rent_roll: ["unit"],
  aging: ["unit", "bucket_0_30"],
  revenue: ["year", "month", "revenue"],
};

export interface ParsedReport {
  type: UploadType;
  columnMap: Record<string, string>;
  mappedRows: Record<string, string>[];
  missingRequired: string[];
}

/* ── coercion ── */

/** Lenient numeric coercion: strips `$`, `,`, `%`, whitespace. Returns null for blanks/garbage. */
export function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v)
    .replace(/[$,%\s]/g, "")
    .trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function num(v: unknown): number {
  return toNumber(v) ?? 0;
}

function isOccupied(tenant: unknown): boolean {
  return !!tenant && String(tenant).trim() !== "";
}

/* ── report-type detection ── */

/**
 * Guess the report type from the CSV header row. Picks the type whose required
 * columns are all present and which maps the most expected columns overall.
 * Returns null when nothing maps confidently (caller routes to founder review).
 */
export function detectReportType(headers: string[]): UploadType | null {
  let best: { type: UploadType; score: number } | null = null;
  for (const type of Object.keys(EXPECTED_COLUMNS) as UploadType[]) {
    const map = autoMapColumns(headers, EXPECTED_COLUMNS[type]);
    const hasRequired = REQUIRED_COLUMNS[type].every((c) => map[c]);
    if (!hasRequired) continue;
    const score = Object.keys(map).length;
    if (!best || score > best.score) best = { type, score };
  }
  return best?.type ?? null;
}

/**
 * Full parse: tokenize CSV text, detect (or accept a hinted) type, map columns.
 * Returns null only when no type can be determined.
 */
export function parseReport(
  text: string,
  hint?: UploadType,
): ParsedReport | null {
  const { headers, rows } = parseCSVText(text);
  if (headers.length === 0) return null;

  // Trust an explicit hint only if its required columns actually map; otherwise
  // fall back to detection so a mislabeled file still lands correctly.
  let type: UploadType | null = null;
  if (hint) {
    const hintMap = autoMapColumns(headers, EXPECTED_COLUMNS[hint]);
    if (REQUIRED_COLUMNS[hint].every((c) => hintMap[c])) type = hint;
  }
  if (!type) type = detectReportType(headers);
  if (!type) return null;

  const expected = EXPECTED_COLUMNS[type];
  const columnMap = autoMapColumns(headers, expected);
  const missingRequired = REQUIRED_COLUMNS[type].filter((c) => !columnMap[c]);
  return {
    type,
    columnMap,
    mappedRows: mapRows(rows, columnMap, expected),
    missingRequired,
  };
}

/* ── summary math ── */

export interface RentRollSummary {
  totalUnits: number;
  occupied: number;
  occupancyPct: number;
  grossPotential: number;
  actualRevenue: number;
  delinquentUnits: number;
  delinquencyPct: number;
}

export function summarizeRentRoll(
  rows: Array<Record<string, unknown>>,
): RentRollSummary {
  const totalUnits = rows.length;
  const occupied = rows.filter((r) => isOccupied(r.tenant_name)).length;
  const grossPotential = rows.reduce((s, r) => s + num(r.rent_rate), 0);
  const actualRevenue = rows.reduce((s, r) => s + num(r.total_due), 0);
  const delinquentUnits = rows.filter((r) => num(r.days_past_due) > 0).length;
  return {
    totalUnits,
    occupied,
    occupancyPct: totalUnits > 0 ? (occupied / totalUnits) * 100 : 0,
    grossPotential,
    actualRevenue,
    delinquentUnits,
    delinquencyPct: totalUnits > 0 ? (delinquentUnits / totalUnits) * 100 : 0,
  };
}

export interface UnitMixRow {
  unit_type: string;
  size_label: string | null;
  total_count: number;
  occupied_count: number;
  street_rate: number | null;
}

/**
 * Derive a unit-mix breakdown from a rent roll by grouping on size label, so a
 * single rent-roll upload also populates the `facility_pms_units` table the
 * reports page reads. Street rate is the average of non-zero rents in the group.
 */
export function deriveUnitMix(
  rows: Array<Record<string, unknown>>,
): UnitMixRow[] {
  const groups = new Map<
    string,
    { total: number; occupied: number; rateSum: number; rateCount: number }
  >();
  for (const r of rows) {
    const label = String(r.size_label ?? "").trim() || "Standard";
    const g = groups.get(label) ?? {
      total: 0,
      occupied: 0,
      rateSum: 0,
      rateCount: 0,
    };
    g.total += 1;
    if (isOccupied(r.tenant_name)) g.occupied += 1;
    const rate = toNumber(r.rent_rate);
    if (rate != null && rate > 0) {
      g.rateSum += rate;
      g.rateCount += 1;
    }
    groups.set(label, g);
  }
  return [...groups.entries()].map(([label, g]) => ({
    unit_type: label,
    size_label: label === "Standard" ? null : label,
    total_count: g.total,
    occupied_count: g.occupied,
    street_rate: g.rateCount > 0 ? g.rateSum / g.rateCount : null,
  }));
}

/* ── anomaly checks (gate before customer-visible data) ── */

/**
 * Sanity checks run before a CSV is allowed to auto-publish. A non-empty result
 * means "hold for founder review" rather than auto-import. Conservative on
 * purpose — false positives just route to manual approval, false negatives let
 * bad data reach the customer.
 *
 * This is the single anomaly policy for the whole PMS pipeline (portal sync
 * upload, admin approval, and the cron sweep all call it). Blank/non-numeric
 * numeric cells coerce to 0 and never trip a check.
 */
export function detectAnomalies(
  type: UploadType,
  rows: Array<Record<string, unknown>>,
): string[] {
  const problems: string[] = [];
  if (rows.length === 0) {
    problems.push("no data rows");
    return problems;
  }

  if (type === "rent_roll") {
    const totalUnits = rows.length;
    if (totalUnits > 100000) {
      problems.push(`implausible unit count (${totalUnits})`);
    }
    const occupied = rows.filter((r) => isOccupied(r.tenant_name)).length;
    // Only suspicious at scale — a genuinely small all-vacant facility is fine.
    if (totalUnits >= 10 && occupied === 0) {
      problems.push(
        `0% occupancy across ${totalUnits} units (likely a tenant-name column mismatch)`,
      );
    }
    const negativeRent = rows.filter((r) => num(r.rent_rate) < 0).length;
    if (negativeRent > 0) {
      problems.push(`${negativeRent} row(s) with negative rent`);
    }
    const negativePastDue = rows.filter((r) => num(r.days_past_due) < 0).length;
    if (negativePastDue > 0) {
      problems.push(`${negativePastDue} row(s) with negative days-past-due`);
    }
    const units = rows.map((r) => String(r.unit ?? "").trim()).filter(Boolean);
    if (units.length > 0 && new Set(units).size < units.length) {
      problems.push("duplicate unit numbers present");
    }
  }

  if (type === "aging") {
    const buckets = [
      "bucket_0_30",
      "bucket_31_60",
      "bucket_61_90",
      "bucket_91_120",
      "bucket_120_plus",
    ];
    const negativeBuckets = rows.filter((r) =>
      buckets.some((b) => num(r[b]) < 0),
    ).length;
    if (negativeBuckets > 0) {
      problems.push(`${negativeBuckets} row(s) with negative aging amounts`);
    }
  }

  if (type === "revenue") {
    if (rows.some((r) => num(r.revenue) < 0)) {
      problems.push("negative revenue present");
    }
  }

  return problems;
}

/* ── importers (Prisma writes) ── */

export async function importRentRoll(
  facilityId: string,
  snapshotDate: Date,
  rows: Array<Record<string, unknown>>,
): Promise<{ imported: number; summary: RentRollSummary }> {
  await db.facility_pms_rent_roll.deleteMany({
    where: { facility_id: facilityId, snapshot_date: snapshotDate },
  });

  await db.facility_pms_rent_roll.createMany({
    data: rows.map((r) => ({
      facility_id: facilityId,
      snapshot_date: snapshotDate,
      unit: String(r.unit ?? ""),
      size_label: r.size_label ? String(r.size_label) : null,
      tenant_name: r.tenant_name ? String(r.tenant_name) : null,
      account: r.account ? String(r.account) : null,
      rental_start: r.rental_start ? new Date(r.rental_start as string) : null,
      paid_thru: r.paid_thru ? new Date(r.paid_thru as string) : null,
      rent_rate: toNumber(r.rent_rate),
      insurance_premium: toNumber(r.insurance_premium),
      total_due: num(r.total_due),
      days_past_due: num(r.days_past_due),
    })),
  });

  const summary = summarizeRentRoll(rows);
  await db.facility_pms_snapshots.upsert({
    where: {
      facility_id_snapshot_date: {
        facility_id: facilityId,
        snapshot_date: snapshotDate,
      },
    },
    update: {
      total_units: summary.totalUnits,
      occupied_units: summary.occupied,
      occupancy_pct: summary.occupancyPct,
      gross_potential: summary.grossPotential,
      actual_revenue: summary.actualRevenue,
      delinquency_pct: summary.delinquencyPct,
      updated_at: new Date(),
    },
    create: {
      facility_id: facilityId,
      snapshot_date: snapshotDate,
      total_units: summary.totalUnits,
      occupied_units: summary.occupied,
      occupancy_pct: summary.occupancyPct,
      gross_potential: summary.grossPotential,
      actual_revenue: summary.actualRevenue,
      delinquency_pct: summary.delinquencyPct,
    },
  });

  // A rent roll also defines the unit mix — populate it so the reports page's
  // unit-mix table fills from the same upload.
  await importUnitMix(facilityId, rows);

  return { imported: rows.length, summary };
}

export async function importUnitMix(
  facilityId: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ upserted: number }> {
  const mix = deriveUnitMix(rows);
  for (const u of mix) {
    await db.facility_pms_units.upsert({
      where: {
        facility_id_unit_type: {
          facility_id: facilityId,
          unit_type: u.unit_type,
        },
      },
      update: {
        size_label: u.size_label,
        total_count: u.total_count,
        occupied_count: u.occupied_count,
        street_rate: u.street_rate,
        last_updated: new Date(),
      },
      create: {
        facility_id: facilityId,
        unit_type: u.unit_type,
        size_label: u.size_label,
        total_count: u.total_count,
        occupied_count: u.occupied_count,
        street_rate: u.street_rate,
      },
    });
  }
  return { upserted: mix.length };
}

export async function importAging(
  facilityId: string,
  snapshotDate: Date,
  rows: Array<Record<string, unknown>>,
): Promise<{ imported: number }> {
  await db.facility_pms_aging.deleteMany({
    where: { facility_id: facilityId, snapshot_date: snapshotDate },
  });

  await db.facility_pms_aging.createMany({
    data: rows.map((r) => ({
      facility_id: facilityId,
      snapshot_date: snapshotDate,
      unit: String(r.unit ?? ""),
      tenant_name: r.tenant_name ? String(r.tenant_name) : null,
      bucket_0_30: num(r.bucket_0_30),
      bucket_31_60: num(r.bucket_31_60),
      bucket_61_90: num(r.bucket_61_90),
      bucket_91_120: num(r.bucket_91_120),
      bucket_120_plus: num(r.bucket_120_plus),
      total: num(r.total),
    })),
  });

  return { imported: rows.length };
}

export async function importRevenue(
  facilityId: string,
  rows: Array<Record<string, unknown>>,
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const r of rows) {
    const year = num(r.year);
    const month = String(r.month ?? "");
    if (!year || !month) continue;
    await db.facility_pms_revenue_history.upsert({
      where: {
        facility_id_year_month: { facility_id: facilityId, year, month },
      },
      update: {
        revenue: num(r.revenue),
        monthly_tax: num(r.monthly_tax),
        move_ins: num(r.move_ins),
        move_outs: num(r.move_outs),
      },
      create: {
        facility_id: facilityId,
        year,
        month,
        revenue: num(r.revenue),
        monthly_tax: num(r.monthly_tax),
        move_ins: num(r.move_ins),
        move_outs: num(r.move_outs),
      },
    });
    upserted++;
  }
  return { upserted };
}

/* ── orchestrator ── */

export interface ImportResult {
  type: UploadType;
  imported: number;
  summary?: RentRollSummary;
}

/**
 * Route already-mapped rows to the right importer. `snapshotDate` is required
 * for rent_roll/aging and ignored for revenue (which is keyed per year/month).
 */
export async function importParsed(
  facilityId: string,
  type: UploadType,
  snapshotDate: Date,
  mappedRows: Array<Record<string, unknown>>,
): Promise<ImportResult> {
  if (type === "rent_roll") {
    const { imported, summary } = await importRentRoll(
      facilityId,
      snapshotDate,
      mappedRows,
    );
    // The rent roll and unit mix just moved — the only thing detection reads —
    // so this is the moment to look, not the next tick of a clock.
    await scheduleDetection(facilityId).catch((err) => console.error("[pms] scheduling detection failed:", err));
    return { type, imported, summary };
  }
  if (type === "aging") {
    const { imported } = await importAging(facilityId, snapshotDate, mappedRows);
    return { type, imported };
  }
  const { upserted } = await importRevenue(facilityId, mappedRows);
  return { type, imported: upserted };
}

/** Human-readable label for a report type (for notes / UI). */
export function reportTypeLabel(type: UploadType): string {
  return type === "rent_roll"
    ? "rent roll"
    : type === "aging"
      ? "aging receivables"
      : "revenue history";
}
