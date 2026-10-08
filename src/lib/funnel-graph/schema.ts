import { z } from "zod";
import { NODE_TYPES } from "./types";
import type { FunnelGraph } from "./types";

const paramValue = z.union([z.string(), z.array(z.string())]);

export const funnelGraphSchema = z.object({
  version: z.literal(1),
  name: z.string().nullable(),
  status: z.enum(["draft", "published"]),
  goal: z
    .object({
      moveIns: z.number().int().positive(),
      month: z.string().min(1),
    })
    .nullable(),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(NODE_TYPES),
      x: z.number(),
      y: z.number(),
      params: z.record(z.string(), paramValue),
      slug: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      from: z.string().min(1),
      fromPort: z.number().int().nonnegative(),
      to: z.string().min(1),
      toPort: z.number().int().nonnegative(),
    }),
  ),
});

export type FunnelGraphInput = z.infer<typeof funnelGraphSchema>;

/** Pull `config.graph` out of a funnel config blob. Null when it isn't a graph. */
export function readGraph(config: unknown): FunnelGraph | null {
  if (!config || typeof config !== "object") return null;
  const graph = (config as { graph?: unknown }).graph;
  const parsed = funnelGraphSchema.safeParse(graph);
  return parsed.success ? parsed.data : null;
}

export function writeGraph(config: unknown, graph: FunnelGraph): Record<string, unknown> {
  const base = config && typeof config === "object" && !Array.isArray(config) ? { ...(config as Record<string, unknown>) } : {};
  return { ...base, graph };
}
