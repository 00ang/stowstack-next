"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import {
  UserPlus,
  Mail,
  Phone,
  MapPin,
  Filter,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Gauge,
  Globe,
  Loader2,
  Send,
  Route,
} from "lucide-react";

interface ConsumerLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  facility: string;
  status: "new" | "contacted" | "toured" | "reserved" | "moved_in" | "lost";
  lead_score: number;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  notes: string[];
}

const STATUS_OPTIONS = ["new", "contacted", "toured", "reserved", "moved_in", "lost"] as const;
const FILTER_OPTIONS = ["all", ...STATUS_OPTIONS] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  new: { bg: "rgba(68,99,134,0.1)", text: "var(--color-gold)" },
  contacted: { bg: "rgba(139,92,246,0.1)", text: "#8B5CF6" },
  toured: { bg: "rgba(171,85,5,0.1)", text: "#AB5505" },
  reserved: { bg: "rgba(249,115,22,0.1)", text: "#F97316" },
  moved_in: { bg: "rgba(34,197,94,0.1)", text: "#22C55E" },
  lost: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
};

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.new;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ConsumerLeadsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const params: Record<string, string> = {};
  if (statusFilter !== "all") params.status = statusFilter;

  const { data: rawData, loading, error, refetch } =
    useAdminFetch<{ leads: ConsumerLead[] }>("/api/consumer-leads", params);
  const leads = rawData?.leads ?? [];

  const handleStatusChange = useCallback(
    async (id: string, newStatus: string) => {
      setActionLoading(id);
      try {
        await adminFetch(`/api/consumer-leads`, {
          method: "PATCH",
          body: JSON.stringify({ leadId: id, status: newStatus }),
        });
        refetch();
      } catch {
        // Handled silently
      } finally {
        setActionLoading(null);
      }
    },
    [refetch]
  );

  const handleAddNote = useCallback(
    async (id: string) => {
      if (!noteText.trim()) return;
      setActionLoading(id);
      try {
        await adminFetch(`/api/consumer-leads`, {
          method: "PATCH",
          body: JSON.stringify({ leadId: id, action: "add_note", note: noteText }),
        });
        setNoteText("");
        refetch();
      } catch {
        // Handled silently
      } finally {
        setActionLoading(null);
      }
    },
    [noteText, refetch]
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>Inbound Leads</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-mid-gray)" }}>
          Consumer-facing lead management
          {rawData && <span className="ml-1">&#183; {leads.length} leads</span>}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} style={{ color: "var(--color-mid-gray)" }} />
        {FILTER_OPTIONS.map((f) => {
          const isActive = statusFilter === f;
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors capitalize"
              style={{
                backgroundColor: isActive ? "var(--color-gold)" : "var(--color-light-gray)",
                color: isActive ? "var(--color-light)" : "var(--color-mid-gray)",
              }}
            >
              {f.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
          Failed to load leads: {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : leads.length > 0 ? (
        <div className="space-y-2">
          {leads.map((lead) => {
            const isExpanded = expandedId === lead.id;
            const isLoading = actionLoading === lead.id;

            return (
              <div
                key={lead.id}
                className="rounded-xl border overflow-hidden"
                style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-light-gray)] transition-colors"
                >
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <span className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>{lead.name}</span>
                    <StatusBadge status={lead.status} />
                    <div className="flex items-center gap-1">
                      <Gauge size={12} style={{ color: "var(--color-mid-gray)" }} />
                      <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>{lead.lead_score}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {lead.facility && (
                      <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                        <MapPin size={10} className="inline mr-1" />
                        {lead.facility}
                      </span>
                    )}
                    {lead.source && (
                      <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                        <Globe size={10} className="inline mr-1" />
                        {lead.source}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown size={16} style={{ color: "var(--color-mid-gray)" }} />
                    ) : (
                      <ChevronRight size={16} style={{ color: "var(--color-mid-gray)" }} />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t space-y-4" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} style={{ color: "var(--color-mid-gray)" }} />
                        <span style={{ color: "var(--color-dark)" }}>{lead.email || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} style={{ color: "var(--color-mid-gray)" }} />
                        <span style={{ color: "var(--color-dark)" }}>{lead.phone || "N/A"}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--color-mid-gray)" }}>Created: </span>
                        <span style={{ color: "var(--color-dark)" }}>{new Date(lead.created_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
                      <div className="flex flex-wrap gap-2">
                        {lead.utm_source && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-light-gray)", color: "var(--color-body-text)" }}>
                            source: {lead.utm_source}
                          </span>
                        )}
                        {lead.utm_medium && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-light-gray)", color: "var(--color-body-text)" }}>
                            medium: {lead.utm_medium}
                          </span>
                        )}
                        {lead.utm_campaign && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "var(--color-light-gray)", color: "var(--color-body-text)" }}>
                            campaign: {lead.utm_campaign}
                          </span>
                        )}
                      </div>
                    )}

                    <Link
                      href={`/admin/consumer-leads/${lead.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium"
                      style={{ color: "var(--color-dark)" }}
                    >
                      <Route size={12} aria-hidden />
                      View journey — every visit, call and report
                    </Link>

                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>Update Status:</span>
                      <select
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        disabled={isLoading}
                        className="rounded-lg border px-2 py-1 text-xs outline-none disabled:opacity-50"
                        style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                      {isLoading && <Loader2 size={12} className="animate-spin" style={{ color: "var(--color-gold)" }} />}
                    </div>

                    {lead.notes && lead.notes.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium mb-2" style={{ color: "var(--color-mid-gray)" }}>
                          <MessageSquare size={10} className="inline mr-1" />
                          Notes
                        </h4>
                        <div className="space-y-1.5">
                          {lead.notes.map((note, idx) => (
                            <p key={idx} className="text-xs rounded-lg p-2" style={{ backgroundColor: "var(--color-light)", color: "var(--color-body-text)" }}>
                              {note}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add a note..."
                        value={expandedId === lead.id ? noteText : ""}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddNote(lead.id);
                        }}
                        className="flex-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
                        style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
                      />
                      <button
                        onClick={() => handleAddNote(lead.id)}
                        disabled={isLoading || !noteText.trim()}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "rgba(68,99,134,0.1)", color: "var(--color-gold)" }}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <UserPlus size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
          <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
            {statusFilter === "all" ? "No consumer leads yet" : `No ${statusFilter.replace(/_/g, " ")} leads`}
          </p>
        </div>
      )}
    </div>
  );
}
