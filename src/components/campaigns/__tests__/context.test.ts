import { describe, expect, it } from "vitest";
import { unitsSummaryFromReading } from "../context";

describe("unitsSummaryFromReading", () => {
  it("reads the same vacancy line the index header shows", () => {
    expect(unitsSummaryFromReading("54", "empty of 322")).toEqual({ empty: 54, total: 322 });
    expect(unitsSummaryFromReading("1,200", "empty of 4,000")).toEqual({ empty: 1200, total: 4000 });
  });

  it("ignores a header that is not a count", () => {
    expect(unitsSummaryFromReading("None", "uploaded yet")).toBeUndefined();
  });
});
