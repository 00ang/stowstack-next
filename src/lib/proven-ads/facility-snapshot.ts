import { db } from "@/lib/db";
import type { FacilitySnapshot } from "./types";

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
  "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN",
  texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

export function parseCityState(location: string | null | undefined): { city: string | null; state: string | null } {
  if (!location) return { city: null, state: null };
  const trimmed = location.trim();
  const comma = trimmed.match(/^([^,]+),\s*([A-Za-z]{2})\b/);
  if (comma) return { city: comma[1].trim(), state: comma[2].toUpperCase() };
  const named = trimmed.match(/^([^,]+),\s*([A-Za-z][A-Za-z\s]+)$/);
  if (named) {
    const state = US_STATES[named[2].trim().toLowerCase()] ?? null;
    return { city: named[1].trim(), state };
  }
  return { city: trimmed || null, state: null };
}

/**
 * The bits of a facility the adaptation needs: name, market, price, offer.
 * Same tables Ad Studio already reads (facilities + PMS units/specials).
 */
export async function loadFacilitySnapshot(facilityId: string): Promise<FacilitySnapshot | null> {
  const facility = await db.facilities.findUnique({
    where: { id: facilityId },
    select: {
      id: true,
      name: true,
      location: true,
      google_address: true,
      website: true,
      google_phone: true,
      google_rating: true,
      review_count: true,
    },
  });
  if (!facility) return null;

  const [units, specials] = await Promise.all([
    db.facility_pms_units
      .findMany({
        where: { facility_id: facilityId },
        select: {
          unit_type: true,
          total_count: true,
          occupied_count: true,
          street_rate: true,
          web_rate: true,
        },
      })
      .catch(() => []),
    db.facility_pms_specials
      .findMany({
        where: { facility_id: facilityId, active: true },
        select: { name: true, description: true, discount_type: true, discount_value: true },
      })
      .catch(() => []),
  ]);

  const open = units.filter((u) => (u.total_count || 0) - (u.occupied_count || 0) > 0);
  const vacantUnits = open.reduce((s, u) => s + ((u.total_count || 0) - (u.occupied_count || 0)), 0);
  const rates = units
    .map((u) => Number(u.web_rate ?? u.street_rate))
    .filter((n) => Number.isFinite(n) && n > 0);
  const fromRate = rates.length ? Math.min(...rates) : null;

  const loc = parseCityState(facility.location || facility.google_address);

  return {
    id: facility.id,
    name: facility.name,
    location: facility.location,
    city: loc.city,
    state: loc.state,
    address: facility.google_address,
    website: facility.website,
    phone: facility.google_phone,
    rating: facility.google_rating != null ? Number(facility.google_rating) : null,
    reviewCount: facility.review_count,
    fromRate,
    vacantUnits: units.length ? vacantUnits : null,
    specials: specials.map((s) => {
      const disc =
        s.discount_type === "percent"
          ? `${s.discount_value}% off`
          : s.discount_type === "months_free"
            ? `${s.discount_value} month(s) free`
            : s.discount_value
              ? `$${s.discount_value} off`
              : "";
      return [s.name, disc, s.description].filter(Boolean).join(" — ");
    }),
    openUnitTypes: open.map((u) => u.unit_type).filter((t): t is string => Boolean(t)),
  };
}
