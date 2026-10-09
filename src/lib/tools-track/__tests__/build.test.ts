import { describe, expect, it } from "vitest";
import { buildOntology } from "@/lib/ontology/build";
import { fixture, NOW } from "@/lib/ontology/__tests__/fixture";
import { demoRows } from "@/lib/portal-demo/demo-rows";
import { buildTrack, defaultFocus, ensureStation, stationAhead, stationInputs, trackChoices, trackSuggestion } from "@/lib/tools-track/build";

const BY = "Oct 31";

function demo() {
  return buildOntology(demoRows(NOW), NOW);
}

function maple() {
  return buildOntology(fixture(), NOW);
}

describe("buildTrack", () => {
  it("builds the fill track for the sample 10×10 from the rows, and invents nothing", () => {
    const ontology = demo();
    const track = buildTrack({ ontology, focus: "units/10x10", by: BY });

    expect(track.focus).toBe("units/10x10");
    expect(track.intent).toMatchObject({ verb: "fill", object: "10×10 drive-up", by: BY });
    expect(track.intent.sentence).toBe("Fill 10×10 drive-up by Oct 31");
    expect(track.savesInto?.name).toBe("Fall Move Season");
    expect(track.stations.map((s) => s.tool)).toEqual([
      "occupancy",
      "market-intel",
      "creative-studio",
      "ad-publisher",
      "landing-pages",
      "lead-nurture",
      "tenants",
    ]);

    const byTool = Object.fromEntries(track.stations.map((s) => [s.tool, s]));
    expect(byTool.occupancy).toMatchObject({ status: "done", handoff: "10×10 · 18 empty" });
    expect(byTool.occupancy.why).toMatch(/18 empty of 80/);
    expect(byTool.occupancy.why).toMatch(/most of any drive-up size/);
    expect(byTool["market-intel"]).toMatchObject({ status: "done", handoff: "$99 to beat" });
    expect(byTool["market-intel"].why).toMatch(/Elm Avenue Self Storage/);
    expect(byTool["market-intel"].why).toMatch(/\$119/);
    expect(byTool["creative-studio"]).toMatchObject({ status: "now", state: "gap", handoff: "no ad names it" });
    expect(byTool["ad-publisher"]).toMatchObject({ status: "next", state: "gap", handoff: "nothing to run yet" });
    expect(byTool["landing-pages"]).toMatchObject({ state: "gap", handoff: "no page lists it" });
    expect(byTool["lead-nurture"]).toMatchObject({ status: "waiting", handoff: "2 asked · no reply" });
    expect(byTool["lead-nurture"].why).toMatch(/Dana Ruiz/);
    expect(byTool["lead-nurture"].why).toMatch(/Chris Okafor/);
    expect(byTool.tenants.status).toBe("counts");
    expect(track.now).toBe("creative-studio");

    const text = JSON.stringify(track);
    expect(text).not.toContain("412");
    expect(text).not.toContain("2 ad drafts");
    expect(text).not.toContain("maple-fall-move");
    expect(text).not.toContain("paused");
  });

  it("is the same track twice, and opens on the top move when no focus is given", () => {
    const ontology = demo();
    const a = buildTrack({ ontology, by: BY });
    const b = buildTrack({ ontology, by: BY });
    expect(a).toEqual(b);
    expect(a.focus).toBe(defaultFocus(ontology));
    expect(a.focus).toBe("units/10x10");
  });

  it("offers the open sizes, emptiest first", () => {
    const choices = trackChoices(demo());
    expect(choices[0]).toEqual({ address: "units/10x10", label: "10×10 drive-up" });
    expect(choices.map((c) => c.address)).not.toContain("units/10x30");
    expect(choices.some((c) => c.label.includes("Climate"))).toBe(true);
  });

  it("reads a lead as its own short track", () => {
    const ontology = demo();
    const lead = ontology.objects.find((o) => o.type === "leads" && o.name === "Dana Ruiz");
    expect(lead).toBeTruthy();
    const track = buildTrack({ ontology, focus: lead!.address, by: BY });
    expect(track.intent.sentence).toBe("Answer Dana Ruiz by Oct 31");
    expect(track.stations[0]).toMatchObject({ tool: "lead-nurture", status: "now", state: "waiting" });
    expect(track.stations.map((s) => s.tool)).toEqual(["lead-nurture", "occupancy", "tenants"]);
  });

  it("reads an unanswered review as a waiting Google Business station", () => {
    const ontology = maple();
    const review = ontology.objects.find((o) => o.type === "reviews" && o.status === "waiting");
    const track = buildTrack({ ontology, focus: review!.address });
    expect(track.stations).toHaveLength(1);
    expect(track.stations[0]).toMatchObject({ tool: "gbp", status: "now", state: "waiting", handoff: "no reply yet" });
    expect(track.stations[0].why).toMatch(/Gate code/);
  });

  it("follows the top move when the unit mix is missing, and asks for an upload when nothing is loaded", () => {
    const raw = fixture();
    raw.units = [];
    const track = buildTrack({ ontology: buildOntology(raw, NOW) });
    expect(track.focusType).toBe("leads");
    expect(track.stations.find((s) => s.tool === "occupancy")?.handoff).toBe("no unit mix");

    const empty = buildOntology(
      { ...fixture(), units: [], specials: [], campaigns: [], ads: [], pages: [], links: [], posts: [], leads: [], tours: [], tenants: [], reviews: [], competitors: [] },
      NOW,
    );
    const bare = buildTrack({ ontology: empty });
    expect(bare.stations).toEqual([]);
    expect(bare.intent.sentence).toBe("Upload your unit mix");
    expect(bare.now).toBeNull();
    expect(trackSuggestion(bare, null).tool).toBeNull();
  });

  it("hands the open station what the earlier stations already know", () => {
    const ontology = demo();
    const track = buildTrack({ ontology, focus: "units/10x10", by: BY });
    const inputs = stationInputs(track, "creative-studio", ontology);
    expect(inputs.map((i) => i.title)).toEqual(["10×10 · 18 empty", "$119 a month online", "$99 to beat"]);
    expect(inputs.map((i) => i.detail)).toEqual(["Occupancy", "Your web rate", "Competitors"]);
    expect(stationAhead(track, "creative-studio").map((s) => s.label)).toEqual([
      "Publish Ads",
      "Landing Pages",
      "Lead Follow-Up",
    ]);
  });

  it("adds a campaign's tool when the object's track doesn't already have it", () => {
    const ontology = demo();
    const track = ensureStation(buildTrack({ ontology, focus: "units/10x10", by: BY }), "google-ads", ontology);
    expect(track.stations.map((s) => s.tool)).toContain("google-ads");
    expect(track.stations.find((s) => s.tool === "google-ads")?.handoff).toBe("nothing to run yet");
    expect(track.now).toBe("creative-studio");
    const same = ensureStation(track, "creative-studio", ontology);
    expect(same.stations.filter((s) => s.tool === "creative-studio")).toHaveLength(1);
  });

  it("suggests opening the gap, then handing off once that station is open", () => {
    const track = buildTrack({ ontology: demo(), focus: "units/10x10", by: BY });
    const shut = trackSuggestion(track, null);
    expect(shut).toMatchObject({ tool: "creative-studio", label: "Write it" });
    expect(shut.sentence).toBe("Write an ad for the 10×10 drive-up.");
    expect(shut.reason).toMatch(/18 empty of 80/);
    expect(shut.reason).not.toMatch(/should|consider|try /i);

    const open = trackSuggestion(track, "creative-studio");
    expect(open).toMatchObject({ tool: "ad-publisher", label: "Send to Publish Ads" });
    expect(open.sentence).toBe("Hand it to Publish Ads.");

    const elsewhere = trackSuggestion(track, "occupancy");
    expect(elsewhere.tool).toBe("creative-studio");
    expect(elsewhere.label).toBe("Back to Creative Studio");
  });

  it("counts drafts that exist and does not call a live page a draft", () => {
    const ontology = demo();
    const ad = ontology.objects.find((o) => o.type === "ads" && o.status === "draft");
    const track = buildTrack({ ontology, focus: ad!.address });
    const creative = track.stations.find((s) => s.tool === "creative-studio");
    expect(creative?.handoff).toBe("1 ad draft");
    expect(creative?.state).toBe("done");
    const publish = track.stations.find((s) => s.tool === "ad-publisher");
    expect(publish?.status).toBe("now");
    expect(publish?.handoff).toMatch(/not running/);
  });
});
