/**
 * Shared PMS CSV parsing and column mapping utilities.
 * Used by both admin upload tab and admin queue processing.
 */

import { parseCSVLine } from "@/components/admin/facility-tabs/pms-dashboard-types";

/* ── types ── */

export type UploadType = "rent_roll" | "aging" | "revenue";

export const UPLOAD_TYPES: { key: UploadType; label: string; desc: string }[] = [
  {
    key: "rent_roll",
    label: "Rent Roll",
    desc: "unit, size_label, tenant_name, account, rental_start, paid_thru, rent_rate, insurance_premium, total_due, days_past_due — plus optional phone, email (lets move-ins be matched to the ads that brought them)",
  },
  {
    key: "aging",
    label: "Aging Receivables",
    desc: "unit, tenant_name, bucket_0_30, bucket_31_60, bucket_61_90, bucket_91_120, bucket_120_plus, total",
  },
  {
    key: "revenue",
    label: "Revenue History",
    desc: "year, month, revenue, monthly_tax, move_ins, move_outs",
  },
];

export const EXPECTED_COLUMNS: Record<UploadType, string[]> = {
  rent_roll: [
    "unit", "size_label", "tenant_name", "account", "rental_start",
    "paid_thru", "rent_rate", "insurance_premium", "total_due", "days_past_due",
    // Optional. Not required to import; when present, a move-in can be matched
    // to the lead that inquired (MISSION.md s12).
    "phone", "email",
  ],
  aging: [
    "unit", "tenant_name", "bucket_0_30", "bucket_31_60",
    "bucket_61_90", "bucket_91_120", "bucket_120_plus", "total",
  ],
  revenue: ["year", "month", "revenue", "monthly_tax", "move_ins", "move_outs"],
};

/**
 * Columns that are useful when present but never block an import. A rent roll
 * without phone/email imports exactly as before; with them, a move-in can be
 * matched to the lead that inquired (MISSION.md s12).
 */
export const OPTIONAL_COLUMNS: Record<UploadType, string[]> = {
  rent_roll: ["phone", "email"],
  aging: [],
  revenue: [],
};

export function isOptionalColumn(type: UploadType, column: string): boolean {
  return OPTIONAL_COLUMNS[type].includes(column);
}

/* ── CSV parsing ── */

export function parseCSVText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = vals[j] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

/* ── column mapping ── */

export function autoMapColumns(
  headers: string[],
  expectedColumns: string[]
): Record<string, string> {
  const map: Record<string, string> = {};

  // Normalize away every non-alphanumeric character (underscores, spaces,
  // hyphens, slashes, "+") so canonical names like "bucket_0_30" still match
  // real-world headers like "0-30" or "120+".
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const exp of expectedColumns) {
    const normalized = norm(exp);
    const match = headers.find((h) => {
      const hn = norm(h);
      return hn === normalized || hn.includes(normalized) || normalized.includes(hn);
    });
    if (match) {
      map[exp] = match;
    }
  }

  return map;
}

/* ── row mapping ── */

export function mapRows(
  rows: Record<string, string>[],
  columnMap: Record<string, string>,
  expectedColumns: string[]
): Record<string, string>[] {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const exp of expectedColumns) {
      const srcCol = columnMap[exp];
      out[exp] = srcCol ? row[srcCol] ?? "" : "";
    }
    return out;
  });
}
