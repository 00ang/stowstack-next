import type { ObjectTypeKey, Ontology, OntologyObject, ToolKey } from "@/lib/ontology/types";

/**
 * The Tools track: one outcome, then the tools in the order the work actually
 * moves. Every hand-off is read from the facility ontology (itself a pure
 * reading of the rows). Nothing here invents a count, a price, or a page.
 *
 * The track is linear. Branches fold into the one station that does that
 * work, and the row cannot be rewired.
 */

export type StationState = "done" | "ready" | "waiting" | "gap" | "counts";

/** What the row shows. "now" and "next" are the track's place, not new facts. */
export type StationStatus = StationState | "now" | "next";

export interface TrackStation {
  /** 1-based place in the row. */
  n: number;
  tool: ToolKey;
  label: string;
  /** Object type whose hue marks the station. */
  hue: ObjectTypeKey;
  /** What the rows say, before the track picks the station to open. */
  state: StationState;
  status: StationStatus;
  /** "Hands on", "Makes", "Runs"… */
  verb: string;
  /** What this station hands the next. */
  handoff: string;
  /** One plain line from the numbers, or null when the hand-off already says it. */
  why: string | null;
}

export interface TrackIntent {
  /** "fill", "answer", "reply"… */
  verb: string;
  /** "10×10 drive-up" */
  object: string;
  /** End of the goal month ("Oct 31"), or null when there is no goal. */
  by: string | null;
  /** "Fill 10×10 drive-up by Oct 31" */
  sentence: string;
}

export interface TrackCampaign {
  id: string;
  name: string;
  address: string;
}

export interface ToolTrack {
  focus: string | null;
  focusType: ObjectTypeKey | null;
  intent: TrackIntent;
  savesInto: TrackCampaign | null;
  stations: TrackStation[];
  /** The station the operator should open. Null when there is nothing to build from. */
  now: ToolKey | null;
}

export interface BuildTrackInput {
  ontology: Ontology;
  /** Address to build around. Omitted: the top move's subject, else the emptiest unit. */
  focus?: string | null;
  /** End of the goal month, already formatted. The track never reads the clock. */
  by?: string | null;
  /** The campaign the operator is already on, used only when the object links to none. */
  working?: { id: string; name: string } | null;
}

export interface TrackChoice {
  address: string;
  /** "10×10 drive-up" */
  label: string;
}

export interface TrackInput {
  hue: ObjectTypeKey;
  title: string;
  detail: string;
}

export interface TrackSuggestion {
  sentence: string;
  reason: string;
  label: string;
  /** Station the button opens. Null when the move leaves the tools (upload). */
  tool: ToolKey | null;
}

interface Spec {
  tool: ToolKey;
  label: string;
  hue: ObjectTypeKey;
  verb: string;
}

const CLOSED_LEAD = new Set(["moved_in", "lost", "converted", "client_signed", "partial"]);

const SPEC: Record<string, Spec> = {
  occupancy: { tool: "occupancy", label: "Occupancy", hue: "units", verb: "Hands on" },
  competitors: { tool: "market-intel", label: "Competitors", hue: "competitors", verb: "Hands on" },
  creative: { tool: "creative-studio", label: "Creative Studio", hue: "ads", verb: "Makes" },
  publish: { tool: "ad-publisher", label: "Publish Ads", hue: "ads", verb: "Runs" },
  google: { tool: "google-ads", label: "Google Ads", hue: "ads", verb: "Runs" },
  pages: { tool: "landing-pages", label: "Landing Pages", hue: "pages", verb: "Lands on" },
  leads: { tool: "lead-nurture", label: "Lead Follow-Up", hue: "leads", verb: "Answers" },
  calls: { tool: "call-tracking", label: "Call Tracking", hue: "leads", verb: "Catches" },
  tenants: { tool: "tenants", label: "Tenants", hue: "tenants", verb: "Proves" },
  gbp: { tool: "gbp", label: "Google Business", hue: "reviews", verb: "Answers" },
  social: { tool: "social", label: "Social Media", hue: "posts", verb: "Posts" },
  links: { tool: "utm-links", label: "Tracking Links", hue: "links", verb: "Tracks" },
  revenue: { tool: "revenue", label: "Revenue", hue: "offers", verb: "Hands on" },
};

function fact(o: OntologyObject | null | undefined, label: string): string | null {
  return o?.facts.find((f) => f.label === label)?.value ?? null;
}

function dollars(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, "").match(/\$(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
}

function parseEmpty(text: string | null): { vacant: number; total: number } | null {
  const m = text?.match(/^(\d+) of (\d+)/);
  return m ? { vacant: Number(m[1]), total: Number(m[2]) } : null;
}

function vacantOf(o: OntologyObject): number {
  return parseEmpty(fact(o, "Empty"))?.vacant ?? 0;
}

function isDriveUp(o: OntologyObject): boolean {
  return /drive-?up/i.test(fact(o, "Features") ?? "");
}

function featureWord(o: OntologyObject): string | null {
  const features = fact(o, "Features") ?? "";
  if (/drive-?up/i.test(features)) return "drive-up";
  if (/climate/i.test(features)) return "climate";
  if (/parking|outdoor/i.test(features)) return "parking";
  return null;
}

export function unitPhrase(o: OntologyObject): string {
  const feature = featureWord(o);
  if (!feature || o.name.toLowerCase().includes(feature)) return o.name;
  return `${o.name} ${feature}`;
}

function byAddressOf(ontology: Ontology): Map<string, OntologyObject> {
  return new Map(ontology.objects.map((o) => [o.address, o]));
}

function linked(o: OntologyObject, map: Map<string, OntologyObject>, type: ObjectTypeKey): OntologyObject[] {
  const out: OntologyObject[] = [];
  for (const address of o.links) {
    const other = map.get(address);
    if (other?.type === type) out.push(other);
  }
  out.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));
  return out;
}

/** The unit this object is about: itself, or the first unit it links to. */
function subjectUnit(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject | null {
  if (focus.type === "units") return focus;
  return linked(focus, map, "units")[0] ?? null;
}

function adsFor(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  if (focus.type === "ads") return [focus];
  const own = linked(focus, map, "ads");
  if (own.length || focus.type === "units") return own;
  const unit = subjectUnit(focus, map);
  return unit ? linked(unit, map, "ads") : own;
}

function pagesFor(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  if (focus.type === "pages") return [focus];
  const own = linked(focus, map, "pages");
  if (own.length || focus.type === "units") return own;
  const unit = subjectUnit(focus, map);
  return unit ? linked(unit, map, "pages") : own;
}

function leadsFor(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  if (focus.type === "leads") return [focus];
  const own = linked(focus, map, "leads");
  if (own.length || focus.type === "units") return own;
  const unit = subjectUnit(focus, map);
  return unit ? linked(unit, map, "leads") : own;
}

function waitingLeads(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  return leadsFor(focus, map)
    .filter((l) => fact(l, "First reply") === "Not yet" && !CLOSED_LEAD.has(l.status ?? ""))
    .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "") || (a.address < b.address ? -1 : 1));
}

function tenantsFor(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  if (focus.type === "tenants") return [focus];
  const own = linked(focus, map, "tenants");
  if (own.length || focus.type === "units") return own;
  const unit = subjectUnit(focus, map);
  return unit ? linked(unit, map, "tenants") : own;
}

interface Reading {
  state: StationState;
  handoff: string;
  why: string | null;
  verb?: string;
  hue?: ObjectTypeKey;
}

function readOccupancy(focus: OntologyObject, map: Map<string, OntologyObject>, ontology: Ontology): Reading {
  const unit = subjectUnit(focus, map);
  if (!unit) return { state: "gap", handoff: "no unit mix", why: null };
  const parsed = parseEmpty(fact(unit, "Empty"));
  const name = unit.name;
  if (!parsed) return { state: "gap", handoff: name, why: null };
  let why = `${parsed.vacant} empty of ${parsed.total}.`;
  if (isDriveUp(unit) && parsed.vacant > 0) {
    const drive = ontology.objects.filter((o) => o.type === "units" && isDriveUp(o));
    const top = Math.max(...drive.map(vacantOf));
    const winners = drive.filter((o) => vacantOf(o) === top);
    if (winners.length === 1 && winners[0].address === unit.address) {
      why = `${parsed.vacant} empty of ${parsed.total}, the most of any drive-up size.`;
    }
  }
  return { state: "done", handoff: `${name} · ${parsed.vacant} empty`, why };
}

function priceForSize(listed: string | null, size: string): number | null {
  if (!listed) return null;
  const part = listed
    .split(",")
    .map((s) => s.trim())
    .find((s) => s === size || s.startsWith(`${size} `));
  return part ? dollars(part) : null;
}

function readCompetitors(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  if (focus.type === "competitors") {
    const listed = fact(focus, "Prices listed");
    const miles = fact(focus, "Distance");
    return {
      state: listed ? "done" : "gap",
      handoff: listed ?? "no prices listed",
      why: miles ? `${focus.name}, ${miles} away.` : focus.name,
    };
  }
  const unit = subjectUnit(focus, map);
  if (!unit) return { state: "gap", handoff: "no prices yet", why: null };
  const ours = dollars(fact(unit, "Web rate")) ?? dollars(fact(unit, "Street rate"));
  const rivals = linked(unit, map, "competitors")
    .map((c) => ({ c, price: priceForSize(fact(c, "Prices listed"), unit.name), miles: fact(c, "Distance") }))
    .filter((r): r is { c: OntologyObject; price: number; miles: string | null } => r.price != null)
    .sort((a, b) => a.price - b.price || (a.c.address < b.c.address ? -1 : 1));
  if (!rivals.length) return { state: "gap", handoff: "no prices yet", why: "No competitor lists this size." };
  const low = rivals[0];
  const cheaper = ours != null && low.price < ours;
  const why = `${low.c.name} lists ${unit.name} at ${money(low.price)}${low.miles ? `, ${low.miles} away` : ""}${
    ours != null ? `. You ask ${money(ours)} online.` : "."
  }`;
  return {
    state: "done",
    handoff: cheaper ? `${money(low.price)} to beat` : `${money(low.price)} listed`,
    why,
  };
}

function readCreative(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const ads = adsFor(focus, map);
  const unit = subjectUnit(focus, map);
  const name = unit?.name ?? focus.name;
  if (!ads.length) {
    const parsed = unit ? parseEmpty(fact(unit, "Empty")) : null;
    const why = parsed ? `${parsed.vacant} empty of ${parsed.total}. No ad names the ${name}.` : `No ad names the ${name}.`;
    return { state: "gap", handoff: "no ad names it", why };
  }
  const drafts = ads.filter((a) => (a.status ?? "draft") === "draft");
  const live = ads.filter((a) => a.status === "published" || a.status === "active");
  if (!live.length) {
    return {
      state: "done",
      handoff: `${drafts.length} ad draft${drafts.length === 1 ? "" : "s"}`,
      why: null,
    };
  }
  const where = [...new Set(live.map((a) => fact(a, "Where")).filter((w): w is string => !!w))];
  return {
    state: "done",
    handoff: where.length ? `${live.length} live on ${where.join(", ")}` : `${live.length} live`,
    why: null,
  };
}

function readPublish(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const ads = adsFor(focus, map);
  if (!ads.length) return { state: "gap", handoff: "nothing to run yet", why: "Nothing is approved for this yet." };
  const live = ads.filter((a) => a.status === "published" || a.status === "active");
  if (live.length) {
    const where = fact(live[0], "Where") ?? "an ad platform";
    return { state: "done", handoff: `${where} · live`, why: null };
  }
  const held = ads.filter((a) => a.status === "paused" || a.status === "approved");
  if (held.length) {
    const where = fact(held[0], "Where") ?? "an ad platform";
    const word = held[0].status === "paused" ? "paused" : "approved";
    return { state: "ready", handoff: `${where} · ${word}`, why: null };
  }
  return {
    state: "gap",
    handoff: `${ads.length} draft${ads.length === 1 ? "" : "s"}, not running`,
    why: "Written, and not running.",
  };
}

function visitsOf(page: OntologyObject): number {
  return Number(fact(page, "Visits, 30 days")?.replace(/,/g, "")) || 0;
}

function readPages(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const pages = pagesFor(focus, map);
  const live = pages.filter((p) => p.status === "published");
  const name = subjectUnit(focus, map)?.name ?? focus.name;
  if (!live.length) return { state: "gap", handoff: "no page lists it", why: `No page lists the ${name}.` };
  const best = [...live].sort((a, b) => visitsOf(b) - visitsOf(a) || (a.address < b.address ? -1 : 1))[0];
  const path = fact(best, "Lives at") ?? best.name;
  const visits = fact(best, "Visits, 30 days");
  const leads = fact(best, "Leads, 30 days");
  return {
    state: "ready",
    handoff: path,
    why: visits ? `${visits} visits and ${leads ?? "0"} leads in 30 days.` : null,
  };
}

function leadWhy(waiting: OntologyObject[], size: string | null): string {
  const n = waiting.length;
  const names = waiting.slice(0, 2).map((l) => l.name);
  const who = n === 1 ? names[0] : n === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${n - 1} others`;
  const about = size ? ` about a ${size}` : "";
  if (n === 1) return `${who} asked${about}. No reply yet.`;
  if (n === 2) return `${who} asked${about}. Neither has a reply.`;
  return `${who} asked${about}. No reply yet.`;
}

function readLeads(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  if (focus.type === "leads") {
    const waiting = fact(focus, "First reply") === "Not yet" && !CLOSED_LEAD.has(focus.status ?? "");
    return {
      state: waiting ? "waiting" : "done",
      handoff: waiting ? "asked · no reply" : (fact(focus, "Status") ?? "answered"),
      why: waiting ? `${focus.name} hasn't heard back.` : null,
    };
  }
  const waiting = waitingLeads(focus, map);
  if (!waiting.length) {
    const any = leadsFor(focus, map).length > 0;
    return { state: "ready", handoff: any ? "all answered" : "no one has asked", why: null };
  }
  const size = subjectUnit(focus, map)?.name ?? null;
  return {
    state: "waiting",
    handoff: `${waiting.length} asked · no reply`,
    why: leadWhy(waiting, size),
  };
}

function readTenants(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const people = tenantsFor(focus, map);
  const n = people.length;
  if (!n) return { state: "counts", handoff: "no move-in on record", why: null };
  const dated = people.filter((t) => fact(t, "Moved in")).length;
  return {
    state: "counts",
    handoff: `${n} move-in${n === 1 ? "" : "s"}`,
    why: dated ? `${dated} with a move-in date.` : null,
  };
}

function readGbp(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  if (focus.type === "reviews") {
    const waiting = fact(focus, "Answered") === "Not yet";
    const said = fact(focus, "Said");
    return {
      state: waiting ? "waiting" : "done",
      handoff: waiting ? "no reply yet" : "answered",
      why: said ?? null,
      hue: "reviews",
    };
  }
  if (focus.type === "posts") {
    const live = focus.status === "published" || focus.status === "posted";
    return {
      state: live ? "done" : focus.status === "scheduled" ? "ready" : "gap",
      handoff: fact(focus, "Status") ?? "no post yet",
      why: null,
      hue: "posts",
      verb: "Posts",
    };
  }
  if (focus.type === "offers") {
    const posts = linked(focus, map, "posts");
    return posts.length
      ? { state: "done", handoff: posts[0].name, why: null, hue: "posts", verb: "Posts" }
      : { state: "gap", handoff: "not in a post", why: `${focus.name} isn't in a Google post.`, hue: "posts", verb: "Posts" };
  }
  const waiting = linked(focus, map, "reviews").filter((r) => fact(r, "Answered") === "Not yet");
  if (waiting.length) {
    return {
      state: "waiting",
      handoff: `${waiting.length} review${waiting.length === 1 ? "" : "s"} waiting`,
      why: fact(waiting[0], "Said"),
      hue: "reviews",
    };
  }
  return { state: "ready", handoff: "no review waiting", why: null, hue: "reviews" };
}

function readLinks(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const links = focus.type === "links" ? [focus] : linked(focus, map, "links");
  if (!links.length) return { state: "gap", handoff: "no tracking link", why: null };
  const clicks = links.reduce((sum, l) => sum + (Number(fact(l, "Clicks")?.replace(/,/g, "")) || 0), 0);
  return { state: "done", handoff: `${clicks.toLocaleString("en-US")} clicks`, why: links.length === 1 ? links[0].name : null };
}

function readRevenue(focus: OntologyObject, map: Map<string, OntologyObject>): Reading {
  const offer = focus.type === "offers" ? focus : (linked(focus, map, "offers").find((o) => o.status === "running") ?? null);
  if (!offer) return { state: "gap", handoff: "no offer running", why: null };
  const deal = fact(offer, "Deal") ?? offer.name;
  return { state: offer.status === "running" ? "done" : "gap", handoff: deal, why: null };
}

function readCalls(focus: OntologyObject): Reading {
  const from = fact(focus, "From");
  const call = from != null && /call/i.test(from);
  return call
    ? { state: "waiting", handoff: "came in by phone", why: `${focus.name} came in by phone.` }
    : { state: "ready", handoff: "no missed call on record", why: null };
}

function readOf(spec: Spec, focus: OntologyObject, map: Map<string, OntologyObject>, ontology: Ontology): Reading {
  switch (spec.tool) {
    case "occupancy":
      return readOccupancy(focus, map, ontology);
    case "market-intel":
      return readCompetitors(focus, map);
    case "creative-studio":
      return readCreative(focus, map);
    case "ad-publisher":
    case "google-ads":
      return readPublish(focus, map);
    case "landing-pages":
      return readPages(focus, map);
    case "lead-nurture":
      return readLeads(focus, map);
    case "call-tracking":
      return readCalls(focus);
    case "tenants":
      return readTenants(focus, map);
    case "gbp":
    case "social":
      return readGbp(focus, map);
    case "utm-links":
      return readLinks(focus, map);
    case "revenue":
      return readRevenue(focus, map);
    case "proven-ads": {
      const published = adsFor(focus, map).filter((a) => a.status === "published" || a.status === "active");
      return published.length
        ? { state: "done", handoff: `${published.length} published`, why: null }
        : { state: "gap", handoff: "none published", why: "No published ad to pick from." };
    }
    default:
      return { state: "gap", handoff: "nothing yet", why: null };
  }
}

function templateFor(focus: OntologyObject): Spec[] {
  switch (focus.type) {
    case "units":
      return [SPEC.occupancy, SPEC.competitors, SPEC.creative, SPEC.publish, SPEC.pages, SPEC.leads, SPEC.tenants];
    case "leads":
      return [SPEC.leads, SPEC.occupancy, SPEC.tenants];
    case "reviews":
      return [{ ...SPEC.gbp, hue: "reviews" }];
    case "pages":
      return [SPEC.pages, SPEC.links, SPEC.leads];
    case "ads":
      return [SPEC.creative, SPEC.publish, SPEC.pages];
    case "offers":
      return [SPEC.revenue, { ...SPEC.gbp, hue: "posts", verb: "Posts" }, SPEC.creative, SPEC.publish];
    case "competitors":
      return [SPEC.competitors, SPEC.creative, SPEC.publish];
    case "campaigns":
      return [SPEC.creative, SPEC.publish, SPEC.pages, SPEC.leads, SPEC.tenants];
    case "posts":
      return /google/i.test(fact(focus, "Where") ?? "")
        ? [{ ...SPEC.gbp, hue: "posts", verb: "Posts" }]
        : [{ ...SPEC.social, hue: "posts" }];
    case "links":
      return [SPEC.links, SPEC.pages];
    case "tenants":
      return [SPEC.tenants, SPEC.occupancy];
    case "tours":
      return [SPEC.leads, SPEC.tenants];
    default:
      return [SPEC.occupancy];
  }
}

function promote(specs: Spec[], readings: Reading[]): TrackStation[] {
  const stations: TrackStation[] = specs.map((spec, i) => {
    const reading = readings[i];
    return {
      n: i + 1,
      tool: spec.tool,
      label: spec.label,
      hue: reading.hue ?? spec.hue,
      state: reading.state,
      status: reading.state,
      verb: reading.verb ?? spec.verb,
      handoff: reading.handoff,
      why: reading.why,
    };
  });
  const idx = stations.findIndex((s) => s.state === "gap" || s.state === "waiting");
  if (idx >= 0) {
    stations[idx].status = "now";
    const nxt = stations[idx + 1];
    if (nxt && nxt.state !== "waiting" && nxt.state !== "counts" && nxt.state !== "done") nxt.status = "next";
  }
  return stations;
}

/** The object a track opens on when the URL names none. */
export function defaultFocus(ontology: Ontology): string | null {
  const top = ontology.moves.find((m) => m.subject.includes("/"));
  if (top) return top.subject;
  const units = ontology.objects.filter((o) => o.type === "units");
  const open = [...units].sort((a, b) => vacantOf(b) - vacantOf(a) || (a.address < b.address ? -1 : 1));
  return open[0]?.address ?? ontology.objects[0]?.address ?? null;
}

/** Open units, fullest vacancy first, for the "I want to" menu. */
export function trackChoices(ontology: Ontology): TrackChoice[] {
  const units = ontology.objects.filter((o) => o.type === "units");
  const open = units.filter((u) => vacantOf(u) > 0);
  const list = open.length ? open : units;
  return [...list]
    .sort((a, b) => vacantOf(b) - vacantOf(a) || (a.address < b.address ? -1 : 1))
    .map((u) => ({ address: u.address, label: unitPhrase(u) }));
}

function intentFor(focus: OntologyObject | null, by: string | null): TrackIntent {
  if (!focus) return { verb: "upload", object: "your unit mix", by: null, sentence: "Upload your unit mix" };
  const dated = (sentence: string, keepBy: boolean) => ({
    verb: sentence.split(" ")[0].toLowerCase(),
    object: focus.name,
    by: keepBy ? by : null,
    sentence: keepBy && by ? `${sentence} by ${by}` : sentence,
  });
  switch (focus.type) {
    case "units": {
      const phrase = unitPhrase(focus);
      const filling = vacantOf(focus) > 0;
      const sentence = filling ? `Fill ${phrase}` : `Hold ${phrase}`;
      return {
        verb: filling ? "fill" : "hold",
        object: phrase,
        by: filling ? by : null,
        sentence: filling && by ? `${sentence} by ${by}` : sentence,
      };
    }
    case "leads":
      return { ...dated(`Answer ${focus.name}`, true), object: focus.name };
    case "reviews":
      return { verb: "reply", object: focus.name, by: null, sentence: `Reply to ${focus.name}` };
    case "pages":
      return { verb: "open", object: focus.name, by: null, sentence: `Open ${focus.name}` };
    case "ads":
      return {
        verb: focus.status === "draft" ? "finish" : "run",
        object: focus.name,
        by: null,
        sentence: focus.status === "draft" ? `Finish ${focus.name}` : `Run ${focus.name}`,
      };
    case "offers":
      return { verb: "show", object: focus.name, by: null, sentence: `Show ${focus.name}` };
    case "competitors":
      return { verb: "answer", object: focus.name, by: null, sentence: `Answer ${focus.name}` };
    case "campaigns":
      return { verb: "run", object: focus.name, by, sentence: by ? `Run ${focus.name} by ${by}` : `Run ${focus.name}` };
    case "posts":
      return { verb: "post", object: focus.name, by: null, sentence: `Post ${focus.name}` };
    case "links":
      return { verb: "check", object: focus.name, by: null, sentence: `Check ${focus.name}` };
    case "tenants":
      return { verb: "count", object: focus.name, by: null, sentence: `Count ${focus.name}` };
    case "tours":
      return { verb: "see", object: focus.name, by: null, sentence: `See ${focus.name}` };
    default:
      return { verb: "open", object: focus.name, by: null, sentence: `Open ${focus.name}` };
  }
}

function campaignRank(status: string | null): number {
  if (status === "live") return 0;
  if (status === "testing") return 1;
  return 2;
}

function campaignsNear(focus: OntologyObject, map: Map<string, OntologyObject>): OntologyObject[] {
  const found = new Map<string, OntologyObject>();
  const take = (address: string) => {
    const o = map.get(address);
    if (o?.type === "campaigns") found.set(o.address, o);
  };
  for (const link of focus.links) {
    take(link);
    const mid = map.get(link);
    if (!mid) continue;
    for (const next of mid.links) take(next);
  }
  return [...found.values()].sort(
    (a, b) => campaignRank(a.status) - campaignRank(b.status) || (a.address < b.address ? -1 : 1),
  );
}

function savesInto(ontology: Ontology, focus: OntologyObject | null, working?: { id: string; name: string } | null): TrackCampaign | null {
  const map = byAddressOf(ontology);
  const near = focus ? campaignsNear(focus, map)[0] : undefined;
  const workingHit = working ? ontology.objects.find((o) => o.type === "campaigns" && o.id === working.id) : undefined;
  const live = ontology.objects
    .filter((o) => o.type === "campaigns")
    .sort((a, b) => campaignRank(a.status) - campaignRank(b.status) || (a.address < b.address ? -1 : 1))[0];
  const picked = near ?? workingHit ?? live;
  return picked ? { id: picked.id, name: picked.name, address: picked.address } : null;
}

const BY_TOOL: Partial<Record<ToolKey, Spec>> = {
  occupancy: SPEC.occupancy,
  "market-intel": SPEC.competitors,
  "creative-studio": SPEC.creative,
  "ad-publisher": SPEC.publish,
  "google-ads": SPEC.google,
  "landing-pages": SPEC.pages,
  "lead-nurture": SPEC.leads,
  "call-tracking": SPEC.calls,
  tenants: SPEC.tenants,
  gbp: SPEC.gbp,
  social: SPEC.social,
  "utm-links": SPEC.links,
  revenue: SPEC.revenue,
  "proven-ads": { tool: "proven-ads", label: "Proven Ads", hue: "ads", verb: "Picks" },
};

/**
 * A campaign function names its tool. If that tool isn't already a station
 * on this object's track, add it so the function opens a station instead of
 * leaving the track. The facts don't change; only the row gains the station.
 */
export function ensureStation(track: ToolTrack, tool: string | null, ontology: Ontology): ToolTrack {
  if (!tool || track.stations.some((s) => s.tool === tool)) return track;
  const spec = BY_TOOL[tool as ToolKey];
  const focus = track.focus ? ontology.objects.find((o) => o.address === track.focus) : null;
  if (!spec || !focus) return track;
  const reading = readOf(spec, focus, byAddressOf(ontology), ontology);
  const station: TrackStation = {
    n: 0,
    tool: spec.tool,
    label: spec.label,
    hue: reading.hue ?? spec.hue,
    state: reading.state,
    status: reading.state,
    verb: reading.verb ?? spec.verb,
    handoff: reading.handoff,
    why: reading.why,
  };
  const at = track.stations.findIndex((s) => s.tool === "tenants");
  const stations = [...track.stations];
  stations.splice(at >= 0 ? at : stations.length, 0, station);
  return { ...track, stations: stations.map((s, i) => ({ ...s, n: i + 1 })) };
}

export function buildTrack({ ontology, focus, by = null, working = null }: BuildTrackInput): ToolTrack {
  const map = byAddressOf(ontology);
  const address = (focus && map.has(focus) ? focus : null) ?? defaultFocus(ontology);
  const object = address ? map.get(address) ?? null : null;
  const intent = intentFor(object, by);
  const campaign = savesInto(ontology, object, working);
  if (!object) {
    return { focus: null, focusType: null, intent, savesInto: campaign, stations: [], now: null };
  }
  const specs = templateFor(object);
  const readings = specs.map((spec) => readOf(spec, object, map, ontology));
  const stations = promote(specs, readings);
  const now = stations.find((s) => s.status === "now")?.tool ?? null;
  return { focus: object.address, focusType: object.type, intent, savesInto: campaign, stations, now };
}

/** What the open station already has in hand, from the stations before it. */
export function stationInputs(track: ToolTrack, tool: ToolKey, ontology: Ontology): TrackInput[] {
  const open = track.stations.find((s) => s.tool === tool);
  if (!open) return [];
  const rows: TrackInput[] = track.stations
    .filter((s) => s.n < open.n)
    .map((s) => ({ hue: s.hue, title: s.handoff, detail: s.label }));
  const focus = track.focus ? ontology.objects.find((o) => o.address === track.focus) : null;
  const unit = focus?.type === "units" ? focus : null;
  const rate = fact(unit, "Web rate");
  if (rate && open.n > 1 && !rows.some((r) => r.title.includes(rate))) {
    const at = rows.findIndex((r) => r.detail === "Occupancy");
    rows.splice(at >= 0 ? at + 1 : rows.length, 0, { hue: "units", title: `${rate} a month online`, detail: "Your web rate" });
  }
  return rows;
}

/** The next few stations, so the drawer can say what happens after the hand-off. */
export function stationAhead(track: ToolTrack, tool: ToolKey): Pick<TrackStation, "n" | "label" | "handoff">[] {
  const open = track.stations.find((s) => s.tool === tool);
  if (!open) return [];
  return track.stations.filter((s) => s.n > open.n).slice(0, 3).map((s) => ({ n: s.n, label: s.label, handoff: s.handoff }));
}

function askFor(station: TrackStation, objectLabel: string): { sentence: string; label: string } {
  switch (station.tool) {
    case "creative-studio":
      return station.state === "gap"
        ? { sentence: `Write an ad for the ${objectLabel}.`, label: "Write it" }
        : { sentence: `Review the ${objectLabel} ad.`, label: "Open it" };
    case "ad-publisher":
      return { sentence: `Send the ${objectLabel} to Publish Ads.`, label: "Open Publish Ads" };
    case "google-ads":
      return { sentence: `Open Google Ads for the ${objectLabel}.`, label: "Open Google Ads" };
    case "lead-nurture":
      return { sentence: station.why ?? "Answer the people waiting.", label: "Answer them" };
    case "landing-pages":
      return station.state === "gap"
        ? { sentence: `Give the ${objectLabel} a page.`, label: "Open pages" }
        : { sentence: `Open the page for the ${objectLabel}.`, label: "Open the page" };
    case "market-intel":
      return { sentence: `Check the price against the ${objectLabel}.`, label: "Compare prices" };
    case "occupancy":
      return { sentence: `Read the ${objectLabel}.`, label: "Open occupancy" };
    case "gbp":
      return { sentence: station.why ?? "Open Google Business.", label: "Open it" };
    case "tenants":
      return { sentence: "Count the move-ins.", label: "Open tenants" };
    default:
      return { sentence: `Open ${station.label}.`, label: "Open it" };
  }
}

/**
 * The one next move for this track. With the drawer shut, it opens the
 * station that needs the operator. With that station open, it hands off to
 * the next one.
 */
export function trackSuggestion(track: ToolTrack, openTool: ToolKey | null): TrackSuggestion {
  if (!track.stations.length || !track.now) {
    return {
      sentence: track.intent.sentence,
      reason: "Every station reads from your unit mix.",
      label: "Upload the unit mix",
      tool: null,
    };
  }
  const now = track.stations.find((s) => s.tool === track.now) ?? track.stations[0];
  const open = openTool ? track.stations.find((s) => s.tool === openTool) ?? null : null;
  if (open && open.tool === now.tool) {
    const next = track.stations.find((s) => s.n === open.n + 1 && s.state !== "counts");
    if (next) {
      return {
        sentence: `Hand it to ${next.label}.`,
        reason: now.why ?? now.handoff,
        label: `Send to ${next.label}`,
        tool: next.tool,
      };
    }
  }
  const ask = askFor(now, track.intent.object);
  const reason = ask.sentence === now.why ? now.handoff : (now.why ?? now.handoff);
  if (open && open.tool !== now.tool) {
    return { sentence: ask.sentence, reason, label: `Back to ${now.label}`, tool: now.tool };
  }
  return { sentence: ask.sentence, reason, label: ask.label, tool: now.tool };
}
