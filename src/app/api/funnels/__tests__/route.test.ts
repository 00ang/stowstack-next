import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn() };
});

import { GET } from "../route";
import { requireFacilityAccess } from "@/lib/api-helpers";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const FUNNEL = "11111111-1111-1111-1111-111111111111";
const OWN = "22222222-2222-2222-2222-222222222222";
const OTHER = "33333333-3333-3333-3333-333333333333";

const guard = vi.mocked(requireFacilityAccess);
const refuse = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.funnels = {
    findUnique: vi.fn().mockImplementation(({ select }: { select?: unknown }) =>
      Promise.resolve(select ? { facility_id: OTHER } : { id: FUNNEL, facility_id: OTHER, partial_leads: [] }),
    ),
    findMany: vi.fn().mockResolvedValue([]),
  };
});

describe("GET /api/funnels?id=", () => {
  it("checks access against the campaign's own facility, not one the caller names", async () => {
    // A session for OWN asking for OTHER's campaign while naming its own facility.
    guard.mockImplementation(async (_req, facilityId) => (facilityId === OWN ? null : refuse()));
    const res = await GET(createMockRequest(`/api/funnels?id=${FUNNEL}&facilityId=${OWN}`));
    expect(res.status).toBe(401);
    expect(guard).toHaveBeenCalledWith(expect.anything(), OTHER);
  });

  it("opens a campaign by id alone for a session that owns it", async () => {
    guard.mockImplementation(async (_req, facilityId) => (facilityId === OTHER ? null : refuse()));
    const res = await GET(createMockRequest(`/api/funnels?id=${FUNNEL}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(FUNNEL);
  });

  it("is a 404 for an authorized caller when the campaign doesn't exist", async () => {
    mockDb.funnels.findUnique = vi.fn().mockResolvedValue(null);
    guard.mockResolvedValue(null);
    const res = await GET(createMockRequest(`/api/funnels?id=${FUNNEL}&facilityId=${OWN}`));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/funnels?facilityId=", () => {
  it("lists only after the facility check passes", async () => {
    guard.mockResolvedValue(refuse());
    const res = await GET(createMockRequest(`/api/funnels?facilityId=${OTHER}`));
    expect(res.status).toBe(401);
    expect(mockDb.funnels.findMany).not.toHaveBeenCalled();
  });

  it("lists the facility's campaigns", async () => {
    guard.mockResolvedValue(null);
    const res = await GET(createMockRequest(`/api/funnels?facilityId=${OWN}`));
    expect(res.status).toBe(200);
    expect(mockDb.funnels.findMany.mock.calls[0][0].where).toEqual({ facility_id: OWN });
  });
});
