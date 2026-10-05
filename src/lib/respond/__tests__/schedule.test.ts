import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The follow-ups each fact schedules for itself, replacing sweeps that ran on a
 * clock every few minutes. What matters is WHEN each job lands: early and the
 * sweep it triggers finds nothing, which is a lost message.
 */

type Enqueued = { queue: string; dedupeKey?: string; runAfter?: Date; payload?: unknown };
let enqueued: Enqueued[];

beforeEach(() => {
  vi.resetModules();
  enqueued = [];
  vi.doMock("@/lib/jobs/queue", () => ({
    enqueue: async (input: Enqueued) => {
      enqueued.push(input);
      return `job-${enqueued.length}`;
    },
  }));
});

afterEach(() => vi.doUnmock("@/lib/jobs/queue"));

const MIN = 60_000;
const at = (q: string, prefix: string) =>
  enqueued.find((e) => e.queue === q && e.dedupeKey?.startsWith(prefix))?.runAfter?.getTime();

describe("tour follow-ups", () => {
  const now = Date.parse("2026-09-23T15:00:00Z");

  it("a tour days out gets both reminders and the no-show check, each at its moment", async () => {
    const { scheduleTourFollowUps, NO_SHOW_GRACE_MINUTES } = await import("@/lib/respond/tour");
    const when = new Date(now + 3 * 24 * 60 * MIN);
    expect(await scheduleTourFollowUps({ id: "t1", facilityId: "f1", scheduledAt: when }, now)).toBe(3);
    expect(at("respond.tour-reminders", "tour24:")).toBe(when.getTime() - 24 * 60 * MIN);
    expect(at("respond.tour-reminders", "tour1:")).toBe(when.getTime() - 60 * MIN);
    // Strictly past the grace, because the no-show sweep tests "older than".
    expect(at("respond.tour-noshow", "tourno:")).toBeGreaterThan(when.getTime() + NO_SHOW_GRACE_MINUTES * MIN);
  });

  it("each reminder runs when the sweep's window would contain the tour", async () => {
    const { scheduleTourFollowUps, SWEEP_WINDOW_MINUTES } = await import("@/lib/respond/tour");
    const when = new Date(now + 3 * 24 * 60 * MIN);
    await scheduleTourFollowUps({ id: "t1", facilityId: "f1", scheduledAt: when }, now);
    for (const [prefix, ahead] of [["tour24:", 24 * 60], ["tour1:", 60]] as const) {
      const fire = at("respond.tour-reminders", prefix)!;
      // dueForReminder: scheduled_at BETWEEN now + ahead - window AND now + ahead
      expect(when.getTime()).toBeLessThanOrEqual(fire + ahead * MIN);
      expect(when.getTime()).toBeGreaterThanOrEqual(fire + (ahead - SWEEP_WINDOW_MINUTES) * MIN);
    }
  });

  it("booked 50 minutes out: no day-before reminder, the hour-before one right away", async () => {
    const { scheduleTourFollowUps } = await import("@/lib/respond/tour");
    const when = new Date(now + 50 * MIN);
    await scheduleTourFollowUps({ id: "t2", facilityId: "f1", scheduledAt: when }, now);
    expect(at("respond.tour-reminders", "tour24:")).toBeUndefined();
    // Inside the hour-before window already — which the old 5-minute sweep would
    // also have caught — so it goes now rather than being dropped.
    expect(at("respond.tour-reminders", "tour1:")).toBe(now);
    expect(at("respond.tour-noshow", "tourno:")).toBeGreaterThan(when.getTime());
  });

  it("a reschedule is a new time and gets new jobs; a replay of the same one does not", async () => {
    const { scheduleTourFollowUps } = await import("@/lib/respond/tour");
    const first = new Date(now + 3 * 24 * 60 * MIN);
    const moved = new Date(first.getTime() + 2 * 60 * MIN);
    await scheduleTourFollowUps({ id: "t3", facilityId: "f1", scheduledAt: first }, now);
    await scheduleTourFollowUps({ id: "t3", facilityId: "f1", scheduledAt: first }, now);
    await scheduleTourFollowUps({ id: "t3", facilityId: "f1", scheduledAt: moved }, now);
    const keys = new Set(enqueued.map((e) => e.dedupeKey));
    expect(keys.size).toBe(6); // the replay collides on its keys; the move does not
  });
});

describe("abandoned-rental rescue", () => {
  it("is booked for just after the window opens, measured from the lead's own creation", async () => {
    const { scheduleRescue, RESCUE_AFTER_MINUTES } = await import("@/lib/respond/abandoned");
    const createdAt = new Date(Date.now() - 2 * MIN);
    await scheduleRescue({ id: "pl1", createdAt });
    const fire = enqueued[0].runAfter!.getTime();
    expect(enqueued[0]).toMatchObject({ queue: "respond.abandoned-rescue", dedupeKey: "rescue:pl1" });
    expect(fire).toBeGreaterThan(createdAt.getTime() + RESCUE_AFTER_MINUTES * MIN);
    expect(fire).toBeLessThanOrEqual(createdAt.getTime() + (RESCUE_AFTER_MINUTES + 1) * MIN);
  });

  it("runs now for a lead whose window is already open — a phone added late", async () => {
    const { scheduleRescue } = await import("@/lib/respond/abandoned");
    const before = Date.now();
    await scheduleRescue({ id: "pl2", createdAt: new Date(before - 30 * MIN) });
    expect(enqueued[0].runAfter!.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("speed-to-lead check", () => {
  it("runs the unanswered-leads sweep, not a single-lead resend", async () => {
    const { scheduleSpeedCheck, CHECK_AFTER_MINUTES } = await import("@/lib/respond/speed-to-lead");
    const before = Date.now();
    await scheduleSpeedCheck("lead1", "f1");
    expect(enqueued[0]).toMatchObject({ queue: "respond.speed-to-lead", dedupeKey: "speedcheck:lead1" });
    expect(enqueued[0].payload).toBeUndefined();
    expect(enqueued[0].runAfter!.getTime()).toBeGreaterThanOrEqual(before + CHECK_AFTER_MINUTES * MIN);
  });
});

describe("PMS detection", () => {
  it("an upload asks for both detectors, for its facility only", async () => {
    const { scheduleDetection } = await import("@/lib/events/detect");
    await scheduleDetection("fac-9");
    expect(enqueued.map((e) => [e.queue, e.payload])).toEqual([
      ["pms.detect-inventory", { facilityId: "fac-9" }],
      ["pms.detect-events", { facilityId: "fac-9" }],
    ]);
  });
});
