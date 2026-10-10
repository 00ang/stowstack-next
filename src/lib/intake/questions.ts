/**
 * One set of intake questions for the homepage popup, the diagnostic,
 * and the Pipeline. Option labels are the stored values. A skipped
 * question is omitted, never filled with a stand-in.
 */

export type StepKind = "choice" | "text" | "facility" | "multi" | "pms";

export interface IntakeOption {
  label: string;
  reaction: string;
}

export interface IntakeStep {
  id: string;
  prompt: string;
  hint?: string;
  kind: StepKind;
  options?: IntakeOption[];
  optional?: boolean;
  /** Popup asks these. The diagnostic asks them only when still blank. */
  surface: "popup" | "diagnostic";
  placeholder?: string;
}

export const ROLE_OPTIONS: IntakeOption[] = [
  { label: "Owner", reaction: "Most independents we talk to are right there too." },
  { label: "Manager", reaction: "You see the day to day. That helps." },
  {
    label: "Building or buying a facility",
    reaction: "A new facility is a different job than a full one.",
  },
  {
    label: "Something else (vendor, job, renter, other)",
    reaction: "Thanks for saying so. We'll point you the right way.",
  },
];

export const FACILITY_COUNT_OPTIONS: IntakeOption[] = [
  { label: "1", reaction: "One facility keeps the picture clear." },
  { label: "2–5", reaction: "A few sites, and you can decide. That's the usual shape." },
  { label: "6–20", reaction: "We'll start with one or two sites, not the whole group." },
  { label: "21–100", reaction: "A group that size usually starts with a small pilot." },
  { label: "100+", reaction: "We'll keep this to a couple of sites until it earns a wider look." },
];

export const STAGE_OPTIONS: IntakeOption[] = [
  {
    label: "Open and stabilized (3+ years)",
    reaction: "A facility that's been open a while is the clearest read.",
  },
  {
    label: "Lease-up (opened in the last 3 years)",
    reaction: "Filling from a low base is a different clock.",
  },
  {
    label: "Under construction",
    reaction: "The useful work can start before the doors open.",
  },
  { label: "Planned (not started yet)", reaction: "Early is fine. We'll keep this light." },
  { label: "Buying or just bought", reaction: "A fresh purchase is a good time to look." },
];

export const UNIT_OPTIONS: IntakeOption[] = [
  { label: "Under 100", reaction: "A smaller place needs a lighter plan." },
  { label: "100–199", reaction: "That's enough to plan around." },
  { label: "200–349", reaction: "That's enough to plan around." },
  { label: "350–499", reaction: "That's enough to plan around." },
  { label: "500–749", reaction: "That's enough to plan around." },
  { label: "750–999", reaction: "Plenty of units. The question is how many are empty." },
  { label: "1,000+", reaction: "Plenty of units. The question is how many are empty." },
];

export const OCCUPANCY_OPTIONS: IntakeOption[] = [
  { label: "Under 60%", reaction: "Room to fill is the reason to look at ads." },
  { label: "60–69%", reaction: "Most independents we talk to are right there too." },
  { label: "70–79%", reaction: "Most independents we talk to are right there too." },
  { label: "80–84%", reaction: "There's still room, just less of it." },
  { label: "85–89%", reaction: "There's still room, just less of it." },
  { label: "90–94%", reaction: "A full facility is a different problem than an empty one." },
  { label: "95%+", reaction: "A full facility is a different problem than an empty one." },
  { label: "Not open yet", reaction: "Nothing to measure yet. That's fine." },
];

export const MOVE_BALANCE_OPTIONS: IntakeOption[] = [
  {
    label: "More move-ins than move-outs",
    reaction: "The place is gaining. Worth knowing whether ads are part of that.",
  },
  { label: "About the same", reaction: "Holding even is a stall, not a win." },
  {
    label: "Move-outs matched or beat move-ins",
    reaction: "When people leave as fast as they come in, ads are only half the story.",
  },
  { label: "Not open yet", reaction: "Nothing to count yet." },
  { label: "Not sure", reaction: "A rough sense later is enough." },
];

export const PAIN_OPTIONS: IntakeOption[] = [
  { label: "Not enough leads coming in", reaction: "That's the usual one." },
  {
    label: "Plenty of leads, not enough are converting to move-ins",
    reaction: "Leads that don't move in are a different fix than more ads.",
  },
  {
    label: "Both — not enough leads AND they're not converting",
    reaction: "Two problems at once. We'll separate them.",
  },
  {
    label: "Revenue per unit is too low",
    reaction: "If the place is full enough, the issue is the rate, not the ads.",
  },
  {
    label: "Operations are stretched thin",
    reaction: "That's an ops problem. Ads won't fix a desk that can't keep up.",
  },
  { label: "Not sure where to start", reaction: "We can start without a diagnosis." },
];

export const AD_SPEND_OPTIONS: IntakeOption[] = [
  { label: "None", reaction: "Starting from zero is normal." },
  { label: "Under $500", reaction: "A light budget. Rough is enough." },
  { label: "$500–$1,500", reaction: "Rough is fine. We read the band, not the exact dollar." },
  { label: "$1,500–$5,000", reaction: "Rough is fine. We read the band, not the exact dollar." },
  { label: "$5,000+", reaction: "Rough is fine. We read the band, not the exact dollar." },
  { label: "Not sure", reaction: "Rough is fine, in your currency." },
];

export const TIMELINE_OPTIONS: IntakeOption[] = [
  { label: "This month", reaction: "Soon is easier to plan around." },
  { label: "In 1–3 months", reaction: "A couple of months is a real timeline." },
  { label: "Later this year", reaction: "Later is still a plan." },
  { label: "Just looking", reaction: "Looking is fine. No pitch from here." },
];

export const MARKETING_CHANNEL_OPTIONS: IntakeOption[] = [
  { label: "Google Ads", reaction: "Noted." },
  { label: "Facebook / Instagram Ads", reaction: "Noted." },
  { label: "SEO / Organic search", reaction: "Noted." },
  { label: "Google Business Profile", reaction: "Noted." },
  { label: "SpareFoot / Storable marketplace", reaction: "Noted." },
  { label: "Print / Direct mail", reaction: "Noted." },
  { label: "Signage / Drive-by traffic", reaction: "Noted." },
  { label: "Referrals", reaction: "Noted." },
  { label: "None / No active marketing", reaction: "Starting from zero is normal." },
];

export const GOOGLE_ADS_OPTIONS: IntakeOption[] = [
  { label: "Great — strong ROI", reaction: "We'll look at what's already working." },
  { label: "Okay — decent but could improve", reaction: "Room to tighten it." },
  { label: "Poor — feels like wasted money", reaction: "That's a common read. We'll look at the actual leads." },
  { label: "Not sure / don't track", reaction: "Most operators don't track it. That's the gap." },
  { label: "Not running Google Ads", reaction: "Fine. We won't assume you are." },
];

export const WHO_MANAGES_OPTIONS: IntakeOption[] = [
  { label: "I manage it myself", reaction: "Then you already know where the time goes." },
  { label: "In-house team / corporate", reaction: "Someone else may have to sign off. Noted." },
  { label: "A general marketing agency", reaction: "A general agency rarely knows storage." },
  { label: "A storage-specific agency", reaction: "You've already paid someone for this." },
  { label: "Nobody — it's not actively managed", reaction: "That's the usual answer." },
];

export const PMS_OPTIONS: IntakeOption[] = [
  { label: "SiteLink (Storable)", reaction: "We can work with that." },
  { label: "storEDGE (Storable)", reaction: "We can work with that." },
  { label: "Facility Manager (Storable)", reaction: "We can work with that." },
  { label: "Hummingbird (Tenant Inc.)", reaction: "We can work with that." },
  { label: "DoorSwap", reaction: "We can work with that." },
  { label: "Easy Storage Solutions", reaction: "We can work with that." },
  { label: "Storage Commander", reaction: "We can work with that." },
  { label: "Yardi Breeze", reaction: "We can work with that." },
  { label: "None / Spreadsheet", reaction: "A spreadsheet is still a system. We'll take it." },
  { label: "Other", reaction: "Type the name. UK and other systems belong here." },
];

export const ONLINE_RENTAL_OPTIONS: IntakeOption[] = [
  { label: "Yes, reserve and rent online", reaction: "Then ads have somewhere to land." },
  { label: "Reserve only", reaction: "A reservation still has to become a move-in." },
  { label: "No", reaction: "The call or the counter is doing the closing." },
  { label: "Not sure", reaction: "Easy to check later." },
];

export const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "role",
    prompt: "You are the…",
    kind: "choice",
    options: ROLE_OPTIONS,
    surface: "popup",
  },
  {
    id: "facility_count",
    prompt: "How many facilities do you run?",
    kind: "choice",
    options: FACILITY_COUNT_OPTIONS,
    surface: "popup",
  },
  {
    id: "facility",
    prompt: "Which facility?",
    hint: "Start typing your facility name",
    kind: "facility",
    surface: "popup",
  },
  {
    id: "stage",
    prompt: "Where is this facility?",
    kind: "choice",
    options: STAGE_OPTIONS,
    surface: "popup",
  },
  {
    id: "units",
    prompt: "What is your total unit count (approximately)?",
    kind: "choice",
    options: UNIT_OPTIONS,
    surface: "popup",
  },
  {
    id: "occupancy",
    prompt: "Occupancy by units today",
    kind: "choice",
    options: OCCUPANCY_OPTIONS,
    surface: "popup",
  },
  {
    id: "move_balance",
    prompt: "In the last 30 days, how did move-ins compare with move-outs?",
    kind: "choice",
    options: MOVE_BALANCE_OPTIONS,
    surface: "popup",
  },
  {
    id: "pain",
    prompt: "What feels like the bigger issue right now?",
    kind: "choice",
    options: PAIN_OPTIONS,
    surface: "popup",
  },
  {
    id: "ad_spend",
    prompt: "Paid ad spend per month, all channels",
    hint: "Rough is fine, in your currency",
    kind: "choice",
    options: AD_SPEND_OPTIONS,
    surface: "popup",
  },
  {
    id: "timeline",
    prompt: "When do you want to fix it?",
    kind: "choice",
    options: TIMELINE_OPTIONS,
    surface: "popup",
  },
  {
    id: "reach_out",
    prompt: "In a sentence or two, what's going on that made you reach out?",
    kind: "text",
    optional: true,
    surface: "popup",
    placeholder: "Optional. One or two sentences.",
  },
  {
    id: "marketing_channels",
    prompt: "What marketing are you running?",
    kind: "multi",
    options: MARKETING_CHANNEL_OPTIONS,
    surface: "diagnostic",
  },
  {
    id: "google_ads",
    prompt: "If you run Google Ads, how would you describe the performance?",
    kind: "choice",
    options: GOOGLE_ADS_OPTIONS,
    surface: "diagnostic",
  },
  {
    id: "who_manages",
    prompt: "Who manages your marketing / ads?",
    kind: "choice",
    options: WHO_MANAGES_OPTIONS,
    surface: "diagnostic",
  },
  {
    id: "pms",
    prompt: "Which PMS / management software do you use?",
    kind: "pms",
    options: PMS_OPTIONS,
    surface: "diagnostic",
  },
  {
    id: "online_rental",
    prompt: "Can a renter reserve or rent a unit online?",
    kind: "choice",
    options: ONLINE_RENTAL_OPTIONS,
    surface: "diagnostic",
  },
  {
    id: "site_note",
    prompt: "Anything about the building, the street, or the competition we should know?",
    kind: "text",
    optional: true,
    surface: "diagnostic",
    placeholder: "Optional. One or two sentences.",
  },
];

export const POPUP_STEPS = INTAKE_STEPS.filter((s) => s.surface === "popup");
export const DIAGNOSTIC_STEPS = INTAKE_STEPS.filter((s) => s.surface === "diagnostic");

const STEP_BY_ID = new Map(INTAKE_STEPS.map((s) => [s.id, s]));

export function stepById(id: string): IntakeStep | undefined {
  return STEP_BY_ID.get(id);
}

export function isAllowedAnswer(id: string, value: string): boolean {
  const step = STEP_BY_ID.get(id);
  if (!step) return false;
  if (step.kind === "text") return value.trim().length > 0 && value.length <= 500;
  if (step.kind === "facility") return false;
  if (step.kind === "multi") {
    const allowed = new Set((step.options || []).map((o) => o.label));
    return value.split(" · ").every((part) => allowed.has(part)) && value.length <= 500;
  }
  if (step.kind === "pms") {
    const allowed = new Set((step.options || []).map((o) => o.label));
    if (allowed.has(value)) return true;
    return value.startsWith("Other: ") && value.length <= 200;
  }
  return (step.options || []).some((o) => o.label === value);
}

export function reactionFor(id: string, value: string): string | null {
  const step = STEP_BY_ID.get(id);
  if (!step) return null;
  if (step.kind === "text") return "That sentence is the most useful thing on this form.";
  if (step.kind === "facility") return "We'll use this so you don't have to retype the address.";
  if (step.kind === "multi") return "Noted.";
  const match = (step.options || []).find((o) => o.label === value || value.startsWith(`${o.label}:`));
  return match?.reaction || null;
}

/** Labels for the Pipeline. Only answered keys show up. */
export const ANSWER_LABELS: Record<string, string> = {
  role: "Role",
  facility_count: "Facilities",
  stage: "Stage",
  units: "Units",
  occupancy: "Occupancy",
  move_balance: "Last 30 days",
  pain: "What hurts",
  ad_spend: "Ad spend",
  timeline: "Timeline",
  reach_out: "In their words",
  marketing_channels: "Marketing",
  google_ads: "Google Ads",
  who_manages: "Who manages ads",
  pms: "PMS",
  pms_other: "PMS (other)",
  online_rental: "Online rental",
  site_note: "Building / street",
  country: "Country",
};

export interface FacilityAnswer {
  name: string;
  address?: string;
  city?: string;
  website?: string;
  placeId?: string;
  country?: string;
  rating?: number | null;
  reviewCount?: number | null;
  typed?: boolean;
}

export function answerRows(
  answers: Record<string, unknown> | null | undefined
): Array<{ label: string; value: string }> {
  if (!answers || typeof answers !== "object") return [];
  const rows: Array<{ label: string; value: string }> = [];
  for (const [key, label] of Object.entries(ANSWER_LABELS)) {
    const raw = answers[key];
    if (typeof raw === "string" && raw.trim()) rows.push({ label, value: raw.trim() });
  }
  const facility = answers.facility;
  if (facility && typeof facility === "object") {
    const f = facility as FacilityAnswer;
    if (f.name) rows.push({ label: "Facility", value: f.name });
    if (f.address || f.city) rows.push({ label: "Address", value: f.address || f.city || "" });
    if (f.country) rows.push({ label: "Country", value: f.country });
  }
  return rows;
}
