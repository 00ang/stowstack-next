import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";
import { GET, PATCH } from "../route";

// Pins the auth behavior after migrating client-onboarding onto the shared
// authenticatePortalRequest. Note PATCH credentials moved from the JSON body to
// the query string (the onboarding page was updated to match).
const mockDb = vi.mocked(db, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/client-onboarding", () => {
  it("401s when code + email do not resolve to a client", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await GET(
      createMockRequest("/api/client-onboarding?code=BAD&email=o@e.com")
    );
    expect(res.status).toBe(401);
  });

  it("returns an empty scaffold for a new client (via the `code` alias)", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = {
      findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
    };
    // @ts-expect-error — db is a vi mock
    mockDb.client_onboarding = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await GET(
      createMockRequest("/api/client-onboarding?code=AC&email=o@e.com")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completionPct).toBe(0);
    expect(body.onboarding.steps.facilityDetails.completed).toBe(false);
  });
});

describe("PATCH /api/client-onboarding", () => {
  it("401s without valid query credentials", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = { findFirst: vi.fn().mockResolvedValue(null) };
    const res = await PATCH(
      createMockRequest("/api/client-onboarding?code=BAD&email=o@e.com", {
        method: "PATCH",
        body: { step: "facilityDetails", data: { x: 1 } },
      })
    );
    expect(res.status).toBe(401);
  });

  it("400s an invalid step", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = {
      findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
    };
    const res = await PATCH(
      createMockRequest("/api/client-onboarding?code=AC&email=o@e.com", {
        method: "PATCH",
        body: { step: "bogus", data: { x: 1 } },
      })
    );
    expect(res.status).toBe(400);
  });

  it("saves a step for an authenticated client", async () => {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = {
      findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
    };
    // @ts-expect-error — db is a vi mock
    mockDb.client_onboarding = {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: "ob1", client_id: "c1", steps: {} }),
      update: vi.fn().mockResolvedValue({}),
    };
    const res = await PATCH(
      createMockRequest("/api/client-onboarding?code=AC&email=o@e.com", {
        method: "PATCH",
        body: { step: "competitorIntel", data: { differentiation: "we are closer" } },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.client_onboarding.update).toHaveBeenCalled();
  });

  function withRow(row: Record<string, unknown>) {
    // @ts-expect-error — db is a vi mock
    mockDb.clients = {
      findFirst: vi.fn().mockResolvedValue({ id: "c1", facility_id: "f1" }),
      findUnique: vi.fn().mockResolvedValue({ name: "Jordan", email: "o@e.com", facility_name: "Maple" }),
    };
    // @ts-expect-error — db is a vi mock
    mockDb.client_onboarding = {
      findFirst: vi.fn().mockResolvedValue({ id: "ob1", client_id: "c1", completed_at: null, steps: {}, ...row }),
      update: vi.fn().mockResolvedValue({}),
    };
  }

  function patch(body: Record<string, unknown>) {
    return PATCH(createMockRequest("/api/client-onboarding?code=AC&email=o@e.com", { method: "PATCH", body }));
  }

  it("won't finish before there is a goal", async () => {
    withRow({});
    const res = await patch({ finish: true });
    expect(res.status).toBe(400);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.client_onboarding.update).not.toHaveBeenCalled();
  });

  it("finishes the short onboarding once the goal is set", async () => {
    withRow({ steps: { adPreferences: { completed: false, data: { primaryGoal: "fill-units" } } } });
    const res = await patch({ finish: true });
    expect(res.status).toBe(200);
    expect((await res.json()).onboarding.completedAt).not.toBeNull();
    // @ts-expect-error — inspecting the mock
    expect(mockDb.client_onboarding.update.mock.calls[0][0].data.completed_at).toBeInstanceOf(Date);
  });

  it("saves the goal and finishes in one call", async () => {
    withRow({});
    const res = await patch({ step: "adPreferences", data: { primaryGoal: "lease-up" }, finish: true });
    expect(res.status).toBe(200);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.client_onboarding.update.mock.calls[0][0].data.completed_at).toBeInstanceOf(Date);
  });

  it("stays finished when an optional detail is saved later", async () => {
    const done = new Date("2026-10-01T00:00:00Z");
    withRow({ completed_at: done });
    const res = await patch({ step: "competitorIntel", data: { differentiation: "" } });
    expect(res.status).toBe(200);
    // @ts-expect-error — inspecting the mock
    expect(mockDb.client_onboarding.update.mock.calls[0][0].data.completed_at).toBe(done);
  });
});
