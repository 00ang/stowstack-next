import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers";

// Route uses Prisma model methods; supply a focused db mock for what it calls.
vi.mock("@/lib/db", () => ({
  db: {
    partial_leads: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    activity_log: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

// Rate limiter is a no-op in tests (avoids hitting Upstash).
vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

// Canonical email layer — spy on sends so we can assert the audit-tool notify.
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  };
});

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { POST } from "../route";

const m = db as unknown as {
  partial_leads: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};
const notify = sendEmail as unknown as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(
    createMockRequest("http://localhost:3000/api/consumer-lead", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  m.partial_leads.findFirst.mockResolvedValue(null);
  m.partial_leads.create.mockResolvedValue({ id: "lead-1" });
  m.partial_leads.update.mockResolvedValue({ id: "existing-1" });
});

describe("POST /api/consumer-lead", () => {
  it("rejects a missing sessionId with 400 (the audit-tool regression)", async () => {
    // Regression: the audit tool used to POST without a sessionId, which 400'd
    // while the UI faked success. The contract is enforced here.
    const res = await post({ email: "op@example.com" });
    expect(res.status).toBe(400);
    expect(m.partial_leads.create).not.toHaveBeenCalled();
  });

  it("requires at least an email or a phone", async () => {
    const res = await post({ sessionId: "s1" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid email format", async () => {
    const res = await post({ sessionId: "s1", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("creates a new partial lead on valid input", async () => {
    const res = await post({ sessionId: "s1", email: "op@example.com" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, status: "created" });
    expect(m.partial_leads.create).toHaveBeenCalledTimes(1);
  });

  it("updates an existing partial lead for the same session", async () => {
    m.partial_leads.findFirst.mockResolvedValue({ id: "existing-1" });
    const res = await post({ sessionId: "s1", email: "op@example.com" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("updated");
    expect(m.partial_leads.update).toHaveBeenCalledTimes(1);
    expect(m.partial_leads.create).not.toHaveBeenCalled();
  });

  it("notifies Blake and Angelo on an audit_tool lead", async () => {
    await post({
      sessionId: "audit_abc",
      email: "op@example.com",
      source: "audit_tool",
      facilityName: "Sunset Storage",
      location: "Austin, TX",
      auditScore: 62,
    });
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.from).toBe("StorageAds <notifications@storageads.com>");
    expect(arg.subject).toContain("Sunset Storage");
    expect(arg.html).toContain("op@example.com");
    expect(arg.to).toEqual(
      expect.arrayContaining(["blake@storageads.com", "angelo@storageads.com"])
    );
  });

  it("does NOT notify for non-audit-tool sources (e.g. landing pages)", async () => {
    await post({
      sessionId: "s1",
      email: "op@example.com",
      facilityId: "fac-1",
      landingPageId: "lp-1",
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
