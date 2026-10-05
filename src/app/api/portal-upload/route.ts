import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { AFTER_PORTAL_UPLOAD_MS, scheduleReportProcessing } from "@/lib/pms-uploads";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { authenticatePortalRequest } from "@/lib/portal-auth";
import { SENDERS, sendEmail } from "@/lib/email";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { escapeHtml } from "@/lib/validation";
import {
  parseReport,
  detectAnomalies,
  importParsed,
  reportTypeLabel,
} from "@/lib/pms-import";

// Cap how many parsed rows we stage on the report row (when held for review) so
// the report_data JSON stays bounded. Auto-imported files don't stage rows.
const MAX_STAGED_ROWS = 5000;

/**
 * Best-effort CSV auto-processing (M7). Returns the post-upload status + a human
 * note, and the parsed payload to stage when a file is held for founder review.
 * Never throws — the file is already stored, so a parse failure just routes the
 * report to manual review rather than failing the whole upload.
 */
async function autoProcessCsv(
  facilityId: string,
  file: File,
): Promise<{
  status: string;
  notes: string;
  reportData: Record<string, unknown> | null;
  processed: boolean;
}> {
  try {
    const text = await file.text();
    const parsed = parseReport(text);

    if (!parsed) {
      return {
        status: "needs_review",
        notes: "Could not auto-detect the report type. Our team will review it.",
        reportData: null,
        processed: false,
      };
    }
    if (parsed.missingRequired.length) {
      return {
        status: "needs_review",
        notes: `Detected ${reportTypeLabel(parsed.type)} but required columns are missing (${parsed.missingRequired.join(", ")}). Held for review.`,
        reportData: null,
        processed: false,
      };
    }

    const anomalies = detectAnomalies(parsed.type, parsed.mappedRows);
    if (anomalies.length) {
      // Stage the parsed rows so an admin can approve without re-parsing.
      return {
        status: "needs_review",
        notes: `Detected ${reportTypeLabel(parsed.type)} (${parsed.mappedRows.length} rows). Held for review: ${anomalies.join("; ")}`,
        reportData: {
          type: parsed.type,
          snapshotDate: new Date().toISOString(),
          mappedRows: parsed.mappedRows.slice(0, MAX_STAGED_ROWS),
          anomalies,
        },
        processed: false,
      };
    }

    // Clean file → auto-import (snapshot date = upload date for rent_roll/aging).
    const result = await importParsed(
      facilityId,
      parsed.type,
      new Date(),
      parsed.mappedRows,
    );
    return {
      status: "processed",
      notes: `Auto-processed ${reportTypeLabel(parsed.type)}: ${result.imported} rows imported.`,
      reportData: null,
      processed: true,
    };
  } catch (err) {
    console.error(
      "[portal-upload] auto-process failed:",
      err instanceof Error ? err.message : err,
    );
    return {
      status: "needs_review",
      notes: "Automatic processing failed. Our team will review this file.",
      reportData: null,
      processed: false,
    };
  }
}

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "text/csv",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * POST — Upload a PMS report file from the client portal.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "portal-upload");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    // Canonical portal auth (replaces the route's private resolveClient). Upload
    // is a client action tied to a facility, so it requires a client scope. The
    // shared helper returns no email, so resolve it from the client id for the
    // pms_reports record + the admin notification.
    const scope = await authenticatePortalRequest(req);
    if (scope instanceof NextResponse) return scope;
    if (scope.kind !== "client") {
      return errorResponse("Client context required", 400, origin);
    }
    const facilityId = scope.facilityId;
    const clientRow = await db.clients.findUnique({
      where: { id: scope.clientId },
      select: { email: true },
    });
    const clientEmail = clientRow?.email ?? "";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const reportType = (formData.get("reportType") as string) || "unknown";

    if (!file || !(file instanceof File)) {
      return errorResponse("No file provided", 400, origin);
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("File too large (25MB max)", 413, origin);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse(
        "Unsupported file type. Accepted: CSV, PDF, Excel (.xlsx, .xls)",
        415,
        origin,
      );
    }

    // Upload to Vercel Blob
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(
      `pms-reports/${facilityId}/${Date.now()}-${sanitizedName}`,
      file,
      { access: "public", contentType: file.type, multipart: true },
    );

    // Get facility name
    const facility = await db.facilities.findUnique({
      where: { id: facilityId },
      select: { name: true },
    });

    // Create pms_reports record
    const report = await db.pms_reports.create({
      data: {
        facility_id: facilityId,
        facility_name: facility?.name ?? null,
        email: clientEmail,
        report_type: reportType,
        file_name: file.name,
        file_url: blob.url,
        file_size: file.size,
        mime_type: file.type,
        status: "uploaded",
      },
    });

    // The net under the inline parse below: if this request dies part-way, or
    // the file is not a CSV, the queue picks the report up once the inline path
    // has had its chance. A no-op for a report that path already finished.
    await scheduleReportProcessing(report.id, { facilityId, delayMs: AFTER_PORTAL_UPLOAD_MS })
      .catch((err) => console.error("[portal-upload] scheduling processing failed:", err));

    // Mark facility as having PMS data
    await db.facilities.update({
      where: { id: facilityId },
      data: { pms_uploaded: true, updated_at: new Date() },
    });

    // M7: CSVs are parsed immediately. Clean files auto-import into
    // facility_pms_*; ambiguous or anomalous files are held at "needs_review"
    // for founder approval before any customer-visible data changes. PDF/XLSX
    // stay "uploaded" for manual handling (parser is CSV-only by design).
    let status = "uploaded";
    let notes: string | null = null;
    if (file.type === "text/csv") {
      const outcome = await autoProcessCsv(facilityId, file);
      status = outcome.status;
      notes = outcome.notes;
      await db.pms_reports.update({
        where: { id: report.id },
        data: {
          status: outcome.status,
          notes: outcome.notes,
          report_data: outcome.reportData
            ? (outcome.reportData as Prisma.InputJsonValue)
            : undefined,
          processed_at: outcome.processed ? new Date() : null,
          processed_by: outcome.processed ? "auto" : null,
        },
      });
    }

    // Send admin notification (fire-and-forget).
    void sendEmail({
      from: SENDERS.notifications,
      to: [process.env.ADMIN_EMAIL || "blake@storageads.com"],
      subject: `PMS Report Uploaded: ${escapeHtml(facility?.name ?? "Unknown")} [${status}]`,
      tags: [{ name: "type", value: "portal_upload" }],
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 480px;">
            <h2 style="color: #141413; margin: 0 0 16px;">New PMS Report Upload</h2>
            <table style="font-size: 14px; color: #6a6560; line-height: 1.6;">
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">Facility</td><td>${escapeHtml(facility?.name ?? "Unknown")}</td></tr>
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">File</td><td>${escapeHtml(file.name)}</td></tr>
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">Type</td><td>${escapeHtml(reportType)}</td></tr>
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">Size</td><td>${(file.size / 1024).toFixed(1)} KB</td></tr>
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">From</td><td>${escapeHtml(clientEmail)}</td></tr>
              <tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">Status</td><td>${escapeHtml(status)}</td></tr>
              ${notes ? `<tr><td style="padding-right: 12px; font-weight: 500; color: #141413;">Notes</td><td>${escapeHtml(notes)}</td></tr>` : ""}
            </table>
            <p style="margin-top: 16px;"><a href="${blob.url}" style="color: #141413;">View File</a></p>
          </div>`,
    });

    return jsonResponse(
      { id: report.id, file_url: blob.url, status, notes, success: true },
      200,
      origin,
    );
  } catch (err) {
    console.error("[portal-upload] Error:", err instanceof Error ? err.message : err);
    return errorResponse("Upload failed", 500, origin);
  }
}

/**
 * GET — Fetch upload history for the client's facility.
 * Also supports admin access with facilityId query param.
 */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "portal-upload");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const scope = await authenticatePortalRequest(req);
    if (scope instanceof NextResponse) return scope;

    // A client is pinned to their own facility; an admin may pass ?facilityId.
    let facilityId: string;
    if (scope.kind === "admin") {
      const paramFacilityId = new URL(req.url).searchParams.get("facilityId");
      if (!paramFacilityId) {
        return errorResponse("Missing facilityId", 400, origin);
      }
      facilityId = paramFacilityId;
    } else {
      facilityId = scope.facilityId;
    }

    const reports = await db.pms_reports.findMany({
      where: { facility_id: facilityId },
      orderBy: { uploaded_at: "desc" },
      select: {
        id: true,
        file_name: true,
        file_url: true,
        file_size: true,
        mime_type: true,
        report_type: true,
        status: true,
        notes: true,
        uploaded_at: true,
        processed_at: true,
      },
      take: 50,
    });

    return jsonResponse({ reports }, 200, origin);
  } catch (err) {
    console.error("[portal-upload] GET Error:", err instanceof Error ? err.message : err);
    return errorResponse("Failed to fetch uploads", 500, origin);
  }
}
