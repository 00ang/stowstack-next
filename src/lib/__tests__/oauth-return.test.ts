import { describe, expect, it } from "vitest";
import { returnUrl, safeReturnTo } from "@/lib/oauth-return";

describe("safeReturnTo", () => {
  it("accepts StorageAds app paths", () => {
    expect(safeReturnTo("/portal/tools?tool=ad-publisher")).toBe("/portal/tools?tool=ad-publisher");
    expect(safeReturnTo("/admin/facilities")).toBe("/admin/facilities");
    expect(safeReturnTo("/partner/tools")).toBe("/partner/tools");
    expect(safeReturnTo("/portal")).toBe("/portal");
  });

  it("refuses anything that could leave the site or isn't an app path", () => {
    for (const bad of [
      "https://evil.example/portal",
      "//evil.example/portal",
      "/\\evil.example",
      "/portalx",
      "/",
      "/blog",
      "portal/tools",
      "/portal/\u0000",
      "",
      null,
      42,
      "/portal/" + "x".repeat(400),
    ]) {
      expect(safeReturnTo(bad), String(bad)).toBeNull();
    }
  });
});

describe("returnUrl", () => {
  it("returns to the path with the outcome on it", () => {
    expect(returnUrl("https://storageads.com", "/portal/tools?tool=ad-publisher", { auth: "success", platform: "meta" })).toBe(
      "https://storageads.com/portal/tools?tool=ad-publisher&auth=success&platform=meta",
    );
  });

  it("falls back to the homepage as before", () => {
    expect(returnUrl("https://storageads.com", null, { auth: "error", platform: "tiktok", message: "No access" })).toBe(
      "https://storageads.com/?auth=error&platform=tiktok&message=No+access",
    );
  });
});
