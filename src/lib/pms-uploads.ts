/**
 * Processing an uploaded PMS report (M7) — everything after the file lands.
 *
 * This used to live in an hourly cron, `/api/cron/process-pms-uploads`, which
 * woke the database 24 times a day to find, almost always, nothing: the portal
 * already parses CSVs inline, so a report is only left `uploaded` when that
 * path died part-way, the file is not a CSV, it came in through
 * `/api/pms-upload`, or an admin put it back in the queue. Each of those now
 * schedules its own processing on the job queue (`scheduleReportProcessing`),
 * and a six-hourly backstop sweeps anything that slipped past.
 *
 * The cron route still exists and calls `processUploadedReports`, so it can be
 * triggered by hand; it is just no longer in `vercel.json`.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import { detectAnomalies, importParsed, parseReport, type UploadType } from "@/lib/pms-import";
import { notifyClientsReportReady } from "@/lib/report-notify";

/** Reports per sweep — what the hourly cron took per run. */
export const PROCESS_BATCH = 10;

/**
 * How long after a portal upload its processing job runs. The portal parses
 * CSVs inline, and the job must not race that import for the same report: by
 * five minutes the inline path has either finished (and the job finds nothing
 * to do) or died (and the job is the retry).
 */
export const AFTER_PORTAL_UPLOAD_MS = 5 * 60_000;

const REPORT_SELECT = {
  id: true,
  facility_id: true,
  file_url: true,
  report_type: true,
  mime_type: true,
} as const;

interface WaitingReport {
  id: string;
  facility_id: string;
  file_url: string | null;
  report_type: string | null;
  mime_type: string | null;
}

export interface ProcessOutcome {
  id: string;
  status: "processed" | "needs_review" | "failed";
  note: string;
}

/** Map a declared report_type string to an UploadType hint, when meaningful. */
function classifyHint(declaredType: string | null | undefined): UploadType | undefined {
  const declared = (declaredType || "").toLowerCase();
  if (declared.includes("rent")) return "rent_roll";
  if (declared.includes("aging") || declared.includes("receivable")) return "aging";
  if (declared.includes("revenue") || declared.includes("income")) return "revenue";
  return undefined;
}

async function processReport(
  report: WaitingReport
): Promise<{ status: ProcessOutcome["status"]; note: string }> {
  // Non-CSV files need human review (PDF, XLSX parsing not implemented yet).
  const isCsv =
    report.mime_type === "text/csv" ||
    (report.file_url || "").toLowerCase().endsWith(".csv");

  if (!isCsv) {
    return {
      status: "needs_review",
      note: "Non-CSV upload — parse manually via admin queue",
    };
  }
  if (!report.file_url) {
    return { status: "failed", note: "No file_url on report" };
  }

  const res = await fetch(report.file_url);
  if (!res.ok) {
    return { status: "failed", note: `Fetch failed: HTTP ${res.status}` };
  }
  const text = await res.text();

  const parsed = parseReport(text, classifyHint(report.report_type));
  if (!parsed) {
    return {
      status: "needs_review",
      note: `Could not classify report type (declared="${report.report_type}")`,
    };
  }
  if (parsed.missingRequired.length > 0) {
    return {
      status: "needs_review",
      note: `Auto-map missing required ${parsed.type} columns: ${parsed.missingRequired.join(", ")}`,
    };
  }

  // Anomaly gate: hold suspicious data for human review rather than publishing
  // wrong occupancy/delinquency straight to the customer portal.
  const anomalies = detectAnomalies(parsed.type, parsed.mappedRows);
  if (anomalies.length > 0) {
    return {
      status: "needs_review",
      note: `Held for review (anomaly check): ${anomalies.join("; ")}`,
    };
  }

  try {
    // snapshot date = today; rent roll + aging are point-in-time. importParsed
    // also derives the unit mix into facility_pms_units for rent rolls.
    const result = await importParsed(
      report.facility_id,
      parsed.type,
      new Date(),
      parsed.mappedRows,
    );
    return {
      status: "processed",
      note: `Auto-processed ${parsed.type}: ${result.imported} rows`,
    };
  } catch (err) {
    return {
      status: "failed",
      note: `Ingest error (${parsed.type}): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function processAndRecord(report: WaitingReport, processedBy: string): Promise<ProcessOutcome> {
  const { status, note } = await processReport(report);
  await db.pms_reports.update({
    where: { id: report.id },
    data: { status, notes: note, processed_at: new Date(), processed_by: processedBy },
  });

  // Fresh occupancy/delinquency is now live in the portal — tell the client(s).
  // Same "report ready" moment as the /api/pms-data import paths, and
  // idempotency-keyed per client per day, so several of a facility's reports
  // processed together cannot spam. Awaited: on the queue, a floating promise
  // can be cut off when the worker's invocation ends. It never throws.
  if (status === "processed") await notifyClientsReportReady(report.facility_id);

  return { id: report.id, status, note };
}

/**
 * Process one report, if it is still waiting. Null when it is not — the inline
 * path already handled it, an earlier run did, or a person moved it on.
 */
export async function processUploadedReport(
  reportId: string,
  processedBy: string
): Promise<ProcessOutcome | null> {
  const report = await db.pms_reports.findFirst({
    where: { id: reportId, status: "uploaded" },
    select: REPORT_SELECT,
  });
  return report ? processAndRecord(report, processedBy) : null;
}

/** The oldest waiting reports, up to `limit`. What the hourly cron did. */
export async function processUploadedReports(
  processedBy: string,
  limit: number = PROCESS_BATCH
): Promise<ProcessOutcome[]> {
  const pending = await db.pms_reports.findMany({
    where: { status: "uploaded" },
    orderBy: { uploaded_at: "asc" },
    take: limit,
    select: REPORT_SELECT,
  });
  const out: ProcessOutcome[] = [];
  for (const report of pending) out.push(await processAndRecord(report, processedBy));
  return out;
}

/**
 * Queue processing for a report that was just uploaded or put back to
 * `uploaded`. Not deduped: a report re-queued by an admin must be looked at
 * again, and `processUploadedReport` is a no-op for one already handled.
 */
export async function scheduleReportProcessing(
  reportId: string,
  opts: { facilityId?: string; delayMs?: number } = {}
): Promise<void> {
  await enqueue({
    queue: "pms.process-upload",
    payload: { reportId },
    tenantKey: opts.facilityId,
    runAfter: new Date(Date.now() + (opts.delayMs ?? 0)),
  });
}
