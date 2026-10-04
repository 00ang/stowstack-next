/**
 * The lead journey — one lead's whole story, oldest first (MISSION.md s12).
 *
 * Every visit and call that brought them, every status change, the move-in we
 * matched them to, and what we told the ad platforms about it. This is the
 * operator-facing face of the ontology: the objects (Touch, Lead, Tenant,
 * report) already exist; this just lays their links out on one line.
 *
 * Pure: the route loads the rows, this decides the order and the words.
 */

import type { Channel, TouchRecord } from "./touch";

export const CHANNEL_LABEL: Record<Channel, string> = {
  paid_search: "Paid search",
  paid_social: "Paid social",
  paid_other: "Paid display",
  organic_search: "Organic search",
  organic_social: "Social",
  email: "Email / text",
  referral: "Referral",
  direct: "Direct",
  call: "Call",
};

const SOURCE_LABEL: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  microsoft: "Microsoft",
  bing: "Bing",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export function sourceLabel(source: string | null): string | null {
  if (!source) return null;
  return SOURCE_LABEL[source] ?? source;
}

/** "Paid search · Google", "Call · Paid social · Meta", "Direct". */
export function touchTitle(t: Pick<TouchRecord, "kind" | "channel" | "source">): string {
  const parts: string[] = [];
  if (t.kind === "call" && t.channel !== "call") parts.push("Call");
  parts.push(CHANNEL_LABEL[t.channel] ?? t.channel);
  const s = sourceLabel(t.source);
  if (s) parts.push(s);
  return parts.join(" · ");
}

function pathOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/** The facts worth a glance: campaign, which click ids came with it, where they landed. */
export function touchDetail(t: TouchRecord): string {
  const ids = (["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "msclkid"] as const).filter((k) => t[k]);
  const bits = [
    t.utm_campaign ? `campaign ${t.utm_campaign}` : null,
    t.utm_content ? `ad ${t.utm_content}` : null,
    ids.length ? ids.join(", ") : null,
    t.kind === "visit" ? pathOf(t.url) : null,
  ];
  return bits.filter(Boolean).join(" · ");
}

export interface StatusEventRow {
  from_status: string | null;
  to_status: string;
  changed_at: Date;
  source: string | null;
}

export interface MatchedTenant {
  unit_number: string;
  unit_size: string | null;
  monthly_rate: number | null;
  move_in_date: Date | null;
}

export interface ReportRow {
  platform: string;
  status: string;
  reason: string | null;
  detail: string | null;
  click_id_type: string | null;
  value: number | null;
  conversion_at: Date | null;
  created_at: Date;
}

export type JourneyItem =
  | { kind: "touch"; at: string; title: string; detail: string; touchKind: "visit" | "call"; channel: Channel }
  | { kind: "lead"; at: string; title: string; detail: string }
  | { kind: "status"; at: string; title: string; detail: string; to: string }
  | { kind: "move_in"; at: string; title: string; detail: string }
  | { kind: "report"; at: string; title: string; detail: string; platform: string; status: string };

const humanize = (s: string) => s.replace(/_/g, " ");
const PLATFORM_LABEL: Record<string, string> = { meta: "Meta", google: "Google Ads" };

/** Plain words for why a report was skipped or failed — what an operator would do about it. */
export const REPORT_REASON: Record<string, string> = {
  no_click_id: "no Google ad click on record for this lead",
  no_identifiers: "no email, phone or Meta click to match on",
  too_old: "move-in is past Meta's 62-day window",
  not_configured: "platform not connected or credentials missing",
  no_conversion_action: "no move-in conversion action set on the Google Ads connection",
  token_unavailable: "Google token expired — reconnect Google Ads",
  lead_or_tenant_missing: "lead or tenant record no longer exists",
  rejected: "the platform refused it",
  transient: "the platform was unreachable; retrying",
  already_reported: "already reported on an earlier attempt",
};

export function reportTitle(r: Pick<ReportRow, "platform" | "status">): string {
  const p = PLATFORM_LABEL[r.platform] ?? r.platform;
  if (r.status === "sent") return `Reported to ${p}`;
  if (r.status === "skipped") return `Not reported to ${p}`;
  return `Report to ${p} failed`;
}

export function reportDetail(r: ReportRow): string {
  const why = r.reason ? REPORT_REASON[r.reason] ?? humanize(r.reason) : null;
  const value = r.value != null ? `$${Number(r.value).toFixed(2)}` : null;
  const via = r.click_id_type && r.click_id_type !== "none" ? `matched on ${r.click_id_type}` : null;
  return [why, value, via].filter(Boolean).join(" · ");
}

export interface JourneyInput {
  lead: { created_at: Date; converted_at: Date | null };
  touches: TouchRecord[];
  statusEvents: StatusEventRow[];
  tenant: MatchedTenant | null;
  reports: ReportRow[];
}

/**
 * Lay a lead's story out in time order. Ties keep a sensible reading order:
 * the touch that caused something comes before the thing it caused.
 */
export function buildJourney(input: JourneyInput): JourneyItem[] {
  const rank: Record<JourneyItem["kind"], number> = { touch: 0, lead: 1, status: 2, move_in: 3, report: 4 };
  const items: JourneyItem[] = [];

  for (const t of input.touches) {
    items.push({
      kind: "touch",
      at: t.occurred_at.toISOString(),
      title: touchTitle(t),
      detail: touchDetail(t),
      touchKind: t.kind,
      channel: t.channel,
    });
  }

  items.push({
    kind: "lead",
    at: (input.lead.converted_at ?? input.lead.created_at).toISOString(),
    title: input.lead.converted_at ? "Submitted their details" : "Started a form",
    detail: "",
  });

  for (const e of input.statusEvents) {
    // The move-in has its own, richer row below; repeating it as a status adds nothing.
    if (e.to_status === "moved_in" && input.tenant) continue;
    items.push({
      kind: "status",
      at: e.changed_at.toISOString(),
      title: `Status: ${humanize(e.to_status)}`,
      detail: [e.from_status ? `from ${humanize(e.from_status)}` : null, e.source ? `via ${humanize(e.source)}` : null]
        .filter(Boolean)
        .join(" · "),
      to: e.to_status,
    });
  }

  if (input.tenant) {
    const t = input.tenant;
    items.push({
      kind: "move_in",
      at: (t.move_in_date ?? new Date()).toISOString(),
      title: `Moved in — unit ${t.unit_number}`,
      detail: [t.unit_size, t.monthly_rate != null ? `$${Number(t.monthly_rate).toFixed(2)}/mo` : null].filter(Boolean).join(" · "),
    });
  }

  for (const r of input.reports) {
    items.push({
      kind: "report",
      at: (r.created_at ?? r.conversion_at ?? new Date()).toISOString(),
      title: reportTitle(r),
      detail: reportDetail(r),
      platform: r.platform,
      status: r.status,
    });
  }

  return items.sort((a, b) => a.at.localeCompare(b.at) || rank[a.kind] - rank[b.kind]);
}
