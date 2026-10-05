import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

vi.mock("@/lib/lead-matching", () => ({
  attemptAndPersistLeadMatch: vi.fn().mockResolvedValue({ status: "matched", linked: true }),
}));

import { matchCsvMoveIn, tenantFromRentRoll, type RentRollContactRow } from "@/lib/attribution/csv-move-in";
import { attemptAndPersistLeadMatch } from "@/lib/lead-matching";

const FAC = "33333333-3333-3333-3333-333333333333";
const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const rr = (o: Partial<RentRollContactRow> = {}): RentRollContactRow => ({
  unit: "B12", tenant_name: "Pat Rivera", account: "A-100", phone: "(269) 555-0142", email: "Pat@Example.com",
  size_label: "10x10", rental_start: new Date("2026-09-18T00:00:00Z"), rent_rate: 129,
  snapshot_date: new Date("2026-09-20T00:00:00Z"), ...o,
});

describe("tenantFromRentRoll", () => {
  it("builds the tenant from the rent-roll row", () => {
    expect(tenantFromRentRoll(FAC, rr(), "ev1")).toEqual({
      facility_id: FAC, external_id: "A-100", name: "Pat Rivera", email: "pat@example.com", phone: "(269) 555-0142",
      unit_number: "B12", unit_size: "10x10", monthly_rate: 129, move_in_date: new Date("2026-09-18T00:00:00Z"),
      status: "active", metadata: { source: "pms_csv", eventId: "ev1" },
    });
  });

  it("creates nothing it could never match — no phone and no email", () => {
    expect(tenantFromRentRoll(FAC, rr({ phone: null, email: null }))).toBeNull();
    expect(tenantFromRentRoll(FAC, rr({ phone: "555-0142", email: "not an email" }))).toBeNull();
  });

  it("falls back to the snapshot date and a zero rate when the export omits them", () => {
    const t = tenantFromRentRoll(FAC, rr({ rental_start: null, rent_rate: null, email: null }));
    expect(t?.move_in_date).toEqual(new Date("2026-09-20T00:00:00Z"));
    expect(t?.monthly_rate).toBe(0);
  });
});

describe("matchCsvMoveIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.facility_pms_rent_roll = { findFirst: vi.fn().mockResolvedValue({ ...rr(), rent_rate: "129.00" }) };
    mockDb.tenants = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "t-new" }),
    };
  });

  it("creates the tenant and runs lead matching on it", async () => {
    const res = await matchCsvMoveIn({ eventId: "ev1", facilityId: FAC, unit: "B12", account: "A-100" });
    expect(res).toEqual({ outcome: "matched", tenantId: "t-new", created: true });
    expect(mockDb.tenants.findFirst.mock.calls[0][0].where).toMatchObject({ facility_id: FAC, external_id: "A-100" });
    expect(vi.mocked(attemptAndPersistLeadMatch).mock.calls[0][1]).toMatchObject({
      id: "t-new", facility_id: FAC, phone: "(269) 555-0142", email: "pat@example.com", monthly_rate: 129,
    });
  });

  it("reuses a tenant already on file rather than duplicating it", async () => {
    mockDb.tenants.findFirst.mockResolvedValue({ id: "t-existing" });
    const res = await matchCsvMoveIn({ facilityId: FAC, unit: "B12", account: "A-100" });
    expect(res).toMatchObject({ tenantId: "t-existing", created: false });
    expect(mockDb.tenants.create).not.toHaveBeenCalled();
  });

  it("without an account, the same name in the same unit is the same tenancy", async () => {
    mockDb.facility_pms_rent_roll.findFirst.mockResolvedValue({ ...rr({ account: null }) });
    await matchCsvMoveIn({ facilityId: FAC, unit: "B12" });
    expect(mockDb.tenants.findFirst.mock.calls[0][0].where).toMatchObject({
      facility_id: FAC, unit_number: "B12", name: { equals: "Pat Rivera", mode: "insensitive" },
    });
  });

  it("leaves a move-in with no contact columns exactly as it was", async () => {
    mockDb.facility_pms_rent_roll.findFirst.mockResolvedValue({ ...rr({ phone: null, email: null }) });
    expect(await matchCsvMoveIn({ facilityId: FAC, unit: "B12" })).toEqual({ outcome: "no_contact" });
    expect(mockDb.tenants.create).not.toHaveBeenCalled();
    expect(attemptAndPersistLeadMatch).not.toHaveBeenCalled();
  });

  it("says so when the rent-roll row cannot be found", async () => {
    mockDb.facility_pms_rent_roll.findFirst.mockResolvedValue(null);
    expect(await matchCsvMoveIn({ facilityId: FAC, unit: "Z9" })).toEqual({ outcome: "no_rent_roll_row" });
  });
});
