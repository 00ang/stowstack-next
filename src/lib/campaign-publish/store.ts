import { db } from "@/lib/db";
import type { NodeResult, PublishState } from "./types";

/**
 * Publish state lives on `funnels.config.publish`, beside `config.graph`.
 *
 * Every write here is a single UPDATE that merges into the JSON in place, never
 * a read-modify-write: the canvas saves `config.graph` while a run is writing
 * results, and a read-modify-write on either side would drop the other's change.
 */

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function readPublishState(config: unknown): PublishState | null {
  const p = asObject(asObject(config).publish);
  if (typeof p.runId !== "string" || !Array.isArray(p.order)) return null;
  return {
    runId: p.runId,
    status: p.status === "finished" ? "finished" : "running",
    startedAt: String(p.startedAt ?? ""),
    finishedAt: typeof p.finishedAt === "string" ? p.finishedAt : undefined,
    order: (p.order as unknown[]).filter((x): x is string => typeof x === "string"),
    nodes: asObject(p.nodes) as Record<string, NodeResult>,
    current: typeof p.current === "string" ? p.current : null,
  };
}

export async function loadPublishState(funnelId: string): Promise<PublishState | null> {
  const row = await db.funnels.findUnique({ where: { id: funnelId }, select: { config: true } });
  return row ? readPublishState(row.config) : null;
}

/** Start a run: a fresh run id and order, keeping every result already known. */
export async function beginRun(funnelId: string, state: Omit<PublishState, "nodes">): Promise<void> {
  const head = JSON.stringify({
    runId: state.runId,
    status: state.status,
    startedAt: state.startedAt,
    order: state.order,
    current: null,
  });
  await db.$executeRaw`
    UPDATE funnels
    SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
          'publish',
          (coalesce(config->'publish', '{}'::jsonb) - 'finishedAt')
            || ${head}::jsonb
            || jsonb_build_object('nodes', coalesce(config->'publish'->'nodes', '{}'::jsonb))
        ),
        updated_at = now()
    WHERE id = ${funnelId}::uuid
  `;
}

/** Record one function's result, and which function the run is on. */
export async function writeNodeResult(funnelId: string, nodeId: string, result: NodeResult): Promise<void> {
  await db.$executeRaw`
    UPDATE funnels
    SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
          'publish',
          coalesce(config->'publish', '{}'::jsonb)
            || jsonb_build_object(
                 'current', ${result.state === "running" ? nodeId : null}::text,
                 'nodes', coalesce(config->'publish'->'nodes', '{}'::jsonb)
                   || jsonb_build_object(${nodeId}::text, ${JSON.stringify(result)}::jsonb)
               )
        ),
        updated_at = now()
    WHERE id = ${funnelId}::uuid
  `;
}

export async function finishRun(funnelId: string, runId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE funnels
    SET config = jsonb_set(
          config,
          '{publish}',
          (config->'publish') || jsonb_build_object('status', 'finished', 'finishedAt', ${new Date().toISOString()}::text, 'current', null)
        ),
        updated_at = now()
    WHERE id = ${funnelId}::uuid AND config->'publish'->>'runId' = ${runId}
  `;
}

/** Mark the campaign's graph published without touching the rest of its config. */
export async function markGraphPublished(funnelId: string): Promise<void> {
  await db.$executeRaw`
    UPDATE funnels
    SET config = CASE WHEN config ? 'graph'
                      THEN jsonb_set(config, '{graph,status}', '"published"'::jsonb)
                      ELSE config END,
        updated_at = now()
    WHERE id = ${funnelId}::uuid
  `;
}

/** Save the canvas without disturbing a run's results. */
export async function writeGraph(funnelId: string, graph: unknown): Promise<void> {
  await db.$executeRaw`
    UPDATE funnels
    SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object('graph', ${JSON.stringify(graph)}::jsonb),
        updated_at = now()
    WHERE id = ${funnelId}::uuid
  `;
}

/** A campaign-level setting the publish writes (alert phone, and so on). */
export async function writeSetting(funnelId: string, key: string, value: string): Promise<void> {
  await db.$executeRaw`
    UPDATE funnels
    SET config = coalesce(config, '{}'::jsonb) || jsonb_build_object(${key}::text, ${value}::text),
        updated_at = now()
    WHERE id = ${funnelId}::uuid
  `;
}
