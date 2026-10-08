import { describe, expect, it } from "vitest";
import { recoveryDay3Message } from "@/lib/funnels/recovery-copy";

const FREE = /first month free/i;

describe("recoveryDay3Message", () => {
  it("does not invent an offer the facility does not run", () => {
    const line = recoveryDay3Message("Maple Street Storage", []);
    expect(line).toMatch(/Maple Street Storage/);
    expect(line).not.toMatch(FREE);
    const inactive = recoveryDay3Message("Maple Street Storage", [
      { name: "First month free", active: false },
    ]);
    expect(inactive).not.toMatch(FREE);
  });

  it("names the special the facility is running, and only that special", () => {
    const line = recoveryDay3Message("Maple Street Storage", [
      { name: "First month free", active: false },
      { name: "15% off climate", description: "three months", active: true },
    ]);
    expect(line).toContain("15% off climate");
    expect(line).not.toMatch(FREE);
  });

  it("may name first month free when that is the running special", () => {
    const line = recoveryDay3Message("Maple Street Storage", [
      { name: "First month free", active: true },
    ]);
    expect(line).toMatch(FREE);
  });
});
