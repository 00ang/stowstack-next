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

/** The index header's vacancy line, parsed so the campaign can cite the same count. */
export function unitsSummaryFromReading(value: string, unit: string): { empty: number; total: number } | undefined {
  const empty = Number(value.replace(/,/g, ""));
  const totalRaw = /([\d,]+)\s*$/.exec(unit)?.[1];
  const total = totalRaw ? Number(totalRaw.replace(/,/g, "")) : NaN;
  if (!Number.isFinite(empty) || !Number.isFinite(total) || total <= 0) return undefined;
  return { empty, total };
}

/**
 * Facts the funnel rules may cite, taken from the facility ontology.
 * Counts in here are labelled SAMPLE by the caller when `sample` is set.
 * Unit vacancy is the index header's figure, not a second sum.
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
      const match = /(\d[\d,]*)\s+of\s+(\d[\d,]*)/.exec(emptyFact);
      const empty = match ? Number(match[1].replace(/,/g, "")) : 0;
      const total = match ? Number(match[2].replace(/,/g, "")) : undefined;
      const climate = /climate/i.test(o.name);
      const parking = /parking|rv|boat/i.test(o.name);
      return {
        key: o.id,
        name: o.name,
        empty,
        total,
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
  const unitsHeader = ontology.summaries.find((s) => s.type === "units");
  return {
    sample,
    facilityName: ontology.facility.name,
    goal: { moveIns: 12, month },
    movedIn30: Number.isFinite(moved) ? moved : undefined,
    unitsSummary: unitsHeader ? unitsSummaryFromReading(unitsHeader.reading.value, unitsHeader.reading.unit) : undefined,
    units,
    offers,
    provenAds,
    metaConnected: true,
  };
}
