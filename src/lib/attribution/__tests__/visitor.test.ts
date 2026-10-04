import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  identifyFromRequest,
  isVisitorId,
  loadLeadTouches,
  readVisitorId,
  seeVisitor,
} from "@/lib/attribution/visitor";
import { phoneHash } from "@/lib/attribution/touch";

const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn> | Record<string, ReturnType<typeof vi.fn>>>;
const VID = "0b9e1d3a-5c4f-4e2a-9b7c-1a2b3c4d5e6f";
const LEAD = "11111111-1111-1111-1111-111111111111";
const FAC = "33333333-3333-3333-3333-333333333333";

function reqWith(cookie?: string) {
  const req = new NextRequest(new URL("http://localhost:3000/api/consumer-lead"));
  if (cookie) req.cookies.set("sa_vid", cookie);
  return req;
}
const executeRaw = () => mockDb.$executeRaw as ReturnType<typeof vi.fn>;
const sqlOf = (call: unknown[]) => (call[0] as TemplateStringsArray).join("?");

beforeEach(() => {
  vi.clearAllMocks();
  executeRaw().mockResolvedValue(1);
});

describe("visitor ids", () => {
  it("accepts only the UUIDs we mint", () => {
    expect(isVisitorId(VID)).toBe(true);
    expect(isVisitorId("abc")).toBe(false);
    expect(isVisitorId("' OR 1=1 --")).toBe(false);
    expect(isVisitorId(undefined)).toBe(false);
  });

  it("reads the cookie, normalised to lower case", () => {
    expect(readVisitorId(reqWith(VID.toUpperCase()))).toBe(VID);
    expect(readVisitorId(reqWith("garbage"))).toBeNull();
    expect(readVisitorId(reqWith())).toBeNull();
  });
});

describe("seeVisitor", () => {
  it("reports whether this call created the visitor", async () => {
    (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ inserted: true }]);
    expect(await seeVisitor(VID)).toEqual({ isNew: true });
    (mockDb.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ inserted: false }]);
    expect(await seeVisitor(VID)).toEqual({ isNew: false });
  });
});

describe("identifyFromRequest", () => {
  it("does nothing without a visitor cookie", async () => {
    await identifyFromRequest(reqWith(), LEAD);
    expect(executeRaw()).not.toHaveBeenCalled();
  });

  it("does nothing without a lead id", async () => {
    await identifyFromRequest(reqWith(VID), null);
    expect(executeRaw()).not.toHaveBeenCalled();
  });

  it("ties the visitor, the lead and the visitor's earlier touches together", async () => {
    await identifyFromRequest(reqWith(VID), LEAD);
    const sql = executeRaw().mock.calls.map(sqlOf);
    expect(sql).toHaveLength(3);
    expect(sql[0]).toMatch(/INSERT INTO visitors[\s\S]*COALESCE\(visitors\.partial_lead_id/); // first identification wins
    expect(sql[1]).toMatch(/UPDATE partial_leads SET visitor_id[\s\S]*visitor_id IS NULL/);
    expect(sql[2]).toMatch(/UPDATE touches SET partial_lead_id[\s\S]*partial_lead_id IS NULL/);
  });

  it("never throws — a lead that fails to link is still a lead", async () => {
    executeRaw().mockRejectedValue(new Error("db down"));
    await expect(identifyFromRequest(reqWith(VID), LEAD)).resolves.toBeUndefined();
  });
});

describe("loadLeadTouches", () => {
  beforeEach(() => {
    mockDb.partial_leads = { findUnique: vi.fn() };
    mockDb.touches = { findMany: vi.fn().mockResolvedValue([]) };
  });

  it("returns nothing for an unknown lead", async () => {
    (mockDb.partial_leads as Record<string, ReturnType<typeof vi.fn>>).findUnique.mockResolvedValue(null);
    expect(await loadLeadTouches(LEAD)).toEqual([]);
  });

  it("reads the lead's own touches, its visitors' touches, and calls from its phone", async () => {
    (mockDb.partial_leads as Record<string, ReturnType<typeof vi.fn>>).findUnique.mockResolvedValue({
      id: LEAD, facility_id: FAC, visitor_id: VID, phone: "(269) 555-0142",
    });
    await loadLeadTouches(LEAD);
    const args = (mockDb.touches as Record<string, ReturnType<typeof vi.fn>>).findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ occurred_at: "asc" });
    expect(args.where.OR).toEqual([
      { partial_lead_id: LEAD },
      { visitor: { partial_lead_id: LEAD } },
      { visitor_id: VID },
      { kind: "call", facility_id: FAC, phone_hash: phoneHash("+12695550142") },
    ]);
  });

  it("omits the visitor and phone branches when the lead has neither", async () => {
    (mockDb.partial_leads as Record<string, ReturnType<typeof vi.fn>>).findUnique.mockResolvedValue({
      id: LEAD, facility_id: FAC, visitor_id: null, phone: null,
    });
    await loadLeadTouches(LEAD);
    const args = (mockDb.touches as Record<string, ReturnType<typeof vi.fn>>).findMany.mock.calls[0][0];
    expect(args.where.OR).toEqual([{ partial_lead_id: LEAD }, { visitor: { partial_lead_id: LEAD } }]);
  });
});
