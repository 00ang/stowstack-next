import { describe, expect, it } from "vitest";
import {
  PROVEN_DAYS,
  daysRunning,
  isProven,
  shouldMarkInactive,
  whyFlagged,
} from "../days-running";

const start = new Date("2026-01-01T00:00:00.000Z");

function windowOf(
  over: Partial<{
    started_at: Date;
    last_seen_at: Date;
    ended_at: Date | null;
    active: boolean;
    source: string;
  }> = {}
) {
  return {
    started_at: over.started_at ?? start,
    last_seen_at: over.last_seen_at ?? new Date("2026-03-15T00:00:00.000Z"),
    ended_at: over.ended_at ?? null,
    active: over.active ?? true,
    source: over.source ?? "meta_ad_library_api",
  };
}

describe("daysRunning", () => {
  it("counts from start to now for an active ad", () => {
    const now = new Date("2026-03-02T00:00:00.000Z");
    expect(daysRunning(windowOf(), now)).toBe(60);
  });

  it("floors partial days", () => {
    const now = new Date("2026-01-02T23:00:00.000Z");
    expect(daysRunning(windowOf(), now)).toBe(1);
  });

  it("never goes negative if start is in the future", () => {
    const now = new Date("2025-12-01T00:00:00.000Z");
    expect(daysRunning(windowOf(), now)).toBe(0);
  });

  it("freezes an inactive ad at ended_at when present", () => {
    const ended = new Date("2026-02-10T00:00:00.000Z");
    expect(
      daysRunning(
        windowOf({ active: false, ended_at: ended, last_seen_at: new Date("2026-03-01") }),
        new Date("2026-06-01")
      )
    ).toBe(40);
  });

  it("uses last_seen when an inactive ad has no ended_at", () => {
    expect(
      daysRunning(
        windowOf({
          active: false,
          ended_at: null,
          last_seen_at: new Date("2026-01-31T00:00:00.000Z"),
        }),
        new Date("2026-06-01")
      )
    ).toBe(30);
  });
});

describe("isProven", () => {
  it("flags at exactly 60 days", () => {
    const now = new Date("2026-03-02T00:00:00.000Z");
    expect(isProven(windowOf(), now)).toBe(true);
    expect(PROVEN_DAYS).toBe(60);
  });

  it("does not flag 59 days", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    expect(isProven(windowOf(), now)).toBe(false);
  });

  it("still flags a stopped ad that earned 60 days", () => {
    expect(
      isProven(
        windowOf({
          active: false,
          ended_at: new Date("2026-03-02T00:00:00.000Z"),
        }),
        new Date("2026-08-01")
      )
    ).toBe(true);
  });
});

describe("shouldMarkInactive", () => {
  it("sweeps an automated ad unseen for 14 days", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    expect(
      shouldMarkInactive(
        windowOf({ last_seen_at: new Date("2026-03-18T00:00:00.000Z") }),
        now
      )
    ).toBe(true);
  });

  it("leaves a recently seen automated ad alone", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    expect(
      shouldMarkInactive(
        windowOf({ last_seen_at: new Date("2026-03-20T00:00:00.000Z") }),
        now
      )
    ).toBe(false);
  });

  it("never sweeps a manual or csv row — a person decides", () => {
    const now = new Date("2026-12-01T00:00:00.000Z");
    expect(
      shouldMarkInactive(windowOf({ source: "manual", last_seen_at: start }), now)
    ).toBe(false);
    expect(
      shouldMarkInactive(windowOf({ source: "csv_import", last_seen_at: start }), now)
    ).toBe(false);
  });

  it("does not re-sweep an already inactive row", () => {
    expect(
      shouldMarkInactive(
        windowOf({ active: false, last_seen_at: start }),
        new Date("2026-12-01")
      )
    ).toBe(false);
  });
});

describe("whyFlagged", () => {
  it("explains the wait when under 60 days", () => {
    const text = whyFlagged(windowOf(), new Date("2026-01-11T00:00:00.000Z"));
    expect(text).toMatch(/10 days/);
    expect(text).toMatch(/50 more days/);
  });

  it("says still running for a live proven ad", () => {
    const text = whyFlagged(windowOf(), new Date("2026-04-01T00:00:00.000Z"));
    expect(text).toMatch(/Still running after 3 months/);
  });

  it("says it stopped after earning the span", () => {
    const text = whyFlagged(
      windowOf({
        active: false,
        ended_at: new Date("2026-04-01T00:00:00.000Z"),
      }),
      new Date("2026-08-01")
    );
    expect(text).toMatch(/Ran 3 months/);
    expect(text).toMatch(/pulled it/);
  });
});
