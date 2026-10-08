"use client";

import { useState } from "react";
import { VariationActions } from "./variation-actions";
import type { AdVariation, MetaAdContent } from "./types";
import { ANGLE_ICONS, VARIATION_STATUS_COLORS, CTA_OPTIONS } from "./types";

export function MetaVariationCard({
  v,
  adminKey,
  onUpdate,
  onDelete,
}: {
  v: AdVariation;
  adminKey: string;
  onUpdate: (updated: AdVariation) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const content = v.content_json as MetaAdContent;
  const [editFields, setEditFields] = useState(content);

  async function patchVariation(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/facility-creatives", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
        body: JSON.stringify({ variationId: v.id, ...body }),
      });
      const data = await res.json();
      if (data.variation) onUpdate(data.variation);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{ANGLE_ICONS[v.angle] || "📝"}</span>
          <span className="text-sm font-semibold text-[var(--color-dark)]">
            {content.angleLabel || v.angle}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${VARIATION_STATUS_COLORS[v.status] || "bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]"}`}
          >
            {v.status}
          </span>
          {v.compliance_status && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                v.compliance_status === "passed"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : v.compliance_status === "flagged"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
              }`}
            >
              {v.compliance_status === "passed" ? "✓ Compliant" : v.compliance_status === "flagged" ? "⚠ Review" : "✕ Violation"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-mid-gray)]">v{v.version}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]">
            Meta
          </span>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] px-4 py-4">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium uppercase text-[var(--color-mid-gray)] block mb-1">
                Primary Text
              </label>
              <textarea
                value={editFields.primaryText}
                onChange={(e) =>
                  setEditFields({ ...editFields, primaryText: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
              />
              <p
                className={`text-xs mt-0.5 ${editFields.primaryText.length > 125 ? "text-red-400" : "text-[var(--color-mid-gray)]"}`}
              >
                {editFields.primaryText.length}/125
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--color-mid-gray)] block mb-1">
                Headline
              </label>
              <input
                value={editFields.headline}
                onChange={(e) =>
                  setEditFields({ ...editFields, headline: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
              />
              <p
                className={`text-xs mt-0.5 ${editFields.headline.length > 40 ? "text-red-400" : "text-[var(--color-mid-gray)]"}`}
              >
                {editFields.headline.length}/40
              </p>
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-[var(--color-mid-gray)] block mb-1">
                Description
              </label>
              <input
                value={editFields.description}
                onChange={(e) =>
                  setEditFields({ ...editFields, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
              />
              <p
                className={`text-xs mt-0.5 ${editFields.description.length > 30 ? "text-red-400" : "text-[var(--color-mid-gray)]"}`}
              >
                {editFields.description.length}/30
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase text-[var(--color-mid-gray)] block mb-1">
                  CTA
                </label>
                <select
                  value={editFields.cta}
                  onChange={(e) =>
                    setEditFields({ ...editFields, cta: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
                >
                  {CTA_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-[var(--color-mid-gray)] block mb-1">
                  Targeting
                </label>
                <input
                  value={editFields.targetingNote}
                  onChange={(e) =>
                    setEditFields({
                      ...editFields,
                      targetingNote: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  patchVariation({
                    content_json: editFields,
                    status: "approved",
                  });
                  setEditing(false);
                }}
                disabled={saving}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                {saving ? "Saving..." : "Save & Approve"}
              </button>
              <button
                onClick={() => {
                  patchVariation({ content_json: editFields });
                  setEditing(false);
                }}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] disabled:opacity-40 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditFields(content);
                }}
                className="px-3 py-1.5 text-xs text-[var(--color-mid-gray)] hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg p-4 bg-[var(--color-light)]">
              <p className="text-sm leading-relaxed text-[var(--color-dark)]" style={{ fontFamily: 'var(--font-ad-body)' }}>
                {content.primaryText}
              </p>
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                <p className="text-xs uppercase tracking-wide text-[var(--color-mid-gray)]">
                  storageads.com
                </p>
                <p className="font-semibold text-sm text-[var(--color-dark)] mt-0.5" style={{ fontFamily: 'var(--font-ad-headline)' }}>
                  {content.headline}
                </p>
                {content.description && (
                  <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">{content.description}</p>
                )}
              </div>
              <div className="mt-3">
                <span className="text-xs px-2.5 py-1 rounded font-medium bg-[var(--color-light-gray)] text-[var(--color-body-text)]">
                  {content.cta}
                </span>
              </div>
            </div>

            {content.targetingNote && (
              <p className="text-[11px] text-[var(--color-mid-gray)] px-1">
                <span className="text-[var(--color-body-text)] font-medium">Targeting:</span> {content.targetingNote}
              </p>
            )}

            {v.compliance_flags && v.compliance_flags.length > 0 && (
              <div className={`p-3 rounded-lg border text-sm ${
                v.compliance_status === "failed"
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-amber-500/5 border-amber-500/20"
              }`}>
                <p className={`font-medium text-xs uppercase tracking-wide mb-2 ${
                  v.compliance_status === "failed" ? "text-red-400" : "text-amber-400"
                }`}>
                  {v.compliance_status === "failed" ? "Policy Violations" : "Compliance Review Needed"}
                </p>
                <ul className="space-y-1.5">
                  {v.compliance_flags.map((flag, i) => (
                    <li key={i} className="text-xs">
                      <span className={`font-medium ${flag.severity === "violation" ? "text-red-300" : "text-amber-300"}`}>
                        {flag.rule}
                      </span>
                      <span className="text-[var(--color-body-text)]"> ({flag.field}): </span>
                      <span className="text-[var(--color-mid-gray)]">{flag.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {v.feedback && (
              <div className="border-l-2 border-[var(--color-red)] bg-[var(--bg-elevated)] p-3 text-sm font-medium text-[var(--color-dark)]">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Reviewer&apos;s note</div>
                {v.feedback}
              </div>
            )}

            {rejecting && (
              <div className="space-y-2">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What needs to change? Be specific so we can regenerate better copy..."
                  rows={3}
                  className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      patchVariation({ status: "rejected", feedback });
                      setRejecting(false);
                      setFeedback("");
                    }}
                    disabled={!feedback.trim() || saving}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
                  >
                    {saving ? "..." : "Reject with Notes"}
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(false);
                      setFeedback("");
                    }}
                    className="px-3 py-1.5 text-xs text-[var(--color-mid-gray)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <VariationActions
              v={v}
              saving={saving}
              onApprove={() => patchVariation({ status: "approved" })}
              onEdit={() => setEditing(true)}
              onReject={() => setRejecting(true)}
              onUnapprove={() => patchVariation({ status: "draft" })}
              onDelete={() => onDelete(v.id)}
              rejecting={rejecting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
