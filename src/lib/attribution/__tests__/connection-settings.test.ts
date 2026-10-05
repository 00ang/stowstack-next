import { describe, expect, it } from "vitest";
import { parseWriteBackSettings, readWriteBackSettings } from "@/lib/attribution/connection-settings";

describe("parseWriteBackSettings", () => {
  it("accepts a Meta pixel id", () => {
    expect(parseWriteBackSettings("meta", { pixelId: " 1234567890123456 " }))
      .toEqual({ ok: true, set: { pixelId: "1234567890123456" }, unset: [] });
  });

  it("accepts a conversion action as a bare id or a resource name", () => {
    expect(parseWriteBackSettings("google_ads", { moveInConversionActionId: "987654321" }))
      .toMatchObject({ ok: true, set: { moveInConversionActionId: "987654321" } });
    expect(parseWriteBackSettings("google_ads", { moveInConversionActionId: "customers/1234567890/conversionActions/55" }))
      .toMatchObject({ ok: true, set: { moveInConversionActionId: "customers/1234567890/conversionActions/55" } });
  });

  it("normalises a manager account to its ten digits", () => {
    expect(parseWriteBackSettings("google_ads", { loginCustomerId: "123-456-7890" }))
      .toMatchObject({ ok: true, set: { loginCustomerId: "1234567890" } });
  });

  it("clears a field sent empty", () => {
    expect(parseWriteBackSettings("google_ads", { moveInConversionActionId: "", loginCustomerId: null }))
      .toEqual({ ok: true, set: {}, unset: ["moveInConversionActionId", "loginCustomerId"] });
  });

  it("refuses malformed values with a message an operator can act on", () => {
    const r = parseWriteBackSettings("meta", { pixelId: "pixel-abc" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/digits only/);
    expect(parseWriteBackSettings("google_ads", { loginCustomerId: "12345" }).ok).toBe(false);
  });

  it("refuses any key that is not a write-back setting — OAuth data stays out of reach", () => {
    expect(parseWriteBackSettings("meta", { pageAccessToken: "steal" }).ok).toBe(false);
    expect(parseWriteBackSettings("meta", { moveInConversionActionId: "1" }).ok).toBe(false);
  });

  it("refuses platforms with no write-back", () => {
    expect(parseWriteBackSettings("tiktok", { pixelId: "123456" }).ok).toBe(false);
    expect(parseWriteBackSettings("meta", null).ok).toBe(false);
  });
});

describe("readWriteBackSettings", () => {
  it("returns only this platform's settings from metadata", () => {
    expect(readWriteBackSettings("google_ads", { customers: ["1"], moveInConversionActionId: "9", pixelId: "x" }))
      .toEqual({ moveInConversionActionId: "9" });
    expect(readWriteBackSettings("meta", null)).toEqual({});
  });
});
