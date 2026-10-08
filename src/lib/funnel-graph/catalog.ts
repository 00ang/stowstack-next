import type { FunnelContext, FunnelNode, Lane, NodeType, PortType } from "./types";

export interface PortIn {
  port: PortType;
  required: boolean;
}

export type OptionSource =
  | "units"
  | "offers"
  | "proven"
  | "angles"
  | "radius"
  | "who"
  | "match"
  | "reserve"
  | "steps"
  | "account";

export interface ParamDef {
  key: string;
  label: string;
  kind: "text" | "number" | "select" | "multi";
  required: boolean;
  placeholder?: string;
  options?: OptionSource;
}

export interface NodeDef {
  type: NodeType;
  title: string;
  lane: Lane;
  /** Lucide icon name, resolved in the canvas. */
  icon: string;
  /** Ontology type whose hue tints the icon. */
  hue: string;
  inputs: PortIn[];
  outputs: PortType[];
  /** At least one input must be connected (each input is optional on its own). */
  anyInput?: boolean;
  anyNeed?: string;
  params: ParamDef[];
  backend: "exists" | "partial";
  endpoint: string;
  /** Platform campaign is created paused. */
  paused: boolean;
  publish: (node: FunnelNode) => string;
}

const ANGLES: [string, string][] = [
  ["convenience", "Easy Move"],
  ["social_proof", "Trusted Choice"],
  ["urgency", "Last Chance"],
  ["lifestyle", "Fresh Start"],
];

export const CATALOG: Record<NodeType, NodeDef> = {
  units: {
    type: "units",
    title: "Units",
    lane: "space",
    icon: "Building2",
    hue: "var(--onto-units)",
    inputs: [],
    outputs: ["space"],
    params: [{ key: "sizes", label: "Sizes to fill", kind: "multi", required: true, options: "units" }],
    backend: "exists",
    endpoint: "facility_pms_units",
    paused: false,
    publish: (n) => `Reads ${list(n.params.sizes).length} unit types from your PMS data. Nothing is written.`,
  },
  offer: {
    type: "offer",
    title: "Offer",
    lane: "space",
    icon: "Tag",
    hue: "var(--onto-offers)",
    inputs: [{ port: "space", required: true }],
    outputs: ["space"],
    params: [{ key: "offer", label: "Special", kind: "select", required: true, options: "offers" }],
    backend: "partial",
    endpoint: "facility_pms_specials",
    paused: false,
    publish: () => "Names the running special in the ad and page copy. Never invents one.",
  },
  waitlist: {
    type: "waitlist",
    title: "Waitlist",
    lane: "space",
    icon: "ListChecks",
    hue: "var(--onto-units)",
    inputs: [{ port: "space", required: true }],
    outputs: ["lead"],
    params: [],
    backend: "exists",
    endpoint: "POST /api/waitlist",
    paused: false,
    publish: () => "Adds a waitlist form for sold-out sizes; texts people in order when one frees up.",
  },
  audience: {
    type: "audience",
    title: "Audience",
    lane: "reach",
    icon: "Users",
    hue: "var(--onto-campaigns)",
    inputs: [{ port: "space", required: true }],
    outputs: ["audience"],
    params: [
      { key: "radius", label: "Radius", kind: "select", required: true, options: "radius" },
      { key: "who", label: "Who", kind: "select", required: true, options: "who" },
    ],
    backend: "partial",
    endpoint: "funnels.target_audience",
    paused: false,
    publish: () => "Saves targeting on the campaign; syncs a Meta custom audience when past leads is picked.",
  },
  proven: {
    type: "proven",
    title: "Proven Ad · recreate",
    lane: "reach",
    icon: "Sparkles",
    hue: "var(--onto-ads)",
    inputs: [
      { port: "audience", required: true },
      { port: "space", required: false },
    ],
    outputs: ["ad"],
    params: [{ key: "src", label: "Start from", kind: "select", required: true, options: "proven" }],
    backend: "exists",
    endpoint: "POST /api/proven-ads/[id]/duplicate",
    paused: false,
    publish: () => "Rewrites the proven ad for your facility, sizes and running offer; saves it as a draft ad on this campaign.",
  },
  write: {
    type: "write",
    title: "Write an ad",
    lane: "reach",
    icon: "PenLine",
    hue: "var(--onto-ads)",
    inputs: [
      { port: "audience", required: true },
      { port: "space", required: false },
    ],
    outputs: ["ad"],
    params: [{ key: "angle", label: "Angle", kind: "select", required: true, options: "angles" }],
    backend: "exists",
    endpoint: "POST /api/facility-creatives",
    paused: false,
    publish: () => "Generates copy and a hero image from your facility data; it stays a draft until you publish.",
  },
  meta: {
    type: "meta",
    title: "Run on Meta",
    lane: "reach",
    icon: "Megaphone",
    hue: "var(--onto-ads)",
    inputs: [{ port: "ad", required: true }],
    outputs: ["visit"],
    params: [
      { key: "budget", label: "Daily budget ($)", kind: "number", required: true },
      { key: "acct", label: "Meta account", kind: "select", required: true, options: "account" },
    ],
    backend: "partial",
    endpoint: "POST /api/publish-ad",
    paused: true,
    publish: (n) =>
      `Creates a Meta campaign PAUSED at $${param(n, "budget") || "?"}/day. Nothing spends until you switch it on in Ads Manager.`,
  },
  google: {
    type: "google",
    title: "Google Search",
    lane: "reach",
    icon: "Search",
    hue: "var(--onto-ads)",
    inputs: [{ port: "ad", required: true }],
    outputs: ["visit"],
    params: [{ key: "budget", label: "Daily budget ($)", kind: "number", required: true }],
    backend: "partial",
    endpoint: "POST /api/publish-ad",
    paused: true,
    publish: (n) => `Creates a Google Search campaign PAUSED at $${param(n, "budget") || "?"}/day.`,
  },
  gbp: {
    type: "gbp",
    title: "Google Business post",
    lane: "reach",
    icon: "Newspaper",
    hue: "var(--onto-posts)",
    inputs: [{ port: "space", required: true }],
    outputs: ["visit"],
    params: [],
    backend: "exists",
    endpoint: "POST /api/gbp-posts",
    paused: false,
    publish: () => "Writes and schedules a Google Business post that links to the page.",
  },
  page: {
    type: "page",
    title: "Landing page",
    lane: "convert",
    icon: "FileText",
    hue: "var(--onto-pages)",
    inputs: [{ port: "visit", required: true }],
    outputs: ["lead", "visit"],
    params: [],
    backend: "exists",
    endpoint: "POST /api/landing-pages/generate",
    paused: false,
    publish: (n) =>
      `Generates /lp/${n.slug || "…"}, message-matched to the ad, and publishes it. A tracking link is made for every way in.`,
  },
  reserve: {
    type: "reserve",
    title: "Reserve online",
    lane: "convert",
    icon: "CalendarCheck",
    hue: "var(--onto-links)",
    inputs: [{ port: "visit", required: true }],
    outputs: ["hold"],
    params: [{ key: "src", label: "Reservations through", kind: "select", required: true, options: "reserve" }],
    backend: "partial",
    endpoint: "POST /api/webhooks/storedge",
    paused: false,
    publish: () => "Embeds the reservation widget on the page; reservations come back by webhook.",
  },
  textback: {
    type: "textback",
    title: "Text back in 60s",
    lane: "respond",
    icon: "MessageSquare",
    hue: "var(--onto-leads)",
    inputs: [{ port: "lead", required: true }],
    outputs: ["lead"],
    params: [{ key: "phone", label: "Alert this phone", kind: "text", required: true, placeholder: "Office cell" }],
    backend: "exists",
    endpoint: "src/lib/respond/speed-to-lead.ts",
    paused: false,
    publish: () => "Every form gets an answer by text within 60 seconds, and you get their number to call.",
  },
  follow: {
    type: "follow",
    title: "Follow-up",
    lane: "respond",
    icon: "Mail",
    hue: "var(--onto-leads)",
    inputs: [{ port: "lead", required: true }],
    outputs: ["lead"],
    params: [{ key: "steps", label: "Sequence", kind: "select", required: true, options: "steps" }],
    backend: "exists",
    endpoint: "drip_sequence_templates",
    paused: false,
    publish: (n) =>
      `Enrols every new lead in a ${param(n, "steps") || "?"}-step sequence; it stops when they reserve or move in.`,
  },
  tour: {
    type: "tour",
    title: "Book a tour",
    lane: "respond",
    icon: "KeyRound",
    hue: "var(--onto-tours)",
    inputs: [{ port: "lead", required: true }],
    outputs: ["lead"],
    params: [],
    backend: "exists",
    endpoint: "POST /api/tour",
    paused: false,
    publish: () => "Adds tour booking to the page and the follow-up.",
  },
  missed: {
    type: "missed",
    title: "Missed-call text-back",
    lane: "respond",
    icon: "Phone",
    hue: "var(--onto-leads)",
    inputs: [],
    outputs: ["lead"],
    params: [],
    backend: "exists",
    endpoint: "call_tracking_numbers",
    paused: false,
    publish: () => "Turns missed calls on your tracking number into leads.",
  },
  movein: {
    type: "movein",
    title: "Move-in",
    lane: "prove",
    icon: "KeyRound",
    hue: "var(--onto-tenants)",
    inputs: [
      { port: "lead", required: false },
      { port: "hold", required: false },
    ],
    anyInput: true,
    anyNeed: "leads or reservations coming in",
    outputs: ["move-in"],
    params: [{ key: "match", label: "Matched from", kind: "select", required: true, options: "match" }],
    backend: "partial",
    endpoint: "src/lib/lead-matching.ts",
    paused: false,
    publish: () => "Counts a lead as moved in when it matches a new tenant. Judges this campaign on move-ins, not clicks.",
  },
  capi: {
    type: "capi",
    title: "Tell Meta & Google",
    lane: "prove",
    icon: "Share2",
    hue: "var(--onto-tenants)",
    inputs: [{ port: "move-in", required: true }],
    outputs: [],
    params: [],
    backend: "exists",
    endpoint: "meta-capi",
    paused: false,
    publish: () => "Reports move-ins to Meta and Google so they optimise for renters, not form fills.",
  },
  review: {
    type: "review",
    title: "Ask for a review",
    lane: "prove",
    icon: "MessageSquareQuote",
    hue: "var(--onto-reviews)",
    inputs: [{ port: "move-in", required: true }],
    outputs: [],
    params: [],
    backend: "exists",
    endpoint: "POST /api/review-request",
    paused: false,
    publish: () => "Asks every new tenant for a Google review a week after move-in.",
  },
  report: {
    type: "report",
    title: "Cost per move-in",
    lane: "prove",
    icon: "BarChart3",
    hue: "var(--onto-tenants)",
    inputs: [{ port: "move-in", required: true }],
    outputs: [],
    params: [],
    backend: "exists",
    endpoint: "/api/attribution",
    paused: false,
    publish: () => "Reports this campaign as cost per move-in, by channel and by move-in date.",
  },
};

export const LANE_LABEL: Record<Lane, string> = {
  space: "Space",
  reach: "Reach",
  convert: "Convert",
  respond: "Respond",
  prove: "Prove",
};

const ADDRESS_HEAD: Record<NodeType, string> = {
  units: "units",
  offer: "offers",
  waitlist: "units",
  audience: "audiences",
  proven: "ads",
  write: "ads",
  meta: "ads",
  google: "ads",
  gbp: "posts",
  page: "pages",
  reserve: "holds",
  textback: "followups",
  follow: "followups",
  tour: "tours",
  missed: "calls",
  movein: "tenants",
  capi: "reports",
  review: "reviews",
  report: "reports",
};

export function defOf(type: NodeType): NodeDef {
  return CATALOG[type];
}

export function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (typeof value === "string" && value) return [value];
  return [];
}

export function param(node: FunnelNode, key: string): string {
  const v = node.params[key];
  return typeof v === "string" ? v : "";
}

export function emptyParam(value: unknown, kind: ParamDef["kind"]): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== "string") return true;
  if (value.trim() === "") return true;
  if (kind === "number" && Number(value) <= 0) return true;
  return false;
}

export function slugify(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "campaign";
}

export function nodeAddress(node: FunnelNode): string {
  const head = ADDRESS_HEAD[node.type];
  const tail = slugify(CATALOG[node.type].title);
  const n = node.id.replace(/\D/g, "") || "1";
  return `${head}/${tail}-${n.padStart(2, "0")}`;
}

export function optionList(
  source: OptionSource,
  ctx: FunnelContext,
): [string, string][] {
  switch (source) {
    case "units":
      return (ctx.units ?? []).filter((u) => u.empty > 0).map((u) => [u.key, `${u.name} · ${u.empty} empty`]);
    case "offers":
      return (ctx.offers ?? []).filter((o) => o.active).map((o) => [o.key, `${o.name} (${o.deal})`]);
    case "proven":
      return (ctx.provenAds ?? []).map((p) => [p.key, p.line]);
    case "angles":
      return ANGLES;
    case "radius":
      return [
        ["3", "3 miles"],
        ["5", "5 miles"],
        ["10", "10 miles"],
      ];
    case "who":
      return [
        ["movers", "People moving nearby"],
        ["past", "Past leads"],
        ["look", "Like your tenants"],
      ];
    case "match":
      return [
        ["rentroll", "Weekly rent-roll upload"],
        ["api", "PMS import"],
      ];
    case "reserve":
      return [
        ["storedge", "storEDGE widget"],
        ["hold", "Hold without payment"],
      ];
    case "steps":
      return [
        ["3", "3 texts and emails over 7 days"],
        ["5", "5 over 14 days"],
      ];
    case "account":
      return ctx.metaConnected === false ? [] : [["ok", "Connected"]];
    default:
      return [];
  }
}

function vacancyLine(empty: number, total: number): string {
  return `${empty.toLocaleString("en-US")} empty of ${total.toLocaleString("en-US")}`;
}

const WHO: Record<string, string> = {
  movers: "movers nearby",
  past: "past leads",
  look: "like your tenants",
};

export function nodeReading(node: FunnelNode, ctx: FunnelContext): string {
  const units = ctx.units ?? [];
  switch (node.type) {
    case "units": {
      const pickedKeys = list(node.params.sizes);
      if (!pickedKeys.length) return "No sizes picked";
      if (ctx.unitsSummary && ctx.unitsSummary.total > 0) {
        return vacancyLine(ctx.unitsSummary.empty, ctx.unitsSummary.total);
      }
      const picked = pickedKeys
        .map((k) => units.find((u) => u.key === k))
        .filter((u): u is NonNullable<typeof u> => !!u);
      if (!picked.length) return `${pickedKeys.length} size${pickedKeys.length === 1 ? "" : "s"} picked`;
      const empty = picked.reduce((a, u) => a + u.empty, 0);
      const total = picked.reduce((a, u) => a + (u.total ?? 0), 0);
      if (total > 0) return vacancyLine(empty, total);
      return `${empty} empty across ${picked.length} size${picked.length === 1 ? "" : "s"}`;
    }
    case "offer": {
      const o = (ctx.offers ?? []).find((x) => x.key === param(node, "offer"));
      return o ? o.deal : "No special picked";
    }
    case "waitlist":
      return "Texts the list when a size frees up";
    case "audience":
      return param(node, "radius")
        ? `${param(node, "radius")} mi · ${WHO[param(node, "who")] || "who?"}`
        : "No radius yet";
    case "proven": {
      const p = (ctx.provenAds ?? []).find((x) => x.key === param(node, "src"));
      return p ? p.line : "No source ad yet";
    }
    case "write": {
      const angle = ANGLES.find((a) => a[0] === param(node, "angle"));
      return angle ? `${angle[1]} angle` : "No angle yet";
    }
    case "meta":
    case "google":
      return param(node, "budget") ? `$${param(node, "budget")}/day · created paused` : "No budget yet";
    case "gbp":
      return "Posts to your Google profile";
    case "page":
      return `/lp/${node.slug || "…"}`;
    case "reserve":
      if (param(node, "src") === "storedge") return "storEDGE widget on the page";
      if (param(node, "src") === "hold") return "Hold, no payment";
      return "No source yet";
    case "textback":
      return param(node, "phone") ? `Texts the lead; alerts ${param(node, "phone")}` : "No alert phone yet";
    case "follow":
      return param(node, "steps") ? `${param(node, "steps")} steps, text + email` : "No sequence yet";
    case "tour":
      return "Confirms by text; 24h and 1h reminders";
    case "missed":
      return "Texts back within a few seconds of a missed call";
    case "movein": {
      const goal = ctx.goal;
      const soFar = ctx.movedIn30;
      if (!param(node, "match")) return "No match source yet";
      const from = param(node, "match") === "api" ? "PMS import" : "rent roll";
      const pace = goal ? ` · goal ${goal.moveIns}` : "";
      const count = soFar != null ? `, ${soFar} so far` : "";
      return `Matched from ${from}${pace}${count}`;
    }
    case "capi":
      return "Sends each move-in back to the platforms";
    case "review":
      return "A week after move-in";
    case "report":
      return "Spend ÷ matched move-ins, by channel";
    default:
      return "";
  }
}

export function needLabel(def: ParamDef): string {
  return def.label.replace(" ($)", "").toLowerCase();
}
