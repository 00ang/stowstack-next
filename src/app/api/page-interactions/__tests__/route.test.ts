import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }) }));

import { POST } from "../route";

const LP = "33333333-3333-3333-3333-333333333333";
const FAC = "11111111-1111-1111-1111-111111111111";

/** The SQL text of the n-th $executeRaw call, parameters elided. */
function sqlOf(call: number): string {
  const [strings, ...values] = vi.mocked(db.$executeRaw).mock.calls[call] as unknown as [TemplateStringsArray, ...unknown[]];
  // A nested Prisma.sql (the batched VALUES) carries its own strings.
  const nested = values.map((v) => (v && typeof v === "object" && "strings" in v ? (v as { strings: string[] }).strings.join("?") : "?"));
  return strings.reduce((acc, s, i) => acc + s + (nested[i] ?? ""), "");
}

describe("POST /api/page-interactions", () => {
  beforeEach(() => vi.mocked(db.$executeRaw).mockClear());

  // Prisma binds strings as text; Postgres will not put text into a uuid column
  // without a cast (42804). Every beacon failed for months for want of these.
  it("casts the ids to uuid in the heartbeat insert /lp/[slug] sends", async () => {
    const res = await POST(createMockRequest("/api/page-interactions", {
      method: "POST",
      body: { landingPageId: LP, facilityId: FAC, sessionId: "s1", scrollDepth: 62, timeOnPage: 41 },
    }));
    expect(res.status).toBe(200);
    expect(sqlOf(0)).toMatch(/VALUES \(\?::uuid, \?::uuid,/);
  });

  it("casts the ids to uuid in batched events too", async () => {
    const res = await POST(createMockRequest("/api/page-interactions", {
      method: "POST",
      body: { landingPageId: LP, facilityId: FAC, sessionId: "s2", events: [{ event_type: "click", x_pct: 40, y_pct: 70 }] },
    }));
    expect(res.status).toBe(200);
    expect(sqlOf(0)).toMatch(/\(\?::uuid, \?::uuid,/);
  });

  it("rejects ids that are not uuids with a 400 instead of a database error", async () => {
    const res = await POST(createMockRequest("/api/page-interactions", {
      method: "POST",
      body: { landingPageId: "not-a-uuid", facilityId: FAC, scrollDepth: 10 },
    }));
    expect(res.status).toBe(400);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
