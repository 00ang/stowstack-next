import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn() };
});

import { GET } from "../route";
import { requireFacilityAccess } from "@/lib/api-helpers";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const guard = vi.mocked(requireFacilityAccess);
const FUNNEL = "11111111-1111-1111-1111-111111111111";
const FAC = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue(null);
  mockDb.funnels = { findUnique: vi.fn().mockResolvedValue({ id: FUNNEL, facility_id: FAC }) };
  mockDb.landing_pages = { findMany: vi.fn().mockResolvedValue([{ id: "p1" }, { id: "p2" }]) };
  mockDb.touches = {
    groupBy: vi.fn().mockResolvedValue([
      { channel: "paid_social", source: "meta", _count: { _all: 240 } },
      { channel: "paid_search", source: "google", _count: { _all: 31 } },
      { channel: "organic_search", source: "google", _count: { _all: 96 } },
      { channel: "direct", source: null, _count: { _all: 12 } },
    ]),
  };
  mockDb.partial_leads = {
    findMany: vi.fn().mockResolvedValue([
      { id: "l1", first_response_at: new Date(), lead_status: "new", matched_tenant_id: null, converted: false },
      { id: "l2", first_response_at: new Date(), lead_status: "reserved", matched_tenant_id: null, converted: false },
      { id: "l3", first_response_at: null, lead_status: "moved_in", matched_tenant_id: "t1", converted: true },
    ]),
  };
  mockDb.nurture_enrollments = { findMany: vi.fn().mockResolvedValue([{ lead_id: "l1" }]) };
  mockDb.drip_sequences = { findMany: vi.fn().mockResolvedValue([{ lead_id: "l1" }, { lead_id: "l3" }]) };
  mockDb.facility_tours = { findMany: vi.fn().mockResolvedValue([{ lead_id: "l2" }]) };
});

describe("GET /api/funnels/flow", () => {
  it("checks access against the campaign's own facility", async () => {
    guard.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const res = await GET(createMockRequest(`/api/funnels/flow?id=${FUNNEL}`));
    expect(res.status).toBe(401);
    expect(guard).toHaveBeenCalledWith(expect.anything(), FAC);
    expect(mockDb.partial_leads.findMany).not.toHaveBeenCalled();
  });

  it("counts what flowed through the campaign", async () => {
    const res = await GET(createMockRequest(`/api/funnels/flow?id=${FUNNEL}`));
    expect(res.status).toBe(200);
    const { counts } = await res.json();
    expect(counts).toEqual({
      days: 30,
      visits: { meta: 240, google: 31, gbp: 96, tiktok: 0, other: 12 },
      leads: 3,
      answered: 2,
      enrolled: 2,
      toured: 1,
      holds: 1,
      moveIns: 1,
    });
    const leadWhere = mockDb.partial_leads.findMany.mock.calls[0][0].where;
    expect(leadWhere.OR).toEqual([
      { funnel_id: FUNNEL },
      { utm_campaign: FUNNEL },
      { landing_page_id: { in: ["p1", "p2"] } },
    ]);
    // Visits count by page or by the campaign id its links carry.
    const touchWhere = mockDb.touches.groupBy.mock.calls[0][0].where;
    expect(touchWhere.OR).toEqual([{ utm_campaign: FUNNEL }, { landing_page_id: { in: ["p1", "p2"] } }]);
  });

  it("is a 404 for a campaign that doesn't exist, and a 400 without an id", async () => {
    mockDb.funnels.findUnique = vi.fn().mockResolvedValue(null);
    expect((await GET(createMockRequest(`/api/funnels/flow?id=${FUNNEL}`))).status).toBe(404);
    expect((await GET(createMockRequest(`/api/funnels/flow`))).status).toBe(400);
  });

  it("keeps the window between a day and 90 days", async () => {
    await GET(createMockRequest(`/api/funnels/flow?id=${FUNNEL}&days=9999`));
    const since: Date = mockDb.partial_leads.findMany.mock.calls[0][0].where.created_at.gte;
    const days = Math.round((Date.now() - since.getTime()) / 86_400_000);
    expect(days).toBe(90);
  });
});
