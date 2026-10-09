"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Users,
  Download,
  BarChart3,
  Package,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { ResponsiveChart } from "@/components/ui/responsive-chart";
import { usePortal } from "@/components/portal/portal-shell";
import { fmtCurrency } from "@/lib/portal-helpers";
import {
  PortalPage,
  Card,
  StatCard,
  EmptyState,
  Button,
  CardSkeleton,
  SectionSkeleton,
  ErrorState,
} from "@/components/portal/ui";
import { MoveInLedger } from "@/components/attribution/move-in-ledger";

/* ─── types ─── */

interface OccupancySnapshot {
  total_units: number;
  occupied_units: number;
  occupancy_pct: number;
  move_ins_mtd: number;
  move_outs_mtd: number;
  delinquency_pct: number | null;
}

interface UnitMixRow {
  type: string;
  size: string;
  total: number;
  occupied: number;
  rate: number;
}

interface TrendPoint {
  date: string;
  occupancy_pct: number;
}

interface ReportData {
  occupancy?: OccupancySnapshot;
  unitMix?: UnitMixRow[];
  occupancyTrend?: TrendPoint[];
  signedAt?: string | null;
}

/* ─── page ─── */

export default function ReportsPage() {
  const { session, client } = usePortal();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/client-reports?accessCode=${session.accessCode}&email=${encodeURIComponent(session.email)}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Unable to load report data.");
    } finally {
      setLoading(false);
    }
  }, [session.accessCode, session.email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const occ = data?.occupancy;
  const unitMix = data?.unitMix;
  const trend = data?.occupancyTrend;
  const signedAt = data?.signedAt?.slice(0, 10);

  function downloadReport() {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.facilityName || "report"}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    const url = `/api/client-report-pdf?accessCode=${encodeURIComponent(session.accessCode)}&email=${encodeURIComponent(session.email)}`;
    window.open(url, "_blank");
  }

  return (
    <PortalPage
      title="Reports & Analytics"
      subtitle={`PMS data and unit performance for ${client.facilityName}`}
      maxWidth="5xl"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadPdf}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Download PDF
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadReport}
            disabled={!data}
          >
            Export JSON
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Where move-ins came from: the open ledger (src/lib/attribution/ledger.ts). */}
        <MoveInLedger facilityId={client.facilityId} />

        {/* Error */}
        {error && <ErrorState message={error} onRetry={fetchData} />}

        {/* Occupancy trend chart */}
        {!loading && trend && trend.length > 1 && (
          <Card as="section">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--color-dark)]" />
              <h3 className="text-sm font-semibold text-[var(--color-dark)]">Occupancy Trend</h3>
            </div>
            <ResponsiveChart mobileHeight={200} desktopHeight={240}>
              <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }}
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }}
                  tickFormatter={(v: number) => `${v}%`}
                  width={40}
                />
                <Tooltip
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, "Occupancy"]}
                  contentStyle={{ background: "var(--color-light)", border: "1px solid var(--color-light-gray)", borderRadius: "8px", fontSize: "12px" }}
                />
                {signedAt && (
                  <ReferenceLine
                    x={signedAt}
                    stroke="var(--color-blue)"
                    strokeDasharray="4 4"
                    label={{ value: "StorageAds Started", position: "top", fontSize: 10, fill: "var(--color-blue)" }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="occupancy_pct"
                  stroke="var(--color-blue)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-blue)" }}
                />
              </LineChart>
            </ResponsiveChart>
          </Card>
        )}

        {/* Occupancy snapshot */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : occ ? (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-dark)]">Occupancy Snapshot</h3>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard
                label="Occupancy"
                value={`${occ.occupancy_pct.toFixed(1)}%`}
                icon={<Building2 className="h-4 w-4" />}
                hint={`${occ.occupied_units} / ${occ.total_units} units`}
              />
              <StatCard label="Total Units" value={occ.total_units} icon={<Package className="h-4 w-4" />} />
              <StatCard label="Occupied Units" value={occ.occupied_units} icon={<Users className="h-4 w-4" />} />
              <StatCard label="Move-Ins (MTD)" value={occ.move_ins_mtd} icon={<TrendingUp className="h-4 w-4" />} />
              <StatCard label="Move-Outs (MTD)" value={occ.move_outs_mtd} icon={<TrendingDown className="h-4 w-4" />} />
              {occ.delinquency_pct != null && (
                <StatCard label="Delinquency" value={`${occ.delinquency_pct.toFixed(1)}%`} icon={<BarChart3 className="h-4 w-4" />} />
              )}
            </div>
          </div>
        ) : !error ? (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No PMS data available yet"
            message="Data will appear once your property management system is connected."
          />
        ) : null}

        {/* Unit mix table */}
        {loading ? (
          <SectionSkeleton />
        ) : unitMix && unitMix.length > 0 ? (
          <section className="overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--color-dark)]">Unit Mix</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--color-mid-gray)]">
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Occupied</th>
                    <th className="px-4 py-3 text-right font-medium">Occ %</th>
                    <th className="px-4 py-3 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {unitMix.map((row, i) => {
                    const occPct = row.total > 0 ? (row.occupied / row.total) * 100 : 0;
                    return (
                      <tr
                        key={i}
                        className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--color-light-gray)]/20"
                      >
                        <td className="px-5 py-3 font-medium text-[var(--color-dark)]">{row.type}</td>
                        <td className="px-4 py-3 text-[var(--color-body-text)]">{row.size}</td>
                        <td className="px-4 py-3 text-right text-[var(--color-body-text)]">{row.total}</td>
                        <td className="px-4 py-3 text-right text-[var(--color-body-text)]">{row.occupied}</td>
                        <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                          {occPct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                          {fmtCurrency(row.rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </PortalPage>
  );
}
