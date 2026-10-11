import { describe, expect, it } from "vitest";
import { allowVercelInsight } from "@/lib/vercel-insights";

describe("allowVercelInsight", () => {
  it("drops admin and portal, including nested routes", () => {
    expect(allowVercelInsight("https://storageads.com/admin")).toBe(false);
    expect(allowVercelInsight("https://storageads.com/admin/facilities")).toBe(false);
    expect(allowVercelInsight("https://storageads.com/portal")).toBe(false);
    expect(allowVercelInsight("https://storageads.com/portal/billing?tab=invoices")).toBe(false);
    expect(allowVercelInsight("/admin")).toBe(false);
    expect(allowVercelInsight("/portal/onboarding")).toBe(false);
  });

  it("keeps public marketing pages and lookalike paths", () => {
    expect(allowVercelInsight("https://storageads.com/")).toBe(true);
    expect(allowVercelInsight("https://storageads.com/pricing")).toBe(true);
    expect(allowVercelInsight("https://storageads.com/audit-tool")).toBe(true);
    expect(allowVercelInsight("/blog/how-operators-fill-units")).toBe(true);
    expect(allowVercelInsight("https://storageads.com/administrator")).toBe(true);
    expect(allowVercelInsight("https://storageads.com/portals")).toBe(true);
    expect(allowVercelInsight("https://storageads.com/partner")).toBe(true);
  });
});
