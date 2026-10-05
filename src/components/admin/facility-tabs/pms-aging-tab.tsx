"use client";

import { useMemo } from "react";
import { AlertTriangle, BarChart3 } from "lucide-react";
import type { PmsData } from "./pms-dashboard-types";
import { fmtCurrency } from "./pms-dashboard-types";

export function AgingTab({ data }: { data: PmsData }) {
  const rows = data.aging;

  const buckets = useMemo(() => {
    const b = {
      b0_30: 0,
      b31_60: 0,
      b61_90: 0,
      b91_120: 0,
      b120_plus: 0,
      total: 0,
    };
    for (const r of rows) {
      b.b0_30 += Number(r.bucket_0_30) || 0;
      b.b31_60 += Number(r.bucket_31_60) || 0;
      b.b61_90 += Number(r.bucket_61_90) || 0;
      b.b91_120 += Number(r.bucket_91_120) || 0;
      b.b120_plus += Number(r.bucket_120_plus) || 0;
      b.total += Number(r.total) || 0;
    }
    return b;
  }, [rows]);

  const maxBucket = Math.max(
    buckets.b0_30,
    buckets.b31_60,
    buckets.b61_90,
    buckets.b91_120,
    buckets.b120_plus,
    1
  );

  const bucketData = [
    { label: "0-30 days", value: buckets.b0_30, color: "var(--color-green)" },
    { label: "31-60 days", value: buckets.b31_60, color: "#AB5505" },
    { label: "61-90 days", value: buckets.b61_90, color: "#F97316" },
    { label: "91-120 days", value: buckets.b91_120, color: "#EF4444" },
    { label: "120+ days", value: buckets.b120_plus, color: "#DC2626" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="text-xs text-[var(--color-mid-gray)] mb-1">
            Total Outstanding
          </div>
          <div className="text-2xl font-semibold text-[var(--color-dark)]">
            {fmtCurrency(buckets.total)}
          </div>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="text-xs text-[var(--color-mid-gray)] mb-1">
            Delinquent Accounts
          </div>
          <div className="text-2xl font-semibold text-[var(--color-dark)]">
            {rows.length}
          </div>
        </div>
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="text-xs text-[var(--color-mid-gray)] mb-1">
            Avg Outstanding
          </div>
          <div className="text-2xl font-semibold text-[var(--color-dark)]">
            {rows.length > 0
              ? fmtCurrency(buckets.total / rows.length)
              : "—"}
          </div>
        </div>
      </div>

      {/* Bucket distribution bars */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[var(--color-dark)] mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--color-gold)]" />
          Aging Distribution
        </h3>
        <div className="space-y-3">
          {bucketData.map((b) => {
            const pct = maxBucket > 0 ? (b.value / maxBucket) * 100 : 0;
            return (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-body-text)] w-24 shrink-0">
                  {b.label}
                </span>
                <div className="flex-1 h-6 bg-[var(--color-light-gray)] rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: b.color,
                      minWidth: b.value > 0 ? "4px" : "0",
                    }}
                  />
                </div>
                <span className="text-xs text-[var(--color-dark)] font-medium w-24 text-right">
                  {fmtCurrency(b.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-light-gray)]">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                  Unit
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                  Tenant
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  0-30
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  31-60
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  61-90
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  91-120
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  120+
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--color-light-gray)] transition">
                  <td className="px-3 py-2 text-[var(--color-dark)] font-mono text-xs">
                    {r.unit}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-dark)]">
                    {r.tenant_name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-body-text)]">
                    {fmtCurrency(r.bucket_0_30)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-body-text)]">
                    {fmtCurrency(r.bucket_31_60)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-body-text)]">
                    {fmtCurrency(r.bucket_61_90)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-body-text)]">
                    {fmtCurrency(r.bucket_91_120)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-400">
                    {fmtCurrency(r.bucket_120_plus)}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--color-dark)] font-medium">
                    {fmtCurrency(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--color-light-gray)] border-t border-[var(--border-subtle)]">
                <td
                  colSpan={2}
                  className="px-3 py-2.5 text-xs font-medium text-[var(--color-body-text)]"
                >
                  Totals
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-[var(--color-body-text)]">
                  {fmtCurrency(buckets.b0_30)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-[var(--color-body-text)]">
                  {fmtCurrency(buckets.b31_60)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-[var(--color-body-text)]">
                  {fmtCurrency(buckets.b61_90)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-[var(--color-body-text)]">
                  {fmtCurrency(buckets.b91_120)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-red-400">
                  {fmtCurrency(buckets.b120_plus)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-[var(--color-dark)]">
                  {fmtCurrency(buckets.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {rows.length === 0 && (
        <div className="text-center py-12 text-[var(--color-mid-gray)]">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No aging data available yet.</p>
        </div>
      )}
    </div>
  );
}
