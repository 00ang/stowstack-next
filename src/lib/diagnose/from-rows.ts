import type { RawFacility, RawLead, RawUnit } from "@/lib/ontology/types";
import type {
  CompetitorRate,
  FacilityPicture,
  GoogleFacts,
  IntakeFacts,
  JevFacts,
  LeadFacts,
  PageFacts,
  PictureStamps,
  RateFacts,
  SnapshotFacts,
  UnitFact,
} from "./picture";
import { blankStamps } from "./picture";

/**
 * Assemble a picture from the rows we already store. Pure: the same rows,
 * extras and clock produce the same picture. Counts are windows of `now`.
 * A query that did not run stays null on the extras, and stays null here.
 */

const DAY = 86_400_000;
const CLOSED = new Set(["moved_in", "lost", "converted", "client_signed"]);

export interface PictureExtras {
  intake?: Record<string, unknown> | null;
  jev?: unknown;
  /** Facility column, used only when the intake didn't answer occupancy. */
  occupancyRange?: string | null;
  snapshot?: SnapshotFacts | null;
  calls?: { total30: number; missed30: number } | null;
  ads?: FacilityPicture["ads"];
  visitors30?: number | null;
  rates?: RateFacts | null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parsePrice(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /(\d+(?:\.\d+)?)/.exec(value.replace(/,/g, ""));
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function sizeKeyOf(name: string, sizeLabel?: string | null): string {
  const raw = `${sizeLabel ?? ""} ${name}`;
  const match = /(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?\s*[x×]\s*(\d+(?:\.\d+)?)/i.exec(raw);
  if (!match) return name.toLowerCase().replace(/[^a-z0-9]+/g, "") || name;
  return `${Number(match[1])}x${Number(match[2])}`;
}

function climateOf(unit: RawUnit): boolean {
  return /climate/i.test(`${unit.unitType} ${unit.features.join(" ")}`);
}

function unitFact(unit: RawUnit): UnitFact {
  return {
    key: unit.id,
    name: unit.unitType,
    sizeKey: sizeKeyOf(unit.unitType, unit.sizeLabel),
    empty: Math.max(0, unit.total - unit.occupied),
    total: unit.total,
    streetRate: unit.streetRate,
    webRate: unit.webRate,
    climate: climateOf(unit),
  };
}

const INTAKE_FIELDS: [keyof IntakeFacts, string][] = [
  ["role", "role"],
  ["stage", "stage"],
  ["unitsBand", "units"],
  ["occupancyBand", "occupancy"],
  ["moveBalance", "move_balance"],
  ["pain", "pain"],
  ["adSpendBand", "ad_spend"],
  ["timeline", "timeline"],
  ["onlineRental", "online_rental"],
  ["googleAds", "google_ads"],
];

function intakeFrom(raw: Record<string, unknown> | null | undefined, occupancyRange: string | null | undefined): { facts: IntakeFacts | null; key: string | null } {
  const keys: string[] = [];
  const facts: IntakeFacts = {
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
  let any = false;
  if (raw) {
    for (const [field, key] of INTAKE_FIELDS) {
      const value = str(raw[key]);
      if (!value) continue;
      facts[field] = value;
      keys.push(key);
      any = true;
    }
    const words = [str(raw.reach_out), str(raw.site_note)].filter((s): s is string => !!s);
    if (words.length) {
      facts.freeText = words.join("\n");
      if (str(raw.reach_out)) keys.push("reach_out");
      if (str(raw.site_note)) keys.push("site_note");
      any = true;
    }
  }
  if (!facts.occupancyBand && str(occupancyRange)) {
    facts.occupancyBand = str(occupancyRange);
    keys.push("occupancy_range");
    any = true;
  }
  keys.sort();
  return { facts: any ? facts : null, key: keys.length ? keys.join("|") : null };
}

function jevFrom(raw: unknown): JevFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const answers = (raw as { answers?: unknown }).answers;
  if (!answers || typeof answers !== "object") return null;
  const pain = (answers as { pain_category?: { choice?: unknown; confidence?: unknown } }).pain_category;
  if (!pain || typeof pain !== "object") return null;
  const choice = str(pain.choice);
  if (!choice) return null;
  const confidence = typeof pain.confidence === "number" && Number.isFinite(pain.confidence) ? pain.confidence : null;
  return { painCategory: choice, confidence };
}

function leadFacts(leads: RawLead[], now: number): LeadFacts {
  const since30 = now - 30 * DAY;
  const since14 = now - 14 * DAY;
  const recent = leads.filter((l) => new Date(l.createdAt).getTime() >= since30);
  const waiting = recent.filter((l) => {
    const status = (l.status ?? "").toLowerCase();
    return l.hasContact && !l.firstResponseAt && !l.converted && !CLOSED.has(status) && new Date(l.createdAt).getTime() >= since14;
  });
  const movedIn = recent.filter((l) => l.converted || !!l.matchedTenantId || (l.status ?? "").toLowerCase() === "moved_in");
  const reservedOpen = recent.filter((l) => (l.status ?? "").toLowerCase() === "reserved" && !l.converted);
  return {
    total: recent.length,
    withContact: recent.filter((l) => l.hasContact).length,
    waiting: waiting.length,
    movedIn: movedIn.length,
    reservedOpen: reservedOpen.length,
  };
}

function pageFacts(raw: RawFacility, now: number): PageFacts[] | null {
  if (!raw.pages.length) return null;
  const since30 = now - 30 * DAY;
  return raw.pages.map((page) => ({
    title: page.title,
    visits30: page.visits30,
    leads30: raw.leads.filter((l) => l.landingPageId === page.id && new Date(l.createdAt).getTime() >= since30).length,
  }));
}

function googleFacts(raw: RawFacility): GoogleFacts | null {
  const rating = num(raw.facility.googleRating);
  const reviewCount = raw.facility.reviewCount;
  const unanswered = raw.reviews.filter((r) => !r.hasResponse);
  const low = unanswered.filter((r) => r.rating <= 3);
  if (rating == null && (reviewCount == null || reviewCount === 0) && raw.reviews.length === 0) return null;
  return {
    rating,
    reviewCount: reviewCount ?? (raw.reviews.length ? raw.reviews.length : null),
    unanswered: unanswered.length,
    unansweredLow: low.length,
    lowestUnanswered: low.length ? Math.min(...low.map((r) => r.rating)) : null,
  };
}

function competitorsOf(raw: RawFacility): CompetitorRate[] | null {
  if (!raw.competitors.length) return null;
  const rows: CompetitorRate[] = [];
  for (const competitor of raw.competitors) {
    for (const unit of competitor.units) {
      const price = parsePrice(unit.price);
      if (price == null) continue;
      const sizeLabel = unit.size || "unit";
      rows.push({
        name: competitor.name,
        sizeKey: sizeKeyOf(sizeLabel),
        sizeLabel,
        price,
        miles: competitor.distanceMiles,
        climate: /climate/i.test(`${unit.type ?? ""} ${unit.size}`),
      });
    }
  }
  return rows.length ? rows : null;
}

function latestStamp(units: RawUnit[]): string | null {
  const times = units.map((u) => u.lastUpdated).filter((t): t is string => !!t).sort();
  return times.length ? times[times.length - 1] : null;
}

export function pictureFromFacility(raw: RawFacility, extras: PictureExtras = {}, opts: { sample?: boolean; now: Date }): FacilityPicture {
  const now = opts.now.getTime();
  const intake = intakeFrom(extras.intake, extras.occupancyRange);
  const google = googleFacts(raw);
  const units = raw.units.length ? raw.units.map(unitFact) : null;
  const stamps: PictureStamps = {
    ...blankStamps(),
    pmsUnitsAt: latestStamp(raw.units),
    snapshotAt: extras.snapshot?.at ?? null,
    intakeKey: intake.key,
    callsKnown: extras.calls != null,
    adsKnown: extras.ads != null,
    googleKnown: google != null,
  };
  return {
    sample: !!opts.sample,
    facilityName: raw.facility.name,
    intake: intake.facts,
    jev: jevFrom(extras.jev),
    units,
    snapshot: extras.snapshot ?? null,
    ledgerMoveIns30: raw.tenantCounts ? raw.tenantCounts.movedIn30 : null,
    leads30: leadFacts(raw.leads, now),
    pages: pageFacts(raw, now),
    calls: extras.calls ?? null,
    ads: extras.ads ?? null,
    visitors30: extras.visitors30 ?? null,
    google,
    competitors: competitorsOf(raw),
    rates: extras.rates ?? null,
    stamps,
  };
}
