import { NextRequest } from "next/server";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireManageOrAdmin,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export const maxDuration = 30;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Poll FAL's queue for a video-generation job submitted via
 * /api/generate-video. Returns one of:
 *   { status: "IN_QUEUE" | "IN_PROGRESS", queuePosition? }
 *   { status: "SUCCEEDED", videoUrl }
 *   { status: "FAILED", error }
 *
 * Called repeatedly by the UI (every ~3s) until SUCCEEDED or FAILED.
 */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "generate-video-status");
  if (limited) return limited;
  const origin = getOrigin(req);
  // Owners poll the jobs they started from the facility tools. Read-only, by
  // an unguessable FAL request id; starting a job is what the plan gates.
  const denied = await requireManageOrAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const requestId = searchParams.get("requestId");
  const app = searchParams.get("app"); // e.g. "fal-ai/wan-i2v"

  if (!requestId || !app) {
    return errorResponse("requestId and app query params are required", 400, origin);
  }
  // Defensive: only allow known FAL app paths so this endpoint can't be
  // used as a general-purpose FAL proxy.
  const allowedApps = new Set(["fal-ai/wan-i2v", "fal-ai/wan-t2v"]);
  if (!allowedApps.has(app)) {
    return errorResponse("Unsupported FAL app", 400, origin);
  }

  const falKey = process.env.FAL_KEY;
  if (!falKey) return errorResponse("FAL not configured", 500, origin);

  const statusUrl = `https://queue.fal.run/${app}/requests/${encodeURIComponent(requestId)}/status`;
  const responseUrl = `https://queue.fal.run/${app}/requests/${encodeURIComponent(requestId)}`;

  try {
    const sres = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
    });
    const stext = await sres.text();
    let sdata: Record<string, unknown>;
    try {
      sdata = JSON.parse(stext);
    } catch {
      return errorResponse(`FAL status returned non-JSON (${sres.status}): ${stext.slice(0, 200)}`, 502, origin);
    }

    if (!sres.ok) {
      return errorResponse(`FAL status error (${sres.status})`, 502, origin);
    }

    const status = sdata.status as string;

    if (status === "COMPLETED") {
      const rres = await fetch(responseUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      const rtext = await rres.text();
      let rdata: Record<string, unknown>;
      try {
        rdata = JSON.parse(rtext);
      } catch {
        return errorResponse(`FAL response non-JSON (${rres.status}): ${rtext.slice(0, 200)}`, 502, origin);
      }
      const videoUrl = (rdata.video as Record<string, string>)?.url;
      if (!videoUrl) {
        return jsonResponse(
          { status: "FAILED", error: "FAL completed but returned no video URL" },
          200,
          origin,
        );
      }
      return jsonResponse({ status: "SUCCEEDED", videoUrl }, 200, origin);
    }

    if (status === "ERROR") {
      // Fetch the response body — FAL typically puts error detail there.
      const rres = await fetch(responseUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      const rtext = await rres.text();
      return jsonResponse(
        { status: "FAILED", error: rtext.slice(0, 500) || "FAL reported an error" },
        200,
        origin,
      );
    }

    // IN_QUEUE or IN_PROGRESS — keep polling.
    return jsonResponse(
      {
        status,
        queuePosition: typeof sdata.queue_position === "number" ? sdata.queue_position : undefined,
      },
      200,
      origin,
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "FAL status check failed",
      502,
      origin,
    );
  }
}
