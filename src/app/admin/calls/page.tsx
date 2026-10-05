"use client";

import { useState } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { useFacility } from "@/lib/facility-context";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Clock,
  Voicemail,
  Filter,
} from "lucide-react";

interface CallStats {
  total_calls: number;
  completed: number;
  avg_duration: number;
  missed_pct: number;
}

interface CallLog {
  id: string;
  date: string;
  caller_number: string;
  facility: string;
  duration: number;
  status: "completed" | "missed" | "voicemail";
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Phone; label: string }> = {
  completed: { color: "#22C55E", icon: PhoneCall, label: "Completed" },
  missed: { color: "#EF4444", icon: PhoneMissed, label: "Missed" },
  voicemail: { color: "#AB5505", icon: Voicemail, label: "Voicemail" },
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border p-5 animate-pulse"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <div className="h-3 w-20 rounded bg-[var(--color-dark)]/5 mb-3" />
          <div className="h-8 w-16 rounded bg-[var(--color-dark)]/5" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
      ))}
    </div>
  );
}

export default function CallsPage() {
  const { current } = useFacility();
  const facilityFilter = current === "all" ? "" : current.name;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const logParams: Record<string, string> = {};
  if (facilityFilter) logParams.facility = facilityFilter;
  if (dateFrom) logParams.date_from = dateFrom;
  if (dateTo) logParams.date_to = dateTo;

  const { data: rawStats, loading: statsLoading, error: statsError } =
    useAdminFetch<{ stats: CallStats; byNumber: unknown[] }>("/api/call-logs", { summary: "true" });
  const stats = rawStats?.stats ?? null;

  const { data: rawLogs, loading: logsLoading, error: logsError } =
    useAdminFetch<{ logs: CallLog[]; total: number; page: number; pages: number }>("/api/call-logs", logParams);
  const logs = rawLogs?.logs ?? [];

  const kpis = stats
    ? [
        { label: "Total Calls", value: stats.total_calls.toLocaleString(), icon: Phone, color: "var(--color-gold)" },
        { label: "Completed", value: stats.completed.toLocaleString(), icon: PhoneCall, color: "#22C55E" },
        { label: "Avg Duration", value: formatDuration(stats.avg_duration), icon: Clock, color: "#AB5505" },
        { label: "Missed %", value: `${stats.missed_pct.toFixed(1)}%`, icon: PhoneOff, color: "#EF4444" },
      ]
    : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>Call Tracking</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-mid-gray)" }}>Monitor and analyze call activity</p>
      </div>

      {statsError && (
        <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
          Failed to load call stats: {statsError}
        </div>
      )}

      {statsLoading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-xl border p-5"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} style={{ color: kpi.color }} />
                  <span className="text-xs font-medium" style={{ color: "var(--color-mid-gray)" }}>{kpi.label}</span>
                </div>
                <p className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>{kpi.value}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Filter size={14} style={{ color: "var(--color-mid-gray)" }} />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none"
            style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
            placeholder="To"
          />
        </div>

        {logsError && (
          <p className="text-sm mb-4" style={{ color: "#EF4444" }}>Failed to load call logs: {logsError}</p>
        )}

        {logsLoading ? (
          <TableSkeleton />
        ) : logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Date/Time</th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Caller</th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Facility</th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Duration</th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.completed;
                  const Icon = config.icon;
                  return (
                    <tr
                      key={log.id}
                      className="border-t transition-colors hover:bg-[var(--color-light-gray)]"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>
                        {new Date(log.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" style={{ color: "var(--color-dark)" }}>
                        {log.caller_number}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-dark)" }}>
                        {log.facility || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>
                        {formatDuration(log.duration)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon size={12} style={{ color: config.color }} />
                          <span className="text-xs font-medium" style={{ color: config.color }}>
                            {config.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Phone size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
            <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>No call logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
