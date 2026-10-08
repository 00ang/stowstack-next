import { describe, expect, it } from "vitest";
import { buildOntology } from "@/lib/ontology/build";
import { prettySize, sizeKey, sizeKeysIn, slugify, parsePrice, monthDay } from "@/lib/ontology/address";
import { OBJECT_TYPE_KEYS } from "@/lib/ontology/types";
import { TYPE_ORDER, typeOfAddress } from "@/lib/ontology/registry";
import { fixture, NOW } from "./fixture";

function shuffled<T>(rows: T[], seed: number): T[] {
  const out = [...rows];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("address helpers", () => {
  it("reads a size however it is written", () => {
    expect(sizeKey("10' x 10'")).toBe("10x10");
    expect(sizeKey("10 X 15 drive-up")).toBe("10x15");
    expect(sizeKey("7.5x10")).toBe("7.5x10");
    expect(sizeKey("10.0x20.0")).toBe("10x20");
    expect(sizeKey("Climate", null, "5×5")).toBe("5x5");
    expect(sizeKey("parking")).toBeNull();
  });

  it("finds every size mentioned in copy", () => {
    expect([...sizeKeysIn("We have 5x5, 10 x 10 and 10' x 20' open")]).toEqual(["5x5", "10x10", "10x20"]);
  });

  it("slugs are stable and never empty", () => {
    expect(slugify("10x10 Climate Controlled!")).toBe("10x10-climate-controlled");
    expect(slugify("Café Storage")).toBe("cafe-storage");
    expect(slugify("!!!", "unit")).toBe("unit");
  });

  it("formats without depending on the locale or the timezone", () => {
    expect(prettySize("10x10 Climate")).toBe("10×10 Climate");
    expect(parsePrice("$1,299.00/mo")).toBe(1299);
    expect(monthDay("2026-10-31")).toBe("Oct 31");
  });
});

describe("buildOntology", () => {
  it("is a pure function of the rows and the clock, whatever order the rows arrive in", () => {
    const a = buildOntology(fixture(), NOW);
    const raw = fixture();
    const b = buildOntology(
      {
        ...raw,
        units: shuffled(raw.units, 7),
        specials: shuffled(raw.specials, 3),
        ads: shuffled(raw.ads, 11),
        leads: shuffled(raw.leads, 5),
        reviews: shuffled(raw.reviews, 9),
      },
      NOW,
    );
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("gives every object one address, unique, that names its type", () => {
    const o = buildOntology(fixture(), NOW);
    const addresses = o.objects.map((x) => x.address);
    expect(new Set(addresses).size).toBe(addresses.length);
    for (const x of o.objects) expect(typeOfAddress(x.address)).toBe(x.type);
    expect(addresses).toContain("units/10x10-climate");
    expect(addresses).toContain("offers/first-month-1");
    expect(addresses).toContain("pages/maple-fall");
    expect(addresses).toContain("tenants/unit-b114");
  });

  it("keeps climate and non-climate apart when an offer or a competitor names a size", () => {
    const raw = fixture();
    raw.units.push({ ...raw.units[0], id: "a1000000-0000-0000-0000-000000000009", unitType: "10x10", features: [] });
    raw.specials[0].appliesTo = ["10x10 Climate"];
    const o = buildOntology(raw, NOW);
    const get = (a: string) => o.objects.find((x) => x.address === a)!;
    expect(get("offers/first-month-1").links.filter((l) => l.startsWith("units/"))).toEqual(["units/10x10-climate"]);
    // Elm's plain 10x10 links to our plain 10x10; its climate 10x10 to our climate one.
    expect(get("units/10x10").links).toContain("competitors/elm-self-storage");
    expect(get("units/10x10-climate").links).toContain("competitors/elm-self-storage");
    expect(o.moves.find((m) => m.rule === "undercut")?.subject).toBe("units/10x10");
  });

  it("suffixes the short id when two records would share an address", () => {
    const raw = fixture();
    raw.units.push({ ...raw.units[1], id: "ff000000-0000-0000-0000-000000000009" });
    const addresses = buildOntology(raw, NOW).objects.filter((x) => x.type === "units").map((x) => x.address);
    expect(addresses).toContain("units/5x10");
    expect(addresses).toContain("units/5x10-ff0000");
  });

  it("links what the rows already imply, in both directions", () => {
    const o = buildOntology(fixture(), NOW);
    const get = (a: string) => o.objects.find((x) => x.address === a)!;
    const unit20 = get("units/10x20");
    // the offer names the size; the ad names the size and the offer
    expect(unit20.links).toContain("offers/first-month-1");
    expect(unit20.links).toContain("ads/meta-d10000");
    expect(get("ads/meta-d10000").links).toEqual(
      expect.arrayContaining(["campaigns/fall-move-season", "offers/first-month-1", "pages/maple-fall", "units/10x20"]),
    );
    // a link points at its page; a lead's tour, tenant and size all connect
    expect(get("links/maple1").links).toEqual(["pages/maple-fall"]);
    expect(get("leads/lead-a20000").links).toEqual(expect.arrayContaining(["tours/tour-a40000", "units/10x10-climate"]));
    // the competitor that lists our sizes links to them
    expect(get("competitors/elm-self-storage").links).toEqual(["units/10x10-climate", "units/5x10"]);
    // links are symmetric
    for (const x of o.objects) for (const l of x.links) expect(get(l).links).toContain(x.address);
  });

  it("keeps types in lane order and reads one true number for each", () => {
    const o = buildOntology(fixture(), NOW);
    expect(o.summaries.map((s) => s.type)).toEqual(TYPE_ORDER);
    expect(TYPE_ORDER).toHaveLength(OBJECT_TYPE_KEYS.length);
    const reading = (t: string) => o.summaries.find((s) => s.type === t)!.reading;
    expect(reading("units")).toMatchObject({ value: "20", unit: "empty of 120" });
    expect(reading("offers")).toMatchObject({ value: "1", unit: "running" });
    expect(reading("reviews")).toMatchObject({ value: "3.5", unit: "from 2" });
    expect(reading("links")).toMatchObject({ value: "37", unit: "clicks" });
    for (const s of o.summaries) expect(s.reading.definition.length).toBeGreaterThan(10);
  });

  it("writes a brief a tool can use", () => {
    const o = buildOntology(fixture(), NOW);
    const unit = o.objects.find((x) => x.address === "units/10x20")!;
    expect(unit.brief).toBe("10×20: 6 of 20 empty, $199 a month online. Offer: First Month $1.");
  });

  describe("moves", () => {
    it("finds each gap once, ranked, with one way to close it", () => {
      const o = buildOntology(fixture(), NOW);
      const rules = o.moves.map((m) => m.rule);
      expect(rules).toEqual(["unsold-space", "leads-waiting", "reviews-waiting", "undercut", "page-no-leads", "drafts-idle"]);
      const unsold = o.moves[0];
      expect(unsold.subject).toBe("units/10x10-climate");
      expect(unsold.sentence).toBe("10×10 Climate has 12 empty and no ad names it.");
      expect(unsold.action).toEqual({ label: "Write an ad", tool: "creative-studio" });
      const undercut = o.moves.find((m) => m.rule === "undercut")!;
      // compared climate to climate: the plain 10x10 at $99 is not held against it
      expect(undercut.sentence).toBe("Elm Self Storage lists 10×10 Climate at $109.");
      expect(undercut.reason).toBe("That is $20 under your $129, 1.8 mi away.");
    });

    it("does not ask for an ad when one already names the size", () => {
      const o = buildOntology(fixture(), NOW);
      expect(o.moves.some((m) => m.subject === "units/10x20")).toBe(false);
    });

    it("asks for the unit mix first when there is none", () => {
      const raw = fixture();
      raw.units = [];
      const o = buildOntology(raw, NOW);
      expect(o.moves[0]).toMatchObject({ rule: "foundation", action: { href: "/portal/upload" } });
    });

    it("flags a running offer nobody can see", () => {
      const raw = fixture();
      raw.ads[0].text = "Room for the whole garage.";
      const o = buildOntology(raw, NOW);
      const unseen = o.moves.find((m) => m.rule === "offer-unseen")!;
      expect(unseen.subject).toBe("offers/first-month-1");
      expect(unseen.action.tool).toBe("gbp");
    });

    it("never repeats an id", () => {
      const ids = buildOntology(fixture(), NOW).moves.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});

describe("the why behind each move", () => {
  const o = buildOntology(fixture(), NOW);

  it("gives every move a plain why", () => {
    expect(o.moves.length).toBeGreaterThan(0);
    for (const m of o.moves) {
      expect(m.why, m.id).toBeTruthy();
      expect(m.why!.length, m.id).toBeLessThan(160);
    }
  });

  it("prices empty space as the rent it would bring", () => {
    const raw = fixture();
    const m = o.moves.find((x) => x.rule === "unsold-space");
    if (!m) return;
    const unit = raw.units.find((u) => o.objects.find((x) => x.address === m.subject)?.id === u.id)!;
    const rent = (unit.total - unit.occupied) * (unit.webRate ?? unit.streetRate ?? 0);
    expect(m.why).toContain(`$${rent.toLocaleString("en-US")} a month in rent`);
  });

  it("says who is waiting, for what, when there aren't enough answered leads to compare", () => {
    const m = o.moves.find((x) => x.rule === "leads-waiting");
    if (!m) return;
    expect(m.why).toMatch(/still waiting|has waited \d+ days? since asking|answered within a day/);
  });

  it("compares answering quickly with answering late once there are enough leads", () => {
    const raw = fixture();
    const base = raw.leads[0];
    const at = (h: number) => new Date(NOW.getTime() - (10 * 24 - h) * 3_600_000).toISOString();
    const made = (i: number, hours: number, moved: boolean) => ({
      ...base,
      id: `c0000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`,
      name: `Lead ${i}`,
      hasContact: true,
      createdAt: at(0),
      firstResponseAt: at(hours),
      converted: moved,
      matchedTenantId: null,
      status: moved ? "moved_in" : "contacted",
    });
    raw.leads = [
      ...raw.leads,
      ...[0, 1, 2, 3].map((i) => made(i, 2, i < 3)),
      ...[4, 5, 6, 7].map((i) => made(i, 48, i === 4)),
    ];
    const m = buildOntology(raw, NOW).moves.find((x) => x.rule === "leads-waiting");
    if (!m) return;
    expect(m.why).toContain("answered within a day moved in");
  });
});
