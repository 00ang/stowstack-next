import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import type { TouchRecord } from "@/lib/attribution/touch";

vi.mock("@/lib/platform-auth", () => ({ getValidGoogleToken: vi.fn().mockResolvedValue("tok") }));

import {
  clickCutoff,
  conversionActionResource,
  conversionTime,
  googleDateTime,
  googleUploadBody,
  moveInEventId,
  planGoogle,
  planMeta,
  readGoogleResponse,
  reportMoveInToGoogle,
  reportMoveInToMeta,
  type MoveInFacts,
} from "@/lib/attribution/write-back";
import { getValidGoogleToken } from "@/lib/platform-auth";

const d = (iso: string) => new Date(iso);
const touch = (o: Partial<TouchRecord> & { occurred_at: Date }): TouchRecord => ({
  kind: "visit", channel: "direct", source: null, url: null, referrer: null,
  utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
  gclid: null, gbraid: null, wbraid: null, fbclid: null, fbc: null, fbp: null, ttclid: null, msclkid: null,
  ...o,
});
const facts = (o: Partial<MoveInFacts> = {}): MoveInFacts => ({
  now: d("2026-10-04T12:00:00Z"),
  moveInDate: "2026-10-01",
  monthlyRate: 129,
  email: "pat@example.com",
  phone: "+12695550142",
  name: "Pat Rivera",
  touches: [],
  ...o,
});

// ── Pure rules ─────────────────────────────────────────────────────────────

describe("conversionTime", () => {
  const now = d("2026-10-04T12:00:00Z");

  it("places a date-only move-in at 17:00 UTC", () => {
    expect(conversionTime("2026-10-01", null, now).toISOString()).toBe("2026-10-01T17:00:00.000Z");
  });

  it("is never before the click it is credited to", () => {
    // Clicked the evening of the move-in day, after our midday placeholder.
    const click = d("2026-10-01T22:30:00Z");
    expect(conversionTime("2026-10-01", click, now).toISOString()).toBe("2026-10-01T22:31:00.000Z");
  });

  it("is never in the future", () => {
    expect(conversionTime("2026-10-09", null, now).getTime()).toBe(now.getTime());
  });

  it("falls back to now with no move-in date", () => {
    expect(conversionTime(null, null, now).getTime()).toBe(now.getTime());
  });

  it("accepts the Date a DATE column comes back as", () => {
    expect(conversionTime(d("2026-10-01T00:00:00Z"), null, now).toISOString()).toBe("2026-10-01T17:00:00.000Z");
  });
});

describe("clickCutoff", () => {
  it("is the end of the move-in day — a click that evening still counts", () => {
    expect(clickCutoff("2026-10-01", d("2026-10-04T00:00:00Z")).toISOString()).toBe("2026-10-01T23:59:59.000Z");
  });
  it("is now when the move-in day has not ended", () => {
    const now = d("2026-10-01T08:00:00Z");
    expect(clickCutoff("2026-10-01", now)).toBe(now);
  });
});

describe("googleDateTime", () => {
  it("formats exactly as Google requires", () => {
    expect(googleDateTime(d("2026-10-01T17:00:00.123Z"))).toBe("2026-10-01 17:00:00+00:00");
  });
});

describe("planMeta", () => {
  it("sends a Purchase with hashed-to-be identifiers, the rent as value and the click's fbc", () => {
    const clickAt = d("2026-09-28T15:00:00Z");
    const plan = planMeta(facts({ touches: [touch({ occurred_at: clickAt, fbclid: "F1", fbp: "fb.1.1.P" })] }));
    expect(plan).toMatchObject({
      send: true,
      value: 129,
      clickIdType: "fbc",
      userData: {
        email: "pat@example.com", phone: "+12695550142", firstName: "Pat", lastName: "Rivera",
        fbc: `fb.1.${clickAt.getTime()}.F1`, fbp: "fb.1.1.P",
      },
    });
  });

  it("still sends on email/phone alone — Meta can match an offline sale without a click", () => {
    const plan = planMeta(facts());
    expect(plan).toMatchObject({ send: true, clickIdType: "none" });
  });

  it("skips when there is nothing Meta could match on", () => {
    expect(planMeta(facts({ email: null, phone: null }))).toMatchObject({ send: false, reason: "no_identifiers" });
  });

  it("skips a move-in older than Meta's 62-day physical_store window", () => {
    expect(planMeta(facts({ moveInDate: "2026-07-01" }))).toMatchObject({ send: false, reason: "too_old" });
  });

  it("omits a zero or missing rent rather than reporting $0", () => {
    expect(planMeta(facts({ monthlyRate: 0 }))).toMatchObject({ send: true, value: null });
    expect(planMeta(facts({ monthlyRate: null }))).toMatchObject({ send: true, value: null });
  });
});

describe("planGoogle", () => {
  it("credits the most recent Google click", () => {
    const plan = planGoogle(facts({
      touches: [
        touch({ occurred_at: d("2026-09-01T00:00:00Z"), gclid: "OLD" }),
        touch({ occurred_at: d("2026-09-25T00:00:00Z"), gbraid: "IOS" }),
      ],
    }));
    expect(plan).toMatchObject({ send: true, click: { type: "gbraid", value: "IOS" }, value: 129 });
  });

  it("skips a move-in with no Google click — it did not come from a Google ad we can prove", () => {
    const plan = planGoogle(facts({ touches: [touch({ occurred_at: d("2026-09-25T00:00:00Z"), fbclid: "F" })] }));
    expect(plan).toMatchObject({ send: false, reason: "no_click_id" });
  });

  it("ignores clicks after the move-in day", () => {
    const plan = planGoogle(facts({ touches: [touch({ occurred_at: d("2026-10-03T00:00:00Z"), gclid: "LATE" })] }));
    expect(plan).toMatchObject({ send: false, reason: "no_click_id" });
  });
});

describe("googleUploadBody", () => {
  const click = { type: "gclid" as const, value: "G1", clickedAt: d("2026-09-25T00:00:00Z") };

  it("sends exactly one click id, the order id for dedupe, and partialFailure", () => {
    const body = googleUploadBody({
      customerId: "123-456-7890", conversionAction: "987", click,
      conversionAt: d("2026-10-01T17:00:00Z"), value: 129, orderId: "movein:t1",
    });
    expect(body).toEqual({
      conversions: [{
        gclid: "G1",
        conversionAction: "customers/1234567890/conversionActions/987",
        conversionDateTime: "2026-10-01 17:00:00+00:00",
        orderId: "movein:t1",
        currencyCode: "USD",
        conversionValue: 129,
      }],
      partialFailure: true,
    });
  });

  it("accepts a full resource name for the conversion action", () => {
    expect(conversionActionResource("123", "customers/999/conversionActions/5")).toBe("customers/999/conversionActions/5");
  });

  it("leaves the value off when there is none", () => {
    const body = googleUploadBody({
      customerId: "1", conversionAction: "2", click, conversionAt: d("2026-10-01T17:00:00Z"), value: null, orderId: "o",
    }) as { conversions: Record<string, unknown>[] };
    expect(body.conversions[0]).not.toHaveProperty("conversionValue");
  });
});

describe("readGoogleResponse — what to retry", () => {
  it("success", () => {
    expect(readGoogleResponse(200, { results: [{}] })).toEqual({ ok: true, alreadyReported: false });
  });
  it("a duplicate is success: an earlier attempt landed", () => {
    const body = { partialFailureError: { code: 3, message: "x", details: [{ errors: [{ errorCode: { conversionUploadError: "CLICK_CONVERSION_ALREADY_EXISTS" } }] }] } };
    expect(readGoogleResponse(200, body)).toEqual({ ok: true, alreadyReported: true });
  });
  it("a row-level rejection is final", () => {
    const body = { partialFailureError: { code: 3, message: "The click is too old" } };
    expect(readGoogleResponse(200, body)).toEqual({ ok: false, transient: false, detail: "The click is too old" });
  });
  it("429 and 5xx are transient", () => {
    expect(readGoogleResponse(429, "slow down")).toMatchObject({ ok: false, transient: true });
    expect(readGoogleResponse(503, "down")).toMatchObject({ ok: false, transient: true });
  });
  it("other 4xx are final", () => {
    expect(readGoogleResponse(400, { error: "bad" })).toMatchObject({ ok: false, transient: false });
  });
});

describe("moveInEventId", () => {
  it("is the same for every attempt at the same move-in", () => {
    expect(moveInEventId("t1")).toBe("movein:t1");
  });
});

// ── Handlers, against mocked I/O ───────────────────────────────────────────

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const LEAD = "11111111-1111-1111-1111-111111111111";
const TENANT = "22222222-2222-2222-2222-222222222222";
const FAC = "33333333-3333-3333-3333-333333333333";
const ctx = (payload: unknown) => ({ id: "j1", payload, cursor: null, attempt: 1, shouldYield: () => false });

function wireDb(opts: { touches?: Record<string, unknown>[]; existing?: string | null; connection?: Record<string, unknown> | null } = {}) {
  mockDb.partial_leads = {
    findUnique: vi.fn().mockResolvedValue({ id: LEAD, email: "lead@example.com", phone: "+12695550142", name: "Pat Rivera", facility_id: FAC, visitor_id: "v1" }),
  };
  mockDb.tenants = {
    findUnique: vi.fn().mockResolvedValue({
      id: TENANT, facility_id: FAC, email: null, phone: "+12695550142", name: "Pat Rivera",
      monthly_rate: 129, move_in_date: new Date(Date.now() - 3 * 86_400_000),
    }),
  };
  mockDb.touches = { findMany: vi.fn().mockResolvedValue(opts.touches ?? []) };
  mockDb.conversion_reports = {
    findUnique: vi.fn().mockResolvedValue(opts.existing ? { status: opts.existing } : null),
    upsert: vi.fn().mockResolvedValue({}),
  };
  mockDb.platform_connections = { findUnique: vi.fn().mockResolvedValue(opts.connection ?? null) };
}
const lastReport = () => mockDb.conversion_reports.upsert.mock.calls.at(-1)?.[0];

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(getValidGoogleToken).mockResolvedValue("tok");
  process.env.META_PIXEL_ID = "PIXEL";
  process.env.META_ACCESS_TOKEN = "META_TOKEN";
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "DEV";
  process.env.GOOGLE_ADS_CLIENT_ID = "CID";
  process.env.GOOGLE_ADS_CLIENT_SECRET = "SECRET";
  delete process.env.GOOGLE_ADS_MOVE_IN_CONVERSION_ACTION_ID;
});
afterEach(() => vi.unstubAllGlobals());

describe("prove.meta-conversion", () => {
  const recentClick = () => ({ ...touch({ occurred_at: new Date(Date.now() - 5 * 86_400_000), fbclid: "F1" }), id: "t1" });

  it("freezes a malformed payload rather than retrying it", async () => {
    wireDb();
    expect(await reportMoveInToMeta(ctx({}))).toMatchObject({ kind: "unknown" });
  });

  it("does nothing when this move-in was already reported", async () => {
    wireDb({ existing: "sent" });
    expect(await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a physical_store Purchase with the move-in event id and records it", async () => {
    wireDb({ touches: [recentClick()] });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const res = await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT, facilityId: FAC }));
    expect(res).toMatchObject({ kind: "done", progressDone: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/PIXEL/events");
    const sent = JSON.parse(init.body).data[0];
    expect(sent).toMatchObject({
      event_name: "Purchase",
      action_source: "physical_store",
      event_id: `movein:${TENANT}`,
      custom_data: { value: 129, currency: "USD" },
    });
    expect(sent.user_data.fbc).toMatch(/^fb\.1\.\d+\.F1$/);
    expect(sent.user_data.ph).toMatch(/^[0-9a-f]{64}$/); // hashed, never raw
    expect(lastReport().create).toMatchObject({ platform: "meta", status: "sent", click_id_type: "fbc" });
  });

  it("uses the facility's own pixel and token when its connection names one", async () => {
    wireDb({ touches: [recentClick()], connection: { access_token: "FAC_TOKEN", metadata: { pixelId: "FAC_PIXEL" } } });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/FAC_PIXEL/events");
    expect(JSON.parse(init.body).access_token).toBe("FAC_TOKEN");
  });

  it("records a rejection and stops — Meta will refuse the same event again", async () => {
    wireDb({ touches: [recentClick()] });
    fetchMock.mockResolvedValue(new Response('{"error":"bad"}', { status: 400 }));
    expect(await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(lastReport().create).toMatchObject({ status: "failed", reason: "rejected" });
  });

  it("throws on a transient failure so the queue retries; the event id makes the retry harmless", async () => {
    wireDb({ touches: [recentClick()] });
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }));
    await expect(reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }))).rejects.toThrow(/transient/);
    expect(lastReport().create).toMatchObject({ status: "failed", reason: "transient" });
  });

  it("records 'not_configured' without calling Meta when no pixel is set", async () => {
    wireDb({ touches: [recentClick()] });
    delete process.env.META_PIXEL_ID;
    expect(await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastReport().create).toMatchObject({ status: "skipped", reason: "not_configured" });
  });

  it("records a skip when the lead or tenant has gone", async () => {
    wireDb();
    mockDb.tenants.findUnique.mockResolvedValue(null);
    expect(await reportMoveInToMeta(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(lastReport().create).toMatchObject({ status: "skipped", reason: "lead_or_tenant_missing" });
  });
});

describe("prove.google-conversion", () => {
  const gclick = () => ({ ...touch({ occurred_at: new Date(Date.now() - 6 * 86_400_000), gclid: "G1" }), id: "t2" });
  const connection = {
    id: "c1", access_token: "a", refresh_token: "r", token_expires_at: new Date(Date.now() + 3_600_000),
    account_id: "123-456-7890", metadata: { customers: ["1234567890"], moveInConversionActionId: "987", loginCustomerId: "555-555-5555" },
  };

  it("skips, without touching credentials, when there is no Google click", async () => {
    wireDb({ connection });
    expect(await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastReport().create).toMatchObject({ platform: "google", status: "skipped", reason: "no_click_id" });
  });

  it("uploads the click conversion with the order id and manager header", async () => {
    wireDb({ touches: [gclick()], connection });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ results: [{}] }), { status: 200 }));

    expect(await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }))).toMatchObject({ kind: "done", progressDone: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/customers\/1234567890:uploadClickConversions$/);
    expect(init.headers["login-customer-id"]).toBe("5555555555");
    expect(init.headers["developer-token"]).toBe("DEV");
    const body = JSON.parse(init.body);
    expect(body.conversions[0]).toMatchObject({
      gclid: "G1", orderId: `movein:${TENANT}`, conversionAction: "customers/1234567890/conversionActions/987",
    });
    expect(lastReport().create).toMatchObject({ status: "sent", click_id_type: "gclid" });
  });

  it("falls back to the env conversion action for a single-account setup", async () => {
    process.env.GOOGLE_ADS_MOVE_IN_CONVERSION_ACTION_ID = "444";
    wireDb({ touches: [gclick()], connection: { ...connection, metadata: {} } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ results: [{}] }), { status: 200 }));
    await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).conversions[0].conversionAction).toMatch(/\/conversionActions\/444$/);
  });

  it("says exactly what is missing when no conversion action is configured", async () => {
    wireDb({ touches: [gclick()], connection: { ...connection, metadata: {} } });
    await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lastReport().create).toMatchObject({ status: "skipped", reason: "no_conversion_action" });
  });

  it("records 'not_configured' when the facility has no Google Ads connection", async () => {
    wireDb({ touches: [gclick()], connection: null });
    await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }));
    expect(lastReport().create).toMatchObject({ status: "skipped", reason: "not_configured" });
  });

  it("a dead token is a failure to fix by reconnecting, not to retry", async () => {
    wireDb({ touches: [gclick()], connection });
    vi.mocked(getValidGoogleToken).mockResolvedValue(null);
    expect(await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }))).toEqual({ kind: "done" });
    expect(lastReport().create).toMatchObject({ status: "failed", reason: "token_unavailable" });
  });

  it("treats Google's duplicate error as already reported", async () => {
    wireDb({ touches: [gclick()], connection });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      partialFailureError: { code: 3, message: "dup", details: [{ errors: [{ errorCode: { conversionUploadError: "CLICK_CONVERSION_ALREADY_EXISTS" } }] }] },
    }), { status: 200 }));
    await reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }));
    expect(lastReport().create).toMatchObject({ status: "sent", reason: "already_reported" });
  });

  it("retries a network failure", async () => {
    wireDb({ touches: [gclick()], connection });
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(reportMoveInToGoogle(ctx({ leadId: LEAD, tenantId: TENANT }))).rejects.toThrow(/transient/);
    expect(lastReport().create).toMatchObject({ status: "failed", reason: "transient" });
  });
});
