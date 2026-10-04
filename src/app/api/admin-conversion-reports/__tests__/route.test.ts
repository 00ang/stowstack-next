import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createAdminRequest, createMockRequest } from "@/test/helpers";

vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn().mockResolvedValue("job-1") }));

import { GET, POST } from "../route";
import { enqueue } from "@/lib/jobs/queue";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const R1 = "66666666-6666-6666-6666-666666666661";
const R2 = "66666666-6666-6666-6666-666666666662";
const LEAD = "11111111-1111-1111-1111-111111111111";
const TENANT = "22222222-2222-2222-2222-222222222222";
const FAC = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.conversion_reports = {
    findMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([{ status: "sent", _count: { _all: 4 } }, { status: "skipped", _count: { _all: 2 } }]),
  };
});

describe("GET /api/admin-conversion-reports", () => {
  it("requires the admin key", async () => {
    expect((await GET(createMockRequest("/api/admin-conversion-reports"))).status).toBe(401);
  });

  it("defaults to what needs a person: failures and fixable skips only", async () => {
    const res = await GET(createAdminRequest("/api/admin-conversion-reports"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ counts: { sent: 4, skipped: 2 }, reports: [] });
    const where = mockDb.conversion_reports.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { status: "failed" },
      { status: "skipped", reason: { in: ["not_configured", "no_conversion_action"] } },
    ]);
  });

  it("filters by status and facility", async () => {
    await GET(createAdminRequest(`/api/admin-conversion-reports?status=sent&facilityId=${FAC}`));
    expect(mockDb.conversion_reports.findMany.mock.calls[0][0].where).toEqual({ status: "sent", facility_id: FAC });
  });
});

describe("POST /api/admin-conversion-reports — retry", () => {
  beforeEach(() => {
    mockDb.conversion_reports.findMany.mockResolvedValue([
      { id: R1, platform: "google", status: "skipped", partial_lead_id: LEAD, tenant_id: TENANT, facility_id: FAC },
      { id: R2, platform: "meta", status: "sent", partial_lead_id: LEAD, tenant_id: TENANT, facility_id: FAC },
    ]);
  });

  it("re-queues unsent reports on their platform's queue and never re-sends a sent one", async () => {
    const res = await POST(createAdminRequest("/api/admin-conversion-reports", {
      method: "POST", body: { action: "retry", reportIds: [R1, R2] },
    }));
    expect(await res.json()).toEqual({ queued: 1, skipped: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enqueue).mock.calls[0][0]).toMatchObject({
      queue: "prove.google-conversion",
      payload: { leadId: LEAD, tenantId: TENANT, facilityId: FAC },
      tenantKey: FAC,
    });
    expect(vi.mocked(enqueue).mock.calls[0][0].dedupeKey).toMatch(new RegExp(`^retry:${R1}:\\d+$`));
  });

  it("rejects an unknown action or an empty list", async () => {
    expect((await POST(createAdminRequest("/api/admin-conversion-reports", { method: "POST", body: { action: "delete", reportIds: [R1] } }))).status).toBe(400);
    expect((await POST(createAdminRequest("/api/admin-conversion-reports", { method: "POST", body: { action: "retry", reportIds: ["nope"] } }))).status).toBe(400);
  });
});
