import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { scheduleReportProcessing } from "@/lib/pms-uploads";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireAdminKey,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * GET — List PMS report uploads for admin processing queue.
 * Optional query params: facilityId, status
 */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-pms-queue");
  if (limited) return limited;
  const authError = await requireFacilityAccess(req);
  if (authError) return authError;
  const origin = getOrigin(req);

  try {
    const url = new URL(req.url);
    const facilityId = url.searchParams.get("facilityId");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (facilityId) where.facility_id = facilityId;
    if (status) where.status = status;

    const reports = await db.pms_reports.findMany({
      where,
      orderBy: { uploaded_at: "desc" },
      select: {
        id: true,
        facility_id: true,
        facility_name: true,
        email: true,
        report_type: true,
        file_name: true,
        file_url: true,
        file_size: true,
        mime_type: true,
        status: true,
        notes: true,
        processed_at: true,
        processed_by: true,
        uploaded_at: true,
      },
      take: 100,
    });

    // Attach facility names for reports that don't have one stored
    const facilityIds = [...new Set(reports.map((r) => r.facility_id))];
    const facilities = await db.facilities.findMany({
      where: { id: { in: facilityIds } },
      select: { id: true, name: true },
    });
    const facilityMap = new Map(facilities.map((f) => [f.id, f.name]));

    const enriched = reports.map((r) => ({
      ...r,
      facility_name: r.facility_name || facilityMap.get(r.facility_id) || "Unknown",
    }));

    return jsonResponse({ reports: enriched }, 200, origin);
  } catch (err) {
    console.error("[admin-pms-queue] GET Error:", err instanceof Error ? err.message : err);
    return errorResponse("Failed to fetch queue", 500, origin);
  }
}

/**
 * PATCH — Update a PMS report upload status, notes, etc.
 *
 * Admin-only by design. Unlike GET (facility-scoped so an owner can see the
 * status of reports they uploaded), processing a report — marking it processed,
 * recording processed_by — is an internal back-office action handled by
 * founders/VAs, not facility owners. Owners do not get write access here.
 */
export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-pms-queue");
  if (limited) return limited;
  const authError = await requireAdminKey(req);
  if (authError) return authError;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { id, status, notes, processed_by } = body;

    if (!id) {
      return errorResponse("Missing report id", 400, origin);
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (processed_by) data.processed_by = processed_by;

    if (status === "processed") {
      data.processed_at = new Date();
    }

    const updated = await db.pms_reports.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        notes: true,
        processed_at: true,
        processed_by: true,
      },
    });

    // Put back in the queue: process it now rather than at the next sweep.
    if (status === "uploaded") {
      await scheduleReportProcessing(updated.id)
        .catch((err) => console.error("[admin-pms-queue] scheduling processing failed:", err));
    }

    return jsonResponse({ report: updated, success: true }, 200, origin);
  } catch (err) {
    console.error("[admin-pms-queue] PATCH Error:", err instanceof Error ? err.message : err);
    return errorResponse("Failed to update report", 500, origin);
  }
}
