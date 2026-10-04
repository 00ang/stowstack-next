import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createAdminRequest, createMockRequest } from "@/test/helpers";

vi.mock("@/lib/attribution/visitor", () => ({ loadLeadTouches: vi.fn().mockResolvedValue([]) }));

import { GET } from "../route";
import { loadLeadTouches } from "@/lib/attribution/visitor";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const LEAD = "11111111-1111-1111-1111-111111111111";
const TENANT = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.partial_leads = {
    findUnique: vi.fn().mockResolvedValue({
      id: LEAD, name: "Pat Rivera", email: "pat@example.com", phone: "+12695550142", facility_id: "f1",
      created_at: new Date("2026-09-10T15:00:00Z"), converted_at: new Date("2026-09-10T15:05:00Z"),
      lead_status: "moved_in", monthly_revenue: 129, matched_tenant_id: TENANT, visitor_id: "v1",
      facilities: { name: "Midtown Storage" },
    }),
  };
  mockDb.lead_status_events = { findMany: vi.fn().mockResolvedValue([]) };
  mockDb.tenants = {
    findUnique: vi.fn().mockResolvedValue({
      unit_number: "B12", unit_size: "10x10", monthly_rate: "129.00", move_in_date: new Date("2026-09-18T00:00:00Z"),
    }),
  };
  mockDb.conversion_reports = { findMany: vi.fn().mockResolvedValue([]) };
  vi.mocked(loadLeadTouches).mockResolvedValue([
    {
      kind: "visit", channel: "paid_search", source: "google", url: null, referrer: null,
      utm_source: "google", utm_medium: "cpc", utm_campaign: "fall", utm_content: null, utm_term: null,
      gclid: "G", gbraid: null, wbraid: null, fbclid: null, fbc: null, fbp: null, ttclid: null, msclkid: null,
      occurred_at: new Date("2026-09-10T14:58:00Z"),
    },
  ]);
});

describe("GET /api/admin-lead-journey", () => {
  it("requires the admin key", async () => {
    const res = await GET(createMockRequest(`/api/admin-lead-journey?leadId=${LEAD}`));
    expect(res.status).toBe(401);
  });

  it("rejects a missing or malformed lead id", async () => {
    expect((await GET(createAdminRequest("/api/admin-lead-journey"))).status).toBe(400);
    expect((await GET(createAdminRequest("/api/admin-lead-journey?leadId=nope"))).status).toBe(400);
  });

  it("404s an unknown lead", async () => {
    mockDb.partial_leads.findUnique.mockResolvedValue(null);
    expect((await GET(createAdminRequest(`/api/admin-lead-journey?leadId=${LEAD}`))).status).toBe(404);
  });

  it("returns the summary and the timeline from the same rows", async () => {
    const res = await GET(createAdminRequest(`/api/admin-lead-journey?leadId=${LEAD}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lead).toMatchObject({ name: "Pat Rivera", facility: "Midtown Storage", tracked: true });
    expect(body.summary).toMatchObject({
      first: { title: "Paid search · Google", campaign: "fall" },
      touchCount: 1,
      movedIn: { unit: "B12", rate: 129 },
    });
    expect(body.journey.map((i: { kind: string }) => i.kind)).toEqual(["touch", "lead", "move_in"]);
  });
});
