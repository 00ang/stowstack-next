import { NextRequest, after } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, errorResponse, getOrigin, jsonResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { defOf, readGraph, readiness } from "@/lib/funnel-graph";
import { isStale, preflight, preflightFacts, readPublishState, runSummary, startPublish, PUBLISH_QUEUE } from "@/lib/campaign-publish";
import { runJobs } from "@/lib/jobs/runner";
import { HANDLERS } from "@/lib/jobs/handlers";

/**
 * Publish a campaign from its canvas.
 *
 *   GET  ?id=<funnelId>        what each function needs first (preflight), and
 *                              the latest run's results, for the canvas to show.
 *   POST { id, retry?: [...] } start a run, or retry: everything not yet live
 *                              runs again, plus any unknown ones named in `retry`.
 *
 * The run itself is a job on the durable queue. The POST starts the worker
 * straight away after answering, so the canvas sees the first results in
 * seconds rather than at the next minute's tick; the cron worker finishes
 * anything this pass doesn't.
 */

export const maxDuration = 300;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

async function loadFunnel(req: NextRequest, id: string | null) {
  if (!id) return { error: "id is required", status: 400 as const };
  const funnel = await db.funnels.findUnique({
    where: { id },
    select: { id: true, facility_id: true, config: true, status: true },
  });
  const denied = await requireFacilityAccess(req, funnel?.facility_id ?? null);
  if (denied) return { denied };
  if (!funnel) return { error: "Campaign not found", status: 404 as const };
  return { funnel };
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "funnel-publish");
  if (limited) return limited;
  const origin = getOrigin(req);
  const loaded = await loadFunnel(req, new URL(req.url).searchParams.get("id"));
  if ("denied" in loaded && loaded.denied) return loaded.denied;
  if ("error" in loaded) return errorResponse(loaded.error!, loaded.status!, origin);
  const { funnel } = loaded;

  try {
    const graph = readGraph(funnel.config);
    const state = readPublishState(funnel.config);
    const facts = await preflightFacts(funnel.facility_id);
    return jsonResponse(
      {
        state,
        stale: isStale(state),
        summary: runSummary(state),
        preflight: graph ? preflight(graph, facts) : {},
        campaignStatus: funnel.status,
      },
      200,
      origin,
    );
  } catch (e) {
    console.error("[funnels/publish GET]", e);
    return errorResponse("Couldn't read this campaign's publish", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.EXPENSIVE_API, "funnel-publish");
  if (limited) return limited;
  const origin = getOrigin(req);

  let body: { id?: string; retry?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }
  const loaded = await loadFunnel(req, body.id ?? null);
  if ("denied" in loaded && loaded.denied) return loaded.denied;
  if ("error" in loaded) return errorResponse(loaded.error!, loaded.status!, origin);
  const { funnel } = loaded;

  const graph = readGraph(funnel.config);
  if (!graph || !graph.nodes.length) return errorResponse("This campaign has nothing on its canvas yet", 400, origin);
  const blocking = graph.nodes.filter((n) => readiness(graph, n).state === "needs");
  if (blocking.length) {
    const first = blocking[0];
    return errorResponse(`${defOf(first.type).title} needs ${readiness(graph, first).need}`, 400, origin);
  }
  const retry = Array.isArray(body.retry) ? body.retry.filter((x): x is string => typeof x === "string").slice(0, 50) : [];

  try {
    const run = await startPublish(funnel.id, funnel.facility_id, retry);
    if (!run) return errorResponse("This campaign couldn't be read", 400, origin);
    if (!run.joined) {
      after(async () => {
        try {
          await runJobs({
            workerId: `publish:${run.runId.slice(0, 8)}`,
            budgetMs: 270_000,
            headroomMs: 30_000,
            queues: [PUBLISH_QUEUE],
            handlers: HANDLERS,
          });
        } catch (e) {
          // The cron worker picks the run up within a minute.
          console.error("[funnels/publish] immediate run failed; the worker will resume it:", e);
        }
      });
    }
    return jsonResponse({ runId: run.runId, joined: run.joined }, 202, origin);
  } catch (e) {
    console.error("[funnels/publish POST]", e);
    return errorResponse("Couldn't start publishing", 500, origin);
  }
}
