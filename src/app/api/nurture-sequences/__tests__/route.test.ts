import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn().mockResolvedValue(null) };
});

import { POST } from "../route";

const mockDb = db as unknown as {
  partial_leads: { findFirst: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
};
const FAC = "33333333-3333-3333-3333-333333333333";
const SEQ = "44444444-4444-4444-4444-444444444444";
const LEAD = "55555555-5555-5555-5555-555555555555";

function enroll(body: Record<string, unknown>) {
  return POST(createMockRequest("/api/nurture-sequences", { method: "POST", body: { action: "enroll", sequenceId: SEQ, facilityId: FAC, ...body } }));
}

/** Tagged-template calls: [strings, ...values]. Returns the SQL text and values of call `i`. */
function sqlCall(i: number): { text: string; values: unknown[] } {
  const [strings, ...values] = mockDb.$queryRaw.mock.calls[i] as [TemplateStringsArray, ...unknown[]];
  return { text: strings.join("?"), values };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.partial_leads = { findFirst: vi.fn() };
  mockDb.$queryRaw
    .mockResolvedValueOnce([{ id: SEQ, steps: [{ delay_minutes: 1 }] }])
    .mockResolvedValueOnce([{ id: "enr-1" }]);
});

describe("POST /api/nurture-sequences enroll", () => {
  it("takes a known lead's contact details from its own record", async () => {
    mockDb.partial_leads.findFirst.mockResolvedValue({ name: "Dana Ruiz", email: "dana@example.com", phone: "+15555550100" });
    const res = await enroll({ leadId: LEAD });
    expect(res.status).toBe(201);
    expect(mockDb.partial_leads.findFirst.mock.calls[0][0].where).toEqual({ id: LEAD, facility_id: FAC });
    const insert = sqlCall(1);
    expect(insert.values).toContain("Dana Ruiz");
    expect(insert.values).toContain("dana@example.com");
    expect(insert.values).toContain("+15555550100");
  });

  it("refuses a lead that isn't this facility's", async () => {
    mockDb.partial_leads.findFirst.mockResolvedValue(null);
    const res = await enroll({ leadId: LEAD });
    expect(res.status).toBe(404);
    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
  });

  it("says so when the lead has no way to reach them", async () => {
    mockDb.partial_leads.findFirst.mockResolvedValue({ name: "No Contact", email: null, phone: null });
    const res = await enroll({ leadId: LEAD });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("no email or phone");
  });

  it("only enrolls into this facility's sequence", async () => {
    mockDb.$queryRaw.mockReset().mockResolvedValueOnce([]);
    const res = await enroll({ contactEmail: "x@example.com" });
    expect(res.status).toBe(404);
    const lookup = sqlCall(0);
    expect(lookup.text).toContain("facility_id");
    expect(lookup.values).toEqual([SEQ, FAC]);
  });

  it("still enrolls typed contact details without a lead", async () => {
    const res = await enroll({ contactName: "Walk In", contactPhone: "+15555550111" });
    expect(res.status).toBe(201);
    expect(mockDb.partial_leads.findFirst).not.toHaveBeenCalled();
  });
});
