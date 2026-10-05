import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { retryStuckDiagnostics } from "@/lib/diagnostic-retry";

export const maxDuration = 30;

/**
 * Manual trigger only — no longer scheduled in `vercel.json`.
 *
 * Finds facilities stuck at diagnostic_submitted with no shared_audit_slug for
 * > 10 minutes (and < 48 hours) and retriggers audit generation. Hourly, this woke the database
 * 24 times a day to find nothing; each intake now queues its own check and the
 * job worker runs a six-hourly sweep (see `@/lib/diagnostic-retry`). Kept so a
 * backlog can be cleared by hand with the cron secret.
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.WEBHOOK, "cron-retry-diagnostic-audits");
  if (limited) return limited;
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ADMIN_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ skipped: true, reason: "Missing ADMIN_SECRET or ANTHROPIC_API_KEY" });
  }

  try {
    const res = await retryStuckDiagnostics();
    if (res.stuck === 0) {
      return NextResponse.json({ retried: 0, message: "No stuck diagnostics" });
    }
    return NextResponse.json({ retried: res.retried, total_stuck: res.stuck });
  } catch (e) {
    console.error("[retry-diagnostic-audits] Cron error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
