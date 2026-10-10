import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminRequest } from "@/test/helpers";

vi.mock("@/lib/db", () => ({
  db: {
    facilities: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    shared_audits: { create: vi.fn().mockResolvedValue({}) },
    audits: { create: vi.fn().mockResolvedValue({}) },
    activity_log: { create: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  SENDERS: { notifications: "StorageAds <notifications@storageads.com>" },
}));

vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
}));

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { POST } from "../route";

const facilities = db.facilities as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const shared = db.shared_audits.create as unknown as ReturnType<typeof vi.fn>;
const audits = db.audits.create as unknown as ReturnType<typeof vi.fn>;
const log = db.activity_log.create as unknown as ReturnType<typeof vi.fn>;
const mail = sendEmail as unknown as ReturnType<typeof vi.fn>;

const thin = {
  facilityName: "Sample Facility (not a real lead)",
  facilityAddress: "",
  contactName: "Pat",
  contactEmail: "pat@example.com",
  contactPhone: "+15125550100",
  websiteUrl: "",
  role: "Owner",
  facilityAge: "Open and stabilized (3+ years)",
  facilityCount: "1",
  occupancy: "",
  totalUnits: "",
  biggerIssue: "Not enough leads coming in",
  moveIns30Days: "Move-outs matched or beat move-ins",
  monthlyAdSpend: "None",
  urgency: "This month",
  additionalNotes: "Leads dried up after the summer.",
};

function anthropicOk() {
  return {
    ok: true,
    json: async () => ({
      content: [
        {
          text: JSON.stringify({
            executiveSummary: "Thin on purpose. No dollar figure.",
            categories: [
              {
                name: "Leads",
                slug: "leads",
                score: 40,
                summary: "Not enough leads, and that is all we were told.",
                greenFlags: ["Owner", "Open"],
                yellowFlag: "Move-outs are keeping up.",
                redFlags: ["No rate", "No count", "No website"],
                actions: [],
              },
            ],
          }),
        },
      ],
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  facilities.findUnique.mockResolvedValue(null);
  facilities.update.mockResolvedValue({});
  shared.mockResolvedValue({});
  audits.mockResolvedValue({});
  log.mockResolvedValue({});
  process.env.ANTHROPIC_API_KEY = "test-anthropic";
});

describe("diagnostic audit delivery", () => {
  it("stores a thin audit without invented vacancy dollars and marks it sent only after the email id comes back", async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicOk());
    vi.stubGlobal("fetch", fetchMock);
    mail.mockResolvedValue({ ok: true, id: "re_123", attempts: 1 });

    const res = await POST(
      createAdminRequest("http://localhost:3000/api/audit-generate-diagnostic", {
        method: "POST",
        body: { diagnosticJson: thin, facilityId: "fac-1" },
      })
    );
    expect(res.status).toBe(200);

    const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content as string;
    expect(prompt).toContain("Do not estimate a percentage");
    expect(prompt).not.toContain("~75%");
    expect(prompt).not.toContain("~300");
    expect(prompt).toContain("Do not invent");

    const stored = shared.mock.calls[0][0].data.audit_json;
    expect(stored.vacancyCost.annualLoss).toBe(0);
    expect(stored.vacancyCost.monthlyLoss).toBe(0);
    expect(stored.vacancyCost.dollarsKnown).toBe(false);
    expect(stored.vacancyCost.avgUnitRate).toBe(0);
    expect(audits).toHaveBeenCalled();

    const statusWrite = facilities.update.mock.calls.map((c) => c[0].data).find((d) => d.pipeline_status);
    expect(statusWrite.pipeline_status).toBe("audit_sent");
    expect(statusWrite.audit_email_id).toBe("re_123");
    expect(statusWrite.audit_sent_at).toBeInstanceOf(Date);
    expect(mail).toHaveBeenCalled();
    const operator = mail.mock.calls.find((c) => c[0].to === "pat@example.com");
    expect(operator?.[0].html).toContain("No dollar loss");
    expect(operator?.[0].html).not.toContain("$110");
  });

  it("does not say audit_sent when the email is refused", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(anthropicOk()));
    mail.mockResolvedValue({ ok: false, error: "Resend 422: bad", attempts: 1 });

    const res = await POST(
      createAdminRequest("http://localhost:3000/api/audit-generate-diagnostic", {
        method: "POST",
        body: { diagnosticJson: thin, facilityId: "fac-1" },
      })
    );
    expect(res.status).toBe(200);
    const statusWrite = facilities.update.mock.calls.map((c) => c[0].data).find((d) => d.pipeline_status);
    expect(statusWrite.pipeline_status).toBe("audit_not_delivered");
    expect(statusWrite.audit_email_id).toBeUndefined();
    expect(log).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "audit_delivery_failed" }),
    });
  });
});
