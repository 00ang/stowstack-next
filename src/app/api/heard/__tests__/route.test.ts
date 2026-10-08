import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));

import { GET, POST } from "../route";
import { heardLink } from "@/lib/attribution/heard-ask";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
  $executeRaw: ReturnType<typeof vi.fn>;
};
const token = () => new URL(heardLink("t1", "f1")).searchParams.get("t")!;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.tenants = {
    findFirst: vi.fn().mockResolvedValue({ id: "t1", metadata: {}, facilities: { name: "Maple Street Storage" } }),
  };
});

describe("/api/heard", () => {
  it("shows the question for a good link, and records nothing by being opened", async () => {
    const res = await GET(createMockRequest(`/api/heard?t=${encodeURIComponent(token())}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.facilityName).toBe("Maple Street Storage");
    expect(body.answers).toHaveLength(7);
    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
    // Looked up by the tenant and the facility the link was signed for.
    expect(mockDb.tenants.findFirst.mock.calls[0][0].where).toMatchObject({ id: "t1", facility_id: "f1" });
  });

  it("is a 404 for a link that isn't ours", async () => {
    expect((await GET(createMockRequest("/api/heard?t=forged.token"))).status).toBe(404);
  });

  it("records an answer on the tenant", async () => {
    const res = await POST(createMockRequest("/api/heard", { method: "POST", body: { t: token(), answer: "google_maps" } }));
    expect(res.status).toBe(200);
    expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
    const values = mockDb.$executeRaw.mock.calls[0].slice(1);
    expect(values.some((v: unknown) => typeof v === "string" && v.includes('"answer":"google_maps"'))).toBe(true);
  });

  it("refuses an answer that isn't one of the choices, or a bad link", async () => {
    expect((await POST(createMockRequest("/api/heard", { method: "POST", body: { t: token(), answer: "tv" } }))).status).toBe(400);
    expect((await POST(createMockRequest("/api/heard", { method: "POST", body: { t: "x.y", answer: "friend" } }))).status).toBe(404);
    expect(mockDb.$executeRaw).not.toHaveBeenCalled();
  });
});
