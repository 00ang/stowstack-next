import type { FunnelContext } from "@/lib/funnel-graph";
import type { Ontology } from "@/lib/ontology/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(date = new Date()): string {
  return MONTHS[date.getMonth()] ?? "October";
}

/** The next few months the goal chip can point at. */
export function goalMonths(date = new Date()): string[] {
  const start = date.getMonth();
  return [0, 1, 2].map((i) => MONTHS[(start + i) % 12]);
}

/**
 * Facts the funnel rules may cite, taken from the facility ontology.
 * Counts in here are labelled SAMPLE by the caller when `sample` is set.
 */
export function funnelContextFromOntology(ontology: Ontology | null, sample: boolean): FunnelContext {
  const month = monthName();
  if (!ontology) {
    return { sample, goal: { moveIns: 12, month }, metaConnected: true };
  }

  const units = ontology.objects
    .filter((o) => o.type === "units")
    .map((o) => {
      const emptyFact = o.facts.find((f) => f.label === "Empty")?.value ?? "";
      const match = /(\d+)\s+of\s+(\d+)/.exec(emptyFact);
      const empty = match ? Number(match[1]) : 0;
      const climate = /climate/i.test(o.name);
      const parking = /parking|rv|boat/i.test(o.name);
      return {
        key: o.id,
        name: o.name,
        empty,
        driveUp: !climate && !parking,
        climate,
      };
    });

  const offers = ontology.objects
    .filter((o) => o.type === "offers")
    .map((o) => ({
      key: o.id,
      name: o.name,
      deal: o.facts[0]?.value || o.brief,
      active: o.status !== "ended" && o.status !== "scheduled",
    }));

  const ads = ontology.objects.filter((o) => o.type === "ads");
  const provenAds = (sample
    ? [
        { key: "drive-right-up", line: "Drive right up to your door." },
        { key: "whole-garage", line: "Room for the whole garage." },
        { key: "reserve-2-min", line: "Moving this month? Reserve in 2 minutes." },
      ]
    : ads.slice(0, 6).map((a) => ({ key: a.id, line: a.name }))
  );

  const moveIns = ontology.summaries.find((s) => s.type === "tenants");
  const moved = Number(moveIns?.reading.value);
  return {
    sample,
    facilityName: ontology.facility.name,
    goal: { moveIns: 12, month },
    movedIn30: Number.isFinite(moved) ? moved : undefined,
    units,
    offers,
    provenAds,
    metaConnected: true,
  };
}
