import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/db", () => ({
  db: {
    facilities: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    activity_log: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/intake/score-lead", () => ({
  scoreAndStore: vi.fn().mockResolvedValue(undefined),
  neutralSortReason: (honeypot: boolean) =>
    honeypot ? "A hidden field was filled." : "Sorted lower for a look.",
}));

vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true }),
  SENDERS: { noreply: "StorageAds <noreply@storageads.com>" },
}));

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { scoreAndStore } from "@/lib/intake/score-lead";
import { PATCH, POST } from "../route";

const m = db as unknown as {
  facilities: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  activity_log: { create: ReturnType<typeof vi.fn> };
};
const notify = sendEmail as unknown as ReturnType<typeof vi.fn>;

function post(body: unknown) {
  return POST(
    createMockRequest("http://localhost:3000/api/audit-form", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body,
    })
  );
}

function patch(body: unknown) {
  return PATCH(
    createMockRequest("http://localhost:3000/api/audit-form", {
      method: "PATCH",
      headers: { origin: "http://localhost:3000" },
      body,
    })
  );
}

const valid = {
  name: "Pat Owner",
  email: "pat@sunsetstorage.com",
  facilityName: "Sunset Storage",
  location: "Austin, TX",
  phone: "512-555-0100",
  totalUnits: "300",
  occupancyRange: "80-90%",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.facilities.create.mockResolvedValue({ id: "fac-1" });
  m.facilities.update.mockResolvedValue({ id: "fac-1" });
  m.facilities.findFirst.mockResolvedValue({ id: "fac-1", intake_answers: {} });
  m.activity_log.create.mockResolvedValue({});
});

describe("POST /api/audit-form", () => {
  it("400s on missing required fields without creating a facility", async () => {
    const res = await post({ email: "pat@x.com" });
    expect(res.status).toBe(400);
    expect(m.facilities.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("400s on an invalid email format", async () => {
    const res = await post({ ...valid, email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(m.facilities.create).not.toHaveBeenCalled();
  });

  it("creates the facility and notifies Blake on a valid submission", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true, facilityId: "fac-1" });

    expect(m.facilities.create).toHaveBeenCalledTimes(1);
    const data = m.facilities.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: "Sunset Storage",
      contact_email: "pat@sunsetstorage.com",
      status: "intake",
      pipeline_status: "submitted",
    });

    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.subject).toContain("Sunset Storage");
    expect(arg.html).toContain("pat@sunsetstorage.com");
    expect(m.activity_log.create).toHaveBeenCalled();
  });

  it("trims the email and tolerates a non-string email", async () => {
    await post({ ...valid, email: "  pat@sunsetstorage.com  " });
    expect(m.facilities.create.mock.calls[0][0].data.contact_email).toBe(
      "pat@sunsetstorage.com"
    );
  });

  it("500s (not a crash) when the DB write fails", async () => {
    m.facilities.create.mockRejectedValue(new Error("db down"));
    const res = await post(valid);
    expect(res.status).toBe(500);
  });

  it("stores a homepage popup lead with name + phone and writes activity", async () => {
    const res = await post({
      source: "homepage_popup",
      name: "Pat Owner",
      phone: "512-555-0123",
      consent: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.facilityId).toBe("fac-1");
    expect(m.facilities.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contact_name: "Pat Owner",
        contact_phone: "+15125550123",
        name: "Homepage inquiry",
        pipeline_status: "submitted",
        form_notes: "homepage_popup:first_month_free",
        total_units: null,
        occupancy_range: null,
        biggest_issue: null,
      }),
    });
    const created = m.facilities.create.mock.calls[0][0].data;
    expect(created.intake_answers).toMatchObject({ source: "homepage_popup", consent: true });
    expect(created.intake_answers.units).toBeUndefined();
    expect(created.intake_answers.occupancy).toBeUndefined();
    expect(created.intake_token).toEqual(expect.any(String));
    expect(scoreAndStore).toHaveBeenCalledWith("fac-1");
    expect(m.activity_log.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "lead_created",
        lead_name: "Pat Owner",
      }),
    });
  });

  it("rejects a homepage popup without TCPA consent or a valid phone", async () => {
    const noConsent = await post({
      source: "homepage_popup",
      name: "Pat",
      phone: "512-555-0123",
      consent: false,
    });
    expect(noConsent.status).toBe(400);

    const badPhone = await post({
      source: "homepage_popup",
      name: "Pat",
      phone: "12",
      consent: true,
    });
    expect(badPhone.status).toBe(400);
    expect(m.facilities.create).not.toHaveBeenCalled();
  });

  it("saves a honeypot hit and sorts it last instead of dropping it", async () => {
    const res = await post({
      source: "homepage_popup",
      name: "Bot",
      phone: "512-555-0123",
      consent: true,
      website_url: "https://spam.test",
    });
    expect(res.status).toBe(200);
    expect(m.facilities.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sort_last: true,
        sort_last_reason: "A hidden field was filled.",
      }),
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("accepts an international number with a country code", async () => {
    const res = await post({
      source: "homepage_popup",
      name: "Ayrshire Owner",
      phone: "+44 141 555 0100",
      consent: true,
    });
    expect(res.status).toBe(200);
    expect(m.facilities.create.mock.calls[0][0].data.contact_phone).toBe("+441415550100");
  });

  it("saves one answer and does not invent the ones still blank", async () => {
    m.facilities.findFirst.mockResolvedValue({
      id: "fac-1",
      intake_answers: { source: "homepage_popup", consent: true },
    });
    const res = await patch({
      facilityId: "fac-1",
      intakeToken: "tok",
      answers: { role: "Owner" },
    });
    expect(res.status).toBe(200);
    const data = m.facilities.update.mock.calls[0][0].data;
    expect(data.intake_answers.role).toBe("Owner");
    expect(data.intake_answers.occupancy).toBeUndefined();
    expect(data.intake_answers.units).toBeUndefined();
    expect(data.total_units).toBeUndefined();
    expect(data.occupancy_range).toBeUndefined();
    expect(data.biggest_issue).toBeUndefined();
    expect(scoreAndStore).toHaveBeenCalledWith("fac-1");
  });

  it("clears a skipped answer instead of storing a default band", async () => {
    m.facilities.findFirst.mockResolvedValue({
      id: "fac-1",
      intake_answers: { role: "Owner", occupancy: "60–69%", units: "200–349" },
    });
    const res = await patch({
      facilityId: "fac-1",
      intakeToken: "tok",
      answers: { occupancy: null, units: "skip" },
    });
    expect(res.status).toBe(200);
    const data = m.facilities.update.mock.calls[0][0].data;
    expect(data.intake_answers.occupancy).toBeUndefined();
    expect(data.intake_answers.units).toBeUndefined();
    expect(data.intake_answers.role).toBe("Owner");
    expect(data.occupancy_range).toBeNull();
    expect(data.total_units).toBeNull();
  });
});
