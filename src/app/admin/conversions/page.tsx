"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, RotateCcw, Settings2 } from "lucide-react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import { groupForAttention, groupTitle, type ReportGroup } from "@/lib/attribution/reports";
import { REPORT_REASON } from "@/lib/attribution/journey";

/**
 * Move-in reports (MISSION.md s12).
 *
 * Every move-in we tried to tell Meta or Google about. The top of the page is
 * the work: reports a person can unblock, grouped by the one fix that clears
 * them. Below it, the full record — including the correct skips, like a
 * move-in that never clicked a Google ad and so has nothing to report there.
 */

interface ReportRow {
  id: string;
  platform: string;
  status: string;
  reason: string | null;
  detail: string | null;
  click_id_type: string | null;
  value: number | null;
  conversion_at: string | null;
  attempts: number;
  updated_at: string;
  facility_id: string | null;
  facility_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
}
interface ReportsResponse {
  counts: Record<string, number>;
  reports: ReportRow[];
}

const TABS = [
  { key: "attention", label: "Needs attention" },
  { key: "failed", label: "Failed" },
  { key: "skipped", label: "Skipped" },
  { key: "sent", label: "Sent" },
  { key: "all", label: "All" },
] as const;

const PLATFORM: Record<string, string> = { meta: "Meta", google: "Google Ads" };

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const statusColor = (s: string) =>
  s === "sent" ? "var(--color-green)" : s === "failed" ? "var(--color-red)" : "var(--color-mid-gray)";

const sectionLabel = {
  fontSize: ".8rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" as const,
  color: "var(--color-mid-gray)", margin: "0 0 .6rem",
};
const button = {
  display: "inline-flex", alignItems: "center", gap: ".35rem", fontSize: ".72rem", fontWeight: 600,
  padding: ".4rem .7rem", border: "1px solid var(--color-light-gray)", background: "transparent",
  color: "var(--color-dark)", cursor: "pointer", textDecoration: "none",
} as const;

function isConfigCause(g: ReportGroup) {
  return g.reason === "no_conversion_action" || g.reason === "not_configured" || g.reason === "token_unavailable";
}

export default function ConversionsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("attention");
  const params = useMemo(() => ({ status: tab }), [tab]);
  const { data, loading, error, refetch } = useAdminFetch<ReportsResponse>("/api/admin-conversion-reports", params);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groups = useMemo(() => groupForAttention(data?.reports ?? []), [data]);

  async function retry(key: string, reportIds: string[]) {
    setRetrying(key);
    setNotice(null);
    try {
      const res = await adminFetch<{ queued: number; skipped: number }>("/api/admin-conversion-reports", {
        method: "POST",
        body: JSON.stringify({ action: "retry", reportIds }),
      });
      setNotice(
        res.queued
          ? `Queued ${res.queued} report${res.queued === 1 ? "" : "s"} — they run within a minute.`
          : "Nothing to retry.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setRetrying(null);
    }
  }

  const counts = data?.counts ?? {};
  const rows = data?.reports ?? [];

  return (
    <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-.03em", margin: 0 }}>Move-in reports</h1>
          <p style={{ margin: ".35rem 0 0", color: "var(--color-body-text)", fontSize: ".85rem", maxWidth: "68ch", lineHeight: 1.6 }}>
            When a lead we can trace moves in, StorageAds tells Meta and Google so they bid on move-ins
            instead of form fills. This is every report, and what happened to it.
          </p>
        </div>
        <button onClick={refetch} style={button}>
          <RefreshCw size={13} aria-hidden /> Refresh
        </button>
      </header>

      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const n =
            t.key === "attention" ? null :
            t.key === "all" ? Object.values(counts).reduce((a, b) => a + b, 0) :
            counts[t.key] ?? 0;
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              fontSize: ".72rem", fontWeight: 600, padding: ".35rem .65rem", cursor: "pointer",
              border: `1px solid ${active ? "var(--color-dark)" : "var(--color-light-gray)"}`,
              background: active ? "var(--color-dark)" : "transparent",
              color: active ? "var(--color-light)" : "var(--color-dark)",
            }}>
              {t.label}{n != null ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>

      {notice && (
        <p role="status" style={{ margin: 0, fontSize: ".8rem", color: "var(--color-body-text)" }}>{notice}</p>
      )}

      {loading && !data ? (
        <div style={{ color: "var(--color-mid-gray)", display: "flex", gap: ".5rem", alignItems: "center", fontSize: ".85rem" }}>
          <Loader2 size={15} className="animate-spin" aria-hidden /> Loading reports…
        </div>
      ) : error ? (
        <div style={{ color: "var(--color-red)", fontSize: ".85rem" }}>Could not load move-in reports. {error}</div>
      ) : (
        <>
          {tab === "attention" && (
            <section>
              <h2 style={sectionLabel}>To fix</h2>
              {groups.length === 0 ? (
                <p style={{ color: "var(--color-mid-gray)", fontSize: ".85rem", margin: 0, lineHeight: 1.6 }}>
                  Nothing needs a person. Every move-in either reported, or had nothing to report — a
                  move-in that never clicked a Google ad has nothing to tell Google.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: ".6rem" }}>
                  {groups.map((g) => (
                    <div key={g.key} style={{ border: "1px solid var(--color-light-gray)", padding: ".8rem .9rem", display: "flex", flexDirection: "column", gap: ".45rem" }}>
                      <strong style={{ fontSize: ".85rem", fontWeight: 650, color: g.status === "failed" ? "var(--color-red)" : "var(--color-dark)" }}>
                        {groupTitle(g)}
                      </strong>
                      <span style={{ fontSize: ".75rem", color: "var(--color-body-text)" }}>
                        {[g.facilityName || null, g.cause].filter(Boolean).join(" · ")}
                      </span>
                      <span style={{ fontSize: ".68rem", color: "var(--color-mid-gray)" }}>latest {ago(g.latest)}</span>
                      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap", marginTop: ".2rem" }}>
                        {isConfigCause(g) && g.facilityId && (
                          <Link href={`/admin/studio/publisher?facility=${g.facilityId}`} style={button}>
                            <Settings2 size={12} aria-hidden /> Connection settings
                          </Link>
                        )}
                        <button onClick={() => retry(g.key, g.reportIds)} disabled={retrying === g.key} style={{ ...button, opacity: retrying === g.key ? 0.5 : 1 }}>
                          {retrying === g.key ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <RotateCcw size={12} aria-hidden />}
                          Retry {g.count}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 style={sectionLabel}>{tab === "attention" ? "Reports behind these" : "Reports"}</h2>
            {rows.length === 0 ? (
              <p style={{ color: "var(--color-mid-gray)", fontSize: ".85rem", margin: 0 }}>None.</p>
            ) : (
              <div style={{ border: "1px solid var(--color-light-gray)", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".78rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--color-mid-gray)" }}>
                      {["Lead", "Facility", "Platform", "Status", "Why", "Value", "Tries", "Updated"].map((h) => (
                        <th key={h} style={{ padding: ".55rem .8rem", fontWeight: 600, fontSize: ".68rem", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--color-light-gray)" }}>
                        <td style={{ padding: ".55rem .8rem", whiteSpace: "nowrap" }}>
                          {r.lead_id ? (
                            <Link href={`/admin/consumer-leads/${r.lead_id}`} style={{ color: "var(--color-dark)", fontWeight: 600 }}>
                              {r.lead_name ?? "Lead"}
                            </Link>
                          ) : "—"}
                        </td>
                        <td style={{ padding: ".55rem .8rem", color: "var(--color-body-text)" }}>{r.facility_name ?? "—"}</td>
                        <td style={{ padding: ".55rem .8rem" }}>{PLATFORM[r.platform] ?? r.platform}</td>
                        <td style={{ padding: ".55rem .8rem", color: statusColor(r.status), fontWeight: 600 }}>{r.status}</td>
                        <td style={{ padding: ".55rem .8rem", color: "var(--color-body-text)", minWidth: 220 }} title={r.detail ?? undefined}>
                          {r.reason ? REPORT_REASON[r.reason] ?? r.reason.replace(/_/g, " ") : r.click_id_type && r.click_id_type !== "none" ? `matched on ${r.click_id_type}` : "—"}
                        </td>
                        <td style={{ padding: ".55rem .8rem", fontVariantNumeric: "tabular-nums" }}>{r.value != null ? `$${r.value.toFixed(2)}` : "—"}</td>
                        <td style={{ padding: ".55rem .8rem", fontVariantNumeric: "tabular-nums" }}>{r.attempts}</td>
                        <td style={{ padding: ".55rem .8rem", color: "var(--color-mid-gray)", whiteSpace: "nowrap" }}>{ago(r.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
