import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn() };
});
vi.mock("@/lib/attribution/ledger", async (orig) => {
  const actual = await orig<typeof import("@/lib/attribution/ledger")>();
  return {
    ...actual,
    buildLedger: vi.fn().mockResolvedValue({
      rows: [
        {
          tenantId: "t1", name: "Riley Chen", unit: "C214", size: "10x20", moveInDate: "2026-09-17",
          visit: { way: "Meta ad", channel: "paid_social", source: "meta", campaign: "Fall Move Season", at: "2026-09-14T10:00:00Z" },
          lead: { id: "l1", askedAt: "2026-09-14T10:00:00Z", answeredInSeconds: 41 },
          match: { status: "matched", method: "phone_exact", confidence: 0.95, attemptId: "a1", candidates: [] },
          said: null, agrees: null, verdict: "traced", way: "Meta ad",
        },
      ],
      summary: { total: 1, traced: 1, said: 0, unsure: 0, unknown: 0, byWay: [{ way: "Meta ad", count: 1 }] },
    }),
  };
});
vi.mock("@/lib/attribution/heard-ask", () => ({
  heardAskOn: vi.fn().mockResolvedValue(false),
  setHeardAsk: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/lead-matching", () => ({ resolveMatchAttempt: vi.fn().mockResolvedValue(true) }));

import { GET, POST } from "../route";
import { requireFacilityAccess } from "@/lib/api-helpers";
import { setHeardAsk } from "@/lib/attribution/heard-ask";
import { resolveMatchAttempt } from "@/lib/lead-matching";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const guard = vi.mocked(requireFacilityAccess);
const FAC = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue(null);
  mockDb.lead_match_attempts = { findUnique: vi.fn().mockResolvedValue({ facility_id: FAC }) };
});

const post = (body: unknown) => POST(createMockRequest("/api/attribution/ledger", { method: "POST", body }));

describe("/api/attribution/ledger", () => {
  it("checks access against the facility asked about", async () => {
    guard.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await GET(createMockRequest(`/api/attribution/ledger?facilityId=${FAC}`))).status).toBe(401);
    expect(guard).toHaveBeenCalledWith(expect.anything(), FAC);
  });

  it("answers the rows, or the same as a spreadsheet", async () => {
    const json = await GET(createMockRequest(`/api/attribution/ledger?facilityId=${FAC}&days=90`));
    expect((await json.json()).summary.total).toBe(1);
    const csv = await GET(createMockRequest(`/api/attribution/ledger?facilityId=${FAC}&format=csv`));
    expect(csv.headers.get("Content-Type")).toContain("text/csv");
    expect(csv.headers.get("Content-Disposition")).toContain("attachment");
    expect(await csv.text()).toContain('"Riley Chen"');
  });

  it("settles an unsure match only for the facility it belongs to", async () => {
    expect((await post({ facilityId: FAC, action: "confirm", attemptId: "a1", leadId: "l9" })).status).toBe(200);
    expect(resolveMatchAttempt).toHaveBeenCalledWith(expect.anything(), "a1", "l9", "owner:ledger");

    mockDb.lead_match_attempts.findUnique = vi.fn().mockResolvedValue({ facility_id: "someone-else" });
    expect((await post({ facilityId: FAC, action: "confirm", attemptId: "a1", leadId: "l9" })).status).toBe(404);
  });

  it("says so when a match is already settled", async () => {
    vi.mocked(resolveMatchAttempt).mockResolvedValueOnce(false);
    expect((await post({ facilityId: FAC, action: "reject", attemptId: "a1" })).status).toBe(409);
  });

  it("switches the ask on and off", async () => {
    await post({ facilityId: FAC, action: "ask", on: true });
    expect(setHeardAsk).toHaveBeenCalledWith(FAC, true);
  });
});
