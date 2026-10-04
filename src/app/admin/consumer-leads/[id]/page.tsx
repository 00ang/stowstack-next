"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Flag,
  Home,
  Loader2,
  MousePointerClick,
  Phone,
  RefreshCw,
  Send,
  UserPlus,
} from "lucide-react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";

/**
 * Lead journey (MISSION.md s12).
 *
 * One lead, start to finish: every visit and call that brought them, what they
 * did, the move-in we matched them to, and what we told Meta and Google about
 * it. First touch and latest non-direct touch are computed from the same rows,
 * so the summary and the timeline can never disagree.
 */

type Kind = "touch" | "lead" | "status" | "move_in" | "report";

interface JourneyItem {
  kind: Kind;
  at: string;
  title: string;
  detail: string;
  touchKind?: "visit" | "call";
  status?: string;
}
interface Brief { title: string; campaign: string | null; at: string }
interface JourneyResponse {
  lead: {
    id: string; name: string | null; email: string | null; phone: string | null;
    facility: string | null; status: string | null; createdAt: string; convertedAt: string | null;
    monthlyRevenue: number | null; tracked: boolean;
  };
  summary: {
    first: Brief | null;
    latestNonDirect: Brief | null;
    touchCount: number;
    path: string[];
    movedIn: { unit: string; rate: number | null; date: string | null } | null;
  };
  journey: JourneyItem[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function iconFor(item: JourneyItem) {
  const p = { size: 14, "aria-hidden": true } as const;
  switch (item.kind) {
    case "touch": return item.touchKind === "call" ? <Phone {...p} /> : <MousePointerClick {...p} />;
    case "lead": return <UserPlus {...p} />;
    case "status": return <Flag {...p} />;
    case "move_in": return <Home {...p} />;
    case "report": return <Send {...p} />;
  }
}

function reportColor(status?: string) {
  if (status === "sent") return "var(--color-green)";
  if (status === "failed") return "var(--color-red)";
  return "var(--color-mid-gray)";
}

const label = { fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--color-mid-gray)" };

function Stat({ title, value, sub }: { title: string; value: string; sub?: string | null }) {
  return (
    <div style={{ padding: ".8rem .95rem", minWidth: 0 }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: ".95rem", fontWeight: 650, marginTop: ".3rem", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub ? <div style={{ fontSize: ".72rem", color: "var(--color-body-text)", marginTop: ".15rem" }}>{sub}</div> : null}
    </div>
  );
}

export default function LeadJourneyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const query = useMemo(() => ({ leadId: id }), [id]);
  const { data, loading, error, refetch } = useAdminFetch<JourneyResponse>("/api/admin-lead-journey", query);

  if (loading && !data) {
    return (
      <div style={{ padding: "2rem", color: "var(--color-mid-gray)", display: "flex", gap: ".5rem", alignItems: "center" }}>
        <Loader2 size={15} className="animate-spin" aria-hidden /> Loading journey…
      </div>
    );
  }
  if (error || !data) {
    return <div style={{ padding: "2rem", color: "var(--color-red)" }}>Could not load this lead. {error}</div>;
  }

  const { lead, summary, journey } = data;
  const name = lead.name || lead.email || lead.phone || "Unnamed lead";

  return (
    <div style={{ padding: "1.5rem 1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: 960 }}>
      <Link href="/admin/consumer-leads" style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", fontSize: ".75rem", color: "var(--color-body-text)", textDecoration: "none" }}>
        <ArrowLeft size={13} aria-hidden /> Consumer leads
      </Link>

      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-.03em", margin: 0 }}>{name}</h1>
          <p style={{ margin: ".35rem 0 0", color: "var(--color-body-text)", fontSize: ".85rem" }}>
            {[lead.facility, lead.status ? lead.status.replace(/_/g, " ") : null, lead.phone, lead.email].filter(Boolean).join(" · ")}
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

      <section style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        border: "1px solid var(--color-light-gray)",
      }}>
        <Stat title="First touch" value={summary.first?.title ?? "Not tracked"} sub={summary.first ? [summary.first.campaign, fmtDay(summary.first.at)].filter(Boolean).join(" · ") : null} />
        <Stat title="Latest non-direct" value={summary.latestNonDirect?.title ?? "—"} sub={summary.latestNonDirect ? [summary.latestNonDirect.campaign, fmtDay(summary.latestNonDirect.at)].filter(Boolean).join(" · ") : null} />
        <Stat title="Touches" value={String(summary.touchCount)} sub={summary.path.length ? summary.path.map((p) => p.replace(/_/g, " ")).join(" → ") : null} />
        <Stat
          title="Moved in"
          value={summary.movedIn ? `Unit ${summary.movedIn.unit}` : "Not yet"}
          sub={summary.movedIn ? [summary.movedIn.rate != null ? `$${summary.movedIn.rate.toFixed(2)}/mo` : null, summary.movedIn.date ? fmtDay(summary.movedIn.date) : null].filter(Boolean).join(" · ") : null}
        />
      </section>

      {!lead.tracked && (
        <p style={{ margin: 0, fontSize: ".8rem", color: "var(--color-body-text)", lineHeight: 1.6, maxWidth: "70ch" }}>
          This lead arrived before visitor tracking, or from a browser that never loaded a landing page,
          so there are no visits to show. Calls from the same number still appear.
        </p>
      )}

      <section>
        <h2 style={{ ...label, fontSize: ".8rem", margin: "0 0 .6rem" }}>Journey</h2>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--color-light-gray)" }}>
          {journey.map((item, i) => (
            <li key={`${item.kind}-${item.at}-${i}`} style={{
              display: "grid", gridTemplateColumns: "1.75rem minmax(0,1fr) auto", gap: ".7rem",
              padding: ".7rem .9rem", alignItems: "start",
              borderTop: i === 0 ? "none" : "1px solid var(--color-light-gray)",
              background: item.kind === "move_in" ? "var(--color-light-gray)" : "transparent",
            }}>
              <span style={{
                color: item.kind === "report" ? reportColor(item.status) : "var(--color-dark)",
                display: "flex", justifyContent: "center", paddingTop: ".1rem",
              }}>
                {iconFor(item)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: ".83rem", fontWeight: 600, color: item.kind === "report" ? reportColor(item.status) : "var(--color-dark)" }}>
                  {item.title}
                </div>
                {item.detail ? (
                  <div style={{ fontSize: ".74rem", color: "var(--color-body-text)", marginTop: ".15rem", overflowWrap: "anywhere" }}>
                    {item.detail}
                  </div>
                ) : null}
              </div>
              <time dateTime={item.at} style={{ fontSize: ".7rem", color: "var(--color-mid-gray)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {item.kind === "move_in" ? fmtDay(item.at) : fmtDate(item.at)}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
