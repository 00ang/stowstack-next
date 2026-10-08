"use client"

import {
  Loader2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Eye,
  MousePointer,
  Navigation,
  Phone,
  Search,
  Map,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { ResponsiveChart } from "@/components/ui/responsive-chart"
import {
  type GBPInsight,
  type InsightsSummary,
  type GBPConnection,
  card,
  textPrimary,
  textSecondary,
  textTertiary,
  btnSecondary,
} from "./gbp-shared"

interface GBPInsightsProps {
  facilityId: string
  adminKey: string
  insights: GBPInsight[]
  insightsSummary: InsightsSummary | null
  connection: GBPConnection | null
  loadAll: () => Promise<void>
  syncing: string | null
  setSyncing: React.Dispatch<React.SetStateAction<string | null>>
  insightsRange: string
  setInsightsRange: React.Dispatch<React.SetStateAction<string>>
}

export default function GBPInsights({
  facilityId,
  adminKey,
  insights,
  insightsSummary,
  connection,
  loadAll,
  syncing,
  setSyncing,
  insightsRange,
  setInsightsRange,
}: GBPInsightsProps) {
  async function syncInsights() {
    setSyncing("insights")
    try {
      await fetch("/api/gbp-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId }),
      })
      await loadAll()
    } catch {
      /* silent */
    }
    setSyncing(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-semibold ${textPrimary}`}>
          GBP Performance Insights
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(
              [
                ["7d", "7 Days"],
                ["30d", "30 Days"],
                ["90d", "90 Days"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setInsightsRange(val)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  insightsRange === val
                    ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                    : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {connection?.status === "connected" && (
            <button
              onClick={syncInsights}
              disabled={syncing === "insights"}
              className={btnSecondary}
            >
              {syncing === "insights" ? (
                <Loader2
                  size={13}
                  className="inline animate-spin mr-1"
                />
              ) : (
                <RefreshCw size={13} className="inline mr-1" />
              )}
              Sync Insights
            </button>
          )}
        </div>
      </div>

      {insightsSummary ? (
        <>
          {insightsSummary.period && (
            <p className={`text-xs ${textTertiary}`}>
              Data from {insightsSummary.period}
            </p>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "Search Views",
                value: insightsSummary.search_views,
                icon: Search,
                color: "text-[var(--color-blue)]",
              },
              {
                label: "Maps Views",
                value: insightsSummary.maps_views,
                icon: Map,
                color: "text-emerald-400",
              },
              {
                label: "Website Clicks",
                value: insightsSummary.website_clicks,
                icon: MousePointer,
                color: "text-purple-400",
              },
              {
                label: "Direction Requests",
                value: insightsSummary.direction_clicks,
                icon: Navigation,
                color: "text-[var(--onto-tours)]",
              },
              {
                label: "Phone Calls",
                value: insightsSummary.phone_calls,
                icon: Phone,
                color: "text-rose-400",
              },
            ].map((stat) => (
              <div key={stat.label} className={card + " p-4"}>
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon size={14} className={stat.color} />
                  <span className={`text-xs font-medium ${textTertiary}`}>
                    {stat.label}
                  </span>
                </div>
                <p className={`text-xl font-semibold ${textPrimary}`}>
                  {((stat.value as number) || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Total impressions & actions */}
          <div className="grid grid-cols-2 gap-3">
            <div className={card + " p-4"}>
              <div className="flex items-center gap-2 mb-1">
                <Eye size={14} className="text-[var(--color-blue)]" />
                <span className={`text-xs font-medium ${textTertiary}`}>
                  Total Impressions
                </span>
              </div>
              <p className={`text-2xl font-semibold ${textPrimary}`}>
                {(insightsSummary.total_impressions || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${textTertiary} mt-0.5`}>
                Search + Maps views combined
              </p>
            </div>
            <div className={card + " p-4"}>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-emerald-400" />
                <span className={`text-xs font-medium ${textTertiary}`}>
                  Total Actions
                </span>
              </div>
              <p className={`text-2xl font-semibold ${textPrimary}`}>
                {(insightsSummary.total_actions || 0).toLocaleString()}
              </p>
              <p className={`text-xs ${textTertiary} mt-0.5`}>
                Clicks + Directions + Calls
              </p>
            </div>
          </div>

          {/* Action rate */}
          {Number(insightsSummary.total_impressions) > 0 && (
            <div className={card + " p-4"}>
              <h4
                className={`text-xs font-semibold ${textTertiary} mb-2 uppercase tracking-wider`}
              >
                Action Rate
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-6 rounded-full overflow-hidden bg-[var(--color-light-gray)]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(100, (Number(insightsSummary.total_actions) / Number(insightsSummary.total_impressions)) * 100)}%`,
                    }}
                  />
                </div>
                <span className={`text-sm font-semibold ${textPrimary}`}>
                  {(
                    (Number(insightsSummary.total_actions) /
                      Number(insightsSummary.total_impressions)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <p className={`text-xs ${textTertiary} mt-1`}>
                Percentage of viewers who took an action
              </p>
            </div>
          )}

          {/* Trend chart */}
          {insights.length > 1 && (
            <div className={card + " p-4"}>
              <h4
                className={`text-sm font-semibold ${textPrimary} mb-4`}
              >
                Impressions Over Time
              </h4>
              <ResponsiveChart mobileHeight={200} desktopHeight={240}>
                <LineChart
                  data={insights.map((i) => ({
                    period: i.period_start,
                    impressions:
                      (i.search_views || 0) + (i.maps_views || 0),
                    actions:
                      (i.website_clicks || 0) +
                      (i.direction_clicks || 0) +
                      (i.phone_calls || 0),
                  }))}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-subtle)"
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "var(--color-mid-gray)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--border-subtle)" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "var(--color-mid-gray)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--border-subtle)" }}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      color: "var(--color-dark)",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="impressions"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                    dot={false}
                    name="Impressions"
                  />
                  <Line
                    type="monotone"
                    dataKey="actions"
                    stroke="var(--color-green)"
                    strokeWidth={2}
                    dot={false}
                    name="Actions"
                  />
                </LineChart>
              </ResponsiveChart>
            </div>
          )}

          {/* Historical table */}
          {insights.length > 1 && (
            <div className={card}>
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <h4 className={`text-sm font-semibold ${textPrimary}`}>
                  Historical Performance
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={textTertiary}>
                      <th className="text-left px-4 py-2 font-medium">
                        Period
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Search
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Maps
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Clicks
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Directions
                      </th>
                      <th className="text-right px-4 py-2 font-medium">
                        Calls
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {insights.map((i) => (
                      <tr
                        key={i.id}
                        className="hover:bg-[var(--color-light-gray)]"
                      >
                        <td className={`px-4 py-2 ${textPrimary}`}>
                          {i.period_start} {"\u2014"} {i.period_end}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${textSecondary}`}
                        >
                          {i.search_views}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${textSecondary}`}
                        >
                          {i.maps_views}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${textSecondary}`}
                        >
                          {i.website_clicks}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${textSecondary}`}
                        >
                          {i.direction_clicks}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${textSecondary}`}
                        >
                          {i.phone_calls}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={card + " p-8 text-center"}>
          <BarChart3
            size={32}
            className={`mx-auto mb-2 opacity-40 ${textTertiary}`}
          />
          <p className={`text-sm ${textSecondary}`}>
            No insights data yet.
          </p>
          <p className={`text-xs mt-1 ${textTertiary}`}>
            {connection?.status === "connected"
              ? 'Click "Sync Insights" to pull performance data from GBP.'
              : "Connect your GBP to start tracking performance metrics."}
          </p>
        </div>
      )}
    </div>
  )
}
