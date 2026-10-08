/**
 * The move-in ledger's rows and the pure work on them (summary, wording, CSV).
 * No I/O, so the sample portal and the client can use it; the ledger itself is
 * built in ./ledger.
 */
import type { Heard } from "./heard";

export type Verdict = "both" | "traced" | "said" | "unsure" | "unknown";

export interface LedgerRow {
  tenantId: string;
  name: string;
  unit: string | null;
  size: string | null;
  moveInDate: string;
  visit: { way: string; channel: string; source: string | null; campaign: string | null; at: string } | null;
  lead: { id: string; askedAt: string; answeredInSeconds: number | null } | null;
  match: {
    status: "matched" | "ambiguous" | "no_match" | "rejected" | "none";
    method: string | null;
    confidence: number | null;
    attemptId: string | null;
    candidates: { leadId: string; name: string | null; askedAt: string | null; method: string }[];
  };
  said: (Heard & { label: string }) | null;
  agrees: boolean | null;
  verdict: Verdict;
  /** The one line a person reads: how this move-in found the facility, or that we don't know yet. */
  way: string;
}

export interface LedgerSummary {
  total: number;
  traced: number;
  said: number;
  unsure: number;
  unknown: number;
  /** Move-ins by the way they came, most first. */
  byWay: { way: string; count: number }[];
}

/** A visit's channel and source in the words an owner uses. */
export function wayOf(channel: string, source: string | null): string {
  const s = (source ?? "").toLowerCase();
  if (channel === "paid_social") return s === "tiktok" ? "TikTok ad" : s === "meta" || s === "facebook" || s === "instagram" ? "Meta ad" : "Social ad";
  if (channel === "paid_search") return s === "microsoft" ? "Bing ad" : "Google ad";
  if (channel === "paid_other") return "Display ad";
  if (channel === "organic_search") return s === "google" ? "Google search or Maps" : "Search";
  if (channel === "organic_social") return "Social post";
  if (channel === "email") return "Follow-up email";
  if (channel === "referral") return "Another website";
  if (channel === "call") return "Phone call";
  return "Typed the address";
}

export function summarise(rows: LedgerRow[]): LedgerSummary {
  const ways = new Map<string, number>();
  for (const r of rows) ways.set(r.way, (ways.get(r.way) ?? 0) + 1);
  return {
    total: rows.length,
    traced: rows.filter((r) => r.verdict === "traced" || r.verdict === "both").length,
    said: rows.filter((r) => r.verdict === "said").length,
    unsure: rows.filter((r) => r.verdict === "unsure").length,
    unknown: rows.filter((r) => r.verdict === "unknown").length,
    byWay: [...ways.entries()].map(([way, count]) => ({ way, count })).sort((a, b) => b.count - a.count),
  };
}

const METHOD_LABEL: Record<string, string> = {
  phone_exact: "Phone, exact",
  email_exact: "Email, exact",
  name_last4_phone: "Last name and phone's last 4",
};

export function methodLabel(method: string | null): string {
  return method ? METHOD_LABEL[method] ?? method.replace(/_/g, " ") : "";
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The ledger as a spreadsheet, every column the screen shows and the ids behind them. */
export function ledgerCsv(rows: LedgerRow[]): string {
  const head = [
    "move_in_date", "tenant", "unit", "size", "how_they_came", "verdict",
    "visit", "visit_campaign", "visit_at", "lead_asked_at", "answered_in_seconds",
    "matched_by", "match_confidence", "they_said", "said_via", "agrees", "tenant_id", "lead_id",
  ];
  const lines = rows.map((r) =>
    [
      r.moveInDate, r.name, r.unit, r.size, r.way, r.verdict,
      r.visit?.way, r.visit?.campaign, r.visit?.at, r.lead?.askedAt, r.lead?.answeredInSeconds,
      r.match.status === "matched" ? methodLabel(r.match.method) : r.match.status,
      r.match.confidence, r.said?.label, r.said?.via, r.agrees == null ? "" : r.agrees ? "yes" : "no",
      r.tenantId, r.lead?.id,
    ].map(csvCell).join(","),
  );
  return [head.join(","), ...lines].join("\r\n");
}
