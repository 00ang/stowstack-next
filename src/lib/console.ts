/**
 * Operator's Console — pure data layer.
 *
 * The Console home (`/admin/console`) renders a scope-adaptive Pulse row and a
 * cross-facility Needs-Attention triage feed. This module holds the pure,
 * UI-free logic: typed shapes for the admin endpoints it reads, formatters,
 * normalizers that fold heterogeneous sources into a single `AttentionItem`
 * feed, and the metric builders. Everything here is deterministic and unit
 * tested (`src/lib/__tests__/console.test.ts`) — no React, no fetch, no colors.
 */

import { groupForAttention, groupTitle, type ReportLike } from "@/lib/attribution/reports";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type Severity = "critical" | "warning" | "info";

export type AttentionSource =
  | "campaign"
  | "pms"
  | "lead"
  | "occupancy"
  | "revenue"
  | "reporting";

/** A normalized row in the Needs-Attention feed. */
export interface AttentionItem {
  /** Stable, unique id (used for React keys and dedup). */
  id: string;
  severity: Severity;
  source: AttentionSource;
  /** Facility this concerns, or "" when portfolio-level. */
  facilityName: string;
  title: string;
  detail: string;
  /** Where the row's action navigates. */
  href: string;
  /** Short verb for the row's action chip, e.g. "Review". */
  actionLabel: string;
  /** ISO timestamp for recency sort within a severity band, when known. */
  at?: string;
}

export interface SeverityCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

export type DeltaTone = "positive" | "negative" | "neutral";
export type DeltaDirection = "up" | "down" | "flat";

export interface PulseDelta {
  /** Display string, e.g. "1.3 pts" or "6". */
  value: string;
  direction: DeltaDirection;
  tone: DeltaTone;
}

/** A single vital in the Pulse row. Values arrive preformatted for display. */
export interface PulseMetric {
  key: string;
  label: string;
  value: string;
  delta?: PulseDelta;
  /** Small sub-note under the value, e.g. "4 live". */
  hint?: string;
  /** Optional sparkline series (oldest → newest). */
  spark?: number[];
}

// ---------------------------------------------------------------------------
// Endpoint response shapes (only the fields the Console consumes)
// ---------------------------------------------------------------------------

export interface FounderDigest {
  generatedAt: string;
  windows: { day: string; week: string };
  auditFunnel: { newLeads24h: number; newLeads7d: number; converted7d: number };
  signedClients: { new24h: number; new7d: number };
  leadStatus7d: Record<string, number>;
}

export interface LeadAnalytics {
  totalLeads: number;
  funnel: Record<string, number>;
  conversionRate: string;
  lostRate: string;
  weeklyVelocity: { week: string; count: number }[];
}

export interface CampaignAlert {
  type: string;
  severity: Severity;
  title: string;
  detail: string;
  metric: number;
  threshold?: number;
  accessCode?: string;
  facilityName: string;
}

export interface CampaignAlertsResponse {
  alerts: CampaignAlert[];
  /** Absent when Redis is empty/unavailable — always derive, never trust. */
  summary?: SeverityCounts;
}

export interface PmsQueueReport {
  id: string;
  facility_id?: string;
  facility_name?: string;
  status: string;
  file_name?: string;
  uploaded_at?: string;
}

export interface PmsQueueResponse {
  reports: PmsQueueReport[];
}

export interface AdminLead {
  id: string;
  name?: string;
  facilityName?: string;
  status?: string;
  followUpDate?: string | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface AdminLeadsResponse {
  leads: AdminLead[];
}

export interface AdminFacility {
  id: string;
  name: string;
  status?: string;
}

export interface AdminFacilitiesResponse {
  facilities: AdminFacility[];
}

export interface OccupancyInsight {
  type: string;
  title: string;
  detail: string;
}

export interface OccupancyIntelligence {
  success?: boolean;
  facility_level?: {
    total_units?: number;
    occupied_units?: number;
    vacant_units?: number;
    physical_occ_pct?: number;
    economic_occ_pct?: number;
    occupancy_gap?: number;
  };
  insights?: OccupancyInsight[];
}

export interface RevenueIntelligence {
  success?: boolean;
  summary?: {
    total_actual_revenue?: number;
    revenue_capture_pct?: number;
    revenue_trend_pct?: number | null;
  };
  health?: { overall?: number };
}

// ---------------------------------------------------------------------------
// Formatters — all null/NaN-safe, all rounded
// ---------------------------------------------------------------------------

const EMPTY = "—";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Coerce a number | numeric-string | null into a finite number or null. */
export function toNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatInt(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return Math.round(n).toLocaleString("en-US");
}

export function formatPercent(value: unknown, digits = 1): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return `${n.toFixed(digits)}%`;
}

export function formatCurrency(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** Compact money for dense cards: $940, $8.4k, $214k, $1.2M. */
export function formatCompactCurrency(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return EMPTY;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString("en-US")}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Human relative time. Past → "3d ago", future → "in 2h", recent → "just now".
 * Invalid/missing input → "".
 */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffMs = now.getTime() - t;
  const past = diffMs >= 0;
  const s = Math.abs(diffMs) / 1000;
  const m = s / 60;
  const h = m / 60;
  const d = h / 24;
  let out: string;
  if (s < 45) return "just now";
  else if (m < 45) out = `${Math.round(m)}m`;
  else if (h < 24) out = `${Math.round(h)}h`;
  else if (d < 30) out = `${Math.round(d)}d`;
  else out = `${Math.round(d / 30)}mo`;
  return past ? `${out} ago` : `in ${out}`;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function isSeverity(value: unknown): value is Severity {
  return value === "critical" || value === "warning" || value === "info";
}

export function severityCounts(items: AttentionItem[]): SeverityCounts {
  const counts: SeverityCounts = { total: 0, critical: 0, warning: 0, info: 0 };
  for (const item of items) {
    counts.total += 1;
    counts[item.severity] += 1;
  }
  return counts;
}

function sameFacility(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

interface ScopeOpts {
  /** When set, keep only items for this facility (case-insensitive). */
  facilityName?: string;
}

// ---------------------------------------------------------------------------
// Normalizers — heterogeneous sources → AttentionItem[]
// ---------------------------------------------------------------------------

/** Statuses considered done; their leads never count as "stalled". */
const TERMINAL_LEAD_STATUS = new Set([
  "client_signed",
  "lost",
  "closed",
  "closed_won",
  "closed_lost",
  "won",
  "dead",
  "archived",
]);

/** A lead with no update in this many days is "gone quiet". */
export const STALE_LEAD_DAYS = 7;

export function campaignAlertsToAttention(
  resp: CampaignAlertsResponse | null | undefined,
  opts: ScopeOpts = {},
): AttentionItem[] {
  const alerts = resp?.alerts ?? [];
  const out: AttentionItem[] = [];
  alerts.forEach((a, i) => {
    if (!a || !isSeverity(a.severity)) return;
    const facilityName = a.facilityName ?? "";
    if (opts.facilityName && !sameFacility(facilityName, opts.facilityName)) return;
    out.push({
      id: `campaign:${a.accessCode ?? facilityName}:${a.type}:${i}`,
      severity: a.severity,
      source: "campaign",
      facilityName,
      title: a.title,
      detail: a.detail,
      href: "/admin/campaigns",
      actionLabel: "Review",
    });
  });
  return out;
}

export function pmsQueueToAttention(
  resp: PmsQueueResponse | null | undefined,
  opts: ScopeOpts = {},
): AttentionItem[] {
  const reports = resp?.reports ?? [];
  const out: AttentionItem[] = [];
  reports.forEach((r, i) => {
    if (!r) return;
    const status = (r.status ?? "").toLowerCase();
    // Only unprocessed/failed uploads want attention.
    const failed = status === "failed" || status === "error";
    const pending =
      status === "pending" ||
      status === "processing" ||
      status === "queued" ||
      status === "uploaded";
    if (!failed && !pending) return;
    const facilityName = r.facility_name ?? "";
    if (opts.facilityName && !sameFacility(facilityName, opts.facilityName)) return;
    const file = r.file_name ?? "report";
    out.push({
      id: `pms:${r.id ?? i}`,
      severity: failed ? "warning" : "info",
      source: "pms",
      facilityName,
      title: failed ? "PMS upload failed" : "PMS report awaiting processing",
      detail: r.uploaded_at
        ? `${file} · uploaded ${relativeTime(r.uploaded_at)}`
        : file,
      href: "/admin/pms-queue",
      actionLabel: failed ? "Retry" : "Process",
      at: r.uploaded_at,
    });
  });
  return out;
}

export function stalledLeadsToAttention(
  resp: AdminLeadsResponse | null | undefined,
  now: Date = new Date(),
  opts: ScopeOpts = {},
): AttentionItem[] {
  const leads = resp?.leads ?? [];
  const out: AttentionItem[] = [];
  for (const lead of leads) {
    if (!lead) continue;
    const status = (lead.status ?? "").toLowerCase();
    if (TERMINAL_LEAD_STATUS.has(status)) continue;
    const facilityName = lead.facilityName ?? "";
    if (opts.facilityName && !sameFacility(facilityName, opts.facilityName)) continue;
    const who = lead.name?.trim() || "Lead";
    const where = facilityName ? ` · ${facilityName}` : "";

    // Overdue follow-up is the strongest signal.
    const followUp = lead.followUpDate ? Date.parse(lead.followUpDate) : NaN;
    if (!Number.isNaN(followUp) && followUp < now.getTime()) {
      out.push({
        id: `lead:${lead.id}:followup`,
        severity: "warning",
        source: "lead",
        facilityName,
        title: "Follow-up overdue",
        detail: `${who}${where} — due ${relativeTime(lead.followUpDate, now)}`,
        href: "/admin",
        actionLabel: "Open",
        at: lead.followUpDate ?? undefined,
      });
      continue;
    }

    // Otherwise flag active leads that have gone quiet.
    const updated = lead.updatedAt ? Date.parse(lead.updatedAt) : NaN;
    if (!Number.isNaN(updated)) {
      const days = (now.getTime() - updated) / 86_400_000;
      if (days >= STALE_LEAD_DAYS) {
        out.push({
          id: `lead:${lead.id}:quiet`,
          severity: "info",
          source: "lead",
          facilityName,
          title: "Lead gone quiet",
          detail: `${who}${where} — no update in ${Math.round(days)} days`,
          href: "/admin",
          actionLabel: "Open",
          at: lead.updatedAt,
        });
      }
    }
  }
  return out;
}

const OCCUPANCY_INSIGHT_SEVERITY: Record<string, Severity | null> = {
  critical: "critical",
  warning: "warning",
  opportunity: "info",
  info: "info",
  success: null,
};

export function occupancyInsightsToAttention(
  occ: OccupancyIntelligence | null | undefined,
  facilityName: string,
): AttentionItem[] {
  const insights = occ?.insights ?? [];
  const out: AttentionItem[] = [];
  insights.forEach((insight, i) => {
    if (!insight) return;
    const severity = OCCUPANCY_INSIGHT_SEVERITY[(insight.type ?? "").toLowerCase()];
    if (!severity) return;
    out.push({
      id: `occupancy:${facilityName}:${i}`,
      severity,
      source: "occupancy",
      facilityName,
      title: insight.title,
      detail: insight.detail,
      href: "/admin/intelligence/occupancy",
      actionLabel: "View",
    });
  });
  return out;
}

export function revenueToAttention(
  rev: RevenueIntelligence | null | undefined,
  facilityName: string,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  const overall = toNumber(rev?.health?.overall);
  if (overall !== null && overall < 60) {
    out.push({
      id: `revenue:${facilityName}:health`,
      severity: overall < 40 ? "critical" : "warning",
      source: "revenue",
      facilityName,
      title: "Revenue health low",
      detail: `Health score ${Math.round(overall)}/100 — review rates and occupancy.`,
      href: "/admin/intelligence/revenue",
      actionLabel: "View",
    });
  }
  const trend = toNumber(rev?.summary?.revenue_trend_pct);
  if (trend !== null && trend <= -5) {
    out.push({
      id: `revenue:${facilityName}:trend`,
      severity: trend <= -15 ? "critical" : "warning",
      source: "revenue",
      facilityName,
      title: "Revenue trending down",
      detail: `Down ${Math.abs(trend).toFixed(1)}% vs the prior period.`,
      href: "/admin/intelligence/revenue",
      actionLabel: "View",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ranking
/** `/api/admin-conversion-reports?status=attention` — move-in reports (MISSION.md s12). */
export interface ConversionReportsResponse {
  counts: Record<string, number>;
  reports: ReportLike[];
}

/**
 * Move-ins we could not report to Meta or Google, grouped by what would fix
 * them. One row per facility + platform + cause, because one fix (set the
 * conversion action, reconnect the account) clears every report behind it.
 * A correct "nothing to report" (no Google click on record) is not work and
 * never appears here.
 */
export function conversionReportsToAttention(
  resp: ConversionReportsResponse | null | undefined,
  opts: ScopeOpts = {},
): AttentionItem[] {
  const groups = groupForAttention(resp?.reports ?? []);
  const out: AttentionItem[] = [];
  for (const g of groups) {
    if (opts.facilityName && !sameFacility(g.facilityName, opts.facilityName)) continue;
    out.push({
      id: `reporting:${g.key}`,
      severity: "warning",
      source: "reporting",
      facilityName: g.facilityName,
      title: groupTitle(g),
      detail: g.cause,
      href: "/admin/conversions",
      actionLabel: g.status === "failed" ? "Retry" : "Fix",
      at: g.latest,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Merge attention sources into one feed: dedup by id, sort critical → warning →
 * info, then most-recent-first within a band (undated items sort last). A stable
 * tiebreak on id keeps the order deterministic for tests and snapshots.
 */
export function rankAttention(
  groups: AttentionItem[][],
  limit?: number,
): AttentionItem[] {
  const seen = new Set<string>();
  const merged: AttentionItem[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  merged.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const at = (Date.parse(b.at ?? "") || 0) - (Date.parse(a.at ?? "") || 0);
    if (at !== 0) return at;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return typeof limit === "number" ? merged.slice(0, limit) : merged;
}

// ---------------------------------------------------------------------------
// Pulse builders
// ---------------------------------------------------------------------------

function delta(value: string, direction: DeltaDirection, tone: DeltaTone): PulseDelta {
  return { value, direction, tone };
}

/** The "Open alerts" vital, shared by both scopes. */
function alertsPulse(attention: SeverityCounts): PulseMetric {
  const hint =
    attention.critical > 0
      ? `${formatInt(attention.critical)} critical`
      : attention.warning > 0
        ? `${formatInt(attention.warning)} warning`
        : attention.total > 0
          ? `${formatInt(attention.total)} to review`
          : "all clear";
  return {
    key: "alerts",
    label: "Open alerts",
    value: formatInt(attention.total),
    hint,
    delta:
      attention.critical > 0
        ? delta(`${formatInt(attention.critical)} critical`, "up", "negative")
        : undefined,
  };
}

/** Portfolio ("all" scope) vitals from the cheap portfolio-wide endpoints. */
export function buildPortfolioPulse(args: {
  digest?: FounderDigest | null;
  analytics?: LeadAnalytics | null;
  facilities?: AdminFacility[] | null;
  attention: SeverityCounts;
}): PulseMetric[] {
  const { digest, analytics, facilities, attention } = args;
  const metrics: PulseMetric[] = [];

  if (facilities) {
    const live = facilities.filter((f) => (f.status ?? "").toLowerCase() === "live").length;
    metrics.push({
      key: "facilities",
      label: "Facilities",
      value: formatInt(facilities.length),
      hint: `${formatInt(live)} live`,
    });
  }

  if (digest) {
    const today = digest.auditFunnel.newLeads24h;
    metrics.push({
      key: "leads",
      label: "New leads · 7d",
      value: formatInt(digest.auditFunnel.newLeads7d),
      hint: `${formatInt(today)} today`,
      delta: today > 0 ? delta(`${formatInt(today)} today`, "up", "positive") : undefined,
      spark: analytics?.weeklyVelocity?.map((w) => w.count),
    });
  } else if (analytics) {
    metrics.push({
      key: "leads",
      label: "Total leads",
      value: formatInt(analytics.totalLeads),
      spark: analytics.weeklyVelocity?.map((w) => w.count),
    });
  }

  if (analytics) {
    const signed = analytics.funnel?.client_signed ?? 0;
    metrics.push({
      key: "conversion",
      label: "Conversion",
      value: formatPercent(analytics.conversionRate),
      hint: `${formatInt(signed)} signed`,
    });
  }

  if (digest) {
    metrics.push({
      key: "signed",
      label: "Signed · 7d",
      value: formatInt(digest.signedClients.new7d),
      hint: `${formatInt(digest.signedClients.new24h)} today`,
    });
  }

  metrics.push(alertsPulse(attention));

  return metrics;
}

/** Single-facility vitals — richer per-facility intelligence when scoped. */
export function buildFacilityPulse(args: {
  occupancy?: OccupancyIntelligence | null;
  revenue?: RevenueIntelligence | null;
  attention: SeverityCounts;
}): PulseMetric[] {
  const { occupancy, revenue, attention } = args;
  const metrics: PulseMetric[] = [];

  const fl = occupancy?.facility_level;
  if (fl && toNumber(fl.physical_occ_pct) !== null) {
    const occupied = toNumber(fl.occupied_units);
    const total = toNumber(fl.total_units);
    metrics.push({
      key: "occupancy",
      label: "Occupancy",
      value: formatPercent(fl.physical_occ_pct),
      hint:
        occupied !== null && total !== null
          ? `${formatInt(occupied)}/${formatInt(total)} units`
          : undefined,
    });
  }
  if (fl && toNumber(fl.economic_occ_pct) !== null) {
    metrics.push({
      key: "economic",
      label: "Economic occ",
      value: formatPercent(fl.economic_occ_pct),
      hint:
        toNumber(fl.occupancy_gap) !== null
          ? `${formatPercent(fl.occupancy_gap)} gap`
          : undefined,
    });
  }

  const rs = revenue?.summary;
  if (rs && toNumber(rs.revenue_capture_pct) !== null) {
    const trend = toNumber(rs.revenue_trend_pct);
    metrics.push({
      key: "capture",
      label: "Revenue capture",
      value: formatPercent(rs.revenue_capture_pct),
      delta:
        trend !== null && trend !== 0
          ? delta(
              `${Math.abs(trend).toFixed(1)}%`,
              trend > 0 ? "up" : "down",
              trend > 0 ? "positive" : "negative",
            )
          : undefined,
    });
  }
  if (rs && toNumber(rs.total_actual_revenue) !== null) {
    metrics.push({
      key: "revenue",
      label: "Actual revenue",
      value: formatCompactCurrency(rs.total_actual_revenue),
    });
  }

  const health = toNumber(revenue?.health?.overall);
  if (health !== null) {
    metrics.push({
      key: "health",
      label: "Revenue health",
      value: `${Math.round(health)}`,
      hint: "of 100",
      delta:
        health < 60
          ? delta(health < 40 ? "critical" : "low", "down", "negative")
          : delta("healthy", "flat", "positive"),
    });
  }

  metrics.push(alertsPulse(attention));

  return metrics;
}
