"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LedgerRow, LedgerSummary } from "@/lib/attribution/ledger-rows";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import { Question } from "@/components/design/dl003/ui";

/**
 * Where move-ins came from: one line of insight, the unsure matches to settle,
 * and every move-in with its evidence. Open by design: what the report counts
 * is what's listed here, and it all exports.
 */

interface Payload {
  rows: LedgerRow[];
  summary: LedgerSummary;
  days: number;
  heardAsk: boolean;
}

/** One hue per kind of evidence (ref 003). Words always carry the meaning too. */
const KIND = {
  measured: "#006FBF",
  said: "#9051B6",
  unsure: "#C33B3E",
} as const;

const METHOD: Record<string, string> = {
  phone_exact: "phone, exact",
  email_exact: "email, exact",
  name_last4_phone: "last name + phone's last 4",
};

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function seconds(s: number | null): string {
  if (s == null) return "not answered";
  if (s < 90) return `answered in ${s}s`;
  if (s < 5400) return `answered in ${Math.round(s / 60)} min`;
  return `answered in ${Math.round(s / 3600)} h`;
}

/** How each measured way reads after a count: "6 from a Meta ad". */
const CAME: Record<string, string> = {
  "Meta ad": "from a Meta ad",
  "Google ad": "from a Google ad",
  "TikTok ad": "from a TikTok ad",
  "Bing ad": "from a Bing ad",
  "Social ad": "from a social ad",
  "Display ad": "from a display ad",
  "Google search or Maps": "from Google search or Maps",
  Search: "from search",
  "Social post": "from a social post",
  "Follow-up email": "from a follow-up email",
  "Another website": "from another website",
  "Phone call": "by phone",
  "Typed the address": "typed the address",
};

/** How each answer reads after a count: "3 found you on Google Maps". */
const SAID: Record<string, string> = {
  "Searched Google": "searched Google",
  "Google Maps": "found you on Google Maps",
  "Facebook or Instagram": "saw you on Facebook or Instagram",
  "Drove by or saw the sign": "drove by or saw the sign",
  "A friend or family": "heard from a friend",
  "Rented here before": "rented here before",
  "Something else": "said something else",
};

/** "11 move-ins: 6 from a Meta ad, 3 found you on Google Maps, 2 not known yet." */
function insight(rows: LedgerRow[]): string {
  if (!rows.length) return "";
  const traced = new Map<string, number>();
  const said = new Map<string, number>();
  let unsure = 0;
  let unknown = 0;
  for (const r of rows) {
    if ((r.verdict === "traced" || r.verdict === "both") && r.visit) traced.set(r.visit.way, (traced.get(r.visit.way) ?? 0) + 1);
    else if (r.verdict === "said" && r.said) said.set(r.said.label, (said.get(r.said.label) ?? 0) + 1);
    else if (r.verdict === "unsure") unsure++;
    else unknown++;
  }
  const parts = [
    ...[...traced.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} ${CAME[w] ?? `from ${w}`}`),
    ...[...said.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${n} ${SAID[w] ?? `said ${w.toLowerCase()}`}`),
    ...(unsure ? [`${unsure} to confirm`] : []),
    ...(unknown ? [`${unknown} not known yet`] : []),
  ];
  return `${rows.length} move-in${rows.length === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

export function MoveInLedger({ facilityId }: { facilityId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sample = isPortalDemo();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attribution/ledger?facilityId=${encodeURIComponent(facilityId)}&days=90`, { credentials: "include" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError("The move-ins couldn't load. Try again in a moment.");
    }
  }, [facilityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    try {
      const res = await fetch("/api/attribution/ledger", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, ...body }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "That didn't save. Try again.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const unsure = rows.filter((r) => r.verdict === "unsure" && r.match.attemptId && r.match.candidates.length);
  const line = insight(rows);

  return (
    <div data-dl003="ledger">
      {sample && (
        <div className="mb-3">
          <Question
            kicker="003 · one question · sky stays off this table"
            q="How did these move-ins find you?"
            a="Each row is one move-in and the evidence for it. A dither plate behind this table would hide the words, so the sky stops above the page."
          />
        </div>
      )}
    <div role="region" aria-label="Where your move-ins came from" className="border border-[var(--ic-ink,#121214)] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#3A3536]">
            Move-ins · last {data?.days ?? 90} days
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold leading-tight text-[#141112]">Where your move-ins came from</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {sample ? (
            <button
              type="button"
              data-fill="5"
              onClick={() => setError("The sample doesn't export. In your own portal this downloads every row as a spreadsheet.")}
              className="act-fill inline-flex h-9 items-center px-3 text-[13px] font-extrabold"
            >
              Export
            </button>
          ) : (
            <a
              href={`/api/attribution/ledger?facilityId=${encodeURIComponent(facilityId)}&days=${data?.days ?? 90}&format=csv`}
              data-fill="5"
              className="act-fill inline-flex h-9 items-center px-3 text-[13px] font-extrabold"
            >
              Export
            </a>
          )}
          <button
            type="button"
            data-fill="4"
            disabled={!data || busy === "ask"}
            onClick={() => void act("ask", { action: "ask", on: !data?.heardAsk })}
            className="act-fill inline-flex h-9 items-center px-3 text-[13px] font-extrabold"
          >
            {data?.heardAsk ? "Asking new tenants · stop" : "Ask new tenants how they found you"}
          </button>
        </div>
      </div>

      {line && <div className="mt-3 text-[16px] font-extrabold leading-snug text-[#141112]">{line}</div>}
      {data?.heardAsk && (
        <div className="mt-1 text-[13.5px] font-semibold text-[#3A3536]">
          Each new tenant with an email gets one question a day after they move in, and answers in one tap.
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 border-l-4 border-[#A12A2A] pl-3 text-[14px] font-bold text-[#141112]">
          {error}
        </div>
      )}

      {unsure.length > 0 && (
        <div className="mt-4 border-t-2 border-[#141112] pt-3">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#3A3536]">
            Confirm · {unsure.length}
          </div>
          <ul className="mt-1">
            {unsure.map((r) => (
              <li key={r.tenantId} className="border-b border-[#E0E0E0] py-3" style={{ boxShadow: `inset 4px 0 0 ${KIND.unsure}`, paddingLeft: 12 }}>
                <div className="text-[14.5px] font-semibold text-[#141112]">
                  <b className="font-extrabold">{r.name}</b> moved into {r.size ? `a ${r.size}` : `unit ${r.unit ?? ""}`} on{" "}
                  {shortDate(r.moveInDate)}. Which lead was this?
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.match.candidates.map((c, i) => (
                    <button
                      key={c.leadId}
                      type="button"
                      data-fill={String((i % 3) + 1)}
                      disabled={!!busy}
                      onClick={() => void act(`c:${c.leadId}`, { action: "confirm", attemptId: r.match.attemptId, leadId: c.leadId })}
                      className="act-fill inline-flex min-h-9 items-center px-3 py-1 text-left text-[13px] font-extrabold"
                    >
                      {c.name || "Unnamed lead"}
                      {c.askedAt ? ` · asked ${shortDate(c.askedAt)}` : ""}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-fill="6"
                    disabled={!!busy}
                    onClick={() => void act(`r:${r.tenantId}`, { action: "reject", attemptId: r.match.attemptId })}
                    className="act-fill inline-flex min-h-9 items-center px-3 py-1 text-[13px] font-extrabold"
                  >
                    Neither
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data && rows.length === 0 && (
        <div className="mt-4 text-[14.5px] font-semibold text-[#141112]">
          No move-ins in the last {data.days} days yet. They show up here as your rent roll comes in. A rent roll with
          phone or email lets each one be tied to the lead that asked.
        </div>
      )}

      {rows.length > 0 && (
        <ol className="mt-4 border-t-2 border-[#141112]">
          {rows.map((r) => {
            const kind =
              r.verdict === "traced" || r.verdict === "both" ? KIND.measured : r.verdict === "said" ? KIND.said : r.verdict === "unsure" ? KIND.unsure : null;
            return (
              <li key={r.tenantId} className="grid gap-x-4 gap-y-1 border-b border-[#E0E0E0] py-3 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="text-[13.5px] font-semibold text-[#141112]">
                  <span className="font-mono text-[12px] font-semibold tabular-nums">{shortDate(r.moveInDate)}</span>
                  <span className="block font-extrabold">{r.name}</span>
                  <span className="block text-[#3A3536]">{[r.size, r.unit && `unit ${r.unit}`].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="min-w-0 text-[14px] font-semibold text-[#141112]">
                  <span className="flex items-center gap-2 font-extrabold">
                    <i
                      aria-hidden
                      className="inline-block h-[10px] w-[10px] shrink-0 border-[1.5px]"
                      style={{ borderColor: kind ?? "#141112", background: kind ?? "transparent" }}
                    />
                    {r.way}
                  </span>
                  {r.visit?.campaign && <span className="block text-[#3A3536]">{r.visit.campaign}</span>}
                  {r.lead && (
                    <span className="block text-[#3A3536]">
                      Asked {shortDate(r.lead.askedAt)}, {seconds(r.lead.answeredInSeconds)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 text-[13.5px] font-semibold text-[#141112]">
                  {r.match.status === "matched" ? (
                    <span className="block">Matched by {METHOD[r.match.method ?? ""] ?? "the rent roll"}</span>
                  ) : r.match.status === "rejected" ? (
                    <span className="block text-[#3A3536]">Not one of the leads</span>
                  ) : r.match.status === "ambiguous" ? (
                    <span className="block">Two possible leads · confirm above</span>
                  ) : (
                    <span className="block text-[#3A3536]">No lead to match</span>
                  )}
                  {r.said ? (
                    <span className="block">
                      {r.said.via === "counter" ? "Told the office: " : "Said: "}
                      <b className="font-extrabold">{r.said.label}</b>
                      {r.agrees === true ? " · matches the visit" : r.agrees === false ? " · differs from the visit" : ""}
                    </span>
                  ) : (
                    <span className="block text-[#3A3536]">Not asked yet</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
    </div>
  );
}
