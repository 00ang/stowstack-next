import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { scheduleDetection } from "@/lib/events/detect";
import {
  v1CorsResponse,
  v1Json,
  v1Error,
  requireApiAuth,
  isErrorResponse,
  requireScope,
  requireOrgFacility,
} from "@/lib/v1-auth";
import { dispatchWebhook } from "@/lib/webhook";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidUuid } from "@/lib/validation";

export async function OPTIONS() {
  return v1CorsResponse();
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-facility-units");
  if (limited) return limited;
  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "units:read");
  if (scopeErr) return scopeErr;

  const facilityId = new URL(request.url).searchParams.get("facilityId");
  if (facilityId && !isValidUuid(facilityId)) return v1Error("Invalid facilityId format", 400);
  const facility = await requireOrgFacility(facilityId, orgId);
  if (facility instanceof Response) return facility;

  try {
    const units = await db.$queryRaw`
      SELECT id, unit_type, size_label, width_ft, depth_ft, sqft, floor, features,
             total_count, occupied_count, vacant_count, street_rate, web_rate, last_updated
      FROM facility_pms_units WHERE facility_id = ${facilityId}::uuid ORDER BY unit_type
    `;
    return v1Json({ units });
  } catch {
    return v1Error("Failed to fetch units", 500);
  }
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-facility-units");
  if (limited) return limited;
  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "units:write");
  if (scopeErr) return scopeErr;

  const facilityId = new URL(request.url).searchParams.get("facilityId");
  if (facilityId && !isValidUuid(facilityId)) return v1Error("Invalid facilityId format", 400);
  const facility = await requireOrgFacility(facilityId, orgId);
  if (facility instanceof Response) return facility;

  const body = await request.json().catch(() => null);
  const unitList = Array.isArray(body?.units) ? body.units : body ? [body] : [];

  if (!unitList.length || !unitList[0].unitType) {
    return v1Error(
      "unitType is required. Send a single unit or { units: [...] }"
    );
  }

  try {
    const saved: Record<string, unknown>[] = [];
    for (const u of unitList) {
      const rows = await db.$queryRaw<Record<string, unknown>[]>`
        INSERT INTO facility_pms_units
          (facility_id, unit_type, size_label, width_ft, depth_ft, sqft, floor, features,
           total_count, occupied_count, street_rate, web_rate)
        VALUES (${facilityId}::uuid, ${u.unitType}, ${u.sizeLabel || null}, ${u.widthFt || null}, ${u.depthFt || null},
                ${u.sqft || null}, ${u.floor || null}, ${u.features || []}::text[],
                ${u.totalCount || 0}, ${u.occupiedCount || 0}, ${u.streetRate || null}, ${u.webRate || null})
        ON CONFLICT (facility_id, unit_type) DO UPDATE SET
          size_label = EXCLUDED.size_label, width_ft = EXCLUDED.width_ft, depth_ft = EXCLUDED.depth_ft,
          sqft = EXCLUDED.sqft, floor = EXCLUDED.floor, features = EXCLUDED.features,
          total_count = EXCLUDED.total_count, occupied_count = EXCLUDED.occupied_count,
          street_rate = EXCLUDED.street_rate, web_rate = EXCLUDED.web_rate,
          last_updated = NOW()
        RETURNING id, unit_type, size_label, width_ft, depth_ft, sqft, floor, features,
                  total_count, occupied_count, vacant_count, street_rate, web_rate, last_updated
      `;
      if (rows[0]) saved.push(rows[0]);
    }

    dispatchWebhook(orgId, "unit.updated", {
      facilityId,
      units: saved,
    }).catch((err) => console.error("[webhook] Fire-and-forget failed:", err));

    if (facilityId) await scheduleDetection(facilityId).catch((err) => console.error("[pms] scheduling detection failed:", err));

    return v1Json({ units: saved });
  } catch {
    return v1Error("Failed to save units", 500);
  }
}
