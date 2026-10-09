import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildTemplate, writeGraph } from "@/lib/funnel-graph";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn() };
});
vi.mock("@/lib/campaign-publish", async (orig) => {
  const actual = await orig<typeof import("@/lib/campaign-publish")>();
  return {
    ...actual,
    startPublish: vi.fn().mockResolvedValue({ runId: "run-1", joined: false }),
    preflightFacts: vi.fn().mockResolvedValue({
      address: true, meta: false, googleAds: true, gbp: true, storedge: true, googleAccess: true, texting: true,
    }),
  };
});
vi.mock("@/lib/jobs/runner", () => ({ runJobs: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/jobs/handlers", () => ({ HANDLERS: {} }));
vi.mock("next/server", async (orig) => {
  const actual = await orig<typeof import("next/server")>();
  return { ...actual, after: vi.fn() };
});

import { GET, POST } from "../route";
import { requireFacilityAccess } from "@/lib/api-helpers";
import { startPublish } from "@/lib/campaign-publish";
import { after } from "next/server";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const guard = vi.mocked(requireFacilityAccess);
const FUNNEL = "11111111-1111-1111-1111-111111111111";
const FAC = "22222222-2222-2222-2222-222222222222";
const ready = buildTemplate("lease");

beforeEach(() => {
  vi.clearAllMocks();
  guard.mockResolvedValue(null);
  mockDb.funnels = {
    findUnique: vi.fn().mockResolvedValue({ id: FUNNEL, facility_id: FAC, status: "draft", config: writeGraph({}, ready) }),
  };
});

const post = (body: unknown) =>
  POST(createMockRequest("/api/funnels/publish", { method: "POST", body }));

describe("POST /api/funnels/publish", () => {
  it("checks access against the campaign's own facility", async () => {
    guard.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const res = await post({ id: FUNNEL });
    expect(res.status).toBe(401);
    expect(guard).toHaveBeenCalledWith(expect.anything(), FAC);
    expect(startPublish).not.toHaveBeenCalled();
  });

  it("starts a run and the worker straight away", async () => {
    const res = await post({ id: FUNNEL, retry: ["n7", 4] });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ runId: "run-1", joined: false });
    expect(startPublish).toHaveBeenCalledWith(FUNNEL, FAC, ["n7"]);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("won't publish a canvas with an unfinished function, and says which", async () => {
    const thin = buildTemplate("drive"); // Meta has no budget yet
    mockDb.funnels.findUnique = vi.fn().mockResolvedValue({ id: FUNNEL, facility_id: FAC, status: "draft", config: writeGraph({}, thin) });
    const res = await post({ id: FUNNEL });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/needs/);
    expect(startPublish).not.toHaveBeenCalled();
  });

  it("is a 404 for a campaign that doesn't exist", async () => {
    mockDb.funnels.findUnique = vi.fn().mockResolvedValue(null);
    expect((await post({ id: FUNNEL })).status).toBe(404);
  });
});

describe("GET /api/funnels/publish", () => {
  it("answers what each function needs first", async () => {
    const res = await GET(createMockRequest(`/api/funnels/publish?id=${FUNNEL}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    const meta = ready.nodes.find((n) => n.type === "meta")!.id;
    expect(body.preflight[meta]).toMatchObject({ state: "needs", fix: { tool: "ad-publisher" } });
    expect(body.state).toBeNull();
  });
});
