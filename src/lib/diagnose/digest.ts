import type {
  CompetitorRate,
  Confidence,
  Digest,
  Evidence,
  EvidenceSource,
  FacilityPicture,
  Gap,
  GapKind,
  UnitFact,
} from "./picture";
import { sourceLabel } from "./picture";

/**
 * Turn everything known about a facility into a few named gaps.
 * Rules, not a model. The same picture always returns the same gaps.
 * Every number in an evidence line is one we were given, or a sum or
 * difference of two of them. A source we don't have stays a nudge.
 */

/** A size is "sitting empty" at this many empty, if it is also a real share. */
const VACANT_EMPTY = 5;
const VACANT_SHARE = 0.15;
/** Or a smaller count when a quarter of that size is open. */
const VACANT_SHARE_HARD = 0.2;
const VACANT_EMPTY_HARD = 3;
/** At or above this share vacant, the whole building is in lease-up. */
const LEASE_UP_SHARE = 1 / 3;
/** Asks in 30 days at or below this, with room to fill, is thin demand. */
const DEMAND_ASKS = 5;
/** Calls in 30 days at or below this is a quiet phone. */
const DEMAND_CALLS = 8;
/** Ads shown in 30 days, while money is being spent, below this is thin reach. */
const DEMAND_VIEWS = 3000;
/** At or above these, demand is not the gap, whatever they said. */
const HEALTHY_ASKS = 8;
const HEALTHY_CALLS = 15;
const HEALTHY_VIEWS = 15000;
/** Asks with a way to reply, and nobody has. */
const WAITING_LEADS = 2;
/** Missed calls before recovery is the story. */
const MISSED_CALLS = 3;
/** A page this visited, with at most one ask, is quiet. */
const QUIET_VISITS = 40;
/** Move-outs before retention is the story. */
const RETENTION_OUTS = 3;
/** Below this, Google is a thin first look. */
const GOOGLE_RATING = 4.2;
const GOOGLE_REVIEWS = 15;
/** A neighbor at or under this fraction of our rate, within 5 miles. */
const UNDERCUT = 0.9;
/** Web rate at or under this fraction of street, on a size that is empty. */
const WEB_VS_STREET = 0.85;
/** Jev only opens a gap on its own at or above this confidence. */
const JEV_SOLE = 0.45;

const PAIN_DEMAND = "Not enough leads coming in";
const PAIN_CONVERT = "Plenty of leads, not enough are converting to move-ins";
const PAIN_BOTH = "Both — not enough leads AND they're not converting";
const PAIN_RATES = "Revenue per unit is too low";
const MOVE_OUTS_AHEAD = "Move-outs matched or beat move-ins";
const ONLINE_NO = "No";
const ONLINE_RESERVE = "Reserve only";
const ONLINE_UNSURE = "Not sure";

function clamp(n: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function people(n: number): string {
  return n === 1 ? "1 person" : `${n} people`;
}

function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function line(picture: FacilityPicture, source: EvidenceSource, text: string, signal?: string): Evidence {
  return { text, source, sourceLabel: sourceLabel(source, picture.sample), ...(signal ? { signal } : {}) };
}

function occupancyFloor(label: string | null | undefined): number | null {
  if (!label) return null;
  if (/not open/i.test(label)) return null;
  if (/^under\s+(\d+)/i.test(label)) return 0;
  const range = /(\d+)\s*[–-]\s*(\d+)/.exec(label);
  if (range) return Number(range[1]);
  const plus = /(\d+)\s*%\+/.exec(label);
  if (plus) return Number(plus[1]);
  return null;
}

function occupancyCeiling(label: string | null | undefined): number | null {
  if (!label) return null;
  if (/not open/i.test(label)) return null;
  const under = /^under\s+(\d+)/i.exec(label);
  if (under) return Number(under[1]) - 1;
  const range = /(\d+)\s*[–-]\s*(\d+)/.exec(label);
  if (range) return Number(range[2]);
  if (/\d+\s*%\+/.test(label)) return 100;
  const one = /(\d+)\s*%/.exec(label);
  if (one) return Number(one[1]);
  return null;
}

function vacancyShare(units: UnitFact[] | null): number | null {
  if (!units?.length) return null;
  const total = units.reduce((n, u) => n + u.total, 0);
  const empty = units.reduce((n, u) => n + u.empty, 0);
  if (total <= 0) return null;
  return empty / total;
}

function roomToFill(picture: FacilityPicture): boolean {
  const share = vacancyShare(picture.units);
  if (share != null && share >= 0.08) return true;
  const ceiling = occupancyCeiling(picture.intake?.occupancyBand);
  if (ceiling != null && ceiling <= 89) return true;
  const floor = occupancyFloor(picture.intake?.occupancyBand);
  if (floor != null && floor <= 84) return true;
  const pct = picture.snapshot?.occupancyPct;
  if (pct != null && pct < 90) return true;
  return share == null && ceiling == null && pct == null;
}

function fullEnough(picture: FacilityPicture): boolean {
  const floor = occupancyFloor(picture.intake?.occupancyBand);
  if (floor != null && floor >= 90) return true;
  const pct = picture.snapshot?.occupancyPct;
  if (pct != null && pct >= 90) return true;
  const share = vacancyShare(picture.units);
  if (share != null && share < 0.08) return true;
  return false;
}

function stageIsLeaseUp(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return /lease-up|under construction/i.test(stage);
}

function listedRate(unit: UnitFact): number | null {
  return unit.webRate ?? unit.streetRate;
}

function qualifyingSizes(units: UnitFact[]): UnitFact[] {
  return units
    .filter((u) => u.total > 0 && u.empty > 0)
    .filter((u) => (u.empty >= VACANT_EMPTY && u.empty / u.total >= VACANT_SHARE) || (u.empty >= VACANT_EMPTY_HARD && u.empty / u.total >= VACANT_SHARE_HARD) || u.empty >= 8)
    .sort((a, b) => sizeScore(b) - sizeScore(a) || a.name.localeCompare(b.name));
}

function sizeScore(unit: UnitFact): number {
  return clamp((unit.empty / unit.total) * 70 + Math.min(40, unit.empty * 2));
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "the open sizes";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function makeGap(
  kind: GapKind,
  title: string,
  severity: number,
  confidence: Confidence,
  evidence: Evidence[],
  metric: string,
  target: string,
  nudge: string | null,
): Gap {
  const signals = evidence.map((e) => e.signal).filter((s): s is string => !!s);
  return {
    id: kind,
    kind,
    title,
    severity: clamp(severity),
    confidence,
    evidence,
    nudge,
    metric,
    target,
    signals,
  };
}

function countedConfidence(volume: number, thinBelow: number): Confidence {
  if (volume >= thinBelow) return "high";
  if (volume > 0) return "medium";
  return "low";
}

function vacantGap(picture: FacilityPicture): Gap | null {
  if (!picture.units?.length) return null;
  const sizes = qualifyingSizes(picture.units);
  if (!sizes.length) return null;
  const top = sizes.slice(0, 3);
  const evidence = top.map((u) => {
    const rate = listedRate(u);
    const rateBit = rate != null ? `, listed at ${dollars(rate)}` : "";
    return line(picture, "pms", `${u.name} has ${u.empty} of ${u.total} empty${rateBit}.`, "vacant");
  });
  const names = top.map((u) => u.name);
  return makeGap(
    "vacant_sizes",
    "Some sizes are sitting empty",
    sizeScore(sizes[0]),
    countedConfidence(sizes[0].empty, 8),
    evidence,
    `Empty ${sizes[0].name}`,
    joinNames(names),
    null,
  );
}

function leaseGap(picture: FacilityPicture): Gap | null {
  const share = vacancyShare(picture.units);
  const stage = stageIsLeaseUp(picture.intake?.stage);
  const band = occupancyCeiling(picture.intake?.occupancyBand);
  const bandLow = band != null && band <= 69;
  const snapshotLow = picture.snapshot?.occupancyPct != null && picture.snapshot.occupancyPct < 70;
  const mostlyEmpty = share != null && share >= LEASE_UP_SHARE;
  if (!stage && !bandLow && !snapshotLow && !mostlyEmpty) return null;

  const evidence: Evidence[] = [];
  if (picture.units?.length && share != null) {
    const total = picture.units.reduce((n, u) => n + u.total, 0);
    const empty = picture.units.reduce((n, u) => n + u.empty, 0);
    evidence.push(line(picture, "pms", `${empty} of ${total} units are empty.`, "vacancy"));
  }
  if (picture.snapshot?.occupancyPct != null) {
    evidence.push(line(picture, "pms", `The latest snapshot shows occupancy at ${picture.snapshot.occupancyPct}%.`, "vacancy"));
  }
  if (stage && picture.intake?.stage) {
    evidence.push(line(picture, "intake", `You said this facility is: ${picture.intake.stage}.`, "self-report"));
  } else if (bandLow && picture.intake?.occupancyBand) {
    evidence.push(line(picture, "intake", `You put occupancy at ${picture.intake.occupancyBand}.`, "self-report"));
  }
  const moveIns = picture.snapshot?.moveIns ?? picture.ledgerMoveIns30;
  const empty = picture.units?.reduce((n, u) => n + u.empty, 0) ?? null;
  if (moveIns != null && empty != null) {
    const source: EvidenceSource = picture.snapshot?.moveIns != null ? "pms" : "ledger";
    evidence.push(line(picture, source, `${moveIns} move-ins in 30 days, and ${empty} units are empty.`, "pace"));
  }
  if (!evidence.length) return null;

  let severity = 58;
  if (share != null) severity = clamp(share * 100 + (stage ? 10 : 0), 95);
  else if (picture.snapshot?.occupancyPct != null) severity = clamp(100 - picture.snapshot.occupancyPct + (stage ? 10 : 0), 95);
  if (share != null && share < 0.15 && stage) severity = 40;

  const counted = share != null || picture.snapshot?.occupancyPct != null;
  const confidence: Confidence = counted && (mostlyEmpty || snapshotLow) ? "high" : counted ? "medium" : "low";
  const paceKnown = moveIns != null && empty != null;
  return makeGap(
    "lease_up",
    "The building is still filling",
    severity,
    confidence,
    evidence,
    paceKnown ? "Move-ins against the empty count" : "Empty units",
    "Every size, from a low base",
    paceKnown ? null : "We'd know more if you shared last month's move-ins.",
  );
}

function demandHealthy(picture: FacilityPicture): boolean {
  if ((picture.leads30?.total ?? -1) >= HEALTHY_ASKS) return true;
  if ((picture.calls?.total30 ?? -1) >= HEALTHY_CALLS) return true;
  if ((picture.ads?.impressions30 ?? -1) >= HEALTHY_VIEWS) return true;
  return false;
}

function demandGap(picture: FacilityPicture): Gap | null {
  if (fullEnough(picture) && !stageIsLeaseUp(picture.intake?.stage)) return null;
  const pain = picture.intake?.pain;
  const said = pain === PAIN_DEMAND || pain === PAIN_BOTH;
  const jev = picture.jev?.painCategory === "not_enough_inquiries" && (picture.jev.confidence ?? 0) >= JEV_SOLE;
  const asks = picture.leads30?.total;
  const calls = picture.calls?.total30;
  const views = picture.ads?.impressions30;
  const spending = (picture.ads?.spend30 ?? 0) > 0;
  const thinAsks = asks != null && asks < DEMAND_ASKS;
  const thinCalls = calls != null && calls < DEMAND_CALLS;
  const thinViews = views != null && views < DEMAND_VIEWS && spending;
  const noSpend = picture.intake?.adSpendBand === "None";
  if (demandHealthy(picture)) return null;
  const room = roomToFill(picture) || said;
  if (!room && !said) return null;
  if (!thinAsks && !thinCalls && !thinViews && !said && !jev && !(noSpend && room && asks == null && calls == null && views == null)) {
    return null;
  }

  const evidence: Evidence[] = [];
  if (thinAsks && asks != null) evidence.push(line(picture, "leads", `${people(asks)} asked in 30 days.`, "asks"));
  if (thinCalls && calls != null) evidence.push(line(picture, "calls", `${plural(calls, "call")} in 30 days.`, "calls"));
  if (thinViews && views != null) evidence.push(line(picture, "ads", `Ads were shown ${views.toLocaleString("en-US")} times in 30 days.`, "views"));
  if (picture.visitors30 != null && picture.visitors30 < 40) {
    evidence.push(line(picture, "visitors", `${plural(picture.visitors30, "visit")} to your pages in 30 days.`, "visits"));
  }
  if (said && pain) evidence.push(line(picture, "intake", `You said: ${pain}.`, "self-report"));
  if (noSpend && picture.intake?.adSpendBand) {
    evidence.push(line(picture, "intake", "You said paid ad spend is none.", "self-report"));
  }
  if (jev && evidence.every((e) => e.signal !== "self-report" || !said)) {
    evidence.push(line(picture, "jev", "The read of your answers points to too few people asking.", "self-report"));
  }
  if (!evidence.length) return null;

  let severity = 36;
  if (thinAsks && asks != null) severity = Math.max(severity, clamp(18 + (DEMAND_ASKS - asks) * 10, 80));
  if (thinCalls && calls != null) severity = Math.max(severity, clamp(20 + (DEMAND_CALLS - calls) * 6, 80));
  if (thinViews && views != null) severity = Math.max(severity, clamp(30 + (1 - views / DEMAND_VIEWS) * 30, 70));
  const counted = thinAsks || thinCalls || thinViews;
  const confidence: Confidence = counted ? countedConfidence(Math.max(asks ?? 0, calls ?? 0), 4) : "low";
  const nudge = counted ? null : "We'd know more if you shared a call log or your ad results.";
  return makeGap(
    "demand",
    "Not enough people are asking",
    severity,
    confidence,
    evidence,
    "People who ask in 30 days",
    "People nearby who aren't calling yet",
    nudge,
  );
}

function conversionGap(picture: FacilityPicture): Gap | null {
  const leads = picture.leads30;
  const pain = picture.intake?.pain;
  const said = pain === PAIN_CONVERT || pain === PAIN_BOTH;
  const jev = picture.jev?.painCategory === "inquiries_not_converting" && (picture.jev.confidence ?? 0) >= JEV_SOLE;
  const evidence: Evidence[] = [];
  let severity = 0;

  if (leads && leads.waiting >= WAITING_LEADS) {
    evidence.push(
      line(
        picture,
        "leads",
        leads.waiting === 1 ? "1 person asked and hasn't heard back." : `${leads.waiting} people asked and haven't heard back.`,
        "waiting",
      ),
    );
    severity = Math.max(severity, clamp(18 + leads.waiting * 8, 70));
  }
  if (leads && leads.total >= 4 && leads.movedIn / leads.total < 0.2) {
    evidence.push(
      line(picture, "leads", `${people(leads.total)} asked in 30 days and ${leads.movedIn} moved in.`, "close-rate"),
    );
    severity = Math.max(severity, clamp(30 + (0.2 - leads.movedIn / leads.total) * 100, 75));
  }
  const quiet = (picture.pages ?? []).filter((p) => p.visits30 >= QUIET_VISITS && p.leads30 <= 1);
  for (const page of quiet.slice(0, 2)) {
    const asks = page.leads30 === 0 ? "no asks" : `${page.leads30} ask`;
    evidence.push(line(picture, "visitors", `${page.title} had ${page.visits30} visits and ${asks}.`, "quiet-page"));
    severity = Math.max(severity, clamp(20 + page.visits30 / 8, 55));
  }
  if (picture.calls && picture.calls.missed30 >= MISSED_CALLS) {
    evidence.push(
      line(picture, "calls", `${plural(picture.calls.missed30, "missed call")} in 30 days, out of ${picture.calls.total30}.`, "missed"),
    );
    severity = Math.max(severity, clamp(25 + picture.calls.missed30 * 6, 75));
  }
  if (leads && leads.reservedOpen >= 2) {
    evidence.push(line(picture, "leads", `${plural(leads.reservedOpen, "reservation")} still haven't moved in.`, "abandoned"));
    severity = Math.max(severity, clamp(28 + leads.reservedOpen * 6, 70));
  }
  if (said && pain && severity < 80) {
    evidence.push(line(picture, "intake", `You said: ${pain}.`, "self-report"));
    if (severity === 0) severity = 36;
  }
  if (jev && !evidence.some((e) => e.source === "jev")) {
    evidence.push(line(picture, "jev", "The read of your answers points to asks that don't become move-ins.", "self-report"));
    if (severity === 0) severity = 34;
  }
  if (!evidence.length || severity === 0) return null;

  const counted = evidence.some((e) => e.source !== "intake" && e.source !== "jev");
  const volume = Math.max(leads?.waiting ?? 0, leads?.total ?? 0, picture.calls?.missed30 ?? 0);
  const confidence: Confidence = counted ? countedConfidence(volume, 6) : "low";
  const metric = evidence.some((e) => e.signal === "waiting" || e.signal === "missed")
    ? "Asks still waiting on a reply"
    : "Asks that become move-ins";
  return makeGap(
    "conversion",
    "People ask, then it goes quiet",
    severity,
    confidence,
    evidence,
    metric,
    "People who already asked, or started a reservation",
    counted ? null : "We'd know more if you shared who asked and who moved in.",
  );
}

function retentionGap(picture: FacilityPicture): Gap | null {
  const snap = picture.snapshot;
  const said = picture.intake?.moveBalance === MOVE_OUTS_AHEAD;
  const jev = picture.jev?.painCategory === "move_outs_outpacing" && (picture.jev.confidence ?? 0) >= JEV_SOLE;
  const counted = snap?.moveIns != null && snap.moveOuts != null;
  if (counted && snap!.moveOuts! < snap!.moveIns!) return null;
  if (counted && snap!.moveOuts! < RETENTION_OUTS && snap!.moveOuts! <= snap!.moveIns!) {
    if (!said && !jev) return null;
  }
  const outsAhead = counted && snap!.moveOuts! >= snap!.moveIns! && snap!.moveOuts! >= RETENTION_OUTS;
  if (!outsAhead && !said && !jev) return null;
  if (!outsAhead && counted) return null;

  const evidence: Evidence[] = [];
  if (outsAhead && snap?.moveIns != null && snap.moveOuts != null) {
    evidence.push(
      line(picture, "pms", `${snap.moveOuts} move-outs and ${snap.moveIns} move-ins on the latest snapshot.`, "move-outs"),
    );
  }
  if (said && picture.intake?.moveBalance) {
    evidence.push(line(picture, "intake", `You said last 30 days: ${picture.intake.moveBalance}.`, "self-report"));
  }
  if (jev && !said) {
    evidence.push(line(picture, "jev", "The read of your answers points to move-outs keeping up with move-ins.", "self-report"));
  }
  if (!evidence.length) return null;

  let severity = 36;
  if (outsAhead && snap?.moveIns != null && snap.moveOuts != null) {
    const gap = snap.moveOuts - snap.moveIns;
    severity = gap === 0 ? 32 : clamp(25 + gap * 12, 85);
  }
  const confidence: Confidence = outsAhead ? countedConfidence(snap!.moveOuts!, 6) : "low";
  return makeGap(
    "retention",
    "Move-outs are keeping up with move-ins",
    severity,
    confidence,
    evidence,
    "Move-outs in 30 days",
    "Tenants who are about to leave",
    outsAhead ? null : "We'd know more if you shared move-ins and move-outs from your PMS.",
  );
}

function googleGap(picture: FacilityPicture): Gap | null {
  const g = picture.google;
  if (!g) return null;
  const thinRating = g.rating != null && g.rating < GOOGLE_RATING;
  const thinCount = g.reviewCount != null && g.reviewCount < GOOGLE_REVIEWS;
  const low = g.unansweredLow >= 1;
  if (!thinRating && !thinCount && !low) return null;

  const evidence: Evidence[] = [];
  if (g.rating != null && g.reviewCount != null) {
    evidence.push(line(picture, "google", `Google rating is ${g.rating} from ${g.reviewCount.toLocaleString("en-US")} reviews.`, "rating"));
  } else if (g.rating != null) {
    evidence.push(line(picture, "google", `Google rating is ${g.rating}.`, "rating"));
  } else if (g.reviewCount != null) {
    evidence.push(line(picture, "google", `Google has ${g.reviewCount.toLocaleString("en-US")} reviews on file.`, "rating"));
  }
  if (low && g.lowestUnanswered != null) {
    const text =
      g.unansweredLow === 1
        ? `1 low review has no reply. It is ${g.lowestUnanswered} stars.`
        : `${g.unansweredLow} low reviews have no reply. The lowest is ${g.lowestUnanswered} stars.`;
    evidence.push(line(picture, "google", text, "unanswered"));
  }
  if (!evidence.length) return null;

  let severity = 0;
  if (thinRating && g.rating != null) severity = Math.max(severity, clamp((GOOGLE_RATING - g.rating) * 50 + 25, 80));
  if (thinCount) severity = Math.max(severity, 40);
  if (low) severity = Math.max(severity, clamp(22 + g.unansweredLow * 6, 40));
  const title = thinRating || thinCount ? "Google is a thin first look" : "A low review has no reply";
  const metric = thinRating || thinCount ? "Google rating and review count" : "Reviews with no reply";
  return makeGap("google", title, severity, "high", evidence, metric, "People who check Google before they call", null);
}

function onlineGap(picture: FacilityPicture): Gap | null {
  const answer = picture.intake?.onlineRental;
  if (!answer) return null;
  if (answer !== ONLINE_NO && answer !== ONLINE_RESERVE && answer !== ONLINE_UNSURE) return null;
  const evidence = [line(picture, "intake", `You said online rental is: ${answer}.`, "self-report")];
  if (answer === ONLINE_NO) {
    return makeGap("online_rental", "People can't rent online", 64, "high", evidence, "Units reserved online", "A renter who is ready and would rather not call", null);
  }
  if (answer === ONLINE_RESERVE) {
    return makeGap(
      "online_rental",
      "A reservation still has to become a rental",
      48,
      "high",
      evidence,
      "Reservations that finish online",
      "People who reserve and still have to call to rent",
      null,
    );
  }
  return makeGap(
    "online_rental",
    "Online rental isn't clear",
    30,
    "low",
    evidence,
    "Units reserved online",
    "Whether a renter can finish online",
    "We'd know more if you confirmed whether people can rent online.",
  );
}

function ratesGap(picture: FacilityPicture): Gap | null {
  const evidence: Evidence[] = [];
  let severity = 0;
  const pain = picture.intake?.pain === PAIN_RATES;
  const jev = picture.jev?.painCategory === "rates_or_revenue" && (picture.jev.confidence ?? 0) >= JEV_SOLE;

  const under = worstUndercut(picture);
  if (under) {
    const miles = under.miles != null ? `, ${under.miles} mi away` : "";
    evidence.push(line(picture, "pms", `${under.sizeLabel} is ${dollars(under.ours)} online, and ${under.empty} are empty.`, "undercut"));
    evidence.push(line(picture, "market", `${under.name} lists a ${under.sizeLabel} at ${dollars(under.theirs)}${miles}.`, "undercut"));
    const pct = 1 - under.theirs / under.ours;
    severity = Math.max(severity, clamp(pct * 100 + Math.min(20, under.empty), 70));
  }

  const discounted = worstDiscount(picture.units);
  if (discounted) {
    evidence.push(
      line(
        picture,
        "pms",
        `${discounted.name} is ${dollars(discounted.web)} online and ${dollars(discounted.street)} on the street rate, with ${discounted.empty} empty.`,
        "discount",
      ),
    );
    severity = Math.max(severity, clamp((1 - discounted.web / discounted.street) * 100, 60));
  }

  if (picture.rates && picture.rates.compared > 0 && picture.rates.belowStandard > 0 && picture.rates.medianGap != null) {
    evidence.push(
      line(
        picture,
        "pms",
        `${picture.rates.belowStandard} of ${picture.rates.compared} tenants are under the standard rate, typically ${dollars(picture.rates.medianGap)} under.`,
        "variance",
      ),
    );
    severity = Math.max(severity, clamp(20 + (picture.rates.belowStandard / picture.rates.compared) * 40, 65));
  }

  if (pain && (fullEnough(picture) || severity > 0)) {
    evidence.push(line(picture, "intake", `You said: ${picture.intake!.pain}.`, "self-report"));
    if (severity === 0) severity = fullEnough(picture) ? 50 : 28;
  }
  if (jev && severity === 0) {
    evidence.push(line(picture, "jev", "The read of your answers points to the rate, not empty units.", "self-report"));
    severity = 34;
  }
  if (!evidence.length || severity === 0) return null;

  const counted = evidence.some((e) => e.source === "pms");
  const confidence: Confidence = counted ? "high" : "low";
  const target = under ? `${under.sizeLabel} against ${under.name}` : "The rate on the sizes you have open";
  return makeGap(
    "rates",
    under ? "A neighbor is cheaper on an open size" : "The rate is the part that isn't working",
    severity,
    confidence,
    evidence,
    under ? "Your rate against that neighbor" : "Rate on the open sizes",
    target,
    counted ? null : "We'd know more if you shared a rent roll.",
  );
}

interface Undercut {
  name: string;
  sizeLabel: string;
  theirs: number;
  ours: number;
  miles: number | null;
  empty: number;
}

function worstUndercut(picture: FacilityPicture): Undercut | null {
  if (!picture.units?.length || !picture.competitors?.length) return null;
  let best: Undercut | null = null;
  for (const unit of picture.units) {
    const ours = listedRate(unit);
    if (ours == null || ours <= 0 || unit.empty < 1) continue;
    const cheaper = picture.competitors
      .filter((c) => c.sizeKey === unit.sizeKey && c.climate === unit.climate && (c.miles == null || c.miles <= 5) && c.price <= ours * UNDERCUT)
      .sort((a, b) => a.price - b.price)[0];
    if (!cheaper) continue;
    const row: Undercut = {
      name: cheaper.name,
      sizeLabel: unit.name,
      theirs: cheaper.price,
      ours,
      miles: cheaper.miles,
      empty: unit.empty,
    };
    if (!best || ours - cheaper.price > best.ours - best.theirs) best = row;
  }
  return best;
}

function worstDiscount(units: UnitFact[] | null): { name: string; web: number; street: number; empty: number } | null {
  if (!units) return null;
  let best: { name: string; web: number; street: number; empty: number } | null = null;
  for (const unit of units) {
    if (unit.webRate == null || unit.streetRate == null || unit.streetRate <= 0 || unit.empty < 1) continue;
    if (unit.webRate / unit.streetRate > WEB_VS_STREET) continue;
    if (!best || unit.streetRate - unit.webRate > best.street - best.web) {
      best = { name: unit.name, web: unit.webRate, street: unit.streetRate, empty: unit.empty };
    }
  }
  return best;
}

function facilityNudges(picture: FacilityPicture, gaps: Gap[]): string[] {
  const lines: string[] = [];
  const push = (text: string) => {
    if (lines.length >= 3) return;
    if (lines.includes(text)) return;
    if (gaps.some((g) => g.nudge === text)) return;
    lines.push(text);
  };
  if (!picture.units) push("We'd know more if you shared your unit mix.");
  const moveOutsKnown = picture.snapshot?.moveOuts != null;
  const moveInsKnown = picture.snapshot?.moveIns != null || picture.ledgerMoveIns30 != null;
  if (!moveInsKnown && !moveOutsKnown) push("We'd know more if you shared last month's move-ins and move-outs.");
  else if (!moveOutsKnown) push("We'd know more if you shared move-outs.");
  if (!picture.calls) push("We'd know more if you shared your call log.");
  if (!picture.ads) push("We'd know more if you shared your ad results.");
  if (!picture.google) push("We'd know more if you connected Google.");
  if (!picture.intake?.onlineRental) push("We'd know more if you told us whether people can rent online.");
  if (!picture.rates && !picture.units) push("We'd know more if you shared a rent roll.");
  return lines;
}

function fingerprint(gaps: Gap[]): string {
  return gaps.map((g) => `${g.id}:${g.severity}:${g.evidence.map((e) => e.text).join("~")}`).join("||");
}

/** Named gaps, ranked. Missing sources stay as nudges, never as invented counts. */
export function digestFacility(picture: FacilityPicture): Digest {
  const found = [vacantGap, leaseGap, demandGap, conversionGap, retentionGap, googleGap, onlineGap, ratesGap]
    .map((fn) => fn(picture))
    .filter((g): g is Gap => g != null)
    .sort((a, b) => b.severity - a.severity || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { gaps: found, nudges: facilityNudges(picture, found), fingerprint: fingerprint(found) };
}

/** Sizes a funnel should name, worst first. Empty when we don't have a mix. */
export function focusSizes(picture: FacilityPicture, limit = 4): UnitFact[] {
  if (!picture.units?.length) return [];
  const qualifying = qualifyingSizes(picture.units);
  const pool = qualifying.length ? qualifying : picture.units.filter((u) => u.empty > 0);
  return pool.slice(0, limit);
}

export function focusSizeKeys(picture: FacilityPicture, limit = 4): string[] {
  return focusSizes(picture, limit).map((u) => u.key);
}
