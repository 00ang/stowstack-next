import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

/**
 * The two hourly crons that used to wake the database 24 times a day each —
 * process-pms-uploads and retry-diagnostic-audits — now run on the job queue,
 * queued by the request that creates their work. What matters: a job for work
 * that is already done does nothing, and a job for work that failed says so.
 */

vi.mock("@/lib/report-notify", () => ({ notifyClientsReportReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/run-diagnostic-audit", () => ({
  generateAuditInProcess: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/pms-import", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pms-import")>();
  return { ...actual, importParsed: vi.fn().mockResolvedValue({ type: "rent_roll", imported: 2 }) };
});

import { notifyClientsReportReady } from "@/lib/report-notify";
import { generateAuditInProcess } from "@/lib/run-diagnostic-audit";

const mockDb = vi.mocked(db, true);
const CLEAN_RENT_ROLL = "unit,tenant,rent\nA1,Jane,100\nA2,Bob,120\n";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => CLEAN_RENT_ROLL }));
});

afterEach(() => vi.unstubAllGlobals());

describe("PMS report processing", () => {
  const waiting = { id: "r1", facility_id: "f1", file_url: "https://blob/x.csv", report_type: "rent_roll", mime_type: "text/csv" };

  it("does nothing for a report the inline upload path already handled", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.pms_reports = { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() };
    const { processUploadedReport } = await import("@/lib/pms-uploads");
    expect(await processUploadedReport("r1", "queue:test")).toBeNull();
    // @ts-expect-error — db is a vi mock
    expect(mockDb.pms_reports.update).not.toHaveBeenCalled();
  });

  it("processes a waiting report, records who did it, and tells the client", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.pms_reports = { findFirst: vi.fn().mockResolvedValue(waiting), update: vi.fn().mockResolvedValue({}) };
    const { processUploadedReport } = await import("@/lib/pms-uploads");
    const out = await processUploadedReport("r1", "queue:test");
    expect(out?.status).toBe("processed");
    // @ts-expect-error — db is a vi mock
    expect(mockDb.pms_reports.update.mock.calls[0][0].data).toMatchObject({ status: "processed", processed_by: "queue:test" });
    expect(notifyClientsReportReady).toHaveBeenCalledWith("f1");
  });

  it("only ever picks up reports still marked uploaded", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    // @ts-expect-error — db is a vi mock
    mockDb.pms_reports = { findFirst, update: vi.fn() };
    const { processUploadedReport } = await import("@/lib/pms-uploads");
    await processUploadedReport("r1", "queue:test");
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "r1", status: "uploaded" });
  });

  it("a portal upload's job waits out the inline parse instead of racing it", async () => {
    vi.resetModules();
    const enqueued: { runAfter?: Date; queue: string; payload?: unknown }[] = [];
    vi.doMock("@/lib/jobs/queue", () => ({ enqueue: async (i: (typeof enqueued)[number]) => { enqueued.push(i); return "j"; } }));
    const { scheduleReportProcessing, AFTER_PORTAL_UPLOAD_MS } = await import("@/lib/pms-uploads");
    const before = Date.now();
    await scheduleReportProcessing("r9", { facilityId: "f1", delayMs: AFTER_PORTAL_UPLOAD_MS });
    expect(enqueued[0]).toMatchObject({ queue: "pms.process-upload", payload: { reportId: "r9" } });
    expect(enqueued[0].runAfter!.getTime()).toBeGreaterThanOrEqual(before + AFTER_PORTAL_UPLOAD_MS);
    vi.doUnmock("@/lib/jobs/queue");
  });
});

describe("diagnostic audit retry", () => {
  const stuckFacility = { id: "fac1", notes: JSON.stringify({ diagnosticJson: { facilityName: "X" } }) };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    // @ts-expect-error — db is a vi mock
    mockDb.activity_log = { create: vi.fn().mockResolvedValue({}) };
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("finds nothing for a facility whose audit arrived — the common case", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany: vi.fn().mockResolvedValue([]) };
    const { retryStuckDiagnostics } = await import("@/lib/diagnostic-retry");
    expect(await retryStuckDiagnostics({ facilityId: "fac1" })).toMatchObject({ stuck: 0, retried: 0, failed: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries generation for a stuck facility", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany: vi.fn().mockResolvedValue([stuckFacility]) };
    const { retryStuckDiagnostics } = await import("@/lib/diagnostic-retry");
    expect(await retryStuckDiagnostics({ facilityId: "fac1" })).toMatchObject({ stuck: 1, retried: 1 });
    expect(generateAuditInProcess).toHaveBeenCalledWith("fac1", { facilityName: "X" });
  });

  it("the queued check throws on a failed retry, so the queue backs off and tries again", async () => {
    vi.mocked(generateAuditInProcess).mockRejectedValueOnce(new Error("generation down"));
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany: vi.fn().mockResolvedValue([stuckFacility]) };
    const { HANDLERS } = await import("@/lib/jobs/handlers");
    const ctx = { id: "j", payload: { facilityId: "fac1" }, cursor: null, attempt: 1, shouldYield: () => false };
    await expect(HANDLERS["audits.retry-diagnostic"](ctx)).rejects.toThrow(/fac1/);
  });

  it("a facility with no stored answers is skipped, not retried forever", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany: vi.fn().mockResolvedValue([{ id: "fac2", notes: "not json" }]) };
    const { HANDLERS } = await import("@/lib/jobs/handlers");
    const ctx = { id: "j", payload: { facilityId: "fac2" }, cursor: null, attempt: 1, shouldYield: () => false };
    await expect(HANDLERS["audits.retry-diagnostic"](ctx)).resolves.toMatchObject({ kind: "done" });
  });

  it("the sweep leaves young submissions to their own queued check", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany };
    const { HANDLERS } = await import("@/lib/jobs/handlers");
    const { SWEEP_AFTER_MINUTES } = await import("@/lib/diagnostic-retry");
    const before = Date.now();
    await HANDLERS["audits.retry-diagnostic"]({ id: "j", payload: {}, cursor: null, attempt: 1, shouldYield: () => false });
    const cutoff = findMany.mock.calls[0][0].where.created_at.lt.getTime();
    expect(cutoff).toBeLessThanOrEqual(before - SWEEP_AFTER_MINUTES * 60_000 + 1_000);
  });

  it("never auto-retries a submission older than the cap — that prospect gets a person, not a weeks-late email", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    // @ts-expect-error — db is a vi mock
    mockDb.facilities = { findMany };
    const { retryStuckDiagnostics, AUTO_RETRY_MAX_HOURS } = await import("@/lib/diagnostic-retry");
    const before = Date.now();
    await retryStuckDiagnostics();
    const floor = findMany.mock.calls[0][0].where.created_at.gt.getTime();
    expect(floor).toBeGreaterThanOrEqual(before - AUTO_RETRY_MAX_HOURS * 3_600_000 - 1_000);
    expect(floor).toBeLessThanOrEqual(Date.now() - AUTO_RETRY_MAX_HOURS * 3_600_000 + 1_000);
  });

  it("an intake's check is booked for just after it would count as stuck", async () => {
    vi.resetModules();
    const enqueued: { runAfter?: Date; dedupeKey?: string }[] = [];
    vi.doMock("@/lib/jobs/queue", () => ({ enqueue: async (i: (typeof enqueued)[number]) => { enqueued.push(i); return "j"; } }));
    const { scheduleDiagnosticRetry, STUCK_AFTER_MINUTES } = await import("@/lib/diagnostic-retry");
    const before = Date.now();
    await scheduleDiagnosticRetry("fac3");
    expect(enqueued[0].dedupeKey).toBe("diag:fac3");
    expect(enqueued[0].runAfter!.getTime()).toBeGreaterThan(before + STUCK_AFTER_MINUTES * 60_000);
    vi.doUnmock("@/lib/jobs/queue");
  });
});
