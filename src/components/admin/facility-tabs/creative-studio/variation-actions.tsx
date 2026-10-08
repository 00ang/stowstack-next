"use client";

import { Trash2 } from "lucide-react";
import type { AdVariation } from "./types";

export function VariationActions({
  v,
  saving,
  onApprove,
  onEdit,
  onReject,
  onUnapprove,
  onDelete,
  rejecting,
}: {
  v: AdVariation;
  saving: boolean;
  onApprove: () => void;
  onEdit?: () => void;
  onReject: () => void;
  onUnapprove: () => void;
  onDelete: () => void;
  rejecting: boolean;
}) {
  if (v.status === "published" || rejecting) return null;

  return (
    <div className="flex gap-2 pt-1 border-t border-[var(--border-subtle)]">
      {v.status !== "approved" && (
        <button
          onClick={onApprove}
          disabled={saving || v.compliance_status === "failed"}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:bg-[var(--ic-soft)] disabled:text-[var(--ic-secondary)] transition-colors"
        >
          {saving ? "..." : "Approve"}
        </button>
      )}
      {onEdit && (
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] transition-colors"
        >
          Edit
        </button>
      )}
      {v.status !== "rejected" && (
        <button
          onClick={onReject}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Reject
        </button>
      )}
      {v.status === "approved" && (
        <button
          onClick={onUnapprove}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] disabled:bg-[var(--ic-soft)] disabled:text-[var(--ic-secondary)] transition-colors"
        >
          Unapprove
        </button>
      )}
      <button
        onClick={onDelete}
        disabled={saving}
        aria-label="Delete variation"
        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--color-mid-gray)] hover:text-red-400 hover:border-red-500/20 disabled:bg-[var(--ic-soft)] disabled:text-[var(--ic-secondary)] transition-colors ml-auto"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
