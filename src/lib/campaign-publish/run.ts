import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { readGraph, type NodeType } from "@/lib/funnel-graph";
import { enqueue } from "@/lib/jobs/queue";
import { errorText, type JobHandler } from "@/lib/jobs/types";
import { selfBaseUrl } from "@/lib/self-url";
import { EXECUTORS, type PublishContext } from "./nodes";
import { publishOrder } from "./order";
import { beginRun, finishRun, markGraphPublished, readPublishState, writeNodeResult } from "./store";
import { RUNNING_LINE, SETTLED, type NodeResult, type PublishState } from "./types";

/**
 * A publish run on the durable queue (src/lib/jobs).
 *
 * One job per run. It walks the campaign's functions in publish order, writes
 * each result as soon as it is known, and yields between functions when the
 * worker's time is short, resuming from the next one. A function that fails
 * is recorded and the run moves on: one bad connection never strands the rest.
 *
 * Unknown outcomes are never retried on their own. That covers an ad platform
 * that stopped answering mid-create, and a run that died while a Meta or Google
 * call was in flight (it shows as "running" on the next pass): either may have
 * made a campaign, so a person looks first and asks for the retry.
 */

export const PUBLISH_QUEUE = "campaign.publish";

/** A run that has not written anything for this long is treated as over. */
export const STALE_MS = 20 * 60_000;

interface Payload {
  funnelId: string;
  runId: string;
  /** Functions the owner asked to try again, including unknown ones. */
  retry?: string[];
}


/** Calls that can make something on an ad platform: a crash mid-call is an unknown, not a retry. */
const PLATFORM: ReadonlySet<NodeType> = new Set(["meta", "google"]);

export async function loadContext(funnelId: string): Promise<{ ctx: PublishContext; state: PublishState | null } | null> {
  const funnel = await db.funnels.findUnique({
    where: { id: funnelId },
    select: { id: true, name: true, facility_id: true, config: true },
  });
  if (!funnel) return null;
  const graph = readGraph(funnel.config);
  if (!graph) return null;
  const facility = await db.facilities.findUnique({
    where: { id: funnel.facility_id },
    select: { id: true, name: true, google_address: true, contact_phone: true },
  });
  if (!facility) return null;
  const state = readPublishState(funnel.config);
  return {
    state,
    ctx: {
      funnelId,
      funnelName: graph.name || funnel.name,
      facility: {
        id: facility.id,
        name: facility.name,
        address: facility.google_address?.trim() || null,
        contactPhone: facility.contact_phone,
      },
      graph,
      results: { ...(state?.nodes ?? {}) },
      base: selfBaseUrl(),
    },
  };
}

export const publishCampaign: JobHandler = async (job) => {
  const { funnelId, runId, retry = [] } = (job.payload ?? {}) as Payload;
  if (!funnelId || !runId) return { kind: "done" };
  const loaded = await loadContext(funnelId);
  // Superseded by a newer run, or the campaign is gone: nothing left to do.
  if (!loaded || !loaded.state || loaded.state.runId !== runId) return { kind: "done" };
  const { ctx, state } = loaded;

  let i = Number((job.cursor as { i?: number } | null)?.i ?? 0);
  for (; i < state.order.length; i++) {
    const id = state.order[i];
    const node = ctx.graph.nodes.find((n) => n.id === id);
    if (!node) continue; // taken off the canvas since the run started
    const prior = ctx.results[id];
    if (prior && SETTLED.has(prior.state)) continue;
    const asked = retry.includes(id);
    if (prior?.state === "unknown" && !asked) continue;
    if (prior?.state === "running" && PLATFORM.has(node.type) && !asked) {
      const stopped: NodeResult = {
        ...prior,
        state: "unknown",
        line: `Publishing stopped part-way. Look in ${node.type === "meta" ? "Ads Manager" : "Google Ads"} before trying again.`,
        at: new Date().toISOString(),
      };
      ctx.results[id] = stopped;
      await writeNodeResult(funnelId, id, stopped);
      continue;
    }

    await writeNodeResult(funnelId, id, {
      ...(prior ?? {}),
      state: "running",
      line: RUNNING_LINE[node.type] ?? "Working…",
      at: new Date().toISOString(),
    });

    let res: NodeResult;
    try {
      res = await EXECUTORS[node.type](ctx, node, prior);
    } catch (e) {
      res = {
        state: "failed",
        line: "Something went wrong here. Try it again.",
        error: errorText(e, 500),
        at: new Date().toISOString(),
      };
    }
    if (!res.ref && prior?.ref) res = { ...res, ref: prior.ref };
    ctx.results[id] = res;
    await writeNodeResult(funnelId, id, res);

    if (i + 1 < state.order.length && job.shouldYield()) {
      return { kind: "more", cursor: { i: i + 1 }, progressDone: i + 1 };
    }
  }

  await finishRun(funnelId, runId);
  const pageLive = ctx.graph.nodes.some((n) => n.type === "page" && SETTLED.has(ctx.results[n.id]?.state));
  if (pageLive) {
    const funnel = await db.funnels.findUnique({ where: { id: funnelId }, select: { published_at: true } });
    await db.funnels.update({
      where: { id: funnelId },
      data: { status: "live", ...(funnel?.published_at ? {} : { published_at: new Date() }) },
    });
    await markGraphPublished(funnelId);
  }
  await db.activity_log
    .create({
      data: {
        type: "campaign_published",
        facility_id: ctx.facility.id,
        detail: `Published “${ctx.funnelName}”`,
        meta: { funnelId, runId },
      },
    })
    .catch(() => {});
  return { kind: "done", progressDone: state.order.length };
};

export function isStale(state: PublishState | null, at = Date.now()): boolean {
  if (!state || state.status !== "running") return false;
  const last = Math.max(
    Date.parse(state.startedAt) || 0,
    ...Object.values(state.nodes).map((r) => Date.parse(r.at) || 0),
  );
  return at - last > STALE_MS;
}

/**
 * Start (or retry) a publish. A run already in progress is joined, not
 * doubled. Returns the run id; the caller kicks the worker.
 */
export async function startPublish(
  funnelId: string,
  facilityId: string,
  retry: string[] = [],
): Promise<{ runId: string; joined: boolean } | null> {
  const loaded = await loadContext(funnelId);
  if (!loaded) return null;
  const { state, ctx } = loaded;
  if (state && state.status === "running" && !isStale(state)) return { runId: state.runId, joined: true };

  const runId = randomUUID();
  const order = publishOrder(ctx.graph);
  await beginRun(funnelId, { runId, status: "running", startedAt: new Date().toISOString(), order });
  await enqueue({
    queue: PUBLISH_QUEUE,
    payload: { funnelId, runId, retry },
    dedupeKey: `${funnelId}:${runId}`,
    tenantKey: facilityId,
    maxAttempts: 3,
    progressTotal: order.length,
  });
  return { runId, joined: false };
}
