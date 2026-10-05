// @vitest-environment node
// (happy-dom strips the forbidden cookie header some cases send.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAdminRequest, createMockRequest } from "@/test/helpers";
import { COOKIE_NAME, HEADER_NAME, createManageToken, verifyManageToken } from "@/lib/manage-session";

/**
 * Client access to the facility tools: one login (the portal login, or the
 * partner session, opens the tools), owners only reach their own facilities,
 * and video generation is a Portfolio-plan feature.
 */

vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  applyRateLimitStrict: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  resetRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/session-auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/portal-provisioning", () => ({ provisionPortalAccess: vi.fn() }));

import { getSession } from "@/lib/session-auth";
import { provisionPortalAccess } from "@/lib/portal-provisioning";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockDb = db as any;

const FAC_A = "11111111-1111-4111-8111-111111111111";
const FAC_B = "22222222-2222-4222-8222-222222222222";

function ownerRequest(url: string, facilityIds: string[], options: { method?: string; body?: unknown } = {}) {
  const token = createManageToken(facilityIds, "portal")!;
  return createMockRequest(url, { ...options, headers: { [HEADER_NAME]: token } });
}

function cookieScope(res: NextResponse) {
  return verifyManageToken(res.cookies.get(COOKIE_NAME)?.value);
}

const org = (plan: string, subscription_status = "active", trial_ends_at: Date | null = null) => ({
  plan,
  subscription_status,
  trial_ends_at,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("video is a Portfolio feature", () => {
  it("only the top plan gets video", async () => {
    const { orgAllowsVideo } = await import("@/lib/plan-limits");
    expect(orgAllowsVideo(org("portfolio"))).toBe(true);
    expect(orgAllowsVideo(org("growth"))).toBe(false);
    expect(orgAllowsVideo(org("launch"))).toBe(false);
    expect(orgAllowsVideo(null)).toBe(false); // no org, no plan
  });

  it("a lapsed Portfolio plan loses it; a sales-managed one without Stripe keeps it", async () => {
    const { orgAllowsVideo } = await import("@/lib/plan-limits");
    expect(orgAllowsVideo(org("portfolio", "canceled"))).toBe(false);
    expect(orgAllowsVideo(org("portfolio", "past_due"))).toBe(false);
    expect(orgAllowsVideo(org("portfolio", "trialing", new Date(Date.now() - 1000)))).toBe(false);
    expect(orgAllowsVideo(org("portfolio", "trialing", new Date(Date.now() + 86_400_000)))).toBe(true);
    expect(orgAllowsVideo(org("portfolio", "incomplete"))).toBe(true);
  });

  describe("POST /api/generate-video", () => {
    // An invalid template is rejected right after the plan gate, so a 400
    // proves the gate let the request through without starting a FAL job.
    const body = { templateId: "not-a-template", facilityId: FAC_A };

    it("refuses an owner whose facility isn't on Portfolio", async () => {
      mockDb.facilities = { findUnique: vi.fn().mockResolvedValue({ organizations: org("growth") }) };
      const { POST } = await import("@/app/api/generate-video/route");
      const res = await POST(ownerRequest("/api/generate-video", [FAC_A], { method: "POST", body }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/Portfolio/);
    });

    it("lets a Portfolio owner through", async () => {
      mockDb.facilities = { findUnique: vi.fn().mockResolvedValue({ organizations: org("portfolio") }) };
      const { POST } = await import("@/app/api/generate-video/route");
      const res = await POST(ownerRequest("/api/generate-video", [FAC_A], { method: "POST", body }));
      expect(res.status).toBe(400);
    });

    it("never gates an admin", async () => {
      mockDb.facilities = { findUnique: vi.fn().mockResolvedValue({ organizations: org("launch") }) };
      const { POST } = await import("@/app/api/generate-video/route");
      const res = await POST(createAdminRequest("/api/generate-video", { method: "POST", body }));
      expect(res.status).toBe(400);
      expect(mockDb.facilities.findUnique).not.toHaveBeenCalled();
    });
  });

  it("the tools session reports which facilities have video", async () => {
    mockDb.facilities = {
      findMany: vi.fn().mockResolvedValue([
        { id: FAC_A, name: "A", google_rating: null, organizations: org("portfolio") },
        { id: FAC_B, name: "B", google_rating: null, organizations: null },
      ]),
    };
    const { GET } = await import("@/app/api/manage/session/route");
    const res = await GET(ownerRequest("/api/manage/session", [FAC_A, FAC_B]));
    const { facilities } = await res.json();
    expect(facilities.map((f: any) => [f.id, f.videoEnabled])).toEqual([
      [FAC_A, true],
      [FAC_B, false],
    ]);
    expect(facilities[0]).not.toHaveProperty("organizations");
    expect(mockDb.facilities.findMany.mock.calls[0][0].select).not.toHaveProperty("notes");
  });
});

describe("one login: the portal login opens the tools", () => {
  const client = {
    id: "c1",
    facility_id: FAC_A,
    email: "owner@facility.com",
    name: "Owner",
    facility_name: "A",
    location: "X",
    occupancy_range: null,
    total_units: null,
    signed_at: null,
    access_code: "ABCD1234",
    monthly_goal: 0,
  };

  beforeEach(() => {
    mockDb.clients = { findUnique: vi.fn().mockResolvedValue(client) };
    mockDb.facilities = { findUnique: vi.fn().mockResolvedValue({ organizations: null }) };
  });

  it("sets the tools cookie for every facility the client's email is signed on", async () => {
    mockDb.clients.findMany = vi.fn().mockResolvedValue([{ facility_id: FAC_A }, { facility_id: FAC_B }]);
    const { POST } = await import("@/app/api/client-data/route");
    const res = await POST(
      createMockRequest("/api/client-data", { method: "POST", body: { email: client.email, accessCode: "ABCD1234" } }),
    );
    expect(res.status).toBe(200);
    const scope = cookieScope(res);
    expect(scope?.facilityIds).toEqual([FAC_A, FAC_B]);
    expect(scope?.mode).toBe("portal");
    // Only live clients on live facilities.
    expect(mockDb.clients.findMany.mock.calls[0][0].where).toMatchObject({
      deleted_at: null,
      facilities: { deleted_at: null },
    });
  });

  it("never blocks the portal login when the tools can't open", async () => {
    mockDb.clients.findMany = vi.fn().mockRejectedValue(new Error("db down"));
    const { POST } = await import("@/app/api/client-data/route");
    const res = await POST(
      createMockRequest("/api/client-data", { method: "POST", body: { email: client.email, accessCode: "ABCD1234" } }),
    );
    expect(res.status).toBe(200);
    expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
  });

  it("a wrong code gets no tools", async () => {
    mockDb.clients.findUnique = vi.fn().mockResolvedValue(null);
    mockDb.clients.findMany = vi.fn();
    const { POST } = await import("@/app/api/client-data/route");
    const res = await POST(
      createMockRequest("/api/client-data", { method: "POST", body: { email: client.email, accessCode: "WRONG999" } }),
    );
    expect(res.status).toBe(401);
    expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
  });
});

describe("partner orgs: the partner session opens the tools", () => {
  const session = (role: string) => ({
    user: { id: "u1", organization_id: "o1", email: "p@x.com", name: "P", role, status: "active", is_superadmin: false },
    organization: { id: "o1" },
  });

  it("gives managers every facility in their org", async () => {
    vi.mocked(getSession).mockResolvedValue(session("facility_manager") as any);
    mockDb.facilities = { findMany: vi.fn().mockResolvedValue([{ id: FAC_A }, { id: FAC_B }]) };
    const { POST } = await import("@/app/api/org-tools-session/route");
    const res = await POST(createMockRequest("/api/org-tools-session", { method: "POST" }));
    expect(res.status).toBe(200);
    expect(cookieScope(res)).toMatchObject({ facilityIds: [FAC_A, FAC_B], mode: "org" });
    expect(mockDb.facilities.findMany.mock.calls[0][0].where).toEqual({ organization_id: "o1", deleted_at: null });
  });

  it("view-only members don't get the tools", async () => {
    vi.mocked(getSession).mockResolvedValue(session("viewer") as any);
    mockDb.facilities = { findMany: vi.fn() };
    const { POST } = await import("@/app/api/org-tools-session/route");
    const res = await POST(createMockRequest("/api/org-tools-session", { method: "POST" }));
    expect(res.status).toBe(403);
    expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
  });

  it("no partner session, no tools", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const { POST } = await import("@/app/api/org-tools-session/route");
    const res = await POST(createMockRequest("/api/org-tools-session", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("owners stay inside their own facilities", () => {
  describe("PATCH /api/manage/facility", () => {
    beforeEach(() => {
      mockDb.facilities = { update: vi.fn().mockResolvedValue({ id: FAC_A }) };
    });

    it("refuses a facility outside the session", async () => {
      const { PATCH } = await import("@/app/api/manage/facility/route");
      const res = await PATCH(ownerRequest("/api/manage/facility", [FAC_A], { method: "PATCH", body: { id: FAC_B, name: "X" } }));
      expect(res.status).toBe(401);
      expect(mockDb.facilities.update).not.toHaveBeenCalled();
    });

    it("saves the profile fields and ignores notes and pipeline status", async () => {
      const { PATCH } = await import("@/app/api/manage/facility/route");
      const res = await PATCH(
        ownerRequest("/api/manage/facility", [FAC_A], {
          method: "PATCH",
          body: { id: FAC_A, contact_phone: " 555-0100 ", website: "", notes: "x", status: "client_signed" },
        }),
      );
      expect(res.status).toBe(200);
      expect(mockDb.facilities.update.mock.calls[0][0]).toMatchObject({
        where: { id: FAC_A },
        data: { contact_phone: "555-0100", website: null },
      });
      expect(mockDb.facilities.update.mock.calls[0][0].data).not.toHaveProperty("notes");
      expect(mockDb.facilities.update.mock.calls[0][0].data).not.toHaveProperty("status");
    });

    it("won't blank the facility name", async () => {
      const { PATCH } = await import("@/app/api/manage/facility/route");
      const res = await PATCH(ownerRequest("/api/manage/facility", [FAC_A], { method: "PATCH", body: { id: FAC_A, name: "  " } }));
      expect(res.status).toBe(400);
    });
  });

  it("landing page generation refuses another facility", async () => {
    const { POST } = await import("@/app/api/landing-pages/generate/route");
    const res = await POST(ownerRequest("/api/landing-pages/generate", [FAC_A], { method: "POST", body: { facilityId: FAC_B } }));
    expect(res.status).toBe(401);
  });

  describe("POST /api/funnels/generate", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("refuses another facility", async () => {
      const { POST } = await import("@/app/api/funnels/generate/route");
      const res = await POST(ownerRequest("/api/funnels/generate", [FAC_A], { method: "POST", body: { facilityId: FAC_B } }));
      expect(res.status).toBe(401);
    });

    it("runs its internal steps as the owner, from the owner's cookie", async () => {
      const token = createManageToken([FAC_A], "portal")!;
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "stop" });
      vi.stubGlobal("fetch", fetchMock);
      mockDb.facilities = { findUnique: vi.fn().mockResolvedValue({ id: FAC_A, name: "A" }) };
      mockDb.funnels = { create: vi.fn().mockResolvedValue({ id: "fn1" }) };
      const { POST } = await import("@/app/api/funnels/generate/route");
      await POST(
        createMockRequest("/api/funnels/generate", {
          method: "POST",
          headers: { cookie: `${COOKIE_NAME}=${token}` },
          body: { facilityId: FAC_A },
        }),
      );
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers[HEADER_NAME]).toBe(token);
      expect(headers).not.toHaveProperty("X-Admin-Key");
    });
  });
});

describe("invite signup creates a real portal login", () => {
  const body = { inviteCode: "test-admin-secret-key", name: "Downtown Storage", location: "Kalamazoo, MI" };

  it("requires an email: it's the login", async () => {
    const { POST } = await import("@/app/api/manage/scratch/route");
    const res = await POST(createMockRequest("/api/manage/scratch", { method: "POST", body }));
    expect(res.status).toBe(400);
  });

  it("creates the facility and its portal client, and signs them in", async () => {
    mockDb.facilities = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: FAC_A, name: "Downtown Storage" }),
    };
    vi.mocked(provisionPortalAccess).mockResolvedValue({ ok: true, code: "ABCD1234", email: "o@x.com", created: true });
    const { POST } = await import("@/app/api/manage/scratch/route");
    const res = await POST(
      createMockRequest("/api/manage/scratch", { method: "POST", body: { ...body, contact_email: "O@x.com" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ portal: { email: "o@x.com", accessCode: "ABCD1234" } });
    expect(provisionPortalAccess).toHaveBeenCalledWith(FAC_A, { sendWelcomeEmail: true });
    expect(cookieScope(res)).toMatchObject({ facilityIds: [FAC_A], mode: "scratch" });
  });

  it("a wrong invite code creates nothing", async () => {
    mockDb.facilities = { findUnique: vi.fn(), create: vi.fn() };
    const { POST } = await import("@/app/api/manage/scratch/route");
    const res = await POST(
      createMockRequest("/api/manage/scratch", { method: "POST", body: { ...body, inviteCode: "nope", contact_email: "o@x.com" } }),
    );
    expect(res.status).toBe(403);
    expect(mockDb.facilities.create).not.toHaveBeenCalled();
  });
});
