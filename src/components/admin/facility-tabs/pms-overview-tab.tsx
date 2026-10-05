"use client";

import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  PieChart,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { PmsData, fmt, fmtCurrency, fmtPct, fmtDate, fmtShortDate } from "./pms-dashboard-types";

export function OverviewTab({ data }: { data: PmsData }) {
  const s = data.latestSnapshot;
  const trend = data.snapshotTrend;

  const kpis = [
    {
      label: "Total Units",
      value: fmt(s?.total_units),
      icon: Building2,
      color: "var(--color-gold)",
    },
    {
      label: "Occupied",
      value: fmt(s?.occupied_units),
      icon: Users,
      color: "var(--color-green)",
    },
    {
      label: "Occupancy",
      value: fmtPct(s?.occupancy_pct),
      icon: PieChart,
      color: "#8B5CF6",
    },
    {
      label: "Gross Potential",
      value: fmtCurrency(s?.gross_potential),
      icon: TrendingUp,
      color: "#AB5505",
    },
    {
      label: "Actual Revenue",
      value: fmtCurrency(s?.actual_revenue),
      icon: DollarSign,
      color: "var(--color-green)",
    },
    {
      label: "Delinquency",
      value: fmtPct(s?.delinquency_pct),
      icon: AlertTriangle,
      color:
        s?.delinquency_pct && Number(s.delinquency_pct) > 10
          ? "#EF4444"
          : "#AB5505",
    },
  ];

  const maxOcc = Math.max(
    ...trend.map((t) => Number(t.occupancy_pct ?? 0)),
    100
  );

  return (
    <div className="space-y-6">
      {/* Snapshot date badge */}
      {s && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-mid-gray)]">
          <CalendarDays className="w-3.5 h-3.5" />
          Snapshot: {fmtDate(s.snapshot_date)}
          {s.move_ins_mtd != null && (
            <span className="ml-4 text-green-400">
              +{s.move_ins_mtd} move-ins MTD
            </span>
          )}
          {s.move_outs_mtd != null && (
            <span className="text-red-400">
              -{s.move_outs_mtd} move-outs MTD
            </span>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                <span className="text-xs text-[var(--color-mid-gray)]">{kpi.label}</span>
              </div>
              <div className="text-xl font-semibold text-[var(--color-dark)]">
                {kpi.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      {trend.length > 1 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
          <h3 className="text-sm font-medium text-[var(--color-dark)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--color-gold)]" />
            Occupancy Trend (Last {trend.length} Snapshots)
          </h3>
          <div className="flex items-end gap-2 h-40">
            {trend.map((t, i) => {
              const pct = Number(t.occupancy_pct ?? 0);
              const height = maxOcc > 0 ? (pct / maxOcc) * 100 : 0;
              return (
                <div
                  key={t.id || i}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] text-[var(--color-body-text)]">
                    {fmtPct(pct)}
                  </span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${height}%`,
                      backgroundColor:
                        pct >= 90
                          ? "var(--color-green)"
                          : pct >= 75
                            ? "#AB5505"
                            : "#EF4444",
                      minHeight: "4px",
                    }}
                  />
                  <span className="text-[9px] text-[var(--color-mid-gray)] truncate w-full text-center">
                    {fmtShortDate(t.snapshot_date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!s && (
        <div className="text-center py-12 text-[var(--color-mid-gray)]">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No PMS snapshot data available yet.</p>
          <p className="text-xs mt-1">
            Upload a rent roll in the Upload tab to get started.
          </p>
        </div>
      )}
    </div>
  );
}
