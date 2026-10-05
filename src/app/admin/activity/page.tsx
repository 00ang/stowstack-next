"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import {
  Activity,
  UserPlus,
  Megaphone,
  DollarSign,
  Server,
  Filter,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  timestamp: string;
  type: string;
  category: "leads" | "campaigns" | "billing" | "system";
  description: string;
  actor: string;
  detail: string;
}

const TYPE_FILTERS = [
  { key: "all", label: "All", icon: Activity },
  { key: "leads", label: "Leads", icon: UserPlus },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "billing", label: "Billing", icon: DollarSign },
  { key: "system", label: "System", icon: Server },
] as const;

const TYPE_COLORS: Record<string, string> = {
  leads: "#22C55E",
  campaigns: "var(--color-gold)",
  billing: "#EAB308",
  system: "var(--color-mid-gray)",
};

const TYPE_ICONS: Record<string, typeof Activity> = {
  leads: UserPlus,
  campaigns: Megaphone,
  billing: DollarSign,
  system: Server,
};

function EntrySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-lg p-4 animate-pulse"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        >
          <div className="h-8 w-8 rounded-full bg-[var(--color-dark)]/5 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-[var(--color-dark)]/5" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-dark)]/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [allEntries, setAllEntries] = useState<ActivityEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const params: Record<string, string> = { limit: "50", offset: String(offset) };
  if (typeFilter !== "all") params.type = typeFilter;

  const { data: rawData, loading, error } = useAdminFetch<{ logs: ActivityEntry[] }>(
    "/api/activity-log",
    params
  );
  useEffect(() => {
    if (rawData) {
      const data = rawData.logs ?? [];
      if (offset === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAllEntries(data);
      } else {
        setAllEntries((prev) => [...prev, ...data]);
      }
      setHasMore(data.length === 50);
      setLoadingMore(false);
    }
  }, [rawData, offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffset(0);
    setAllEntries([]);
    setHasMore(true);
  }, [typeFilter]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      setOffset((prev) => prev + 50);
    }
  }, [loadingMore, hasMore, loading]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>
          Activity Log
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-mid-gray)" }}>
          System-wide event history
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={14} style={{ color: "var(--color-mid-gray)" }} />
        {TYPE_FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = typeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: isActive ? "var(--color-gold)" : "var(--color-light-gray)",
                color: isActive ? "var(--color-light)" : "var(--color-mid-gray)",
              }}
            >
              <Icon size={12} />
              {f.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div
          className="rounded-lg border p-4 text-sm"
          style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}
        >
          Failed to load activity: {error}
        </div>
      )}

      {loading && offset === 0 ? (
        <EntrySkeleton />
      ) : allEntries.length > 0 ? (
        <div className="space-y-2">
          {allEntries.map((entry) => {
            const bucket = entry.category || entry.type;
            const color = TYPE_COLORS[bucket] || "var(--color-mid-gray)";
            const Icon = TYPE_ICONS[bucket] || Activity;
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 rounded-lg p-4 transition-colors hover:bg-[var(--color-light-gray)]"
                style={{ backgroundColor: "var(--bg-elevated)" }}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon size={14} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--color-dark)" }}>
                    {entry.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: "var(--color-mid-gray)" }}>
                    {entry.actor && <span>{entry.actor}</span>}
                    {entry.detail && (
                      <>
                        <span>&#183;</span>
                        <span>{entry.detail}</span>
                      </>
                    )}
                    <span>&#183;</span>
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore && (
                <div className="h-6 w-6 border-2 border-[var(--color-blue)] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16">
          <Activity size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
          <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>No activity entries found</p>
        </div>
      )}
    </div>
  );
}
