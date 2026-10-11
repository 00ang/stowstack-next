"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { LEAD_STEP_IDS, STEP_LABELS, type LeadStep, type LeadStepId } from "@/lib/lead-step";
import { LeadStepMark } from "@/components/admin/lead-step-mark";

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  facilityName: string;
  location: string;
  createdAt: string;
  step: LeadStep;
}

interface LeadStepsResponse {
  leads: LeadRow[];
  counts: Record<LeadStepId, number>;
  total: number;
  truncated: boolean;
}

const FILTERS: Array<LeadStepId | "all"> = ["all", ...LEAD_STEP_IDS];

export function LeadStepBoard() {
  const { data, loading, error, refetch } = useAdminFetch<LeadStepsResponse>("/api/admin-lead-steps");
  const [filter, setFilter] = useState<LeadStepId | "all">("all");

  const groups = useMemo(() => {
    const leads = data?.leads ?? [];
    const grouped = LEAD_STEP_IDS.map((id) => ({
      id,
      label: STEP_LABELS[id],
      leads: leads
        .filter((lead) => lead.step.id === id)
        .sort((a, b) => {
          const days = (b.step.stuckDays ?? -1) - (a.step.stuckDays ?? -1);
          if (days !== 0) return days;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    }));
    if (filter === "all") return grouped.filter((group) => group.leads.length > 0);
    const one = grouped.find((group) => group.id === filter);
    return one && one.leads.length > 0 ? [one] : [];
  }, [data, filter]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-dark)]">Lead nurture</h2>
          <p className="mt-0.5 text-xs text-[var(--color-mid-gray)]">
            Where each lead stopped. Counts come from the leads below.
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="rounded-xl border border-[var(--border-subtle)] p-2 hover:bg-[var(--color-light-gray)]"
          aria-label="Reload lead steps"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[var(--color-body-text)]" />
        </button>
      </div>

      {error && (
        <div role="alert" className="border-l-2 border-[var(--color-red)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--color-dark)]">
          Couldn&apos;t load lead steps. {error}
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-[var(--color-mid-gray)]">Loading lead steps…</p>
      )}

      {data && (
        <>
          {data.truncated && (
            <p className="text-xs text-[var(--color-mid-gray)]">
              Showing the {data.leads.length} newest of {data.total} facilities. Counts are for the rows shown.
            </p>
          )}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {FILTERS.map((id) => {
              const active = filter === id;
              const count = id === "all" ? data.leads.length : data.counts[id] ?? 0;
              const label = id === "all" ? "All" : STEP_LABELS[id];
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(id)}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{
                    borderColor: active ? "var(--color-dark)" : "var(--border-subtle)",
                    background: active ? "var(--color-dark)" : "transparent",
                    color: active ? "var(--color-light)" : "var(--color-body-text)",
                  }}
                >
                  {label} {count}
                </button>
              );
            })}
          </div>

          {groups.length === 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-8 text-center text-sm text-[var(--color-mid-gray)]">
              {data.leads.length === 0 ? "No leads on file." : "No leads at this step."}
            </div>
          )}

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
                  {group.label} · {group.leads.length}
                </h3>
                <ul className="space-y-2">
                  {group.leads.map((lead) => (
                    <li
                      key={lead.id}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 sm:p-4"
                    >
                      <div className="mb-3 min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-dark)]">
                          {lead.name || "No name"}
                        </p>
                        <p className="truncate text-xs text-[var(--color-mid-gray)]">
                          {[lead.facilityName, lead.location].filter(Boolean).join(" · ") || "No facility name"}
                        </p>
                        <p className="truncate text-xs text-[var(--color-body-text)]">
                          {[lead.email, lead.phone].filter(Boolean).join(" · ") || "No email or phone"}
                        </p>
                      </div>
                      <LeadStepMark step={lead.step} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
