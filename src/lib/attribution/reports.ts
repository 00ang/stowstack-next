/**
 * Move-in reports — which ones a person needs to act on (MISSION.md s12).
 *
 * Most skips are simply true: a move-in with no Google click has nothing to
 * tell Google. Those are not work. The ones that are work are the ones a person
 * can fix — a missing conversion action, a dead token, a platform that refused
 * the event — and each fix unblocks every report waiting on it, so they are
 * grouped by facility, platform and cause rather than listed one by one.
 *
 * Pure.
 */

import { REPORT_REASON } from "./journey";

/** Skip reasons an operator can fix. Everything else is a correct "nothing to report". */
export const ACTIONABLE_SKIP_REASONS = ["not_configured", "no_conversion_action"] as const;

export interface ReportLike {
  id: string;
  platform: string;
  status: string;
  reason: string | null;
  facility_id: string | null;
  facility_name: string | null;
  updated_at: string;
}

export function needsAttention(r: Pick<ReportLike, "status" | "reason">): boolean {
  if (r.status === "failed") return true;
  return r.status === "skipped" && (ACTIONABLE_SKIP_REASONS as readonly string[]).includes(r.reason ?? "");
}

export interface ReportGroup {
  key: string;
  facilityId: string | null;
  facilityName: string;
  platform: string;
  status: string;
  reason: string | null;
  /** What to do about it, in operator words. */
  cause: string;
  count: number;
  reportIds: string[];
  latest: string;
}

const PLATFORM = (p: string) => (p === "google" ? "Google Ads" : p === "meta" ? "Meta" : p);

/** Group the reports that need a person, worst and newest first. */
export function groupForAttention(rows: ReportLike[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const r of rows) {
    if (!needsAttention(r)) continue;
    const key = `${r.facility_id ?? "none"}:${r.platform}:${r.status}:${r.reason ?? ""}`;
    const g = groups.get(key);
    if (g) {
      g.count++;
      g.reportIds.push(r.id);
      if (r.updated_at > g.latest) g.latest = r.updated_at;
      continue;
    }
    groups.set(key, {
      key,
      facilityId: r.facility_id,
      facilityName: r.facility_name ?? "",
      platform: r.platform,
      status: r.status,
      reason: r.reason,
      cause: r.reason ? REPORT_REASON[r.reason] ?? r.reason.replace(/_/g, " ") : r.status,
      count: 1,
      reportIds: [r.id],
      latest: r.updated_at,
    });
  }
  return [...groups.values()].sort(
    (a, b) => (a.status === "failed" ? 0 : 1) - (b.status === "failed" ? 0 : 1) || b.latest.localeCompare(a.latest),
  );
}

/** "3 move-ins not reported to Google Ads" — the headline for one group. */
export function groupTitle(g: Pick<ReportGroup, "count" | "platform" | "status">): string {
  const n = `${g.count} move-in${g.count === 1 ? "" : "s"}`;
  return g.status === "failed" ? `${n} failed to report to ${PLATFORM(g.platform)}` : `${n} not reported to ${PLATFORM(g.platform)}`;
}
