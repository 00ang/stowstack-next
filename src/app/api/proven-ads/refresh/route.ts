import { NextRequest } from "next/server";
import { enqueue } from "@/lib/jobs/queue";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { adapterCoverage } from "@/lib/proven-ads/adapters";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Kick a refresh now. The worker (cron /api/cron/jobs) picks it up.
 * Dedupe key is the current hour so a double-click is a no-op.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-refresh");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  try {
    const id = await enqueue({
      queue: "proven-ads.refresh",
      dedupeKey: `manual:${hour}`,
      payload: { reason: "admin" },
      maxAttempts: 3,
    });
    return jsonResponse(
      {
        queued: Boolean(id),
        jobId: id,
        sources: adapterCoverage(),
        note: id
          ? "Refresh queued. The job worker will run it on the next minute."
          : "A refresh is already queued for this hour.",
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not enqueue refresh";
    return errorResponse(message, 500, origin);
  }
}
