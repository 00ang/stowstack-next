import { describe, expect, it } from "vitest";
import { whyChanged } from "@/lib/diagnose/changed";
import { digestFacility } from "@/lib/diagnose/digest";
import { maplePicture } from "@/lib/diagnose/sample";
import { blankPicture, type FacilityPicture, type UnitFact } from "@/lib/diagnose/picture";

function unit(over: Partial<UnitFact> & Pick<UnitFact, "key" | "name" | "empty" | "total">): UnitFact {
  return {
    sizeKey: over.sizeKey ?? over.name.toLowerCase(),
    streetRate: null,
    webRate: null,
    climate: false,
    ...over,
  };
}

function picture(over: Partial<FacilityPicture> = {}): FacilityPicture {
  return blankPicture(over);
}

describe("digestFacility", () => {
  it("names empty sizes from the PMS and does not invent a count", () => {
    const digest = digestFacility(
      picture({
        units: [unit({ key: "a", name: "10x10", empty: 18, total: 80, webRate: 119 })],
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "vacant_sizes");
    expect(gap).toBeTruthy();
    expect(gap!.evidence[0].text).toBe("10x10 has 18 of 80 empty, listed at $119.");
    expect(gap!.evidence[0].sourceLabel).toBe("from your PMS upload");
    expect(gap!.metric).toBe("Empty 10x10");
    expect(gap!.confidence).toBe("high");
    expect(JSON.stringify(gap)).not.toContain("999");
  });

  it("does not invent a vacant-size gap when no unit mix was shared", () => {
    const digest = digestFacility(picture({ intake: { ...emptyIntake(), pain: "Not enough leads coming in", occupancyBand: "70–79%" } }));
    expect(digest.gaps.some((g) => g.id === "vacant_sizes")).toBe(false);
    expect(digest.nudges.join(" ")).toMatch(/unit mix/);
    const demand = digest.gaps.find((g) => g.id === "demand");
    expect(demand?.confidence).toBe("low");
    expect(demand?.evidence.every((e) => !/\d/.test(e.text))).toBe(true);
    expect(demand?.nudge).toMatch(/We'd know more if you shared/);
  });

  it("trusts counted move-ins over a move-out story", () => {
    const digest = digestFacility(
      picture({
        intake: { ...emptyIntake(), moveBalance: "Move-outs matched or beat move-ins" },
        snapshot: { at: "2026-10-01", occupancyPct: 84, moveIns: 10, moveOuts: 2, totalUnits: 200, occupiedUnits: 168 },
      }),
    );
    expect(digest.gaps.some((g) => g.id === "retention")).toBe(false);
  });

  it("flags move-outs when the snapshot shows them ahead", () => {
    const digest = digestFacility(
      picture({
        snapshot: { at: "2026-10-01", occupancyPct: 80, moveIns: 2, moveOuts: 6, totalUnits: null, occupiedUnits: null },
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "retention");
    expect(gap?.evidence[0].text).toBe("6 move-outs and 2 move-ins on the latest snapshot.");
    expect(gap?.evidence[0].sourceLabel).toBe("from your PMS upload");
    expect(gap?.metric).toBe("Move-outs in 30 days");
  });

  it("treats a self-reported lease-up as thin until the unit mix arrives", () => {
    const digest = digestFacility(
      picture({
        intake: { ...emptyIntake(), stage: "Lease-up (opened in the last 3 years)" },
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "lease_up");
    expect(gap?.confidence).toBe("low");
    expect(gap?.evidence[0].sourceLabel).toBe("you told us");
    expect(gap?.nudge).toMatch(/move-ins/);
  });

  it("calls a mostly empty building a lease-up from the unit counts", () => {
    const digest = digestFacility(
      picture({
        units: [unit({ key: "a", name: "10x10", empty: 150, total: 322 })],
        ledgerMoveIns30: 4,
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "lease_up");
    expect(gap?.confidence).toBe("high");
    expect(gap?.evidence.some((e) => e.text.includes("150 of 322"))).toBe(true);
    expect(gap?.evidence.some((e) => e.text.includes("4 move-ins") && e.source === "ledger")).toBe(true);
  });

  it("drops demand when people are already asking", () => {
    const digest = digestFacility(
      picture({
        intake: { ...emptyIntake(), pain: "Not enough leads coming in" },
        leads30: { total: 12, withContact: 12, waiting: 0, movedIn: 4, reservedOpen: 0 },
        units: [unit({ key: "a", name: "10x10", empty: 18, total: 80 })],
      }),
    );
    expect(digest.gaps.some((g) => g.id === "demand")).toBe(false);
  });

  it("flags unanswered asks and missed calls as a conversion gap", () => {
    const digest = digestFacility(
      picture({
        leads30: { total: 9, withContact: 8, waiting: 3, movedIn: 2, reservedOpen: 2 },
        calls: { total30: 14, missed30: 5 },
        pages: [{ title: "Climate units", visits30: 96, leads30: 1 }],
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "conversion");
    expect(gap?.signals).toEqual(expect.arrayContaining(["waiting", "missed", "abandoned", "quiet-page"]));
    expect(gap?.confidence).toBe("high");
    expect(gap?.evidence.some((e) => e.text.includes("3 people") && e.sourceLabel === "from people who asked")).toBe(true);
    expect(gap?.evidence.some((e) => e.sourceLabel === "from your call log")).toBe(true);
  });

  it("only says online rental is missing when they said so", () => {
    expect(digestFacility(picture()).gaps.some((g) => g.id === "online_rental")).toBe(false);
    const no = digestFacility(picture({ intake: { ...emptyIntake(), onlineRental: "No" } }));
    expect(no.gaps.find((g) => g.id === "online_rental")?.title).toBe("People can't rent online");
    const yes = digestFacility(picture({ intake: { ...emptyIntake(), onlineRental: "Yes, reserve and rent online" } }));
    expect(yes.gaps.some((g) => g.id === "online_rental")).toBe(false);
  });

  it("cites a neighbor's price only when both prices are known", () => {
    const digest = digestFacility(
      picture({
        units: [unit({ key: "a", name: "10x10", sizeKey: "10x10", empty: 18, total: 80, webRate: 119 })],
        competitors: [{ name: "Elm Avenue Self Storage", sizeKey: "10x10", sizeLabel: "10x10", price: 99, miles: 1.8, climate: false }],
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "rates");
    const ours = gap?.evidence.find((e) => e.source === "pms");
    const theirs = gap?.evidence.find((e) => e.source === "market");
    expect(ours?.text).toContain("$119");
    expect(ours?.text).toContain("18");
    expect(ours?.sourceLabel).toBe("from your PMS upload");
    expect(theirs?.text).toContain("$99");
    expect(theirs?.sourceLabel).toBe("from nearby listings");
  });

  it("keeps a weak Google rating and ignores a strong one", () => {
    const strong = digestFacility(
      picture({ google: { rating: 4.6, reviewCount: 80, unanswered: 0, unansweredLow: 0, lowestUnanswered: null } }),
    );
    expect(strong.gaps.some((g) => g.id === "google")).toBe(false);
    const thin = digestFacility(
      picture({ google: { rating: 3.4, reviewCount: 6, unanswered: 2, unansweredLow: 1, lowestUnanswered: 2 } }),
    );
    const gap = thin.gaps.find((g) => g.id === "google");
    expect(gap?.title).toBe("Google is a thin first look");
    expect(gap?.evidence.some((e) => e.text.includes("3.4") && e.sourceLabel === "from Google")).toBe(true);
  });

  it("lowers confidence when the only source is what they said", () => {
    const digest = digestFacility(
      picture({
        intake: { ...emptyIntake(), pain: "Plenty of leads, not enough are converting to move-ins" },
      }),
    );
    const gap = digest.gaps.find((g) => g.id === "conversion");
    expect(gap?.confidence).toBe("low");
    expect(gap?.nudge).toMatch(/We'd know more/);
  });

  it("is deterministic", () => {
    const input = picture({
      units: [unit({ key: "a", name: "10x20", empty: 9, total: 30, webRate: 199 })],
      leads30: { total: 2, withContact: 2, waiting: 2, movedIn: 0, reservedOpen: 0 },
    });
    expect(digestFacility(input)).toEqual(digestFacility(input));
  });
});

describe("whyChanged", () => {
  it("says nothing the first time", () => {
    const digest = digestFacility(picture());
    expect(whyChanged(null, digest, null, picture().stamps)).toBeNull();
  });

  it("names the new source when a gap appears", () => {
    const before = digestFacility(picture());
    const after = digestFacility(
      picture({
        calls: { total30: 4, missed30: 4 },
        stamps: { ...picture().stamps, callsKnown: true },
        units: [unit({ key: "a", name: "10x10", empty: 2, total: 40 })],
      }),
    );
    const line = whyChanged(before, after, picture().stamps, after ? picture({ stamps: { ...picture().stamps, callsKnown: true } }).stamps : picture().stamps);
    expect(line).toMatch(/call log/i);
  });

  it("says a PMS upload changed the empty sizes", () => {
    const units = [unit({ key: "a", name: "10x10", empty: 18, total: 80 })];
    const first = digestFacility(picture({ units, stamps: { ...picture().stamps, pmsUnitsAt: "2026-09-01" } }));
    const nextUnits = [unit({ key: "a", name: "10x10", empty: 24, total: 80 })];
    const second = digestFacility(picture({ units: nextUnits, stamps: { ...picture().stamps, pmsUnitsAt: "2026-10-08" } }));
    const line = whyChanged(first, second, { ...picture().stamps, pmsUnitsAt: "2026-09-01" }, { ...picture().stamps, pmsUnitsAt: "2026-10-08" });
    expect(line).toBe("A new PMS upload changed which sizes are empty.");
  });
});

describe("maple street sample", () => {
  const now = new Date("2026-10-11T15:00:00.000Z");
  const pictureNow = maplePicture(now);
  const digest = digestFacility(pictureNow);

  it("labels every evidence line as sample and never invents a call count", () => {
    expect(pictureNow.sample).toBe(true);
    expect(pictureNow.facilityName).toBe("Maple Street Storage");
    expect(pictureNow.calls).toBeNull();
    for (const gap of digest.gaps) {
      for (const line of gap.evidence) expect(line.sourceLabel.startsWith("Sample · ")).toBe(true);
    }
    expect(digest.nudges.length).toBeLessThanOrEqual(3);
    expect(digest.nudges.some((n) => /call log/i.test(n))).toBe(true);
  });

  it("ranks the empty sizes first, from the sample PMS", () => {
    expect(digest.gaps[0]?.id).toBe("vacant_sizes");
    expect(digest.gaps.map((g) => g.id)).toEqual(expect.arrayContaining(["vacant_sizes", "conversion"]));
    expect(digest.gaps.some((g) => g.id === "demand")).toBe(false);
    expect(digest.gaps.some((g) => g.id === "retention")).toBe(false);
    expect(digest.gaps.some((g) => g.id === "lease_up")).toBe(false);
    const vacant = digest.gaps[0];
    expect(vacant.evidence.some((e) => e.text.includes("18 of 80"))).toBe(true);
    expect(vacant.evidence[0].sourceLabel).toBe("Sample · from your PMS upload");
  });
});

function emptyIntake(): FacilityPicture["intake"] & object {
  return {
    role: null,
    stage: null,
    unitsBand: null,
    occupancyBand: null,
    moveBalance: null,
    pain: null,
    adSpendBand: null,
    timeline: null,
    freeText: null,
    onlineRental: null,
    googleAds: null,
  };
}
