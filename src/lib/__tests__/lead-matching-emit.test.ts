import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/events/bus", () => ({ emit: vi.fn().mockResolvedValue({ emitted: 1, duplicates: 0, fannedOut: 2 }) }));
vi.mock("@/lib/lead-events", () => ({ markLeadAsMatchedTenant: vi.fn().mockResolvedValue({ recorded: true, fromStatus: "new" }) }));

import { attemptAndPersistLeadMatch } from "@/lib/lead-matching";
import { emit } from "@/lib/events/bus";
import { markLeadAsMatchedTenant } from "@/lib/lead-events";

const FAC = "33333333-3333-3333-3333-333333333333";
const TENANT = { id: "22222222-2222-2222-2222-222222222222", facility_id: FAC, phone: "+12695550142", move_in_date: "2026-10-01", monthly_rate: "129.00" };
const lead = (id: string) => ({ id, email: null, phone: "2695550142", name: "Pat", created_at: new Date("2026-09-20T00:00:00Z") });

/** A client whose queries answer, in order: the phone strategy, then the attempt insert. */
let $executeRaw = vi.fn();
function client(phoneRows: unknown[]) {
  const $queryRaw = vi.fn().mockResolvedValueOnce(phoneRows).mockResolvedValueOnce([{ id: "attempt-1" }]);
  $executeRaw = vi.fn().mockResolvedValue(1);
  return { $queryRaw, $executeRaw } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("attemptAndPersistLeadMatch → lead.moved_in", () => {
  it("emits once on a single confident match, keyed by tenant so it reports once", async () => {
    const res = await attemptAndPersistLeadMatch(client([lead("L1")]), TENANT);
    expect(res).toMatchObject({ status: "matched", linked: true });
    expect(emit).toHaveBeenCalledTimes(1);
    const [events, tenantKey] = vi.mocked(emit).mock.calls[0];
    expect(tenantKey).toBe(FAC);
    expect(events).toEqual([
      expect.objectContaining({
        type: "lead.moved_in",
        sourceKey: `tenant:${TENANT.id}`,
        payload: expect.objectContaining({
          facilityId: FAC, leadId: "L1", tenantId: TENANT.id,
          moveInDate: "2026-10-01", monthlyRate: 129, matchMethod: "phone_exact", confidence: 0.95,
        }),
      }),
    ]);
  });

  it("emits nothing for an ambiguous match — a person resolves it first", async () => {
    const res = await attemptAndPersistLeadMatch(client([lead("L1"), lead("L2")]), TENANT);
    expect(res.status).toBe("ambiguous");
    expect(emit).not.toHaveBeenCalled();
  });

  it("emits nothing when the link itself failed", async () => {
    vi.mocked(markLeadAsMatchedTenant).mockRejectedValueOnce(new Error("db"));
    const res = await attemptAndPersistLeadMatch(client([lead("L1")]), TENANT);
    expect(res.linked).toBe(false);
    expect(emit).not.toHaveBeenCalled();
  });

  it("an emit failure never fails the tenant import", async () => {
    vi.mocked(emit).mockRejectedValueOnce(new Error("bus down"));
    await expect(attemptAndPersistLeadMatch(client([lead("L1")]), TENANT)).resolves.toMatchObject({ linked: true });
  });

  it("records the rent and move-in date on the lead, so cost per move-in has revenue", async () => {
    await attemptAndPersistLeadMatch(client([lead("L1")]), TENANT);
    expect($executeRaw).toHaveBeenCalledTimes(1);
    const [strings, rate, moveIn, leadId] = $executeRaw.mock.calls[0];
    expect((strings as TemplateStringsArray).join("?")).toMatch(/monthly_revenue = COALESCE\(monthly_revenue/);
    expect([rate, moveIn, leadId]).toEqual([129, "2026-10-01", "L1"]);
  });

  it("does not touch revenue for an ambiguous match", async () => {
    await attemptAndPersistLeadMatch(client([lead("L1"), lead("L2")]), TENANT);
    expect($executeRaw).not.toHaveBeenCalled();
  });
});
