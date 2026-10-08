import { db } from "@/lib/db";

/** One size typed in onboarding. Only the fields the form collects. */
export interface TypedUnitInput {
  type?: unknown;
  size?: unknown;
  monthlyRate?: unknown;
  availableCount?: unknown;
  /** How many of the size there are in all. When given, empty = availableCount of these. */
  totalCount?: unknown;
}

export interface PmsUnitWrite {
  unit_type: string;
  size_label: string | null;
  width_ft: number | null;
  depth_ft: number | null;
  sqft: number | null;
  total_count: number;
  occupied_count: number;
  street_rate: number | null;
  web_rate: number | null;
}

const SIZE = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/**
 * The sizes someone typed in onboarding, as rows for `facility_pms_units`, so
 * the ontology stops asking them to upload a unit mix.
 *
 * With a total, the available count is the empty share of it (occupied is
 * the rest). Without one (the original form only asked how many are open),
 * the open count stands in for the total and nothing is counted occupied.
 * A type that names its own size ("10x10 Climate") is the fuller name and
 * is kept, so climate units stay climate in the unit mix.
 */
export function typedUnitsToPms(units: TypedUnitInput[]): PmsUnitWrite[] {
  const used = new Set<string>();
  const rows: PmsUnitWrite[] = [];
  for (const unit of units) {
    const type = text(unit.type);
    const size = text(unit.size);
    if (!type && !size) continue;
    let unitType = SIZE.test(type) ? type : size || type;
    if (used.has(unitType.toLowerCase())) {
      const label = type && type.toLowerCase() !== unitType.toLowerCase() ? type : `${unitType}-2`;
      unitType = used.has(label.toLowerCase()) ? `${unitType}-${used.size + 1}` : label;
    }
    used.add(unitType.toLowerCase());
    const match = SIZE.exec(size || type);
    const width = match ? Number(match[1]) : null;
    const depth = match ? Number(match[2]) : null;
    const available = Math.round(num(unit.availableCount));
    const total = Math.round(num(unit.totalCount));
    const rate = num(unit.monthlyRate);
    rows.push({
      unit_type: unitType,
      size_label: size || null,
      width_ft: width,
      depth_ft: depth,
      sqft: width != null && depth != null ? width * depth : null,
      total_count: total > 0 ? Math.max(total, available) : available,
      occupied_count: total > 0 ? Math.max(0, total - available) : 0,
      street_rate: rate || null,
      web_rate: rate || null,
    });
  }
  return rows;
}

/** Upsert the typed mix. Does not delete sizes the form didn't mention. */
export async function writeTypedUnitMix(facilityId: string, units: TypedUnitInput[]): Promise<number> {
  const rows = typedUnitsToPms(units);
  for (const row of rows) {
    await db.facility_pms_units.upsert({
      where: { facility_id_unit_type: { facility_id: facilityId, unit_type: row.unit_type } },
      update: {
        size_label: row.size_label,
        width_ft: row.width_ft,
        depth_ft: row.depth_ft,
        sqft: row.sqft,
        total_count: row.total_count,
        occupied_count: row.occupied_count,
        street_rate: row.street_rate,
        web_rate: row.web_rate,
        last_updated: new Date(),
      },
      create: {
        facility_id: facilityId,
        unit_type: row.unit_type,
        size_label: row.size_label,
        width_ft: row.width_ft,
        depth_ft: row.depth_ft,
        sqft: row.sqft,
        total_count: row.total_count,
        occupied_count: row.occupied_count,
        street_rate: row.street_rate,
        web_rate: row.web_rate,
      },
    });
  }
  return rows.length;
}
