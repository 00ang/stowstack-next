import { NextRequest } from "next/server";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  verifyCsrfOrigin,
} from "@/lib/api-helpers";
import { getManageScope, manageScopeAllows } from "@/lib/manage-session";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

/**
 * PATCH /api/manage/facility
 *
 * Owner edit of their own facility's profile (the Overview card in the
 * facility tools). The admin equivalent is /api/admin-facilities, which stays
 * admin-only: owners get a narrower field list — no pipeline status, and no
 * `notes`, which holds staff notes and the raw audit intake.
 */

const OWNER_EDITABLE_FIELDS = [
  "name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website",
  "google_address",
  "google_phone",
  "occupancy_range",
  "total_units",
  "biggest_issue",
] as const;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function PATCH(req: NextRequest) {
  const origin = getOrigin(req);

  const csrf = verifyCsrfOrigin(req);
  if (csrf) return csrf;

  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "manage-facility");
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!manageScopeAllows(getManageScope(req), id)) {
    return errorResponse("Unauthorized", 401, origin);
  }

  const data: Record<string, string | null> = {};
  for (const key of OWNER_EDITABLE_FIELDS) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return errorResponse(`${key} must be text`, 400, origin);
    }
    const trimmed = value?.trim() ?? "";
    if (trimmed.length > 500) return errorResponse(`${key} is too long`, 400, origin);
    data[key] = trimmed === "" ? null : trimmed;
  }
  if (data.name === null) return errorResponse("Facility name can't be empty", 400, origin);
  if (Object.keys(data).length === 0) return errorResponse("Nothing to update", 400, origin);

  const facility = await db.facilities.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      contact_name: true,
      contact_email: true,
      contact_phone: true,
      website: true,
      google_address: true,
      google_phone: true,
      occupancy_range: true,
      total_units: true,
      biggest_issue: true,
    },
  });

  return jsonResponse({ success: true, facility }, 200, origin);
}
