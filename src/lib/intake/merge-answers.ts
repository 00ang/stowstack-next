import { Prisma } from "@prisma/client";
import { isAllowedAnswer, type FacilityAnswer } from "@/lib/intake/questions";

/**
 * Fixed-option keys that also live on facilities columns the Pipeline
 * already shows. Everything else stays in intake_answers.
 */
const COLUMN_FOR: Record<string, "total_units" | "occupancy_range" | "biggest_issue"> = {
  units: "total_units",
  occupancy: "occupancy_range",
  pain: "biggest_issue",
};

const SCALAR_KEYS = new Set([
  "role",
  "facility_count",
  "stage",
  "units",
  "occupancy",
  "move_balance",
  "pain",
  "ad_spend",
  "timeline",
  "reach_out",
  "marketing_channels",
  "google_ads",
  "who_manages",
  "pms",
  "pms_other",
  "online_rental",
  "site_note",
]);

export interface MergeResult {
  intake_answers: Record<string, unknown>;
  columns: {
    total_units?: string | null;
    occupancy_range?: string | null;
    biggest_issue?: string | null;
    name?: string;
    location?: string;
    website?: string | null;
    place_id?: string | null;
    google_address?: string | null;
    google_rating?: number | null;
    review_count?: number | null;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function isSkip(value: unknown): boolean {
  return value == null || value === "" || value === "skip";
}

/**
 * Merge one step into the saved answers.
 * A skip removes that key and clears the matching column. It never
 * writes a stand-in like "60-75" or "100-300".
 */
export function mergeIntakeAnswers(
  existing: unknown,
  patch: Record<string, unknown>
): MergeResult {
  const intake_answers = asRecord(existing);
  const columns: MergeResult["columns"] = {};

  for (const [key, value] of Object.entries(patch)) {
    if (key === "facility") {
      applyFacility(intake_answers, columns, value);
      continue;
    }
    if (!SCALAR_KEYS.has(key)) continue;

    if (isSkip(value)) {
      delete intake_answers[key];
      const column = COLUMN_FOR[key];
      if (column) columns[column] = null;
      continue;
    }

    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) {
      delete intake_answers[key];
      const column = COLUMN_FOR[key];
      if (column) columns[column] = null;
      continue;
    }

    const checkKey = key === "pms_other" ? "pms" : key;
    const checkValue = key === "pms_other" ? `Other: ${trimmed}` : trimmed;
    if (key !== "pms_other" && !isAllowedAnswer(checkKey, checkValue) && key !== "pms") {
      continue;
    }
    if (key === "pms" && !isAllowedAnswer("pms", trimmed) && !trimmed.startsWith("Other: ")) {
      continue;
    }

    intake_answers[key] = key === "pms_other" ? trimmed : trimmed;
    const column = COLUMN_FOR[key];
    if (column) columns[column] = trimmed;
  }

  return { intake_answers, columns };
}

function applyFacility(
  intake_answers: Record<string, unknown>,
  columns: MergeResult["columns"],
  value: unknown
): void {
  if (isSkip(value)) {
    delete intake_answers.facility;
    delete intake_answers.country;
    return;
  }
  if (!value || typeof value !== "object") return;
  const raw = value as FacilityAnswer;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 200) : "";
  if (!name) return;
  const address = typeof raw.address === "string" ? raw.address.trim().slice(0, 500) : "";
  const city = typeof raw.city === "string" ? raw.city.trim().slice(0, 200) : "";
  const website = typeof raw.website === "string" ? raw.website.trim().slice(0, 500) : "";
  const placeId = typeof raw.placeId === "string" ? raw.placeId.trim().slice(0, 200) : "";
  const country = typeof raw.country === "string" ? raw.country.trim().slice(0, 80) : "";
  const facility: FacilityAnswer = {
    name,
    ...(address ? { address } : {}),
    ...(city ? { city } : {}),
    ...(website ? { website } : {}),
    ...(placeId ? { placeId } : {}),
    ...(country ? { country } : {}),
    ...(typeof raw.rating === "number" ? { rating: raw.rating } : {}),
    ...(typeof raw.reviewCount === "number" ? { reviewCount: raw.reviewCount } : {}),
    ...(raw.typed ? { typed: true } : {}),
  };
  intake_answers.facility = facility;
  if (country) intake_answers.country = country;
  columns.name = name;
  const location = address || city;
  if (location) columns.location = location;
  if (website) columns.website = website;
  if (placeId) columns.place_id = placeId;
  if (address) columns.google_address = address;
  if (typeof raw.rating === "number") columns.google_rating = raw.rating;
  if (typeof raw.reviewCount === "number") columns.review_count = raw.reviewCount;
}

export function answersJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
