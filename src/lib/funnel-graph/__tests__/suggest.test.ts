import { describe, expect, it } from "vitest";
import { suggestTemplate } from "@/lib/funnel-graph/suggest";
import type { FunnelContext } from "@/lib/funnel-graph";

const base: FunnelContext = {
  goal: { moveIns: 12, month: "October" },
  unitsSummary: { empty: 54, total: 322 },
  units: [
    { key: "a", name: "10×10", empty: 18, total: 80, driveUp: true, climate: false },
    { key: "b", name: "10×20", empty: 6, total: 40, driveUp: true, climate: false },
    { key: "c", name: "10×10 Climate", empty: 12, total: 40, driveUp: false, climate: true },
  ],
  offers: [{ key: "o", name: "Climate Fall Special", deal: "First month $1", active: true }],
};

describe("suggestTemplate", () => {
  it("fills drive-up when drive-up has the most empty", () => {
    const s = suggestTemplate(base);
    expect(s.key).toBe("drive");
    expect(s.because).toEqual(["Goal: 12 move-ins in October.", "10×10 has 18 empty, 10×20 has 6 empty."]);
  });

  it("pushes climate with the running special when climate has more empty", () => {
    const s = suggestTemplate({
      ...base,
      units: base.units!.map((u) => (u.climate ? { ...u, empty: 40 } : u)),
      unitsSummary: { empty: 64, total: 322 },
    });
    expect(s.key).toBe("shoulder");
    expect(s.because[1]).toBe("40 climate units empty against 24 drive-up.");
    expect(s.because[2]).toContain("Climate Fall Special");
  });

  it("does not lead with a special the facility isn't running", () => {
    const s = suggestTemplate({
      ...base,
      units: base.units!.map((u) => (u.climate ? { ...u, empty: 40 } : u)),
      offers: [{ key: "o", name: "Old Special", deal: "x", active: false }],
    });
    expect(s.key).toBe("drive");
  });

  it("calls a mostly empty building a lease-up", () => {
    const s = suggestTemplate({ ...base, unitsSummary: { empty: 150, total: 322 } });
    expect(s.key).toBe("lease");
    expect(s.because[1]).toBe("150 of 322 units are empty (47%), so every size needs reach.");
  });

  it("still suggests something with no unit mix, and says what would sharpen it", () => {
    const s = suggestTemplate({ goal: { moveIns: 8, month: "November" } });
    expect(s.key).toBe("drive");
    expect(s.because[1]).toContain("add your unit mix");
  });

  it("is deterministic and leaves the goal out when there is none", () => {
    const a = suggestTemplate({ ...base, goal: undefined });
    const b = suggestTemplate({ ...base, goal: undefined });
    expect(a).toEqual(b);
    expect(a.because[0]).not.toContain("Goal");
  });
});
