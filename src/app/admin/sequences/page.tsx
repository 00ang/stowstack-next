"use client";

import { useState, useCallback } from "react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import {
  Mail,
  Play,
  Pause,
  XCircle,
  Filter,
  Clock,
  CheckCircle,
  ChevronRight,
  Plus,
  Zap,
} from "lucide-react";

interface SequenceTemplate {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    delayDays?: number;
    delayHours?: number;
    templateId: string;
    label: string;
  }>;
}

interface Drip {
  sequenceId: string;
  leadId: string;
  currentStep: number;
  status: "active" | "paused" | "completed" | "cancelled";
  enrolledAt: string;
  nextSendAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  history: unknown[];
  leadName: string;
  leadEmail: string;
  facilityName: string;
  leadStatus: string;
}

interface ApiData {
  sequences: SequenceTemplate[];
  drips: Drip[];
}

const STATUS_FILTERS = ["all", "active", "paused", "completed", "cancelled"] as const;

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof Mail }> = {
  active: { bg: "rgba(34,197,94,0.1)", text: "#22C55E", icon: Play },
  paused: { bg: "rgba(171,85,5,0.1)", text: "#AB5505", icon: Pause },
  completed: { bg: "rgba(68,99,134,0.1)", text: "var(--color-gold)", icon: CheckCircle },
  cancelled: { bg: "rgba(107,114,128,0.1)", text: "#6B7280", icon: XCircle },
};

function SequenceCard({
  template,
  dripCount,
  onEnroll,
}: {
  template: SequenceTemplate;
  dripCount: number;
  onEnroll: (seqId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-elevated)" }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap size={14} style={{ color: "var(--color-gold)" }} />
            <h3 className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
              {template.name}
            </h3>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--color-mid-gray)" }}>
            {template.description}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs" style={{ color: "var(--color-body-text)" }}>
              {template.steps.length} steps
            </span>
            <span className="text-xs" style={{ color: "var(--color-body-text)" }}>
              {dripCount} enrolled
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEnroll(template.id)}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: "rgba(68,99,134,0.1)", color: "var(--color-gold)" }}
          >
            <Plus size={12} />
            Enroll
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-[var(--color-dark)]/5 transition-colors"
          >
            <ChevronRight
              size={14}
              style={{
                color: "var(--color-mid-gray)",
                transform: expanded ? "rotate(90deg)" : "none",
                transition: "transform 0.15s",
              }}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div className="relative pl-4">
            {template.steps.map((step, i) => {
              const delay = step.delayDays
                ? `${step.delayDays}d`
                : step.delayHours
                  ? `${step.delayHours}h`
                  : "0";
              return (
                <div key={i} className="relative pb-3 last:pb-0">
                  {i < template.steps.length - 1 && (
                    <div
                      className="absolute left-0 top-3 w-px h-full"
                      style={{ backgroundColor: "var(--border-subtle)", transform: "translateX(-0.5px)" }}
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full shrink-0 -ml-1"
                      style={{ backgroundColor: "var(--color-gold)" }}
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--color-dark)" }}>
                        {step.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                        +{delay} delay
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EnrollModal({
  sequenceId,
  onClose,
  onSuccess,
}: {
  sequenceId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId.trim()) return;

    setLoading(true);
    setError("");
    try {
      await adminFetch("/api/drip-sequences", {
        method: "POST",
        body: JSON.stringify({ leadId: leadId.trim(), sequenceId }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--color-light)" }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--color-dark)" }}>
          Enroll in Sequence
        </h3>
        <form onSubmit={handleEnroll}>
          <label className="block text-xs font-medium mb-2" style={{ color: "var(--color-body-text)" }}>
            Facility ID (Lead)
          </label>
          <input
            type="text"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            placeholder="Paste facility UUID"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: "var(--color-light-gray)",
              color: "var(--color-dark)",
            }}
            autoFocus
          />
          {error && (
            <p className="text-xs mt-2" style={{ color: "#EF4444" }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg transition-colors"
              style={{ color: "var(--color-body-text)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !leadId.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--color-gold)", color: "var(--color-light)" }}
            >
              {loading ? "Enrolling..." : "Enroll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--bg-elevated)" }} />
      ))}
    </div>
  );
}

export default function SequencesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [enrollSequence, setEnrollSequence] = useState<string | null>(null);

  const { data: rawData, loading, error, refetch } = useAdminFetch<ApiData>(
    "/api/drip-sequences"
  );

  const templates = rawData?.sequences ?? [];
  const allDrips = rawData?.drips ?? [];
  const drips =
    statusFilter === "all"
      ? allDrips
      : allDrips.filter((d) => d.status === statusFilter);

  const handleAction = useCallback(
    async (leadId: string, action: "pause" | "resume" | "cancel") => {
      setActionLoading(leadId);
      try {
        if (action === "cancel") {
          await adminFetch("/api/drip-sequences", {
            method: "DELETE",
            body: JSON.stringify({ leadId }),
          });
        } else {
          await adminFetch("/api/drip-sequences", {
            method: "PATCH",
            body: JSON.stringify({ leadId, action }),
          });
        }
        refetch();
      } catch {
        // Silently handle errors
      } finally {
        setActionLoading(null);
      }
    },
    [refetch]
  );

  const activeCount = allDrips.filter((d) => d.status === "active").length;
  const pausedCount = allDrips.filter((d) => d.status === "paused").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>
          Email Sequences
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-mid-gray)" }}>
          Manage drip campaigns and automated nurture sequences
          {rawData && (
            <span className="ml-2">
              &#183; {activeCount} active, {pausedCount} paused
            </span>
          )}
        </p>
      </div>

      {/* Sequence templates */}
      {templates.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--color-body-text)" }}>
            Sequence Templates
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {templates.map((t) => (
              <SequenceCard
                key={t.id}
                template={t}
                dripCount={allDrips.filter((d) => d.sequenceId === t.id).length}
                onEnroll={setEnrollSequence}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drip enrollments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium" style={{ color: "var(--color-body-text)" }}>
            Active Enrollments
          </h2>
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: "var(--color-mid-gray)" }} />
            {STATUS_FILTERS.map((f) => {
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
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg border p-4 text-sm"
            style={{
              backgroundColor: "rgba(239,68,68,0.1)",
              borderColor: "rgba(239,68,68,0.2)",
              color: "#EF4444",
            }}
          >
            Failed to load sequences: {error}
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : drips.length > 0 ? (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Lead
                  </th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Sequence
                  </th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Progress
                  </th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Next Send
                  </th>
                  <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Status
                  </th>
                  <th className="text-right text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {drips.map((drip) => {
                  const style = STATUS_STYLES[drip.status] || STATUS_STYLES.cancelled;
                  const StatusIcon = style.icon;
                  const isLoading = actionLoading === drip.leadId;
                  const template = templates.find((t) => t.id === drip.sequenceId);
                  const totalSteps = template?.steps.length || 1;
                  const progress = Math.round((drip.currentStep / totalSteps) * 100);

                  return (
                    <tr
                      key={drip.leadId}
                      className="border-t transition-colors hover:bg-[var(--color-light-gray)]"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm" style={{ color: "var(--color-dark)" }}>
                            {drip.leadName}
                          </div>
                          <div className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                            {drip.leadEmail || drip.facilityName}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>
                        {template?.name || drip.sequenceId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 h-1.5 rounded-full max-w-[80px]"
                            style={{ backgroundColor: "var(--color-light-gray)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: "var(--color-gold)",
                              }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                            {drip.currentStep}/{totalSteps}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>
                        {drip.nextSendAt ? (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(drip.nextSendAt).toLocaleDateString()}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon size={12} style={{ color: style.text }} />
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                            style={{ backgroundColor: style.bg, color: style.text }}
                          >
                            {drip.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {drip.status === "active" && (
                            <button
                              onClick={() => handleAction(drip.leadId, "pause")}
                              disabled={isLoading}
                              className="p-1.5 rounded-lg hover:bg-[var(--color-dark)]/5 transition-colors disabled:opacity-50"
                              title="Pause"
                            >
                              <Pause size={14} style={{ color: "#AB5505" }} />
                            </button>
                          )}
                          {drip.status === "paused" && (
                            <button
                              onClick={() => handleAction(drip.leadId, "resume")}
                              disabled={isLoading}
                              className="p-1.5 rounded-lg hover:bg-[var(--color-dark)]/5 transition-colors disabled:opacity-50"
                              title="Resume"
                            >
                              <Play size={14} style={{ color: "#22C55E" }} />
                            </button>
                          )}
                          {(drip.status === "active" || drip.status === "paused") && (
                            <button
                              onClick={() => handleAction(drip.leadId, "cancel")}
                              disabled={isLoading}
                              className="p-1.5 rounded-lg hover:bg-[var(--color-dark)]/5 transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <XCircle size={14} style={{ color: "#EF4444" }} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <Mail size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
            <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
              {statusFilter === "all" ? "No email sequences found" : `No ${statusFilter} sequences`}
            </p>
          </div>
        )}
      </div>

      {enrollSequence && (
        <EnrollModal
          sequenceId={enrollSequence}
          onClose={() => setEnrollSequence(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
