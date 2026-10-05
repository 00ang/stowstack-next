import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { notifyCronFailure } from "@/lib/cron-runner";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { detectAnomalies, summarizeRentRoll } from "@/lib/pms-import";
import { processUploadedReports } from "@/lib/pms-uploads";

export const maxDuration = 300;

/**
 * Backward-compatible re-exports. The parsing/anomaly/summary logic now lives in
 * the single shared importer (`@/lib/pms-import`) so the portal sync-upload,
 * admin approval action, and this cron sweep all run identical code. These
 * aliases keep existing imports (and tests) pointed here working.
 */
export const detectPmsAnomalies = detectAnomalies;
export const computeRentRollSnapshot = summarizeRentRoll;

/**
 * Manual trigger only — no longer scheduled in `vercel.json`.
 *
 * Hourly, this woke the database 24 times a day to find nothing; uploads now
 * queue their own processing and the job worker runs a six-hourly backstop
 * (see `@/lib/pms-uploads`). Kept so a stuck queue can be drained by hand with
 * the cron secret.
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.WEBHOOK, "cron-process-pms-uploads");
  if (limited) return limited;
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  try {
    const items = await processUploadedReports("cron:process-pms-uploads");
    return NextResponse.json({
      success: true,
      processed: items.filter((i) => i.status === "processed").length,
      needsReview: items.filter((i) => i.status === "needs_review").length,
      failed: items.filter((i) => i.status === "failed").length,
      items,
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    notifyCronFailure("process-pms-uploads", err, Date.now() - startTime);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Cron processing failed", message },
      { status: 500 }
    );
  }
}
