import { describe, it, expect, vi } from "vitest";
import { createMockRequest } from "@/test/helpers";

// The route fires a notification email on the success path; stub it so the
// module imports cleanly without a Resend client. (db is mocked globally in
// src/test/setup.ts.) The guard/validation paths under test return before any
// email or db call, so no further mocking is needed.
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  SENDERS: { default: "test@storageads.com", notifications: "notes@storageads.com" },
}));

vi.mock("@/lib/diagnostic-retry", () => ({
  scheduleDiagnosticRetry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: vi.fn() };
});

import { db } from "@/lib/db";
import { POST } from "../route";

const facilities = db as unknown as {
  facilities: { create: ReturnType<typeof vi.fn> };
  activity_log: { create: ReturnType<typeof vi.fn> };
};

const PATH = "/api/diagnostic-intake";

function post(body: unknown) {
  return POST(createMockRequest(PATH, { method: "POST", body }));
}

describe("POST /api/diagnostic-intake — payload-size guard", () => {
  it("rejects oversized submissions with 413 before they reach the AI prompt", async () => {
    // Valid required fields, so the ONLY thing that can produce a non-2xx here
    // is the size guard itself.
    const res = await post({
      facilityName: "Test Facility",
      contactEmail: "owner@example.com",
      responses: { note: "x".repeat(60_000) },
    });
    expect(res.status).toBe(413);
  });

  it("allows a normal-size submission past the guard (validation still runs)", async () => {
    // Small responses clear the guard; missing facilityName then trips the
    // existing required-field validation (400) before any db/email work.
    const res = await post({
      contactEmail: "owner@example.com",
      responses: { note: "occupancy is around 80%" },
    });
    expect(res.status).toBe(400);
  });

  it("does not store made-up bands when occupancy, units, or the issue are skipped", async () => {
    facilities.facilities = { create: vi.fn().mockResolvedValue({ id: "fac-1" }) };
    facilities.activity_log = { create: vi.fn().mockResolvedValue({}) };

    const res = await post({
      facilityName: "Main Street Storage",
      contactEmail: "owner@mainstreet.test",
      responses: {},
    });
    expect(res.status).toBe(201);
    const data = facilities.facilities.create.mock.calls[0][0].data;
    expect(data.occupancy_range).toBeNull();
    expect(data.total_units).toBeNull();
    expect(data.biggest_issue).toBeNull();
    expect(JSON.stringify(data)).not.toContain("60-75");
    expect(JSON.stringify(data)).not.toContain("100-300");
    expect(JSON.stringify(data)).not.toContain("filling-units");
  });

  it("stores the raw band the operator picked", async () => {
    facilities.facilities = { create: vi.fn().mockResolvedValue({ id: "fac-1" }) };
    facilities.activity_log = { create: vi.fn().mockResolvedValue({}) };

    const res = await post({
      facilityName: "Main Street Storage",
      contactEmail: "owner@mainstreet.test",
      responses: {
        "About where is your facility sitting today (overall occupancy)?": "60–69%",
        "What is your total unit count (approximately)?": "200–349",
      },
    });
    expect(res.status).toBe(201);
    const data = facilities.facilities.create.mock.calls[0][0].data;
    expect(data.occupancy_range).toBe("60–69%");
    expect(data.total_units).toBe("200–349");
    expect(data.biggest_issue).toBeNull();
  });

  it("does not false-trigger when responses is absent", async () => {
    const res = await post({ facilityName: "Test Facility" });
    // Missing contactEmail -> 400 from validation, NOT 413 from the guard.
    expect(res.status).toBe(400);
  });
});
