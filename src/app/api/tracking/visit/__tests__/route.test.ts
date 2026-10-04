import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({ applyRateLimit: vi.fn().mockResolvedValue(null) }));

import { POST } from "../route";

const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn> | Record<string, ReturnType<typeof vi.fn>>>;
const VID = "0b9e1d3a-5c4f-4e2a-9b7c-1a2b3c4d5e6f";
const FAC = "33333333-3333-3333-3333-333333333333";
const LP = "44444444-4444-4444-4444-444444444444";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function visit(body: Record<string, unknown>, cookie?: string) {
  const req = createMockRequest("/api/tracking/visit", { method: "POST", body });
  // The test DOM drops a `cookie` header as browser-forbidden, so cookies go in
  // through NextRequest's own jar — which is what the route reads anyway.
  for (const pair of (cookie ?? "").split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) req.cookies.set(name, rest.join("="));
  }
  return req;
}
const createMany = () => (mockDb.touches as Record<string, ReturnType<typeof vi.fn>>).createMany;
const recorded = () => createMany().mock.calls.map((c) => c[0].data[0]);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.activity_log = { create: vi.fn().mockResolvedValue({}) };
  mockDb.touches = { createMany: vi.fn().mockResolvedValue({ count: 1 }) };
  // seeVisitor: a brand-new browser unless a test says otherwise
  (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ inserted: true }]);
});

describe("POST /api/tracking/visit — the visitor cookie", () => {
  it("mints a visitor id and sets it as a long-lived, HttpOnly, first-party cookie", async () => {
    const res = await POST(visit({ url: "http://localhost:3000/lp/x", landing_page_id: LP, facility_id: FAC }));
    expect(res.status).toBe(200);
    const c = res.cookies.get("sa_vid");
    expect(c?.value).toMatch(UUID_RE);
    expect(c?.httpOnly).toBe(true);
    expect(c?.sameSite).toBe("lax");
    expect(c?.maxAge).toBe(400 * 24 * 60 * 60);
  });

  it("keeps an existing visitor id and rolls its expiry forward", async () => {
    const res = await POST(visit({ url: "http://localhost:3000/lp/x" }, `sa_vid=${VID}`));
    expect(res.cookies.get("sa_vid")?.value).toBe(VID);
  });

  it("replaces a cookie value we did not mint", async () => {
    const res = await POST(visit({ url: "http://localhost:3000/lp/x" }, "sa_vid=not-ours"));
    const v = res.cookies.get("sa_vid")?.value;
    expect(v).toMatch(UUID_RE);
    expect(v).not.toBe("not-ours");
  });

  it("still sets the cookie when the visit log write fails", async () => {
    (mockDb.activity_log as Record<string, ReturnType<typeof vi.fn>>).create.mockRejectedValue(new Error("db down"));
    const res = await POST(visit({ url: "http://localhost:3000/lp/x" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get("sa_vid")?.value).toMatch(UUID_RE);
  });
});

describe("POST /api/tracking/visit — touches", () => {
  it("records a browser's first visit, classified from the URL and referrer", async () => {
    await POST(visit({
      url: "http://localhost:3000/lp/x?utm_source=google&utm_medium=cpc&utm_campaign=fall&gclid=G1",
      referrer: "https://www.google.com/",
      landing_page_id: LP,
      facility_id: FAC,
    }, `sa_vid=${VID}`));
    expect(recorded()).toHaveLength(1);
    expect(recorded()[0]).toMatchObject({
      visitor_id: VID, facility_id: FAC, landing_page_id: LP, kind: "visit",
      channel: "paid_search", source: "google", utm_campaign: "fall", gclid: "G1",
    });
  });

  it("writes nothing for a bare direct revisit", async () => {
    (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ inserted: false }]);
    await POST(visit({ url: "http://localhost:3000/lp/x" }, `sa_vid=${VID}`));
    expect(createMany()).not.toHaveBeenCalled();
  });

  it("records a returning visitor who arrives from a new source", async () => {
    (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ inserted: false }]);
    await POST(visit({ url: "http://localhost:3000/lp/x?fbclid=F1&utm_source=facebook&utm_medium=paid_social" }, `sa_vid=${VID}`));
    expect(recorded()[0]).toMatchObject({ channel: "paid_social", source: "meta", fbclid: "F1" });
  });

  it("ignores the client's sticky stored params — only the URL is evidence", async () => {
    (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([{ inserted: false }]);
    await POST(visit({
      url: "http://localhost:3000/lp/x",
      tracking_params: { utm_source: "google", gclid: "LAST_WEEK" },
    }, `sa_vid=${VID}`));
    expect(createMany()).not.toHaveBeenCalled();
  });

  it("captures Meta's browser cookies for the write-back", async () => {
    await POST(visit({ url: "http://localhost:3000/lp/x" }, `sa_vid=${VID}; _fbp=fb.1.1.P; _fbc=fb.1.2.C`));
    expect(recorded()[0]).toMatchObject({ fbp: "fb.1.1.P", fbc: "fb.1.2.C" });
  });

  it("drops ids that are not UUIDs instead of failing the insert", async () => {
    await POST(visit({ url: "http://localhost:3000/lp/x", facility_id: "nope", landing_page_id: "nope" }));
    expect(recorded()[0]).toMatchObject({ facility_id: null, landing_page_id: null });
  });

  it("a touch failure never fails the visit", async () => {
    createMany().mockRejectedValue(new Error("insert failed"));
    const res = await POST(visit({ url: "http://localhost:3000/lp/x?gclid=G" }));
    expect(res.status).toBe(200);
  });
});
