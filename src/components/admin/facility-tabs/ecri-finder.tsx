"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  AlertCircle,
  Loader2,
  FileText,
  X,
  Copy,
  Download,
  Check,
} from "lucide-react";

type EcriRisk = "low" | "medium" | "higher";
type EcriStatus = "pending" | "scheduled" | "sent" | "done";

interface EcriTenant {
  tenantId: string;
  tenantName: string | null;
  email: string | null;
  unit: string | null;
  sizeLabel: string | null;
  unitType: string | null;
  currentRate: number;
  marketRate: number | null;
  marketSource: "sensitivity" | "street_rate" | null;
  suggestedRate: number;
  monthlyLift: number;
  liftPct: number | null;
  tenureMonths: number;
  monthsSinceLastIncrease: number | null;
  sensitivityBucket: string | null;
  sensitivityScore: number | null;
  risk: EcriRisk;
  status: EcriStatus;
  sentAt: string | null;
}

interface EcriResponse {
  facilityId: string;
  count: number;
  worked: number;
  totalMonthlyLift: number;
  totalAnnualLift: number;
  tenants: EcriTenant[];
}

interface LetterResponse {
  tenantId: string;
  tenantName: string | null;
  unit: string | null;
  currentRate: number;
  newRate: number;
  effectiveDate: string;
  noticeDays: number;
  subject: string;
  body: string;
}

const STATUSES: EcriStatus[] = ["pending", "scheduled", "sent", "done"];

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

const RISK_STYLE: Record<EcriRisk, { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "var(--color-green)", bg: "rgba(120,140,93,0.15)" },
  medium: { label: "Medium", color: "var(--ink3)", bg: "var(--card)" },
  higher: { label: "Higher", color: "var(--color-red)", bg: "rgba(176,74,58,0.15)" },
};

export default function EcriFinder({
  facilityId,
  facilityName,
  adminKey,
}: {
  facilityId: string;
  facilityName: string;
  adminKey: string;
}) {
  const [data, setData] = useState<EcriResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<LetterResponse | null>(null);
  const [letterLoading, setLetterLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ecri?facilityId=${encodeURIComponent(facilityId)}`,
        { headers: { "X-Admin-Key": adminKey } },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Request failed (${res.status})`);
      }
      setData((await res.json()) as EcriResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ECRI data");
    } finally {
      setLoading(false);
    }
  }, [facilityId, adminKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Optimistically set a tenant's status, then persist.
  const updateStatus = useCallback(
    async (tenant: EcriTenant, status: EcriStatus) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              tenants: prev.tenants.map((t) =>
                t.tenantId === tenant.tenantId ? { ...t, status } : t,
              ),
              worked: prev.tenants.filter((t) =>
                t.tenantId === tenant.tenantId
                  ? status === "sent" || status === "done"
                  : t.status === "sent" || t.status === "done",
              ).length,
            }
          : prev,
      );
      try {
        const res = await fetch("/api/ecri/track", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({
            tenantId: tenant.tenantId,
            status,
            currentRate: tenant.currentRate,
            newRate: tenant.suggestedRate,
            monthlyUplift: tenant.monthlyLift,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        // Revert by refetching the source of truth.
        fetchData();
      }
    },
    [adminKey, fetchData],
  );

  const openLetter = useCallback(
    async (tenant: EcriTenant) => {
      setLetterLoading(tenant.tenantId);
      try {
        const res = await fetch("/api/ecri/letter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({
            tenantId: tenant.tenantId,
            newRate: tenant.suggestedRate,
          }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error || `Failed to generate letter (${res.status})`);
        }
        setLetter((await res.json()) as LetterResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate letter");
      } finally {
        setLetterLoading(null);
      }
    },
    [adminKey],
  );

  if (loading) {
    return (
      <Centered>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--ink3)" }} />
        <p style={subtleText}>Scanning tenants for rate-increase opportunities…</p>
      </Centered>
    );
  }

  if (error && !data) {
    return (
      <Centered>
        <AlertCircle className="h-6 w-6" style={{ color: "var(--color-red)" }} />
        <p style={subtleText}>{error}</p>
        <button type="button" onClick={() => fetchData()} style={btnStyle}>
          Try again
        </button>
      </Centered>
    );
  }

  if (!data || data.count === 0) {
    return (
      <Centered>
        <TrendingUp className="h-7 w-7" style={{ color: "var(--ink3)" }} />
        <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>
          No rate-increase opportunities
        </h2>
        <p style={{ ...subtleText, maxWidth: "380px" }}>
          No active tenants at {facilityName} are currently under market by a
          meaningful margin. This can also mean tenant or sensitivity data
          hasn&rsquo;t been imported yet. Upload a fresh PMS report or run the
          sensitivity scorer to refresh the analysis.
        </p>
      </Centered>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font)", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
        <TrendingUp className="h-5 w-5" style={{ color: "var(--ink)" }} />
        <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>
          ECRI &mdash; Rate Increase Finder
        </h1>
      </div>
      <p style={{ ...subtleText, marginBottom: "20px" }}>
        Existing tenants paying below street rate, ranked by monthly revenue
        lift. The suggested rate is sensitivity-aware &mdash; sticky tenants get a
        larger raise, flight risks a gentler one. Work the safest, highest-impact
        ones first.
      </p>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            marginBottom: "12px",
            fontSize: "13px",
            color: "var(--color-red)",
            background: "rgba(176,74,58,0.1)",
            border: "1px solid rgba(176,74,58,0.3)",
            borderRadius: "8px",
          }}
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          padding: "16px 20px",
          background: "var(--card)",
          border: "1px solid var(--bdr-strong)",
          borderRadius: "10px",
          marginBottom: "20px",
        }}
      >
        <Stat label="Tenants flagged" value={String(data.count)} />
        <Stat label="Monthly lift" value={money(data.totalMonthlyLift)} />
        <Stat label="Annualized lift" value={money(data.totalAnnualLift)} />
        <Stat label="Worked" value={`${data.worked} of ${data.count}`} />
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--bdr-strong)", borderRadius: "10px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "var(--card)" }}>
              <Th align="left">Tenant</Th>
              <Th align="left">Unit</Th>
              <Th align="left">Size</Th>
              <Th align="right">Current</Th>
              <Th align="right">Suggested</Th>
              <Th align="right">+$/mo</Th>
              <Th align="right">+%</Th>
              <Th align="center">Risk</Th>
              <Th align="left">Status</Th>
              <Th align="right">Letter</Th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => {
              const risk = RISK_STYLE[t.risk];
              return (
                <tr key={t.tenantId} style={{ borderTop: "1px solid var(--bdr-strong)" }}>
                  <Td align="left">{t.tenantName || "—"}</Td>
                  <Td align="left">{t.unit || "—"}</Td>
                  <Td align="left">{t.sizeLabel || t.unitType || "—"}</Td>
                  <Td align="right">{money(t.currentRate)}</Td>
                  <Td align="right">
                    <span
                      title={
                        t.marketRate
                          ? `Market ${money(t.marketRate)} · ${
                              t.marketSource === "street_rate"
                                ? "posted street rate (no sensitivity score yet)"
                                : "sensitivity-derived market rate"
                            }`
                          : undefined
                      }
                    >
                      {money(t.suggestedRate)}
                    </span>
                  </Td>
                  <Td align="right" strong>
                    {money(t.monthlyLift)}
                  </Td>
                  <Td align="right">{t.liftPct !== null ? `${t.liftPct}%` : "—"}</Td>
                  <Td align="center">
                    <span
                      title={
                        t.sensitivityBucket
                          ? `Sensitivity: ${t.sensitivityBucket}`
                          : "Risk from tenure (no sensitivity score yet)"
                      }
                      style={{
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        color: risk.color,
                        background: risk.bg,
                      }}
                    >
                      {risk.label}
                    </span>
                  </Td>
                  <Td align="left">
                    <select
                      value={t.status}
                      onChange={(e) => updateStatus(t, e.target.value as EcriStatus)}
                      style={{
                        fontFamily: "var(--font)",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--ink)",
                        background: "var(--card)",
                        border: "1px solid var(--bdr-strong)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => openLetter(t)}
                      disabled={letterLoading === t.tenantId}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontFamily: "var(--font)",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--ink)",
                        background: "var(--card)",
                        border: "1px solid var(--bdr-strong)",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        cursor: letterLoading === t.tenantId ? "wait" : "pointer",
                        opacity: letterLoading === t.tenantId ? 0.6 : 1,
                      }}
                    >
                      {letterLoading === t.tenantId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      Letter
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {letter && (
        <LetterModal
          letter={letter}
          onClose={() => setLetter(null)}
          onMarkSent={() => {
            const t = data.tenants.find((x) => x.tenantId === letter.tenantId);
            if (t) updateStatus(t, "sent");
            setLetter(null);
          }}
        />
      )}
    </div>
  );
}

function LetterModal({
  letter,
  onClose,
  onMarkSent,
}: {
  letter: LetterResponse;
  onClose: () => void;
  onMarkSent: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can still select the text */
    }
  };

  const download = () => {
    const blob = new Blob([letter.body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rate-increase-${(letter.unit || "unit").replace(/\s+/g, "-")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "var(--font)",
          background: "var(--card)",
          border: "1px solid var(--bdr-strong)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "640px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--bdr-strong)",
          }}
        >
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              {letter.subject}
            </h3>
            <p style={{ ...subtleText, marginTop: "2px" }}>
              {letter.tenantName} · Unit {letter.unit} · {money(letter.currentRate)} →{" "}
              {money(letter.newRate)} · effective {letter.effectiveDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <textarea
          readOnly
          value={letter.body}
          style={{
            flex: 1,
            minHeight: "320px",
            resize: "none",
            fontFamily: "var(--font)",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--ink)",
            background: "var(--light, #E0E0E5)",
            border: "none",
            padding: "20px",
            outline: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            padding: "14px 20px",
            borderTop: "1px solid var(--bdr-strong)",
          }}
        >
          <button type="button" onClick={copy} style={btnStyle}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={download} style={btnStyle}>
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onMarkSent}
            style={{ ...btnStyle, color: "var(--light, #E0E0E5)", background: "var(--ink)", borderColor: "var(--ink)" }}
          >
            <Check className="h-4 w-4" />
            Mark as sent
          </button>
        </div>
      </div>
    </div>
  );
}

const subtleText: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--ink3)",
  lineHeight: 1.5,
  margin: 0,
};

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontFamily: "var(--font)",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--ink)",
  background: "var(--card)",
  border: "1px solid var(--bdr-strong)",
  borderRadius: "8px",
  padding: "8px 14px",
  cursor: "pointer",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center"
      style={{ fontFamily: "var(--font)" }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--ink3)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align: "left" | "right" | "center" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        color: "var(--ink3)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  strong,
}: {
  children: React.ReactNode;
  align: "left" | "right" | "center";
  strong?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "10px 14px",
        color: "var(--ink)",
        fontWeight: strong ? 700 : 400,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
