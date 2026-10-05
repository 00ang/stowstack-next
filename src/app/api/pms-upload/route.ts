import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { scheduleReportProcessing } from "@/lib/pms-uploads";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  isAdminRequest,
} from "@/lib/api-helpers";
import { SENDERS, sendEmail } from "@/lib/email";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidEmail, sanitizeString, escapeHtml } from "@/lib/validation";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "pms-upload");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const facilityName = sanitizeString(body.facilityName, 300);
    const email = sanitizeString(body.email, 254);
    const reportType = sanitizeString(body.reportType, 50);
    const fileName = sanitizeString(body.fileName, 255);
    const { reportData } = body;

    if (!facilityName || !email || !reportData) {
      return errorResponse(
        "Missing required fields: facilityName, email, reportData",
        400,
        origin,
      );
    }
    if (!isValidEmail(email)) {
      return errorResponse("Invalid email format", 400, origin);
    }

    // Reject oversized payloads (10MB max for report data)
    const reportSize = JSON.stringify(reportData).length;
    if (reportSize > 10_000_000) {
      return errorResponse("Report data too large (10MB max)", 413, origin);
    }

    // Look up facility by email to get facility_id (required for pms_reports)
    const facility = await db.facilities.findFirst({
      where: { contact_email: email.toLowerCase() },
      select: { id: true },
    });

    if (!facility) {
      return errorResponse("No facility found for this email", 404, origin);
    }

    // Authorization: a matching contact_email is not proof of control. Require an
    // admin key, or a portal access code belonging to a client of this facility,
    // before writing PMS data to it.
    if (!isAdminRequest(req)) {
      const accessCode =
        typeof body.accessCode === "string" ? body.accessCode.trim() : "";
      const authorizedClient = accessCode
        ? await db.clients.findFirst({
            where: { access_code: accessCode, facility_id: facility.id },
            select: { id: true },
          })
        : null;
      if (!authorizedClient) {
        return errorResponse("Unauthorized", 401, origin);
      }
    }

    const report = await db.pms_reports.create({
      data: {
        facility_id: facility.id,
        facility_name: facilityName,
        email,
        report_type: reportType || "unknown",
        file_name: fileName || "report.csv",
        report_data: reportData,
      },
    });

    // Lands `uploaded`; the queue triages it for the admin review queue.
    await scheduleReportProcessing(report.id, { facilityId: facility.id })
      .catch((err) => console.error("[pms-upload] scheduling processing failed:", err));

    await db.facilities.update({
      where: { id: facility.id },
      data: { pms_uploaded: true, updated_at: new Date() },
    });

    void sendEmail({
      from: SENDERS.notifications,
      to: [process.env.ADMIN_EMAIL || "blake@storageads.com", "anna@storageads.com"],
      subject: `PMS Report Uploaded: ${escapeHtml(facilityName)}`,
      tags: [{ name: "type", value: "pms_upload" }],
      html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2>New PMS Report Upload</h2>
            <p><strong>Facility:</strong> ${escapeHtml(facilityName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Report Type:</strong> ${escapeHtml(reportType || "Not specified")}</p>
            <p><strong>File:</strong> ${escapeHtml(fileName || "report.csv")}</p>
            <p style="color: #666; font-size: 13px;">Uploaded: ${new Date().toISOString()}</p>
          </div>`,
    });

    return jsonResponse({ id: report.id, success: true }, 200, origin);
  } catch {
    return errorResponse("Failed to save PMS report", 500, origin);
  }
}
