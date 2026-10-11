"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { ActionFill } from "@/components/ontology/action-fill";
import { CATALOG } from "@/lib/funnel-graph";
import { graphForSuggestion, type FunnelSuggestion } from "@/lib/diagnose/suggest";
import type { FunnelContext, FunnelGoal } from "@/lib/funnel-graph";
import { NodeIcon } from "./icons";

/**
 * Suggested for you. Ranked by how far off the facility is, from its own
 * numbers. Building one opens a draft. Nothing publishes from here.
 */

function Path({ suggestion, goal, ctx }: { suggestion: FunnelSuggestion; goal: FunnelGoal | null; ctx: FunnelContext }) {
  const graph = useMemo(
    () => graphForSuggestion(suggestion, goal, ctx),
    [suggestion, goal, ctx],
  );
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Steps in this funnel">
      {graph.nodes.map((node, i) => {
        const def = CATALOG[node.type];
        return (
          <li key={node.id} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-[12px] text-[var(--ic-instruction)]">→</span>}
            <span className="inline-flex items-center gap-1 border border-[var(--ic-ink)]/25 bg-[var(--ic-pane)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--ic-ink)]">
              <NodeIcon name={def.icon} className="h-3.5 w-3.5" color={def.hue} />
              {def.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function SuggestedForYou({
  suggestions,
  nudges,
  changeLine,
  sample,
  loading,
  creatingId,
  error,
  goal,
  ctx,
  onBuild,
  onDismiss,
}: {
  suggestions: FunnelSuggestion[];
  nudges: string[];
  changeLine: string | null;
  sample: boolean;
  loading: boolean;
  creatingId: string | null;
  error: string | null;
  goal: FunnelGoal | null;
  ctx: FunnelContext;
  onBuild: (suggestion: FunnelSuggestion) => void;
  onDismiss: (suggestion: FunnelSuggestion) => void;
}) {
  if (loading && suggestions.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2 text-[14px] font-semibold text-[var(--ic-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading what we know…
      </div>
    );
  }
  if (suggestions.length === 0 && nudges.length === 0 && !changeLine) return null;

  return (
    <div role="region" aria-labelledby="suggested-heading" className="border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
      <div className="border-b border-[var(--ic-ink)] px-5 py-4">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">From what you've shared</div>
        <h2 id="suggested-heading" className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--ic-ink)]">
          Suggested for you
        </h2>
        <p className="mt-1 text-[14px] font-semibold leading-snug text-[var(--ic-secondary)]">
          Each one is a draft aimed at a gap. Nothing goes live, and nothing spends, until you publish.
        </p>
        {sample && <div className="ic-label mt-2 text-[10px] text-[var(--ic-instruction)]">Sample facility · counts are sample</div>}
        {changeLine && (
          <p className="mt-3 text-[14px] font-semibold leading-snug text-[var(--ic-ink)]">
            <span className="ic-label mb-1 block text-[10px] text-[var(--ic-instruction)]">Why this changed</span>
            {changeLine}
          </p>
        )}
      </div>
      <ul>
        {suggestions.map((suggestion) => (
          <li key={suggestion.id} className="border-b border-[var(--ic-ink)]/15 px-5 py-4 last:border-b-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[18px] font-extrabold leading-tight text-[var(--ic-ink)]">{suggestion.name}</h3>
              <span className="ic-label text-[10px] text-[var(--ic-instruction)]">{suggestion.confidenceLabel}</span>
            </div>
            <p className="mt-1 text-[14px] font-semibold text-[var(--ic-secondary)]">
              For {suggestion.targets.charAt(0).toLowerCase() + suggestion.targets.slice(1)}.
            </p>
            <ul className="mt-2 space-y-1">
              {suggestion.why.map((line) => (
                <li key={line.text} className="text-[14px] font-semibold leading-snug text-[var(--ic-ink)]">
                  {line.text}{" "}
                  <span className="text-[var(--ic-secondary)]">· {line.sourceLabel}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[14px] font-extrabold text-[var(--ic-ink)]">The number to watch: {suggestion.metric}.</p>
            {suggestion.nudge && <p className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">{suggestion.nudge}</p>}
            <Path suggestion={suggestion} goal={goal} ctx={ctx} />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <ActionFill n={0} onClick={() => onBuild(suggestion)}>
                {creatingId === suggestion.id ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
                  </span>
                ) : (
                  "Build this funnel"
                )}
              </ActionFill>
              <button
                type="button"
                onClick={() => onDismiss(suggestion)}
                className="text-[13px] font-extrabold text-[var(--ic-ink)] underline underline-offset-4"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
      {nudges.length > 0 && (
        <div className="border-t border-[var(--ic-ink)]/15 px-5 py-3">
          <ul className="space-y-1">
            {nudges.map((nudge) => (
              <li key={nudge} className="text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">
                {nudge}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <div role="alert" className="border-t border-[var(--ic-ink)]/15 px-5 py-3 text-[13px] font-semibold text-[var(--ic-ink)]">
          {error}
        </div>
      )}
    </div>
  );
}
