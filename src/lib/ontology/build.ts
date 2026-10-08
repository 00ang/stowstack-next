import {
  addressOf,
  channelName,
  daysSince,
  excerpt,
  money,
  monthDay,
  parsePrice,
  plural,
  prettySize,
  shortId,
  sizeKey,
  sizeKeysIn,
  slugify,
} from "./address";
import { TYPE_DEFS, TYPE_ORDER } from "./registry";
import type {
  Fact,
  Move,
  ObjectAction,
  ObjectTypeKey,
  Ontology,
  OntologyObject,
  RawFacility,
  RawLead,
  RawReview,
  RawUnit,
  Reading,
  TypeSummary,
} from "./types";

/**
 * buildOntology: rows in, a linked, addressed, explained facility out.
 *
 * Pure. Same rows and the same clock always give the same ontology, whatever
 * order the rows arrive in: every list is sorted by a stable key before an
 * address is handed out, and every output list is sorted before it leaves.
 */

const DAY = 86_400_000;

/** Climate-controlled, however a PMS or a competitor's site writes it. */
const CLIMATE_RE = /climate|\bcc\b|heated|temperature/i;

function isClimate(u: RawUnit): boolean {
  return CLIMATE_RE.test(`${u.unitType} ${u.features.join(" ")}`);
}

/** Lead states that are finished, one way or the other. */
const CLOSED_LEAD_STATES = new Set(["moved_in", "lost", "converted", "client_signed"]);

interface Draft {
  address: string;
  type: ObjectTypeKey;
  id: string;
  name: string;
  status: string | null;
  at: string | null;
  facts: Fact[];
  actions: ObjectAction[];
  /** Sort key within the type; lower sorts first. */
  order: (string | number)[];
}

function fact(label: string, value: string | null | undefined): Fact[] {
  return value ? [{ label, value }] : [];
}

function lower(s: string | null | undefined): string | null {
  return s ? s.trim().toLowerCase() : null;
}

function byId<T extends { id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function compareOrder(a: (string | number)[], b: (string | number)[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x) < String(y) ? -1 : 1;
  }
  return 0;
}

/** Hands out addresses, suffixing the short id when two records would share one. */
class AddressBook {
  private used = new Set<string>();
  claim(type: ObjectTypeKey, slug: string, id: string): string {
    let address = addressOf(type, slug);
    if (this.used.has(address)) address = addressOf(type, `${slug}-${shortId(id)}`);
    let n = 2;
    while (this.used.has(address)) address = addressOf(type, `${slug}-${shortId(id)}-${n++}`);
    this.used.add(address);
    return address;
  }
}

function time(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function platformName(platform: string): string {
  const p = platform.toLowerCase();
  if (p.startsWith("meta")) return "Meta";
  if (p.startsWith("google")) return "Google";
  if (p.startsWith("tiktok")) return "TikTok";
  if (p.includes("email")) return "Email";
  if (p.includes("landing")) return "Landing page";
  return platform.replace(/[_-]+/g, " ");
}

function discountText(type: string | null, value: number | null, fallback: string | null): string | null {
  if (value != null && Number.isFinite(value)) {
    const t = (type ?? "fixed").toLowerCase();
    if (t.includes("percent")) return `${Number.isInteger(value) ? value : value.toFixed(1)}% off`;
    if (t.includes("first") || t.includes("month")) return `${money(value)} first month`;
    if (t.includes("free")) return `${value} month${value === 1 ? "" : "s"} free`;
    return `${money(value)} off`;
  }
  return fallback ? excerpt(fallback, 60) : null;
}

/* ─── the build ─── */

export function buildOntology(raw: RawFacility, now: Date): Ontology {
  const book = new AddressBook();
  const drafts: Draft[] = [];
  const links = new Map<string, Set<string>>();
  const link = (a: string | undefined, b: string | undefined) => {
    if (!a || !b || a === b) return;
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a)!.add(b);
    links.get(b)!.add(a);
  };
  const nowMs = now.getTime();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();

  /* units ---------------------------------------------------------------- */
  const unitAddr = new Map<string, string>();
  const unitsBySize = new Map<string, string[]>();
  const unitRow = new Map<string, RawUnit>();
  for (const u of byId(raw.units)) {
    const address = book.claim("units", slugify(u.unitType, "unit"), u.id);
    unitAddr.set(u.id, address);
    unitRow.set(address, u);
    const size = sizeKey(u.widthFt && u.depthFt ? `${u.widthFt}x${u.depthFt}` : null, u.sizeLabel, u.unitType);
    if (size) unitsBySize.set(size, [...(unitsBySize.get(size) ?? []), address]);
    const vacant = Math.max(0, u.total - u.occupied);
    drafts.push({
      address,
      type: "units",
      id: u.id,
      name: prettySize(u.unitType),
      status: u.total === 0 ? null : vacant === 0 ? "full" : "open",
      at: u.lastUpdated,
      facts: [
        { label: "Empty", value: `${vacant} of ${u.total}` },
        ...fact("Web rate", money(u.webRate)),
        ...fact("Street rate", money(u.streetRate)),
        ...fact("Features", u.features.length ? u.features.join(", ") : null),
      ],
      actions: [
        { label: "Write an ad", tool: "creative-studio" },
        { label: "See occupancy", tool: "occupancy" },
        { label: "Compare prices", tool: "market-intel" },
      ],
      order: [-vacant, u.unitType.toLowerCase()],
    });
  }
  const unitsForSize = (key: string | null) => (key ? unitsBySize.get(key) ?? [] : []);

  /* offers --------------------------------------------------------------- */
  const offerAddr = new Map<string, string>();
  const activeOffers: { address: string; needle: string; name: string }[] = [];
  const offerAppliesAll = new Set<string>();
  for (const s of byId(raw.specials)) {
    const address = book.claim("offers", slugify(s.name, "offer"), s.id);
    offerAddr.set(s.id, address);
    const ended = s.endDate != null && time(s.endDate) < today;
    const notYet = s.startDate != null && time(s.startDate) > nowMs;
    const running = s.active !== false && !ended && !notYet;
    const sizes = s.appliesTo.map((a) => prettySize(a)).filter(Boolean);
    if (sizes.length === 0) offerAppliesAll.add(address);
    for (const a of s.appliesTo) {
      // An exact unit type wins ("10x10 Climate" means that type, not every 10x10).
      // Only a bare size falls back to every unit of that size, climate kept apart.
      const byType = [...unitRow.entries()].filter(([, u]) => slugify(u.unitType) === slugify(a)).map(([addr]) => addr);
      const key = sizeKey(a);
      const wantsClimate = CLIMATE_RE.test(a);
      const bySize = key ? unitsForSize(key).filter((addr) => isClimate(unitRow.get(addr)!) === wantsClimate) : [];
      for (const t of byType.length ? byType : bySize) link(address, t);
    }
    if (running && s.name.trim().length >= 4) activeOffers.push({ address, needle: s.name.trim().toLowerCase(), name: s.name.trim() });
    drafts.push({
      address,
      type: "offers",
      id: s.id,
      name: s.name.trim(),
      status: running ? "running" : notYet ? "scheduled" : "ended",
      at: s.endDate ?? s.startDate,
      facts: [
        ...fact("Deal", discountText(s.discountType, s.discountValue, s.description)),
        { label: "Applies to", value: sizes.length ? sizes.join(", ") : "Every size" },
        ...fact(running ? "Runs through" : "Ended", monthDay(s.endDate)),
      ],
      actions: [
        { label: "Write a Google post", tool: "gbp" },
        { label: "Put it in an ad", tool: "creative-studio" },
      ],
      order: [running ? 0 : 1, s.name.toLowerCase()],
    });
  }
  const offersMentionedIn = (text: string): string[] => {
    const t = text.toLowerCase();
    return activeOffers.filter((o) => t.includes(o.needle)).map((o) => o.address);
  };

  /* campaigns ------------------------------------------------------------ */
  const campaignAddr = new Map<string, string>();
  for (const c of byId(raw.campaigns)) {
    const address = book.claim("campaigns", slugify(c.name, "campaign"), c.id);
    campaignAddr.set(c.id, address);
    const status = lower(c.status);
    drafts.push({
      address,
      type: "campaigns",
      id: c.id,
      name: c.name,
      status,
      at: c.publishedAt ?? c.createdAt,
      facts: [
        ...fact("Status", status),
        ...fact("Kind", c.archetype ? c.archetype.replace(/_/g, " ") : null),
        ...fact("Budget", c.dailyBudget != null ? `${money(c.dailyBudget)} a day` : null),
        ...fact("Started", monthDay(c.publishedAt)),
      ],
      actions: [{ label: "Open campaign", tool: "funnels" }],
      order: [status === "live" ? 0 : status === "testing" ? 1 : 2, -time(c.createdAt)],
    });
  }

  /* ads ------------------------------------------------------------------ */
  const adAddr = new Map<string, string>();
  for (const a of byId(raw.ads)) {
    const platform = platformName(a.platform);
    const address = book.claim("ads", `${slugify(platform, "ad")}-${shortId(a.id)}`, a.id);
    adAddr.set(a.id, address);
    const status = lower(a.status) ?? "draft";
    if (a.funnelId) link(address, campaignAddr.get(a.funnelId));
    for (const size of sizeKeysIn(a.text)) for (const u of unitsForSize(size)) link(address, u);
    for (const o of offersMentionedIn(a.text)) link(address, o);
    drafts.push({
      address,
      type: "ads",
      id: a.id,
      name: a.headline ? excerpt(a.headline, 56) : `${platform} ad`,
      status,
      at: a.createdAt,
      facts: [
        { label: "Where", value: platform },
        ...fact("Angle", a.angle ? a.angle.replace(/_/g, " ") : null),
        { label: "Status", value: status },
        ...fact("Written", monthDay(a.createdAt)),
      ],
      actions: [
        { label: "Open in Ad Generator", tool: "ad-studio", params: { variation: a.id } },
        { label: "Publish", tool: "ad-publisher" },
      ],
      order: [-time(a.createdAt)],
    });
  }

  /* pages ---------------------------------------------------------------- */
  const pageAddr = new Map<string, string>();
  const pageLeads30 = new Map<string, number>();
  for (const l of raw.leads) {
    if (l.landingPageId && time(l.createdAt) >= nowMs - 30 * DAY) {
      pageLeads30.set(l.landingPageId, (pageLeads30.get(l.landingPageId) ?? 0) + 1);
    }
  }
  for (const p of byId(raw.pages)) {
    const address = book.claim("pages", slugify(p.slug, "page"), p.id);
    pageAddr.set(p.id, address);
    const status = lower(p.status);
    if (p.funnelId) link(address, campaignAddr.get(p.funnelId));
    for (const v of p.variationIds) link(address, adAddr.get(v));
    for (const size of sizeKeysIn(p.title)) for (const u of unitsForSize(size)) link(address, u);
    for (const o of offersMentionedIn(p.title)) link(address, o);
    drafts.push({
      address,
      type: "pages",
      id: p.id,
      name: p.title,
      status,
      at: p.publishedAt ?? p.createdAt,
      facts: [
        { label: "Lives at", value: `/lp/${p.slug}` },
        ...fact("Status", status),
        { label: "Visits, 30 days", value: String(p.visits30) },
        { label: "Leads, 30 days", value: String(pageLeads30.get(p.id) ?? 0) },
      ],
      actions: [
        { label: "Edit page", tool: "landing-pages" },
        { label: "Make a tracking link", tool: "utm-links" },
      ],
      order: [status === "published" ? 0 : 1, -time(p.publishedAt ?? p.createdAt)],
    });
  }

  /* links ---------------------------------------------------------------- */
  for (const l of byId(raw.links)) {
    const address = book.claim("links", slugify(l.shortCode, "link"), l.id);
    if (l.landingPageId) link(address, pageAddr.get(l.landingPageId));
    drafts.push({
      address,
      type: "links",
      id: l.id,
      name: l.label,
      status: null,
      at: l.lastClickedAt ?? l.createdAt,
      facts: [
        { label: "Clicks", value: l.clickCount.toLocaleString("en-US") },
        { label: "Source", value: [l.utmSource, l.utmMedium].filter(Boolean).join(" / ") },
        ...fact("Campaign tag", l.utmCampaign),
        ...fact("Last click", monthDay(l.lastClickedAt)),
      ],
      actions: [{ label: "Open tracking links", tool: "utm-links" }],
      order: [-l.clickCount, l.label.toLowerCase()],
    });
  }

  /* posts ---------------------------------------------------------------- */
  for (const p of byId(raw.posts)) {
    const google = p.channel === "google";
    const where = google ? "Google Business" : channelName(p.channel).replace(/^./, (c) => c.toUpperCase());
    const address = book.claim("posts", `${slugify(google ? "google" : p.channel, "post")}-${shortId(p.id)}`, p.id);
    const text = `${p.title ?? ""} ${p.body}`;
    const offers = new Set(offersMentionedIn(text));
    if (p.offerCode) {
      for (const o of activeOffers) if (o.needle === p.offerCode.trim().toLowerCase()) offers.add(o.address);
    }
    for (const o of offers) link(address, o);
    for (const size of sizeKeysIn(text)) for (const u of unitsForSize(size)) link(address, u);
    const status = lower(p.status);
    const when = p.publishedAt ?? p.scheduledAt ?? p.createdAt;
    drafts.push({
      address,
      type: "posts",
      id: p.id,
      name: p.title ? excerpt(p.title, 56) : excerpt(p.body, 56),
      status,
      at: when,
      facts: [
        { label: "Where", value: where },
        ...fact("Status", status),
        ...fact(p.publishedAt ? "Posted" : p.scheduledAt ? "Scheduled" : "Written", monthDay(when)),
      ],
      actions: [{ label: google ? "Open Google Business" : "Open social", tool: google ? "gbp" : "social" }],
      order: [-time(when)],
    });
  }

  /* leads ---------------------------------------------------------------- */
  const leadAddr = new Map<string, string>();
  const leadRow = new Map<string, RawLead>();
  for (const l of byId(raw.leads)) {
    const address = book.claim("leads", `lead-${shortId(l.id)}`, l.id);
    leadAddr.set(l.id, address);
    leadRow.set(address, l);
    const size = sizeKey(l.unitSize);
    for (const u of unitsForSize(size)) link(address, u);
    if (l.landingPageId) link(address, pageAddr.get(l.landingPageId));
    if (l.funnelId) link(address, campaignAddr.get(l.funnelId));
    const status = lower(l.status) ?? "new";
    drafts.push({
      address,
      type: "leads",
      id: l.id,
      name: l.name?.trim() || `A lead from ${channelName(l.sourceChannel)}`,
      status,
      at: l.createdAt,
      facts: [
        ...fact("Wants", l.unitSize ? prettySize(l.unitSize) : null),
        { label: "From", value: channelName(l.sourceChannel) },
        { label: "Status", value: status.replace(/_/g, " ") },
        ...fact("Came in", monthDay(l.createdAt)),
        { label: "First reply", value: monthDay(l.firstResponseAt) ?? "Not yet" },
      ],
      actions: [{ label: "Follow up", tool: "lead-nurture" }],
      order: [-time(l.createdAt)],
    });
  }

  /* tours ---------------------------------------------------------------- */
  for (const t of byId(raw.tours)) {
    const address = book.claim("tours", `tour-${shortId(t.id)}`, t.id);
    if (t.leadId) link(address, leadAddr.get(t.leadId));
    for (const u of unitsForSize(sizeKey(t.sizeLabel))) link(address, u);
    const status = lower(t.status);
    const upcoming = time(t.scheduledAt) >= nowMs;
    drafts.push({
      address,
      type: "tours",
      id: t.id,
      name: `${t.contactName?.trim() || "Tour"}, ${monthDay(t.scheduledAt) ?? "unscheduled"}`,
      status,
      at: t.scheduledAt,
      facts: [
        ...fact("Who", t.contactName?.trim()),
        ...fact("Size", t.sizeLabel ? prettySize(t.sizeLabel) : null),
        ...fact("When", monthDay(t.scheduledAt)),
        ...fact("Status", status),
      ],
      actions: [],
      order: [upcoming ? 0 : 1, upcoming ? time(t.scheduledAt) : -time(t.scheduledAt)],
    });
  }

  /* tenants (recent move-ins) ---------------------------------------------- */
  const tenantAddr = new Map<string, string>();
  for (const t of byId(raw.tenants)) {
    const address = book.claim("tenants", `unit-${slugify(t.unitNumber, "unit")}`, t.id);
    tenantAddr.set(t.id, address);
    for (const u of unitsForSize(sizeKey(t.unitSize, t.unitType))) link(address, u);
    drafts.push({
      address,
      type: "tenants",
      id: t.id,
      name: `Unit ${t.unitNumber}`,
      status: lower(t.status),
      at: t.moveInDate,
      facts: [
        { label: "Tenant", value: t.name },
        ...fact("Size", t.unitSize ? prettySize(t.unitSize) : t.unitType ? prettySize(t.unitType) : null),
        ...fact("Rate", t.monthlyRate ? `${money(t.monthlyRate)} a month` : null),
        ...fact("Moved in", monthDay(t.moveInDate)),
      ],
      actions: [{ label: "Open tenants", tool: "tenants" }],
      order: [-time(t.moveInDate)],
    });
  }
  for (const l of raw.leads) {
    if (l.matchedTenantId) link(leadAddr.get(l.id), tenantAddr.get(l.matchedTenantId));
  }

  /* reviews -------------------------------------------------------------- */
  const reviewAddr = new Map<string, string>();
  for (const r of byId(raw.reviews)) {
    const address = book.claim("reviews", `review-${shortId(r.id)}`, r.id);
    reviewAddr.set(r.id, address);
    drafts.push({
      address,
      type: "reviews",
      id: r.id,
      name: `${r.rating}-star review from ${r.author?.trim() || "a customer"}`,
      status: r.hasResponse ? "answered" : "waiting",
      at: r.reviewTime,
      facts: [
        { label: "Rating", value: `${r.rating} of 5` },
        ...fact("Said", r.text ? excerpt(r.text, 140) : null),
        ...fact("Posted", monthDay(r.reviewTime)),
        { label: "Answered", value: r.hasResponse ? "Yes" : "Not yet" },
      ],
      actions: [{ label: r.hasResponse ? "Open Google Business" : "Reply", tool: "gbp" }],
      order: [r.hasResponse ? 1 : 0, -time(r.reviewTime)],
    });
  }

  /* competitors ---------------------------------------------------------- */
  // Prices by size, tagged climate or not, so a plain 10x10 is never held against a climate one.
  const competitorPrices = new Map<string, { address: string; name: string; price: number; miles: number | null; climate: boolean }[]>();
  const competitors = [...raw.competitors].sort((a, b) =>
    a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0,
  );
  for (const c of competitors) {
    const slug = slugify(c.name, "competitor");
    const address = book.claim("competitors", slug, slug);
    const listed: string[] = [];
    for (const u of c.units) {
      const key = sizeKey(u.size);
      const price = parsePrice(u.price);
      if (key && price != null && listed.length < 3) listed.push(`${prettySize(key)} ${money(price)}`);
      if (key && price != null) {
        const climate = CLIMATE_RE.test(`${u.type ?? ""} ${u.size}`);
        for (const ours of unitsForSize(key)) if (isClimate(unitRow.get(ours)!) === climate) link(address, ours);
        competitorPrices.set(key, [
          ...(competitorPrices.get(key) ?? []),
          { address, name: c.name, price, miles: c.distanceMiles, climate },
        ]);
      }
    }
    drafts.push({
      address,
      type: "competitors",
      id: slug,
      name: c.name,
      status: null,
      at: null,
      facts: [
        ...fact("Distance", c.distanceMiles != null ? `${c.distanceMiles} mi` : null),
        ...fact("Rating", c.rating != null ? `${c.rating} (${c.reviewCount.toLocaleString("en-US")})` : null),
        ...fact("Prices listed", listed.length ? listed.join(", ") : null),
        ...fact("Running", c.promotions[0] ? excerpt(c.promotions[0], 80) : null),
      ],
      actions: [{ label: "Compare prices", tool: "market-intel" }],
      order: [c.distanceMiles ?? 999, c.name.toLowerCase()],
    });
  }

  /* offers that apply to every size link nowhere specific, but they do apply */
  const offersForUnit = (unitAddress: string) =>
    drafts.filter(
      (d) =>
        d.type === "offers" &&
        d.status === "running" &&
        (offerAppliesAll.has(d.address) || links.get(d.address)?.has(unitAddress)),
    );

  /* briefs: one sentence of facts a tool can use ---------------------------- */
  const briefOf = (d: Draft): string => {
    const get = (label: string) => d.facts.find((f) => f.label === label)?.value;
    switch (d.type) {
      case "units": {
        const u = unitRow.get(d.address)!;
        const vacant = Math.max(0, u.total - u.occupied);
        const rate = money(u.webRate ?? u.streetRate);
        const offers = offersForUnit(d.address).map((o) => o.name);
        return [
          `${d.name}: ${vacant} of ${u.total} empty`,
          rate ? `, ${rate} a month online` : "",
          offers.length ? `. Offer: ${offers.join("; ")}` : "",
          ".",
        ].join("");
      }
      case "offers":
        return `${d.name}: ${get("Deal") ?? "special"} on ${(get("Applies to") ?? "every size").toLowerCase()}${
          get("Runs through") ? `, through ${get("Runs through")}` : ""
        }.`;
      case "ads":
        return `${get("Where")} ad${get("Angle") ? `, ${get("Angle")} angle` : ""}: ${d.name}.`;
      case "pages":
        return `${d.name} (${get("Lives at")}): ${get("Visits, 30 days")} visits and ${get("Leads, 30 days")} leads in 30 days.`;
      case "leads":
        return `${d.name}${get("Wants") ? ` wants a ${get("Wants")}` : ""}, from ${get("From")}, came in ${get("Came in")}.`;
      case "reviews":
        return `${d.name}${get("Said") ? `: "${get("Said")}"` : ""}.`;
      case "competitors":
        return `${d.name}${get("Distance") ? `, ${get("Distance")} away` : ""}${
          get("Prices listed") ? `, lists ${get("Prices listed")}` : ""
        }.`;
      default:
        return `${TYPE_DEFS[d.type].singular}: ${d.name}${d.facts[0] ? `, ${d.facts[0].label.toLowerCase()} ${d.facts[0].value}` : ""}.`;
    }
  };

  /* assemble objects --------------------------------------------------------- */
  const typeIndex = new Map(TYPE_ORDER.map((t, i) => [t, i]));
  drafts.sort((a, b) => {
    const t = typeIndex.get(a.type)! - typeIndex.get(b.type)!;
    if (t !== 0) return t;
    const o = compareOrder(a.order, b.order);
    return o !== 0 ? o : a.address < b.address ? -1 : 1;
  });
  const objects: OntologyObject[] = drafts.map((d) => ({
    address: d.address,
    type: d.type,
    id: d.id,
    name: d.name,
    status: d.status,
    at: d.at,
    facts: d.facts,
    links: [...(links.get(d.address) ?? [])].sort(),
    brief: briefOf(d),
    actions: d.actions.slice(0, 3),
  }));
  const byAddress = new Map(objects.map((o) => [o.address, o]));
  const ofType = (t: ObjectTypeKey) => objects.filter((o) => o.type === t);

  /* readings ----------------------------------------------------------------- */
  const summaries: TypeSummary[] = TYPE_ORDER.map((type) => ({
    type,
    count: ofType(type).length,
    reading: readingFor(type, raw, objects, now),
  }));

  /* moves -------------------------------------------------------------------- */
  const moves: Move[] = [];
  const move = (m: Omit<Move, "id" | "type">) =>
    moves.push({ ...m, id: `${m.rule}:${m.subject}`, type: (byAddress.get(m.subject)?.type ?? "units") as ObjectTypeKey });

  if (raw.units.length === 0) {
    moves.push({
      id: "foundation:units",
      rule: "foundation",
      rank: 1000,
      subject: "units",
      type: "units",
      sentence: "Upload your unit mix.",
      reason: "Every size, rate and vacancy here reads from it. Offers, ads and price checks wait on it.",
      why: "Every suggestion here starts from your sizes and prices.",
      action: { label: "Upload", href: "/portal/upload" },
    });
  }

  // Empty space nobody is selling: open units no ad names.
  const unsold = ofType("units")
    .map((o) => ({ o, u: unitRow.get(o.address)! }))
    .map(({ o, u }) => ({ o, u, vacant: Math.max(0, u.total - u.occupied) }))
    .filter(({ o, u, vacant }) => u.total > 0 && vacant >= 3 && vacant / u.total >= 0.08 && !o.links.some((l) => l.startsWith("ads/")))
    .sort((a, b) => b.vacant - a.vacant || (a.o.address < b.o.address ? -1 : 1))
    .slice(0, 2);
  for (const { o, u, vacant } of unsold) {
    const rateN = u.webRate ?? u.streetRate;
    const rate = money(rateN);
    move({
      rule: "unsold-space",
      rank: 500 + Math.min(vacant, 99),
      subject: o.address,
      sentence: `${o.name} has ${vacant} empty and no ad names it.`,
      reason: `${vacant} of ${u.total} are open${rate ? ` at ${rate} a month online` : ""}.`,
      why: rateN ? `${money(Math.round(vacant * rateN))} a month in rent is sitting in empty ${o.name} units.` : undefined,
      action: { label: "Write an ad", tool: "creative-studio" },
    });
  }

  // Leads nobody has answered.
  const waiting = ofType("leads")
    .map((o) => ({ o, l: leadRow.get(o.address)! }))
    .filter(
      ({ l }) =>
        l.hasContact &&
        !l.firstResponseAt &&
        !l.converted &&
        !CLOSED_LEAD_STATES.has(lower(l.status) ?? "") &&
        time(l.createdAt) >= nowMs - 14 * DAY,
    )
    .sort((a, b) => time(a.l.createdAt) - time(b.l.createdAt) || (a.o.address < b.o.address ? -1 : 1));
  if (waiting.length) {
    const oldest = waiting[0];
    const days = daysSince(oldest.l.createdAt, now) ?? 0;
    // The why: what happened here when people were answered quickly, if there
    // are enough answered leads to say; otherwise who is waiting, for what.
    const answered = ofType("leads")
      .map((o) => leadRow.get(o.address)!)
      .filter((l) => l.firstResponseAt && time(l.firstResponseAt) >= time(l.createdAt));
    const quick = answered.filter((l) => time(l.firstResponseAt!) - time(l.createdAt) <= DAY);
    const slow = answered.filter((l) => time(l.firstResponseAt!) - time(l.createdAt) > DAY);
    const movedIn = (ls: RawLead[]) => ls.filter((l) => l.converted || !!l.matchedTenantId).length;
    const who = oldest.l.name ? oldest.l.name.split(" ")[0] : "Someone";
    const wanted = oldest.l.unitSize ? ` about a ${prettySize(oldest.l.unitSize) || oldest.l.unitSize}` : "";
    const leadWhy =
      quick.length >= 4 && slow.length >= 4
        ? `Here, people answered within a day moved in ${movedIn(quick)} of ${quick.length} times; answered later, ${movedIn(slow)} of ${slow.length}.`
        : days === 0
          ? `${who} asked${wanted} today and is still waiting.`
          : `${who} has waited ${plural(days, "day")} since asking${wanted}.`;
    move({
      rule: "leads-waiting",
      rank: 480 + Math.min(waiting.length, 19),
      subject: oldest.o.address,
      sentence: waiting.length === 1 ? `${oldest.o.name} hasn't heard back.` : `${plural(waiting.length, "lead")} haven't heard back.`,
      reason:
        days === 0
          ? `The oldest came in today, from ${channelName(oldest.l.sourceChannel)}.`
          : `The oldest came in ${plural(days, "day")} ago, from ${channelName(oldest.l.sourceChannel)}.`,
      why: leadWhy,
      action: { label: "Follow up", tool: "lead-nurture" },
    });
  }

  // Reviews with no reply, lowest rating first.
  const unanswered = byId(raw.reviews)
    .filter((r) => !r.hasResponse)
    .sort((a: RawReview, b: RawReview) => a.rating - b.rating || time(a.reviewTime) - time(b.reviewTime));
  if (unanswered.length) {
    const first = unanswered[0];
    const address = reviewAddr.get(first.id)!;
    move({
      rule: "reviews-waiting",
      rank: 450 + (5 - Math.max(1, Math.min(5, first.rating))) * 10,
      subject: address,
      sentence:
        unanswered.length === 1
          ? `A ${first.rating}-star review is waiting for a reply.`
          : `${plural(unanswered.length, "review")} are waiting for a reply.`,
      reason:
        unanswered.length === 1
          ? `Posted ${monthDay(first.reviewTime) ?? "recently"}.`
          : `Start with the ${first.rating}-star one from ${monthDay(first.reviewTime) ?? "recently"}.`,
      why: first.text ? `${first.author ? `${first.author.split(" ")[0]} wrote` : "It says"}: “${excerpt(first.text, 90)}”` : undefined,
      action: { label: "Reply", tool: "gbp" },
    });
  }

  // Offers nobody can see.
  const specialByAddress = new Map(raw.specials.map((sp) => [offerAddr.get(sp.id), sp]));
  for (const o of ofType("offers").filter((x) => x.status === "running")) {
    const shown = o.links.some((l) => l.startsWith("ads/") || l.startsWith("pages/") || l.startsWith("posts/"));
    if (shown) continue;
    const ends = specialByAddress.get(o.address)?.endDate ?? null;
    move({
      rule: "offer-unseen",
      rank: 400,
      subject: o.address,
      sentence: `${o.name} isn't in any ad, page or Google post.`,
      reason: "An offer only works where people can see it.",
      why: ends ? `It runs until ${monthDay(ends)}, and nobody has seen it yet.` : "It's running, and nobody has seen it yet.",
      action: { label: "Write a Google post", tool: "gbp" },
    });
  }

  // Someone nearby lists your open size for less.
  const undercuts = ofType("units")
    .map((o) => {
      const u = unitRow.get(o.address)!;
      const ours = u.webRate ?? u.streetRate;
      const key = sizeKey(u.widthFt && u.depthFt ? `${u.widthFt}x${u.depthFt}` : null, u.sizeLabel, u.unitType);
      if (!ours || !key || u.total - u.occupied < 1) return null;
      const climate = isClimate(u);
      const cheaper = (competitorPrices.get(key) ?? [])
        .filter((c) => c.climate === climate && (c.miles == null || c.miles <= 5) && c.price <= ours * 0.9)
        .sort((a, b) => a.price - b.price || (a.address < b.address ? -1 : 1))[0];
      return cheaper ? { o, ours, cheaper } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.ours - b.cheaper.price - (a.ours - a.cheaper.price) || (a.o.address < b.o.address ? -1 : 1))
    .slice(0, 1);
  for (const { o, ours, cheaper } of undercuts) {
    const u = unitRow.get(o.address)!;
    const empty = Math.max(0, u.total - u.occupied);
    const pct = Math.round(((ours - cheaper.price) / ours) * 100);
    move({
      rule: "undercut",
      rank: 380 + Math.min(Math.round(ours - cheaper.price), 99),
      subject: o.address,
      sentence: `${cheaper.name} lists ${o.name} at ${money(cheaper.price)}.`,
      reason: `That is ${money(Math.round(ours - cheaper.price))} under your ${money(ours)}${cheaper.miles != null ? `, ${cheaper.miles} mi away` : ""}.`,
      why: `They ask ${pct}% less${cheaper.miles != null ? `, ${cheaper.miles} mi from you,` : ""} while ${empty} of yours sit empty.`,
      action: { label: "Compare prices", tool: "market-intel" },
    });
  }

  // Pages people visit and leave. The why compares them with this facility's
  // own pages that do turn visits into leads, when there are any.
  const converting = byId(raw.pages).filter((p) => lower(p.status) === "published" && p.visits30 >= 40 && (pageLeads30.get(p.id) ?? 0) > 0);
  const convVisits = converting.reduce((n, p) => n + p.visits30, 0);
  const convLeads = converting.reduce((n, p) => n + (pageLeads30.get(p.id) ?? 0), 0);
  for (const p of byId(raw.pages)) {
    if (lower(p.status) !== "published" || p.visits30 < 40 || (pageLeads30.get(p.id) ?? 0) > 0) continue;
    const address = pageAddr.get(p.id)!;
    move({
      rule: "page-no-leads",
      rank: 300 + Math.min(Math.round(p.visits30 / 10), 99),
      subject: address,
      sentence: `${p.title} had ${p.visits30} visits and no leads.`,
      reason: "Counted over the last 30 days.",
      why: convLeads > 0
        ? `Your other pages turn about 1 in ${Math.max(1, Math.round(convVisits / convLeads))} visits into a lead.`
        : `${p.visits30} people looked and left without asking.`,
      action: { label: "Edit page", tool: "landing-pages" },
    });
  }

  // Drafts that never left.
  const staleDrafts = ofType("ads")
    .filter((a) => a.status === "draft" && (daysSince(a.at, now) ?? 0) >= 7)
    .sort((a, b) => time(a.at) - time(b.at) || (a.address < b.address ? -1 : 1));
  if (staleDrafts.length) {
    move({
      rule: "drafts-idle",
      rank: 200 + Math.min(staleDrafts.length, 99),
      subject: staleDrafts[0].address,
      sentence:
        staleDrafts.length === 1 ? "An ad draft has sat for over a week." : `${plural(staleDrafts.length, "ad draft")} have sat for over a week.`,
      reason: `The oldest was written ${monthDay(staleDrafts[0].at)}.`,
      why: staleDrafts.length === 1 ? "Written, and never shown to anyone." : "Written, and none of them shown to anyone.",
      // Drafts are approved in Creative Studio; Publish Ads only shows approved ads.
      action: { label: "Review drafts", tool: "creative-studio" },
    });
  }

  moves.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));

  return {
    facility: { id: raw.facility.id, name: raw.facility.name },
    generatedAt: now.toISOString(),
    objects,
    summaries,
    moves,
  };
}

/* ─── readings: one true number per type, with how it is counted ─── */

function readingFor(type: ObjectTypeKey, raw: RawFacility, objects: OntologyObject[], now: Date): Reading {
  const nowMs = now.getTime();
  const count = (t: ObjectTypeKey, pred: (o: OntologyObject) => boolean = () => true) =>
    objects.filter((o) => o.type === t && pred(o)).length;
  switch (type) {
    case "units": {
      if (raw.units.length === 0) return { value: "None", unit: "uploaded yet", definition: "Upload your unit mix to fill this in." };
      const total = raw.units.reduce((s, u) => s + u.total, 0);
      const empty = raw.units.reduce((s, u) => s + Math.max(0, u.total - u.occupied), 0);
      return {
        value: empty.toLocaleString("en-US"),
        unit: `empty of ${total.toLocaleString("en-US")}`,
        definition: "Vacant units across every size, from your last unit-mix upload.",
      };
    }
    case "offers":
      return { value: String(count("offers", (o) => o.status === "running")), unit: "running", definition: "Specials switched on whose end date hasn't passed." };
    case "campaigns":
      return { value: String(count("campaigns", (o) => o.status === "live")), unit: "live", definition: "Campaigns currently running." };
    case "ads":
      return { value: String(count("ads", (o) => o.status === "published")), unit: "published", definition: "Ads that went out to a platform. Drafts are listed but not counted." };
    case "pages":
      return { value: String(count("pages", (o) => o.status === "published")), unit: "live", definition: "Published landing pages." };
    case "links": {
      const clicks = raw.links.reduce((s, l) => s + l.clickCount, 0);
      return { value: clicks.toLocaleString("en-US"), unit: "clicks", definition: "Every click on every tracking link, since each was made." };
    }
    case "posts":
      return { value: String(count("posts", (o) => o.status === "published" || o.status === "posted")), unit: "posted", definition: "Google Business and social posts that went live." };
    case "leads": {
      const n = raw.leads.filter((l) => new Date(l.createdAt).getTime() >= nowMs - 30 * DAY).length;
      return { value: String(n), unit: "in 30 days", definition: "People who asked about a unit in the last 30 days, from any source." };
    }
    case "tours": {
      const n = raw.tours.filter((t) => new Date(t.scheduledAt).getTime() >= nowMs && lower(t.status) !== "cancelled").length;
      return { value: String(n), unit: "coming up", definition: "Booked tours that haven't happened yet." };
    }
    case "tenants":
      return { value: String(raw.tenantCounts.movedIn30), unit: "in 30 days", definition: "Tenants whose move-in date falls in the last 30 days." };
    case "reviews": {
      const rated = raw.reviews.filter((r) => r.rating > 0);
      const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : raw.facility.googleRating;
      return avg == null
        ? { value: "None", unit: "yet", definition: "Connect Google Business to bring your reviews in." }
        : {
            value: avg.toFixed(1),
            unit: rated.length ? `from ${rated.length}` : "on Google",
            definition: rated.length
              ? "Average rating across the reviews synced from Google Business."
              : "Your Google rating. Connect Google Business to bring each review in.",
          };
    }
    case "competitors":
      return { value: String(raw.competitors.length), unit: "nearby", definition: "Facilities within 15 miles from your last market scan." };
  }
}
