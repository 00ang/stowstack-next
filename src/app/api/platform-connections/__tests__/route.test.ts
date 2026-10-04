import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAdminRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-helpers", async (orig) => {
  const actual = await orig<typeof import("@/lib/api-helpers")>();
  return { ...actual, requireFacilityAccess: vi.fn().mockResolvedValue(null) };
});

import { PATCH } from "../route";
import { requireFacilityAccess } from "@/lib/api-helpers";

const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn> | Record<string, ReturnType<typeof vi.fn>>>;
const CONN = "55555555-5555-5555-5555-555555555555";
const FAC = "33333333-3333-3333-3333-333333333333";

function patch(body: unknown) {
  return createAdminRequest("/api/platform-connections", { method: "PATCH", body });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.platform_connections = {
    findUnique: vi.fn().mockResolvedValue({ facility_id: FAC, platform: "google_ads" }),
  };
  (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([
    { metadata: { customers: ["1234567890"], moveInConversionActionId: "987" } },
  ]);
});

describe("PATCH /api/platform-connections — move-in reporting settings", () => {
  it("merges valid settings and returns only the write-back fields", async () => {
    const res = await PATCH(patch({ connectionId: CONN, settings: { moveInConversionActionId: "987" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, settings: { moveInConversionActionId: "987" } });
    expect(requireFacilityAccess).toHaveBeenCalledWith(expect.anything(), FAC);
    const sql = ((mockDb.$queryRaw as ReturnType<typeof vi.fn>).mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toMatch(/COALESCE\(metadata, '\{\}'::jsonb\) - \?::text\[\]\) \|\| \?::jsonb/);
  });

  it("rejects a bad value before touching the database", async () => {
    const res = await PATCH(patch({ connectionId: CONN, settings: { loginCustomerId: "nope" } }));
    expect(res.status).toBe(400);
    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
  });

  it("refuses to write OAuth fields through this endpoint", async () => {
    const res = await PATCH(patch({ connectionId: CONN, settings: { customers: ["x"] } }));
    expect(res.status).toBe(400);
  });

  it("404s an unknown connection", async () => {
    (mockDb.platform_connections as Record<string, ReturnType<typeof vi.fn>>).findUnique.mockResolvedValue(null);
    expect((await PATCH(patch({ connectionId: CONN, settings: {} }))).status).toBe(404);
  });

  it("respects facility access", async () => {
    vi.mocked(requireFacilityAccess).mockResolvedValueOnce(NextResponse.json({ error: "no" }, { status: 403 }) as never);
    expect((await PATCH(patch({ connectionId: CONN, settings: { moveInConversionActionId: "1" } }))).status).toBe(403);
    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
  });
});
