import { describe, expect, it } from "vitest";
import { COOLDOWN_MINUTES, SHORT_CALL_SECONDS, isMissedCall, missedCallText } from "@/lib/respond/missed-call";
import { RESCUE_AFTER_MINUTES, RESCUE_BEFORE_MINUTES, rescueText } from "@/lib/respond/abandoned";
import { segmentCount } from "@/lib/messaging/types";
import { COPY } from "@/lib/messaging/copy";
import { TARGET_SECONDS } from "@/lib/respond/speed-to-lead";

describe("isMissedCall", () => {
  it("counts the obvious misses", () => {
    ["no-answer", "busy", "failed", "canceled"].forEach((s) =>
      expect(isMissedCall({ status: s, duration: 0 })).toBe(true)
    );
  });

  // Twilio reports `completed` both for a real conversation and for a call that
  // hit voicemail and was abandoned. Duration is the only thing that separates
  // them, and the caller experienced the second as a missed call.
  it("counts a connected-but-instantly-ended call as missed", () => {
    expect(isMissedCall({ status: "completed", duration: 3 })).toBe(true);
    expect(isMissedCall({ status: "completed", duration: SHORT_CALL_SECONDS - 1 })).toBe(true);
  });

  it("does NOT count a real conversation", () => {
    expect(isMissedCall({ status: "completed", duration: SHORT_CALL_SECONDS })).toBe(false);
    expect(isMissedCall({ status: "completed", duration: 240 })).toBe(false);
  });

  it("ignores in-progress statuses so we do not text mid-call", () => {
    ["ringing", "in-progress", "queued"].forEach((s) =>
      expect(isMissedCall({ status: s, duration: 0 })).toBe(false)
    );
  });

  it("is not fooled by case or nulls", () => {
    expect(isMissedCall({ status: "NO-ANSWER", duration: null })).toBe(true);
    expect(isMissedCall({ status: null, duration: null })).toBe(false);
  });
});

describe("missed-call copy", () => {
  it("names the facility, invites a reply, and carries an opt-out", () => {
    const m = missedCallText("Northline Storage");
    expect(m).toContain("Northline Storage");
    expect(m).toMatch(/STOP/);
  });
  it("is one segment and plain ASCII", () => {
    const m = missedCallText("Longhorn State Storage Springtown");
    expect(segmentCount(m)).toBe(1);
    expect(/^[\x20-\x7e]*$/.test(m)).toBe(true);
  });
  // Three texts to somebody who redialled three times is how a helpful reply
  // becomes a complaint.
  it("has a cooldown long enough to survive a redial", () => {
    expect(COOLDOWN_MINUTES).toBeGreaterThanOrEqual(30);
  });
});

describe("abandoned-rescue window", () => {
  // Too early and they only stepped away from the form; too late and "you were
  // just looking at this" stops being true and starts being creepy.
  it("opens late enough to be a real abandonment", () => {
    expect(RESCUE_AFTER_MINUTES).toBeGreaterThanOrEqual(5);
  });
  it("closes before it gets creepy, leaving the rest to the email sequence", () => {
    expect(RESCUE_BEFORE_MINUTES).toBeLessThanOrEqual(240);
    expect(RESCUE_BEFORE_MINUTES).toBeGreaterThan(RESCUE_AFTER_MINUTES);
  });
});

describe("rescue copy", () => {
  const base = { name: "Dana Reeves", unitSize: "10x10", facilityName: "Northline Storage" };

  it("uses the first name, the size and the facility", () => {
    const m = rescueText(base);
    expect(m).toContain("Dana");
    expect(m).not.toContain("Reeves");
    expect(m).toContain("10x10");
    expect(m).toContain("Northline Storage");
  });

  it("degrades without a name or size rather than printing null", () => {
    const m = rescueText({ name: null, unitSize: null, facilityName: "Northline" });
    expect(m).toContain("a unit");
    expect(m).not.toMatch(/null|undefined/);
  });

  it("is one segment and plain ASCII", () => {
    expect(segmentCount(rescueText(base))).toBe(1);
    expect(/^[\x20-\x7e]*$/.test(rescueText(base))).toBe(true);
  });

  it("always carries an opt-out", () => {
    expect(rescueText(base)).toMatch(/STOP/);
  });
});

describe("speed-to-lead target (r5)", () => {
  it("is the industry minute, not a number we invented", () => {
    expect(TARGET_SECONDS).toBe(60);
  });
});

describe("lead acknowledgement copy", () => {
  const base = { name: "Dana Reeves", unitSize: "10x10", facilityName: "Longhorn State Storage Springtown" };

  it("uses the first name only, and names what they asked about", () => {
    const m = COPY.en.leadAck(base);
    expect(m).toContain("Dana");
    expect(m).not.toContain("Reeves");
    expect(m).toContain("10x10");
    expect(m).toContain(base.facilityName);
  });

  // It promises a call. If the copy stops saying so, the operator alert below
  // has no counterpart and we have quietly broken the promise.
  it("promises the callback that the operator alert exists to enable", () => {
    expect(COPY.en.leadAck(base)).toMatch(/call you/i);
    expect(COPY.es.leadAck(base)).toMatch(/llamamos/i);
  });

  it("degrades without a name or size rather than printing null", () => {
    const m = COPY.en.leadAck({ name: null, unitSize: null, facilityName: "Northline" });
    expect(m).not.toMatch(/null|undefined/);
    expect(m).not.toMatch(/\s{2,}/);
  });
});

describe("operator alert copy", () => {
  const base = {
    name: "Dana Reeves", phone: "+15125550123", unitSize: "10x10",
    facilityName: "Longhorn State Storage Springtown",
  };

  // The single thing this message exists to deliver.
  it("carries the number the operator has to dial", () => {
    expect(COPY.en.operatorAlert(base)).toContain("+15125550123");
  });

  it("says which facility, because an operator may run twenty", () => {
    expect(COPY.en.operatorAlert(base)).toContain(base.facilityName);
  });

  it("is internal, so it carries no opt-out and no marketing", () => {
    const m = COPY.en.operatorAlert(base);
    expect(m).not.toMatch(/STOP/);
    expect(m).not.toMatch(/opt out/i);
  });

  it("still reads as a sentence when the lead left no name or size", () => {
    const m = COPY.en.operatorAlert({ name: null, phone: null, unitSize: null, facilityName: "Northline" });
    expect(m).not.toMatch(/null|undefined/);
    expect(m).toContain("no name given");
    expect(segmentCount(m)).toBe(1);
  });
});
