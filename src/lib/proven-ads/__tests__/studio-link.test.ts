import { describe, expect, it } from "vitest";
import { adStudioDraftPath } from "../studio-link";

describe("adStudioDraftPath", () => {
  it("keeps the variation and scopes the draft to the facility", () => {
    expect(
      adStudioDraftPath("/admin/studio/ad-generator?variation=var-9", "fac-1")
    ).toBe("/admin/studio/ad-generator?variation=var-9&facility=fac-1");
  });

  it("accepts an absolute studio URL", () => {
    expect(
      adStudioDraftPath("https://storageads.com/admin/studio/ad-generator?variation=abc", "fac-2")
    ).toBe("/admin/studio/ad-generator?variation=abc&facility=fac-2");
  });
});
