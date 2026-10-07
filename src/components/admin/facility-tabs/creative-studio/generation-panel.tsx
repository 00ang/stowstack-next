"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { GenerationPlatform } from "./types";
import { GENERATION_OPTIONS } from "./types";
import { useToolFocus } from "@/components/ontology/tool-focus";

export function GenerationPanel({
  generating,
  genPlatform,
  hasVariations,
  onGenerate,
}: {
  generating: boolean;
  genPlatform: GenerationPlatform | null;
  hasVariations: boolean;
  onGenerate: (platform: GenerationPlatform, feedback?: string) => void;
}) {
  // Opened from an object (a unit, an offer…)? Start with its facts as the
  // direction, so the owner edits a sentence instead of writing one.
  const focus = useToolFocus();
  const seeded = focus ? `Feature this. ${focus.brief}` : "";
  const [showRegenInput, setShowRegenInput] = useState(!!seeded);
  const [regenFeedback, setRegenFeedback] = useState(seeded);

  /* Regenerate with notes */
  if (showRegenInput) {
    return (
      <div className="border border-[var(--border-subtle)] rounded-xl p-4 bg-[var(--bg-elevated)] space-y-3">
        <label className="text-xs font-medium text-[var(--color-body-text)] block">Direction for new variations</label>
        <textarea
          value={regenFeedback}
          onChange={(e) => setRegenFeedback(e.target.value)}
          placeholder="e.g., More urgency, mention the spring special, target families..."
          rows={2}
          className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
        />
        <div className="flex flex-wrap gap-2">
          {GENERATION_OPTIONS.filter((o) => o.id !== "all").map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onGenerate(opt.id, regenFeedback || undefined);
                setShowRegenInput(false);
                setRegenFeedback("");
              }}
              disabled={generating}
              className="px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold-hover)] disabled:opacity-40 whitespace-nowrap transition-colors"
            >
              {generating && genPlatform === opt.id ? "Generating..." : `${opt.icon} ${opt.label}`}
            </button>
          ))}
          <button
            onClick={() => { setShowRegenInput(false); setRegenFeedback(""); }}
            className="px-3 py-1.5 text-xs text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* Generation buttons */
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {GENERATION_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onGenerate(opt.id)}
            disabled={generating}
            className={`flex flex-col items-start p-4 border rounded-xl transition-all ${
              generating && genPlatform === opt.id
                ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10"
                : "border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:bg-[var(--color-light-gray)]"
            } disabled:opacity-50`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{opt.icon}</span>
              <span className="text-sm font-semibold text-[var(--color-dark)]">{opt.label}</span>
            </div>
            <span className="text-[11px] text-[var(--color-mid-gray)] leading-snug">
              {generating && genPlatform === opt.id ? (
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Generating...
                </span>
              ) : (
                opt.desc
              )}
            </span>
          </button>
        ))}
      </div>
      {hasVariations && (
        <button
          onClick={() => setShowRegenInput(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw size={12} /> Regenerate with Notes
        </button>
      )}
    </div>
  );
}
