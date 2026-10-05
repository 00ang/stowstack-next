import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminRequest, createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    activity_log: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { GET } from "../route";

const findMany = (db as unknown as {
  activity_log: { findMany: ReturnType<typeof vi.fn> };
}).activity_log.findMany;

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
});

describe("GET /api/activity-log", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await GET(createMockRequest("/api/activity-log"));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns presented rows the admin UI can render", async () => {
    findMany.mockResolvedValue([
      {
        id: "evt-1",
        type: "lead_created",
        lead_name: "Pat",
        facility_name: "North Gate",
        detail: "New lead from North Gate",
        created_at: new Date("2026-10-05T15:00:00.000Z"),
      },
    ]);

    const res = await GET(createAdminRequest("/api/activity-log"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logs[0]).toMatchObject({
      id: "evt-1",
      timestamp: "2026-10-05T15:00:00.000Z",
      type: "lead_created",
      category: "leads",
      description: "New lead from North Gate",
      actor: "Pat",
      facility: "North Gate",
    });
  });

  it("hides cron noise by default and honours type/offset", async () => {
    await GET(createAdminRequest("/api/activity-log?type=leads&offset=50&limit=25"));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 25,
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
      })
    );

    findMany.mockClear();
    await GET(createAdminRequest("/api/activity-log"));
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        NOT: { type: { startsWith: "cron_" } },
      })
    );
  });
});
