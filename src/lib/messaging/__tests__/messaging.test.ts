import { describe, expect, it } from "vitest";
import {
  MAX_SEGMENTS,
  SEND_WINDOW,
  checkSendable,
  isStartReply,
  isStopReply,
  msUntilSendWindow,
  normalisePhone,
  segmentCount,
  withinSendWindow,
} from "@/lib/messaging/types";
import { notifyCount, waitlistMessage } from "@/lib/respond/waitlist";

describe("normalisePhone", () => {
  it("accepts E.164 unchanged", () => {
    expect(normalisePhone("+15125550123")).toBe("+15125550123");
  });
  it("adds +1 to a bare North American 10-digit number", () => {
    expect(normalisePhone("512-555-0123")).toBe("+15125550123");
    expect(normalisePhone("(512) 555 0123")).toBe("+15125550123");
  });
  it("handles a leading 1", () => {
    expect(normalisePhone("1 512 555 0123")).toBe("+15125550123");
  });
  // Guessing a country code for a foreign-looking number would send somewhere
  // real and wrong. Refusing is the safe failure.
  it("refuses rather than guessing when it cannot tell", () => {
    expect(normalisePhone("5551234")).toBeNull();
    expect(normalisePhone("00 44 20 7946 0000")).toBeNull();
    expect(normalisePhone("")).toBeNull();
    expect(normalisePhone(null)).toBeNull();
    expect(normalisePhone("not a phone")).toBeNull();
  });
  it("rejects absurd lengths even with a +", () => {
    expect(normalisePhone("+1234")).toBeNull();
    expect(normalisePhone("+12345678901234567")).toBeNull();
  });
});

describe("stop and start replies", () => {
  it("recognises the standard stop keywords in any case or punctuation", () => {
    ["STOP", "stop", "Stop.", "  UNSUBSCRIBE ", "cancel", "QUIT", "optout", "opt-out"]
      .forEach((w) => expect(isStopReply(w)).toBe(true));
  });
  it("does not treat an ordinary message as a stop", () => {
    ["yes please", "stop by tomorrow?", "I'll take it", ""].forEach((w) =>
      expect(isStopReply(w)).toBe(false)
    );
  });
  it("recognises start keywords", () => {
    ["START", "unstop", "Yes"].forEach((w) => expect(isStartReply(w)).toBe(true));
  });
});

describe("send window", () => {
  it("is 8am to 9pm", () => {
    expect(SEND_WINDOW).toEqual({ openHour: 8, closeHour: 21 });
    expect(withinSendWindow(8)).toBe(true);
    expect(withinSendWindow(20)).toBe(true);
    expect(withinSendWindow(21)).toBe(false);
    expect(withinSendWindow(7)).toBe(false);
    expect(withinSendWindow(3)).toBe(false);
  });
  it("computes the wait until it opens rather than dropping the message", () => {
    expect(msUntilSendWindow(14)).toBe(0);
    expect(msUntilSendWindow(6, 0)).toBe(2 * 3600_000);
    expect(msUntilSendWindow(6, 30)).toBe(1.5 * 3600_000);
    expect(msUntilSendWindow(22, 0)).toBe(10 * 3600_000); // overnight
  });
});

describe("segmentCount", () => {
  it("counts a short GSM message as one", () => {
    expect(segmentCount("A 10x10 just opened up.")).toBe(1);
    expect(segmentCount("x".repeat(160))).toBe(1);
  });
  it("splits past 160 GSM characters", () => {
    expect(segmentCount("x".repeat(161))).toBe(2);
  });
  // One emoji drops the whole message to 70-character segments — worth knowing
  // before someone "brightens up" the copy and triples the bill.
  it("drops to 70-character segments the moment a non-GSM character appears", () => {
    expect(segmentCount("x".repeat(80))).toBe(1);
    expect(segmentCount("x".repeat(80) + "🎉")).toBe(2);
  });
});

describe("checkSendable — the gate", () => {
  const base = { to: "+15125550123", body: "A 10x10 just opened up.", optedOut: false };

  it("passes a clean message", () => {
    expect(checkSendable(base)).toEqual({ ok: true });
  });

  // The one that is a legal failure rather than a quality problem, so it is
  // checked before anything else that could mask it.
  it("refuses an opted-out number", () => {
    expect(checkSendable({ ...base, optedOut: true })).toEqual({ ok: false, reason: "opted-out" });
  });

  it("refuses when there is no usable number", () => {
    expect(checkSendable({ ...base, to: null })).toEqual({ ok: false, reason: "no-number" });
  });

  it("refuses an empty body", () => {
    expect(checkSendable({ ...base, body: "   " })).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses an absurdly long message", () => {
    expect(checkSendable({ ...base, body: "x".repeat(160 * MAX_SEGMENTS + 200) }))
      .toEqual({ ok: false, reason: "too-long" });
  });

  it("refuses outside the send window when the local hour is known", () => {
    expect(checkSendable({ ...base, localHour: 3 })).toEqual({ ok: false, reason: "quiet-hours" });
    expect(checkSendable({ ...base, localHour: 10 })).toEqual({ ok: true });
  });

  it("skips the quiet-hours gate when the local hour is unknown, rather than assuming UTC", () => {
    expect(checkSendable(base)).toEqual({ ok: true });
  });

  it("an opt-out beats a valid send window", () => {
    expect(checkSendable({ ...base, optedOut: true, localHour: 10 }).ok).toBe(false);
  });
});

describe("waitlist message", () => {
  const base = { name: "Dana Reeves", sizeLabel: "10x10", facilityName: "Northline Storage", streetRate: 149 };

  it("names the person, the size, the place and the price", () => {
    const m = waitlistMessage(base);
    expect(m).toContain("Dana");
    expect(m).not.toContain("Reeves"); // first name only
    expect(m).toContain("10x10");
    expect(m).toContain("Northline Storage");
    expect(m).toContain("$149");
  });

  // Required on marketing SMS, not a courtesy.
  it("always carries an opt-out path", () => {
    expect(waitlistMessage(base)).toMatch(/STOP/);
    expect(waitlistMessage({ name: null, sizeLabel: null, facilityName: "X", streetRate: null })).toMatch(/STOP/);
  });

  it("stays inside one segment so it bills once and reads whole", () => {
    expect(segmentCount(waitlistMessage(base))).toBe(1);
    expect(segmentCount(waitlistMessage({
      name: "Bartholomew", sizeLabel: "10x30 climate controlled",
      facilityName: "Longhorn State Storage Springtown", streetRate: 249,
    }))).toBeLessThanOrEqual(2);
  });

  it("degrades gracefully with nothing known", () => {
    const m = waitlistMessage({ name: null, sizeLabel: null, facilityName: "Northline", streetRate: null });
    expect(m).toContain("a unit");
    expect(m).not.toContain("undefined");
    expect(m).not.toContain("null");
  });
});

describe("notifyCount", () => {
  // Texting everyone for one unit produces one rental and a queue of people told
  // about something already gone.
  it("notifies more than are free, but not the whole list", () => {
    expect(notifyCount(1)).toBe(2);
    expect(notifyCount(3)).toBe(6);
  });
  it("caps so a big release cannot blast the list", () => {
    expect(notifyCount(50)).toBe(10);
  });
  it("always notifies at least one, even on a zero", () => {
    expect(notifyCount(0)).toBe(2);
  });
});
