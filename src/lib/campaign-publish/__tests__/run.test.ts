import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { buildTemplate, writeGraph } from "@/lib/funnel-graph";
import type { JobContext } from "@/lib/jobs/types";

const executed: string[] = [];
vi.mock("../nodes", async () => {
  const { NODE_TYPES } = await import("@/lib/funnel-graph");
  const exec = (type: string) => async (_ctx: unknown, node: { id: string }) => {
    executed.push(node.id);
    if (type === "meta") return { state: "paused", line: "Made, paused.", ref: { campaignId: "c1" }, at: "t" };
    if (type === "google") return { state: "needs", line: "Connect Google Ads.", at: "t" };
    if (type === "write") throw new Error("model down");
    return { state: "done", line: `${type} done`, at: "t" };
  };
  return { EXECUTORS: Object.fromEntries(NODE_TYPES.map((t) => [t, exec(t)])) };
});
vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn().mockResolvedValue("job-1") }));

import { publishCampaign, startPublish, isStale } from "../run";
import { enqueue } from "@/lib/jobs/queue";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
  $executeRaw: ReturnType<typeof vi.fn>;
};
const FUNNEL = "11111111-1111-1111-1111-111111111111";
const graph = buildTemplate("lease");

function funnelWith(publish: unknown) {
  return { id: FUNNEL, name: "Lease-up", facility_id: "fac-1", config: { ...writeGraph({}, graph), publish }, published_at: null };
}

function job(payload: unknown, cursor: unknown = null, yieldAfter = Infinity): JobContext {
  let calls = 0;
  return { id: "job-1", payload, cursor, attempt: 1, shouldYield: () => ++calls > yieldAfter };
}

/** The node results written, by node id, last write wins. */
function written(): Record<string, { state: string; line: string }> {
  const out: Record<string, { state: string; line: string }> = {};
  for (const call of mockDb.$executeRaw.mock.calls) {
    const values = call.slice(1) as unknown[];
    const json = values.find((v) => typeof v === "string" && v.startsWith('{"state"')) as string | undefined;
    const nodeId = values.find((v) => typeof v === "string" && graph.nodes.some((n) => n.id === v)) as string | undefined;
    if (json && nodeId) out[nodeId] = JSON.parse(json);
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  executed.length = 0;
  mockDb.facilities = {
    findUnique: vi.fn().mockResolvedValue({ id: "fac-1", name: "Maple", google_address: "1 Main St, Springfield, IL", contact_phone: null }),
  };
  mockDb.activity_log = { create: vi.fn().mockResolvedValue({}) };
});

describe("a publish run", () => {
  it("publishes every function, records a failure without stopping, and puts the campaign live", async () => {
    const order = graph.nodes.map((n) => n.id);
    mockDb.funnels = {
      findUnique: vi.fn().mockResolvedValue(funnelWith({ runId: "r1", status: "running", startedAt: "x", order, nodes: {} })),
      update: vi.fn().mockResolvedValue({}),
    };
    const res = await publishCampaign(job({ funnelId: FUNNEL, runId: "r1" }));
    expect(res).toEqual({ kind: "done", progressDone: order.length });
    expect(executed).toHaveLength(order.length);
    const out = written();
    const write = graph.nodes.find((n) => n.type === "write")!.id;
    expect(out[write]).toMatchObject({ state: "failed" });
    const meta = graph.nodes.find((n) => n.type === "meta")!.id;
    expect(out[meta]).toMatchObject({ state: "paused" });
    expect(mockDb.funnels.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "live" }) }));
  });

  it("leaves live functions alone and never retries an unknown one unless asked", async () => {
    const meta = graph.nodes.find((n) => n.type === "meta")!.id;
    const google = graph.nodes.find((n) => n.type === "google")!.id;
    const page = graph.nodes.find((n) => n.type === "page")!.id;
    const nodes = {
      [page]: { state: "done", line: "Live", at: "t" },
      [meta]: { state: "unknown", line: "Check Ads Manager", ref: { campaignId: "c1" }, at: "t" },
    };
    mockDb.funnels = {
      findUnique: vi.fn().mockResolvedValue(funnelWith({ runId: "r2", status: "running", startedAt: "x", order: [page, meta, google], nodes })),
      update: vi.fn().mockResolvedValue({}),
    };
    await publishCampaign(job({ funnelId: FUNNEL, runId: "r2" }));
    expect(executed).toEqual([google]);

    executed.length = 0;
    await publishCampaign(job({ funnelId: FUNNEL, runId: "r2", retry: [meta] }));
    expect(executed).toEqual([meta, google]);
  });

  it("turns a platform call that was in flight when the worker died into unknown, not a second campaign", async () => {
    const meta = graph.nodes.find((n) => n.type === "meta")!.id;
    mockDb.funnels = {
      findUnique: vi.fn().mockResolvedValue(
        funnelWith({ runId: "r3", status: "running", startedAt: "x", order: [meta], nodes: { [meta]: { state: "running", line: "…", at: "t" } } }),
      ),
      update: vi.fn().mockResolvedValue({}),
    };
    await publishCampaign(job({ funnelId: FUNNEL, runId: "r3" }));
    expect(executed).toEqual([]);
    expect(written()[meta]).toMatchObject({ state: "unknown" });
  });

  it("yields between functions when time is short, and resumes from the next one", async () => {
    const order = graph.nodes.map((n) => n.id);
    mockDb.funnels = {
      findUnique: vi.fn().mockResolvedValue(funnelWith({ runId: "r4", status: "running", startedAt: "x", order, nodes: {} })),
      update: vi.fn().mockResolvedValue({}),
    };
    const first = await publishCampaign(job({ funnelId: FUNNEL, runId: "r4" }, null, 1));
    expect(first).toMatchObject({ kind: "more", cursor: { i: 2 } });
    executed.length = 0;
    await publishCampaign(job({ funnelId: FUNNEL, runId: "r4" }, { i: 2 }));
    expect(executed).toEqual(order.slice(2));
  });

  it("stops quietly when a newer run has replaced it", async () => {
    mockDb.funnels = {
      findUnique: vi.fn().mockResolvedValue(funnelWith({ runId: "newer", status: "running", startedAt: "x", order: [], nodes: {} })),
    };
    expect(await publishCampaign(job({ funnelId: FUNNEL, runId: "old" }))).toEqual({ kind: "done" });
    expect(executed).toEqual([]);
  });
});

describe("starting a publish", () => {
  it("joins a run already going instead of starting a second", async () => {
    mockDb.funnels = {
      findUnique: vi
        .fn()
        .mockResolvedValue(funnelWith({ runId: "r5", status: "running", startedAt: new Date().toISOString(), order: [], nodes: {} })),
    };
    expect(await startPublish(FUNNEL, "fac-1")).toEqual({ runId: "r5", joined: true });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues one job per run, deduplicated on the run", async () => {
    mockDb.funnels = { findUnique: vi.fn().mockResolvedValue(funnelWith(undefined)) };
    const run = await startPublish(FUNNEL, "fac-1", ["n1"]);
    expect(run?.joined).toBe(false);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        queue: "campaign.publish",
        dedupeKey: `${FUNNEL}:${run?.runId}`,
        payload: { funnelId: FUNNEL, runId: run?.runId, retry: ["n1"] },
        tenantKey: "fac-1",
      }),
    );
  });

  it("treats a run that has gone quiet for 20 minutes as over", () => {
    const old = new Date(Date.now() - 21 * 60_000).toISOString();
    expect(isStale({ runId: "r", status: "running", startedAt: old, order: [], nodes: {} })).toBe(true);
    expect(isStale({ runId: "r", status: "running", startedAt: new Date().toISOString(), order: [], nodes: {} })).toBe(false);
  });
});
