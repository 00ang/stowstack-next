import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Redis } from "@upstash/redis";
import { MAX_SLEEP_MS, RETRY_MS, alarmAt, rearm, ringAt, setAlarmClient } from "@/lib/jobs/alarm";

/** Just enough of Upstash for the alarm: one sorted set, ZADD with and without LT. */
class FakeRedis {
  scores = new Map<string, number>();
  failing = false;

  async zadd(key: string, a: unknown, b?: unknown): Promise<number> {
    if (this.failing) throw new Error("redis down");
    const opts = (b === undefined ? {} : a) as { lt?: boolean };
    const { score } = (b === undefined ? a : b) as { score: number };
    const current = this.scores.get(key);
    if (opts.lt && current !== undefined && score >= current) return 0;
    this.scores.set(key, score);
    return 1;
  }

  async zscore(key: string): Promise<number | null> {
    if (this.failing) throw new Error("redis down");
    return this.scores.get(key) ?? null;
  }
}

let redis: FakeRedis;

beforeEach(() => {
  redis = new FakeRedis();
  setAlarmClient(redis as unknown as Redis);
});

afterEach(() => setAlarmClient(undefined));

describe("the alarm", () => {
  it("is unknown before anything arms it — which means wake", async () => {
    expect(await alarmAt()).toBeNull();
  });

  it("is unknown without Redis at all, so the worker behaves as it always did", async () => {
    setAlarmClient(null);
    await ringAt(5_000);
    expect(await alarmAt()).toBeNull();
  });

  it("a ring only ever moves it earlier", async () => {
    await ringAt(10_000);
    await ringAt(20_000);
    expect(await alarmAt()).toBe(10_000);
    await ringAt(5_000);
    expect(await alarmAt()).toBe(5_000);
  });

  it("a failing Redis reads as unknown and never throws into a request", async () => {
    redis.failing = true;
    await expect(ringAt(1_000)).resolves.toBeUndefined();
    expect(await alarmAt()).toBeNull();
  });
});

describe("rearm", () => {
  const now = 1_000_000;

  it("sets the alarm to the next due job", async () => {
    await rearm(async () => new Date(now + 90_000), now);
    expect(await alarmAt()).toBe(now + 90_000);
  });

  it("can move the alarm later than it was — the one write allowed to", async () => {
    await ringAt(now - 60_000); // the alarm that woke this pass
    await rearm(async () => new Date(now + 3_600_000), now);
    expect(await alarmAt()).toBe(now + 3_600_000);
  });

  it("an empty queue still looks again within MAX_SLEEP_MS", async () => {
    await rearm(async () => null, now);
    expect(await alarmAt()).toBe(now + MAX_SLEEP_MS);
  });

  it("caps a far-future job at MAX_SLEEP_MS too", async () => {
    await rearm(async () => new Date(now + 30 * 24 * 3_600_000), now);
    expect(await alarmAt()).toBe(now + MAX_SLEEP_MS);
  });

  // The race the three steps exist for: a request enqueues while the worker is
  // between reading Postgres and setting the alarm. Its row is not in the read,
  // so only its ring can save it — and the ring must survive the worker's write.
  it("does not lose a job enqueued while it was re-arming", async () => {
    await ringAt(now - 60_000);
    await rearm(async () => {
      await ringAt(now + 30_000); // the concurrent enqueue, after the read
      return new Date(now + 3_600_000); // what the read saw
    }, now);
    expect(await alarmAt()).toBe(now + 30_000);
  });

  it("backs off to RETRY_MS when Postgres cannot answer, instead of every minute", async () => {
    await ringAt(now - 60_000);
    await rearm(async () => {
      throw new Error("Can't reach database server");
    }, now);
    expect(await alarmAt()).toBe(now + RETRY_MS);
  });
});

describe("enqueue rings the alarm", () => {
  it("for a job it created, at the job's own time", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([{ id: "j1" }] as never);
    const { enqueue } = await import("@/lib/jobs/queue");
    const at = new Date(2_000_000);
    expect(await enqueue({ queue: "q", runAfter: at })).toBe("j1");
    expect(await alarmAt()).toBe(2_000_000);
  });

  it("not for a duplicate — the original rang when it was created", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([] as never);
    const { enqueue } = await import("@/lib/jobs/queue");
    expect(await enqueue({ queue: "q", dedupeKey: "k", runAfter: new Date(2_000_000) })).toBeNull();
    expect(await alarmAt()).toBeNull();
  });
});

describe("the worker", () => {
  const request = () =>
    new Request("https://storageads.com/api/cron/jobs", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

  async function loadWorker(alarm: number | null) {
    vi.resetModules();
    const passes: string[] = [];
    const rearmed: unknown[] = [];
    vi.doMock("@/lib/jobs/alarm", () => ({
      alarmAt: async () => alarm,
      rearm: async (fn: unknown) => { rearmed.push(fn); },
    }));
    vi.doMock("@/lib/jobs/schedule", () => ({
      ensureScheduled: async () => { passes.push("schedule"); return 0; },
    }));
    vi.doMock("@/lib/jobs/runner", () => ({
      runJobs: async () => { passes.push("run"); return { claimed: 0 }; },
    }));
    const { GET } = await import("@/app/api/cron/jobs/route");
    return { GET, passes, rearmed };
  }

  afterEach(() => {
    vi.doUnmock("@/lib/jobs/alarm");
    vi.doUnmock("@/lib/jobs/schedule");
    vi.doUnmock("@/lib/jobs/runner");
  });

  it("does not touch Postgres when the alarm is in the future", async () => {
    const { GET, passes, rearmed } = await loadWorker(Date.now() + 60_000);
    const res = await GET(request() as never);
    expect((await res.json()).idle).toBe(true);
    expect(passes).toEqual([]);
    expect(rearmed).toEqual([]);
  });

  it("runs a pass and re-arms when the alarm has gone off", async () => {
    const { GET, passes, rearmed } = await loadWorker(Date.now() - 1);
    await GET(request() as never);
    expect(passes).toEqual(["schedule", "run"]);
    expect(rearmed).toHaveLength(1);
  });

  it("runs a pass when the alarm is unknown — a missed job costs more than an idle query", async () => {
    const { GET, passes } = await loadWorker(null);
    await GET(request() as never);
    expect(passes).toEqual(["schedule", "run"]);
  });
});
