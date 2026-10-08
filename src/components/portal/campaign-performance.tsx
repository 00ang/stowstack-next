"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Users,
  Footprints,
  Target,
  TrendingUp,
  BarChart3,
  Award,
  Lightbulb,
} from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import {
  type AttributionData,
  fmtCurrency,
  fmt,
  dateRangeParams,
} from "@/lib/portal-helpers";
import {
  PortalPage,
  Card,
  StatCard,
  EmptyState,
  Tabs,
  CardSkeleton,
  SectionSkeleton,
  ErrorState,
} from "@/components/portal/ui";

/* ─── constants ─── */

const RANGES = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
];

/* ─── page ─── */

/** Spend, leads, move-ins and cost per lead, by campaign, from /api/attribution. */
export function CampaignPerformance() {
  const { session } = usePortal();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { start, end } = dateRangeParams(range);
      const res = await fetch(
        `/api/attribution?accessCode=${session.accessCode}&startDate=${start}&endDate=${end}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json: AttributionData = await res.json();
      setData(json);
    } catch {
      setError("Unable to load campaign data.");
    } finally {
      setLoading(false);
    }
  }, [session.accessCode, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── KPI cards ─── */

  const kpis = data
    ? [
        { label: "Total Spend", value: fmtCurrency(data.totals.spend), icon: DollarSign },
        { label: "Leads", value: fmt(data.totals.leads), icon: Users },
        { label: "Move-Ins", value: fmt(data.totals.move_ins), icon: Footprints },
        { label: "CPL", value: fmtCurrency(data.totals.cpl), icon: Target },
        { label: "ROAS", value: `${data.totals.roas.toFixed(1)}x`, icon: TrendingUp },
      ]
    : [];

  /* ─── campaign insights (client-side) ─── */

  const insights = (() => {
    if (!data?.hasData || !data.campaigns || data.campaigns.length === 0) return null;

    const campaignsWithSpend = data.campaigns.filter((c) => c.spend > 0);
    if (campaignsWithSpend.length === 0) return null;

    const bestRoas = campaignsWithSpend.reduce((best, c) =>
      c.roas > best.roas ? c : best
    );
    const highestSpend = campaignsWithSpend.reduce((top, c) =>
      c.spend > top.spend ? c : top
    );

    const bestName = bestRoas.campaign || "Unattributed";
    const spendName = highestSpend.campaign || "Unattributed";

    let tip = "";
    if (bestRoas.roas >= 2) {
      tip = `Your ${bestName} campaign has the best ROAS at ${bestRoas.roas.toFixed(1)}x. Consider shifting more budget there.`;
    } else if (highestSpend.roas < 1) {
      tip = `Your highest-spend campaign (${spendName}) is underperforming on ROAS. Review targeting or creative to improve returns.`;
    } else {
      tip = `No big shifts this period. ${bestName} is your top performer, so keep its budget where it is.`;
    }

    return { bestRoas, highestSpend, tip };
  })();

  /* ─── trend max for bar scaling ─── */

  const trendMax =
    data?.monthlyTrend?.reduce((m, t) => Math.max(m, t.spend, t.revenue), 0) || 1;

  return (
    <PortalPage
      title="Campaign Performance"
      subtitle="Ad spend, leads, and attribution overview"
      actions={<Tabs options={RANGES} value={range} onChange={setRange} ariaLabel="Date range" />}
    >
      <div className="space-y-6">
        {/* Error */}
        {error && <ErrorState message={error} onRetry={fetchData} />}

        {/* KPI cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : data?.hasData ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <StatCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  icon={<Icon className="h-4 w-4" />}
                />
              );
            })}
          </div>
        ) : !error ? (
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No campaign data for this period"
            message="Try a wider date range, or check back once ad spend is attributed."
          />
        ) : null}

        {/* Campaign insights */}
        {!loading && !insights && data?.hasData && (
          <Card as="section" className="text-center">
            <p className="text-sm text-[var(--color-mid-gray)]">No campaign insights available yet</p>
          </Card>
        )}
        {!loading && insights && (
          <Card as="section">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-dark)]">
              <TrendingUp className="h-4 w-4 text-[var(--color-dark)]" />
              What to do next
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Best ROAS */}
              <div className="rounded-lg border border-[var(--color-green)]/20 bg-[var(--color-green-light)] p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Award className="h-4 w-4 text-[var(--color-green)]" />
                  <span className="text-xs font-medium text-[var(--color-green)]">Best ROAS</span>
                </div>
                <p className="text-sm font-semibold text-[var(--color-dark)]">
                  {insights.bestRoas.campaign || "Unattributed"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-body-text)]">
                  <span className="font-semibold text-[var(--color-dark)]">
                    {insights.bestRoas.roas.toFixed(1)}x
                  </span>{" "}
                  return on ad spend
                </p>
              </div>

              {/* Highest spend */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)]/50 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-[var(--color-dark)]" />
                  <span className="text-xs font-medium text-[var(--color-body-text)]">Highest Spend</span>
                </div>
                <p className="text-sm font-semibold text-[var(--color-dark)]">
                  {insights.highestSpend.campaign || "Unattributed"}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-body-text)]">
                  <span className="font-semibold text-[var(--color-dark)]">
                    ${insights.highestSpend.spend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>{" "}
                  total spend
                </p>
              </div>

              {/* AI tip */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hi)] p-4 sm:col-span-2 lg:col-span-1">
                <div className="mb-1 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-[var(--color-dark)]" />
                  <span className="text-xs font-medium text-[var(--color-dark)]">Recommendation</span>
                </div>
                <p className="text-sm leading-relaxed text-[var(--color-body-text)]">
                  {insights.tip}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Campaign table */}
        {loading ? (
          <SectionSkeleton />
        ) : data?.hasData && data.campaigns.length > 0 ? (
          <section className="overflow-hidden rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="border-b border-[var(--border-subtle)] px-5 py-4">
              <h3 className="text-sm font-semibold text-[var(--color-dark)]">Campaigns</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--color-mid-gray)]">
                    <th className="px-5 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 text-right font-medium">Spend</th>
                    <th className="px-4 py-3 text-right font-medium">Impressions</th>
                    <th className="px-4 py-3 text-right font-medium">Clicks</th>
                    <th className="px-4 py-3 text-right font-medium">Leads</th>
                    <th className="px-4 py-3 text-right font-medium">Move-Ins</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">CPL</th>
                    <th className="px-4 py-3 text-right font-medium">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--color-dark)]/[0.02]"
                    >
                      <td className="px-5 py-3 font-medium text-[var(--color-dark)]">
                        {c.campaign || "Unattributed"}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {fmtCurrency(c.spend)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {fmt(c.impressions)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">{fmt(c.clicks)}</td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">{fmt(c.leads)}</td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {fmt(c.move_ins)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {fmtCurrency(c.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {fmtCurrency(c.cpl)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-body-text)]">
                        {c.roas.toFixed(1)}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {/* Monthly trend */}
        {loading ? (
          <SectionSkeleton />
        ) : data?.hasData && data.monthlyTrend && data.monthlyTrend.length > 0 ? (
          <Card as="section">
            <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">Monthly Trend</h3>
            <div className="space-y-3">
              {data.monthlyTrend.map((m) => (
                <div key={m.month} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--color-body-text)]">{m.month}</span>
                    <div className="flex gap-4">
                      <span className="text-[var(--color-mid-gray)]">
                        Spend: <span className="text-[var(--color-body-text)]">{fmtCurrency(m.spend)}</span>
                      </span>
                      <span className="text-[var(--color-mid-gray)]">
                        Rev: <span className="text-[var(--color-body-text)]">{fmtCurrency(m.revenue)}</span>
                      </span>
                      <span className="text-[var(--color-mid-gray)]">
                        Leads: <span className="text-[var(--color-body-text)]">{fmt(m.leads)}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {/* Spend bar */}
                    <div className="h-2 rounded-full bg-[var(--color-blue)]" style={{ width: `${Math.max((m.spend / trendMax) * 100, 2)}%` }} />
                    {/* Revenue bar */}
                    <div className="h-2 rounded-full bg-[var(--color-green)]" style={{ width: `${Math.max((m.revenue / trendMax) * 100, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-[10px] text-[var(--color-mid-gray)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-blue)]" />
                Spend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-green)]" />
                Revenue
              </span>
            </div>
          </Card>
        ) : null}
      </div>
    </PortalPage>
  );
}
