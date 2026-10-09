import { describe, expect, it } from "vitest";
import { buildOntology } from "@/lib/ontology/build";
import { NOW } from "@/lib/ontology/__tests__/fixture";
import { demoRows } from "@/lib/portal-demo/demo-rows";
import { linkedIds, splitByFocus, textNamesFocus, variationText } from "@/lib/tools-track/focus-match";

function unit(address: string) {
  const ontology = buildOntology(demoRows(NOW), NOW);
  const found = ontology.objects.find((o) => o.address === address);
  if (!found) throw new Error(address);
  return { ontology, found };
}

describe("textNamesFocus", () => {
  it("keeps the sample ads off the 10×10, and a line that names it on", () => {
    const { found } = unit("units/10x10");
    for (const ad of demoRows(NOW).ads) {
      expect(textNamesFocus(found, `${ad.headline ?? ""} ${ad.text}`)).toBe(false);
    }
    expect(textNamesFocus(found, "10x10 units open on Maple Street, $119 a month online.")).toBe(true);
    expect(textNamesFocus(found, "Climate-controlled 10x10 units, inside and dry.")).toBe(false);
    expect(textNamesFocus(found, "10x20 drive-up units. First Month $1.")).toBe(false);
  });

  it("keeps a plain 10×10 off the climate unit", () => {
    const { found } = unit("units/10x10-climate");
    expect(textNamesFocus(found, "Climate-controlled 10×10 units on Maple Street.")).toBe(true);
    expect(textNamesFocus(found, "A 10x10 you can drive right up to.")).toBe(false);
  });

  it("treats a linked ad as targeting the unit even when the copy does not say the size", () => {
    const { ontology, found } = unit("units/10x10");
    const ads = splitByFocus(found, [{ id: "linked-ad", text: "Room for the whole garage." }], (a) => a.text, (a) => a.id, new Set(["linked-ad"]));
    expect(ads.named.map((a) => a.id)).toEqual(["linked-ad"]);
    expect(linkedIds(ontology, "units/10x10", "ads").size).toBe(0);
  });

  it("reads a creative's copy fields", () => {
    const { found } = unit("units/10x10");
    const text = variationText({
      headline: "A 10x10 you can drive right up to",
      primaryText: "10x10 units open on Maple Street.",
      headlines: [{ text: "Reserve online today" }],
    });
    expect(textNamesFocus(found, text)).toBe(true);
  });
});
