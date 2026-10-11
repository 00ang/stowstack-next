import type { FunnelContext, FunnelGoal } from "@/lib/funnel-graph/types";
import { digestFacility, focusSizeKeys } from "./digest";
import { buildSuggestedGraph, type SuggestionTemplate } from "./graphs";
import type { Confidence, Digest, FacilityPicture, Gap, GapKind } from "./picture";
import { confidenceLabel } from "./picture";

/**
 * One suggested funnel per gap. The why is the evidence. The number is
 * the one to watch. Nothing here promises it will move.
 */

export interface FunnelSuggestion {
  id: GapKind;
  template: SuggestionTemplate;
  name: string;
  why: { text: string; sourceLabel: string }[];
  targets: string;
  metric: string;
  severity: number;
  confidence: Confidence;
  confidenceLabel: string;
  sample: boolean;
  /** Dismiss sticks until the evidence itself changes. */
  evidenceKey: string;
  sizeKeys: string[];
  offerKey: string | null;
  nudge: string | null;
}

const NAMES: Record<SuggestionTemplate, string> = {
  "vacant-size": "Fill the empty sizes",
  recovery: "Catch missed calls and holds",
  "follow-up": "Answer the people who asked",
  stay: "A reason to stay",
  "lease-up": "Lease-up launch",
  reviews: "Ask for a review after move-in",
  "rent-online": "Let them reserve online",
  reach: "Reach people who aren't calling",
  rates: "Show the rate you mean",
};

function templateFor(gap: Gap): SuggestionTemplate {
  if (gap.kind === "vacant_sizes") return "vacant-size";
  if (gap.kind === "lease_up") return "lease-up";
  if (gap.kind === "retention") return "stay";
  if (gap.kind === "google") return "reviews";
  if (gap.kind === "online_rental") return "rent-online";
  if (gap.kind === "demand") return "reach";
  if (gap.kind === "rates") return "rates";
  if (gap.signals.includes("missed") || gap.signals.includes("abandoned")) return "recovery";
  return "follow-up";
}

function activeOffer(ctx: FunnelContext | undefined): string | null {
  const offer = ctx?.offers?.find((o) => o.active);
  return offer?.key ?? null;
}

export function suggestFunnels(picture: FacilityPicture, digest: Digest = digestFacility(picture), ctx?: FunnelContext): FunnelSuggestion[] {
  const keys = focusSizeKeys(picture);
  const offerKey = activeOffer(ctx);
  return digest.gaps.map((gap) => {
    const template = templateFor(gap);
    return {
      id: gap.id,
      template,
      name: NAMES[template],
      why: gap.evidence.map((e) => ({ text: e.text, sourceLabel: e.sourceLabel })),
      targets: gap.target,
      metric: gap.metric,
      severity: gap.severity,
      confidence: gap.confidence,
      confidenceLabel: confidenceLabel(gap.confidence),
      sample: picture.sample,
      evidenceKey: gap.evidence.map((e) => e.text).join("|"),
      sizeKeys: keys,
      offerKey: template === "stay" ? offerKey : null,
      nudge: gap.nudge,
    };
  });
}

export function graphForSuggestion(suggestion: FunnelSuggestion, goal: FunnelGoal | null, ctx?: FunnelContext) {
  return buildSuggestedGraph({
    template: suggestion.template,
    sizeKeys: suggestion.sizeKeys,
    offerKey: suggestion.offerKey,
    goal,
    ctx,
  });
}
