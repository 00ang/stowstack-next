"use client";

import { useMemo, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";

/**
 * Domain event stream (MISSION.md s7).
 *
 * What the product noticed happening at a facility, and where it sent it. The
 * "waiting" table is the useful half: several subscriber queues have no handler
 * yet on purpose — an unregistered queue freezes rather than fails, so the work
 * piles up visibly here and is re-deliverable the day each handler ships.
 */

interface EventRow {
  id: string; type: string; facility_id: string | null; facility_name: string | null;
  payload: Record<string, unknown>; occurred_at: string; created_at: string; deliveries: number;
}
interface EventsResponse {
  byType: { type: string; n: number; latest: string }[];
  events: EventRow[];
  waiting: { queue: string; status: string; n: number }[];
  total: number;
}

/** Plain-English label for each event type — the UI should not speak in snake_case. */
const LABEL: Record<string, string> = {
  "unit.moved_in": "Moved in",
  "unit.moved_out": "Moved out",
  "tenant.delinquent": "Delinquent",
  "unit.rate_changed": "Rate changed",
  "inventory.available": "Unit available",
  "lead.moved_in": "Lead moved in",
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** One line of context per event type, from whatever the payload carries. */
function summarise(e: EventRow): string {
  const p = e.payload ?? {};
  const unit = typeof p.unit === "string" ? `Unit ${p.unit}` : "";
  switch (e.type) {
    case "tenant.delinquent":
      return [unit, p.threshold ? `${p.threshold} days past due` : ""].filter(Boolean).join(" · ");
    case "unit.rate_changed":
      return [unit, p.from != null && p.to != null ? `$${p.from} → $${p.to}` : ""].filter(Boolean).join(" · ");
    case "inventory.available":
      return [p.sizeLabel ? String(p.sizeLabel) : "", p.available != null ? `${p.available} free` : ""]
        .filter(Boolean).join(" · ");
    case "lead.moved_in":
      return [p.monthlyRate != null ? `$${p.monthlyRate}/mo` : "", p.matchMethod ? `matched by ${p.matchMethod}` : ""]
        .filter(Boolean).join(" · ");
    default:
      return [unit, typeof p.tenantName === "string" ? p.tenantName : ""].filter(Boolean).join(" · ");
  }
}

export default function EventsPage() {
  const [type, setType] = useState<string>("");
  const params = useMemo(() => (type ? { type } : undefined), [type]);
  const { data, loading, error, refetch } = useAdminFetch<EventsResponse>("/api/admin-events", params);

  if (loading && !data) {
    return (
      <div style={{ padding: "2rem", color: "var(--color-mid-gray)", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <Loader2 size={15} className="animate-spin" aria-hidden /> Loading events…
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: "2rem", color: "var(--color-red)" }}>Could not read the event stream. {error}</div>;
  }

  const events = data?.events ?? [];
  const waiting = data?.waiting ?? [];

  return (
    <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-.03em", margin: 0 }}>Events</h1>
          <p style={{ margin: ".35rem 0 0", color: "var(--color-body-text)", fontSize: ".85rem", maxWidth: "64ch", lineHeight: 1.6 }}>
            What the product noticed at a facility, detected by comparing PMS snapshots. Each event fans
            out to the capabilities that subscribe to it.
          </p>
        </div>
        <button onClick={refetch} style={{
          display: "flex", alignItems: "center", gap: ".4rem", fontSize: ".75rem", fontWeight: 600,
          padding: ".5rem .8rem", border: "1px solid var(--color-light-gray)", background: "transparent",
          color: "var(--color-dark)", cursor: "pointer",
        }}>
          <RefreshCw size={13} aria-hidden /> Refresh
        </button>
      </header>

      <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
        {[{ type: "", n: data?.total ?? 0 }, ...(data?.byType ?? [])].map((t) => (
          <button key={t.type || "all"} onClick={() => setType(t.type)} style={{
            fontSize: ".72rem", fontWeight: 600, padding: ".35rem .65rem", cursor: "pointer",
            border: `1px solid ${type === t.type ? "var(--color-dark)" : "var(--color-light-gray)"}`,
            background: type === t.type ? "var(--color-dark)" : "transparent",
            color: type === t.type ? "var(--color-light)" : "var(--color-dark)",
          }}>
            {t.type ? LABEL[t.type] ?? t.type : "All"} · {t.n}
          </button>
        ))}
      </div>

      <section>
        <h2 style={{ fontSize: ".8rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-mid-gray)", margin: "0 0 .6rem" }}>
          Recent
        </h2>
        {events.length === 0 ? (
          <p style={{ color: "var(--color-mid-gray)", fontSize: ".85rem", margin: 0, lineHeight: 1.6 }}>
            No events yet. Detection needs <strong>two</strong> PMS snapshots for a facility before it can
            tell what changed — a single upload establishes the baseline and deliberately emits nothing,
            so nobody&apos;s existing tenants get treated as fresh move-ins.
          </p>
        ) : (
          <div style={{ border: "1px solid var(--color-light-gray)" }}>
            {events.map((e, i) => (
              <div key={e.id} style={{
                display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: ".75rem",
                padding: ".65rem .9rem", alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid var(--color-light-gray)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: ".82rem", fontWeight: 600 }}>{LABEL[e.type] ?? e.type}</strong>
                    <span style={{ fontSize: ".76rem", color: "var(--color-body-text)" }}>{summarise(e)}</span>
                  </div>
                  <div style={{ fontSize: ".7rem", color: "var(--color-mid-gray)", marginTop: ".15rem" }}>
                    {e.facility_name ?? "—"} · {ago(e.occurred_at)}
                  </div>
                </div>
                <span style={{
                  fontSize: ".68rem", fontWeight: 600, color: "var(--color-mid-gray)", whiteSpace: "nowrap",
                }}>
                  {e.deliveries} {e.deliveries === 1 ? "delivery" : "deliveries"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: ".8rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-mid-gray)", margin: "0 0 .6rem" }}>
          Waiting on a handler
        </h2>
        <p style={{ color: "var(--color-body-text)", fontSize: ".8rem", margin: "0 0 .6rem", maxWidth: "64ch", lineHeight: 1.6 }}>
          These queues are subscribed but not yet built. Work accumulates rather than being dropped, and
          is re-delivered the day each handler ships.
        </p>
        {waiting.length === 0 ? (
          <p style={{ color: "var(--color-mid-gray)", fontSize: ".85rem", margin: 0, display: "flex", gap: ".4rem", alignItems: "center" }}>
            <Activity size={13} aria-hidden /> Nothing queued for a subscriber.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: ".5rem" }}>
            {waiting.map((w) => (
              <div key={`${w.queue}-${w.status}`} style={{
                border: "1px solid var(--color-light-gray)", padding: ".6rem .75rem",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".5rem",
              }}>
                <code style={{ fontSize: ".74rem", fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.queue}
                </code>
                <span style={{ fontSize: ".78rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{w.n}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
