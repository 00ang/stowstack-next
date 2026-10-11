import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/db", () => ({
  db: {
    shared_audits: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Rate limiter: allow by default; individual tests can flip it.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { GET } from "../route";

const m = db as unknown as {
  shared_audits: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const rateLimit = checkRateLimit as unknown as ReturnType<typeof vi.fn>;
const notify = sendEmail as unknown as ReturnType<typeof vi.fn>;

function load(slug: string | null) {
  const url = slug
    ? `http://localhost:3000/api/audit-load?slug=${encodeURIComponent(slug)}`
    : "http://localhost:3000/api/audit-load";
  return GET(createMockRequest(url));
}

const record = (views: number) => ({
  id: "aud-1",
  slug: "sunset-storage-ab12",
  facility_name: "Sunset Storage",
  audit_json: { overallScore: 58 },
  views,
  created_at: new Date("2026-06-20T00:00:00Z"),
  expires_at: new Date("2099-01-01T00:00:00Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true });
  m.shared_audits.update.mockResolvedValue({});
});

describe("GET /api/audit-load", () => {
  it("400s when slug is missing", async () => {
    const res = await load(null);
    expect(res.status).toBe(400);
    expect(m.shared_audits.findFirst).not.toHaveBeenCalled();
  });

  it("429s when rate limited", async () => {
    rateLimit.mockResolvedValue({ allowed: false });
    const res = await load("sunset-storage-ab12");
    expect(res.status).toBe(429);
  });

  it("404s when the audit is missing or expired", async () => {
    m.shared_audits.findFirst.mockResolvedValue(null);
    const res = await load("nope");
    expect(res.status).toBe(404);
    expect(notify).not.toHaveBeenCalled();
  });

  it("returns the audit and increments the view count", async () => {
    m.shared_audits.findFirst.mockResolvedValue(record(4));
    const res = await load("sunset-storage-ab12");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.facilityName).toBe("Sunset Storage");
    expect(json.views).toBe(5);
    expect(m.shared_audits.update).toHaveBeenCalledWith({
      where: { id: "aud-1" },
      data: { views: { increment: 1 } },
    });
  });

  it("fires the first-view alert (idempotent) on view 0", async () => {
    m.shared_audits.findFirst.mockResolvedValue(record(0));
    await load("sunset-storage-ab12");
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.subject).toContain("Audit Opened");
    expect(arg.idempotencyKey).toBe("audit-first-view:aud-1");
    expect(arg.to).toEqual(
      expect.arrayContaining(["blake@storageads.com", "angelo@storageads.com"])
    );
  });

  it("fires the hot-lead alert exactly when crossing the 3-view threshold", async () => {
    m.shared_audits.findFirst.mockResolvedValue(record(2)); // 2 -> 3
    await load("sunset-storage-ab12");
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.subject).toContain("Hot Lead");
    expect(arg.idempotencyKey).toBe("audit-hot-lead:aud-1");
  });

  it("does not re-fire alerts on an in-between view (view 1)", async () => {
    m.shared_audits.findFirst.mockResolvedValue(record(1));
    await load("sunset-storage-ab12");
    expect(notify).not.toHaveBeenCalled();
  });

  it("does not re-fire the hot-lead alert past the threshold (view 5)", async () => {
    m.shared_audits.findFirst.mockResolvedValue(record(5));
    await load("sunset-storage-ab12");
    expect(notify).not.toHaveBeenCalled();
  });
});
