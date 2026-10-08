import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";
import { PATCH } from "../route";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function patch(body: Record<string, unknown>) {
  return PATCH(createMockRequest("/api/client-data", { method: "PATCH", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.portal_login_codes = { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() };
  mockDb.clients = {
    findUnique: vi.fn().mockResolvedValue({ id: "client-1", email: "owner@example.com" }),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  };
  mockDb.client_goals = { upsert: vi.fn().mockResolvedValue({}) };
});

describe("PATCH /api/client-data monthlyGoal", () => {
  it("makes the goal this month's target as well as the default", async () => {
    const res = await patch({ email: "owner@example.com", accessCode: "LEGACYCODE1", monthlyGoal: 12 });
    expect(res.status).toBe(200);
    expect(mockDb.clients.update.mock.calls[0][0].data).toEqual({ monthly_goal: 12 });
    const call = mockDb.client_goals.upsert.mock.calls[0][0];
    const now = new Date();
    expect(call.where.client_id_period_month.client_id).toBe("client-1");
    expect(call.where.client_id_period_month.period_month.toISOString()).toBe(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(),
    );
    expect(call.update).toEqual({ target: 12 });
    expect(call.create.target).toBe(12);
  });

  it("leaves the month alone when only notification settings change", async () => {
    const res = await patch({ email: "owner@example.com", accessCode: "LEGACYCODE1", notificationPreferences: { email: true } });
    expect(res.status).toBe(200);
    expect(mockDb.client_goals.upsert).not.toHaveBeenCalled();
  });

  it("refuses a caller whose code doesn't match", async () => {
    mockDb.clients.findUnique.mockResolvedValue({ id: "client-1", email: "someone-else@example.com" });
    const res = await patch({ email: "owner@example.com", accessCode: "LEGACYCODE1", monthlyGoal: 12 });
    expect(res.status).toBe(401);
    expect(mockDb.client_goals.upsert).not.toHaveBeenCalled();
  });
});
