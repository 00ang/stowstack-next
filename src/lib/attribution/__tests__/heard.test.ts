import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { agrees, heardFromWalkin, heardSequenceSteps, isHeardAnswer, readHeard } from "../heard";
import { askHowTheyHeard, readHeardToken, heardLink, setHeardAsk } from "../heard-ask";
import { signToken, verifyToken } from "@/lib/signed-token";
import { ledgerCsv, summarise, wayOf, type LedgerRow } from "../ledger-rows";

const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const DAY = 86_400_000;

describe("what they said", () => {
  it("knows its answers", () => {
    expect(isHeardAnswer("google_maps")).toBe(true);
    expect(isHeardAnswer("billboard")).toBe(false);
  });

  it("reads the office's walk-in form in the same terms", () => {
    expect(heardFromWalkin("facebook_instagram_ad")).toBe("social");
    expect(heardFromWalkin("drove_by_signage")).toBe("drove_by");
    expect(heardFromWalkin("repeat_customer")).toBe("returning");
    expect(heardFromWalkin("anything")).toBe("other");
  });

  it("says when what they said agrees with the visit, and stays quiet when a click can't tell", () => {
    expect(agrees("social", "paid_social", "meta")).toBe(true);
    expect(agrees("google_search", "paid_social", "meta")).toBe(false);
    expect(agrees("google_maps", "organic_search", "google")).toBe(true);
    expect(agrees("friend", "paid_social", "meta")).toBeNull();
    expect(agrees("social", null, null)).toBeNull();
  });

  it("reads an answer from tenant metadata, ignoring anything else there", () => {
    expect(readHeard({ heardFrom: { answer: "friend", at: "t", via: "counter" }, other: 1 })).toEqual({
      answer: "friend",
      at: "t",
      via: "counter",
    });
    expect(readHeard({ heardFrom: { answer: "nope" } })).toBeNull();
    expect(readHeard(null)).toBeNull();
  });

  it("asks one question, by email, with the signed link in it", () => {
    const [step] = heardSequenceSteps();
    expect(step.channel).toBe("email");
    expect(step.body).toContain("{heard_link}");
  });
});

describe("signed links", () => {
  it("round-trips, and is bound to its purpose", () => {
    const t = signToken("heard", { tid: "a" }, 60_000);
    expect(verifyToken("heard", t)).toMatchObject({ tid: "a" });
    expect(verifyToken("other", t)).toBeNull();
  });

  it("refuses a changed or expired token", () => {
    const t = signToken("heard", { tid: "a" }, 60_000);
    const [data, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ tid: "b", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyToken("heard", `${forged}.${sig}`)).toBeNull();
    expect(verifyToken("heard", `${data}.x${sig.slice(1)}`)).toBeNull();
    expect(verifyToken("heard", signToken("heard", { tid: "a" }, -1))).toBeNull();
  });

  it("makes a /heard link a tenant can answer from, and nothing else", () => {
    const url = new URL(heardLink("tenant-1", "fac-1"));
    expect(url.pathname).toBe("/heard");
    expect(readHeardToken(url.searchParams.get("t"))).toEqual({ tenantId: "tenant-1", facilityId: "fac-1" });
    expect(readHeardToken("junk")).toBeNull();
  });
});

describe("asking a new tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.nurture_sequences = {
      findFirst: vi.fn().mockResolvedValue({ id: "seq-1", steps: heardSequenceSteps() }),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    };
    mockDb.nurture_enrollments = { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) };
  });
  afterEach(() => vi.useRealTimers());

  const tenant = (over: Record<string, unknown> = {}) => ({
    id: "t1",
    facility_id: "f1",
    name: "Riley Chen",
    email: "riley@example.com",
    move_in_date: new Date(Date.now() - 2 * DAY),
    ...over,
  });

  it("enrols a tenant who just moved in, once, a day out, with their own link", async () => {
    expect(await askHowTheyHeard(tenant())).toBe(true);
    const data = mockDb.nurture_enrollments.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ sequence_id: "seq-1", tenant_id: "t1", contact_email: "riley@example.com" });
    expect(readHeardToken(new URL(data.metadata.heard_link).searchParams.get("t"))).toEqual({ tenantId: "t1", facilityId: "f1" });
    expect(data.next_send_at.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
  });

  it("never emails a long-standing tenant on a re-import, or anyone without an email", async () => {
    expect(await askHowTheyHeard(tenant({ move_in_date: new Date(Date.now() - 400 * DAY) }))).toBe(false);
    expect(await askHowTheyHeard(tenant({ move_in_date: null }))).toBe(false);
    expect(await askHowTheyHeard(tenant({ email: null }))).toBe(false);
    expect(mockDb.nurture_enrollments.create).not.toHaveBeenCalled();
  });

  it("does nothing while the owner has it off, and nothing twice", async () => {
    mockDb.nurture_sequences.findFirst = vi.fn().mockResolvedValue(null);
    expect(await askHowTheyHeard(tenant())).toBe(false);
    mockDb.nurture_sequences.findFirst = vi.fn().mockResolvedValue({ id: "seq-1", steps: heardSequenceSteps() });
    mockDb.nurture_enrollments.findFirst = vi.fn().mockResolvedValue({ id: "e1" });
    expect(await askHowTheyHeard(tenant())).toBe(true);
    expect(mockDb.nurture_enrollments.create).not.toHaveBeenCalled();
  });

  it("switches on by making the sequence, and off by pausing it", async () => {
    mockDb.nurture_sequences.findFirst = vi.fn().mockResolvedValue(null);
    await setHeardAsk("f1", true);
    expect(mockDb.nurture_sequences.create.mock.calls[0][0].data).toMatchObject({ trigger_type: "move_in_heard", status: "active" });
    mockDb.nurture_sequences.findFirst = vi.fn().mockResolvedValue({ id: "seq-1" });
    await setHeardAsk("f1", false);
    expect(mockDb.nurture_sequences.update.mock.calls[0][0].data).toMatchObject({ status: "paused" });
  });
});

describe("ledger rows", () => {
  const row = (over: Partial<LedgerRow>): LedgerRow => ({
    tenantId: "t",
    name: "A",
    unit: "1",
    size: "10x10",
    moveInDate: "2026-10-01",
    visit: null,
    lead: null,
    match: { status: "none", method: null, confidence: null, attemptId: null, candidates: [] },
    said: null,
    agrees: null,
    verdict: "unknown",
    way: "Not known yet",
    ...over,
  });

  it("names a visit in the owner's words", () => {
    expect(wayOf("paid_social", "meta")).toBe("Meta ad");
    expect(wayOf("paid_search", "google")).toBe("Google ad");
    expect(wayOf("organic_search", "google")).toBe("Google search or Maps");
    expect(wayOf("direct", null)).toBe("Typed the address");
  });

  it("counts traced, said, unsure and unknown, and the ways most first", () => {
    const s = summarise([
      row({ verdict: "both", way: "Meta ad" }),
      row({ verdict: "traced", way: "Meta ad" }),
      row({ verdict: "said", way: "Drove by or saw the sign" }),
      row({ verdict: "unsure", way: "Unsure: confirm the lead" }),
      row({}),
    ]);
    expect(s).toMatchObject({ total: 5, traced: 2, said: 1, unsure: 1, unknown: 1 });
    expect(s.byWay[0]).toEqual({ way: "Meta ad", count: 2 });
  });

  it("exports every row, quoted, with spreadsheet formulas neutralised", () => {
    const csv = ledgerCsv([row({ name: '=HYPERLINK("x")', way: 'Said "hi"' })]);
    const [head, line] = csv.split("\r\n");
    expect(head.split(",")[0]).toBe("move_in_date");
    expect(line).toContain(`"'=HYPERLINK(""x"")"`);
    expect(line).toContain(`"Said ""hi"""`);
  });
});
