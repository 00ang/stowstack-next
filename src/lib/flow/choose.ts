import { actionHref } from "@/lib/ontology/href";
import type { Move, ObjectTypeKey, Ontology } from "@/lib/ontology/types";
import type { NextMove } from "@/lib/funnel-graph";
import type { Pace } from "./pace";

/**
 * One next move for wherever the operator is. Every surface in the portal
 * asks this same question with its own `where`, so the suggestion follows
 * them from page to page instead of each page inventing its own:
 *
 *   1. the facility's foundation (nothing works without the unit mix);
 *   2. the object in focus, then the tool in hand;
 *   3. the campaign being worked on;
 *   4. the month's goal (set it; or, behind pace with nothing live, start one);
 *   5. the facility's top move.
 *
 * Pure and deterministic: the same ontology, pace and place give the same move.
 */

export type Surface =
  | "dashboard"
  | "index"
  | "campaigns"
  | "campaign"
  | "reports"
  | "tools"
  | "reviews"
  | "upload"
  | "messages"
  | "billing"
  | "settings"
  | "onboarding"
  | "other";

export interface Where {
  surface: Surface;
  /** Tool key when the surface is the facility tools. */
  tool?: string | null;
  /** Ontology address the page or tool is focused on. */
  focus?: string | null;
}

/** The campaign the operator is building, carried from page to page. */
export interface WorkingOn {
  id: string;
  name: string;
  status: "draft" | "published";
  /** The campaign's own next move, from its graph (funnel-graph `nextMove`). */
  move: NextMove | null;
}

export interface FlowMove {
  /** Stable id, so a list can skip the move the bar already shows. */
  id: string;
  source: "facility" | "campaign" | "goal";
  sentence: string;
  reason: string;
  /** One plain line on why it matters, when the facility's numbers can say it. */
  why?: string;
  /** The one button. */
  label: string;
  href: string;
  /** True when the button would land where the operator already is. */
  here: boolean;
  /** The object the move is about, for its mark. */
  subject: string | null;
  type: ObjectTypeKey | null;
}

const SURFACE_PATHS: [string, Surface][] = [
  ["/portal/campaigns/", "campaign"],
  ["/portal/campaigns", "campaigns"],
  ["/portal/index", "index"],
  ["/portal/reports", "reports"],
  ["/portal/tools", "tools"],
  ["/portal/gbp", "reviews"],
  ["/portal/upload", "upload"],
  ["/portal/messages", "messages"],
  ["/portal/billing", "billing"],
  ["/portal/settings", "settings"],
  ["/portal/onboarding", "onboarding"],
];

export function surfaceOf(pathname: string): Surface {
  if (pathname === "/portal" || pathname === "/portal/") return "dashboard";
  for (const [prefix, surface] of SURFACE_PATHS) {
    if (prefix.endsWith("/") ? pathname.startsWith(prefix) && pathname.length > prefix.length : pathname.startsWith(prefix)) {
      return surface;
    }
  }
  return "other";
}

/** Would following `href` land on `where`? Tools compare tool and focus too. */
export function isHere(href: string, where: Where): boolean {
  const url = new URL(href, "https://storageads.local");
  const surface = surfaceOf(url.pathname);
  if (surface !== where.surface) return false;
  if (surface !== "tools") return true;
  const tool = url.searchParams.get("tool") ?? "overview";
  const focus = url.searchParams.get("focus");
  return tool === (where.tool ?? "overview") && (focus ?? null) === (where.focus ?? null);
}

function fromOntologyMove(move: Move, where: Where): FlowMove {
  const href = actionHref(move.action, move.subject);
  return {
    id: move.id,
    source: "facility",
    sentence: move.sentence,
    reason: move.reason,
    why: move.why,
    label: move.action.label,
    href,
    here: isHere(href, where),
    subject: move.subject.includes("/") ? move.subject : null,
    type: move.type,
  };
}

export function campaignHref(id: string, run = false): string {
  return `/portal/campaigns/${encodeURIComponent(id)}${run ? "?do=next" : ""}`;
}

function fromCampaign(working: WorkingOn, where: Where): FlowMove | null {
  if (!working.move) return null;
  const href = campaignHref(working.id, true);
  return {
    id: `campaign:${working.id}:${working.move.action.kind}`,
    source: "campaign",
    sentence: working.move.sentence,
    reason: `${working.name} · ${working.move.reason}`,
    why: working.move.why,
    label: working.move.actionLabel,
    href,
    here: where.surface === "campaign",
    subject: null,
    type: "campaigns",
  };
}

function goalMove(pace: Pace | null, ontology: Ontology, where: Where): FlowMove | null {
  if (!pace) return null;
  if (pace.target <= 0) {
    const href = "/portal/settings#goal";
    return {
      id: `goal:set:${pace.monthName}`,
      source: "goal",
      sentence: `Set your move-in goal for ${pace.monthName}.`,
      reason: "Every campaign and every next move here is aimed at it.",
      label: "Set the goal",
      href,
      here: isHere(href, where),
      subject: null,
      type: "tenants",
    };
  }
  const live = ontology.objects.some((o) => o.type === "campaigns" && o.status === "live");
  if (pace.onTrack || live) return null;
  const href = "/portal/campaigns?new=goal";
  return {
    id: `goal:behind:${pace.monthName}`,
    source: "goal",
    sentence: `You're behind pace on ${pace.monthName}'s goal.`,
    reason: `${pace.line}; a straight line to ${pace.target} has ${pace.expectedByNow} by today.${
      pace.projection ? ` ${pace.projection}` : ""
    } Nothing is live to close the gap.`,
    label: "Start from your goal",
    href,
    here: isHere(href, where),
    subject: null,
    type: "campaigns",
  };
}

export interface ChooseInput {
  ontology: Ontology | null;
  pace: Pace | null;
  working: WorkingOn | null;
  where: Where;
}

/** The one next move for `where`, or null when nothing needs the operator. */
export function chooseMove({ ontology, pace, working, where }: ChooseInput): FlowMove | null {
  if (!ontology) return null;
  const moves = ontology.moves;

  // 1. Nothing works without the unit mix. On the upload page itself, say so as "here".
  const foundation = moves.find((m) => m.rule === "foundation");
  if (foundation) return fromOntologyMove(foundation, where);

  // 2. The object in focus, then the tool in hand.
  if (where.focus) {
    const about = moves.find((m) => m.subject === where.focus);
    if (about) return fromOntologyMove(about, where);
  }
  if (where.surface === "tools" && where.tool) {
    const inTool = moves.find((m) => m.action.tool === where.tool);
    if (inTool) return fromOntologyMove(inTool, where);
  }

  // 3. The campaign being built (the builder shows its own move).
  if (working && where.surface !== "campaign") {
    const campaign = fromCampaign(working, where);
    if (campaign) return campaign;
  }

  // 4. The month's goal.
  const goal = goalMove(pace, ontology, where);
  if (goal) return goal;

  // 5. The facility's top move.
  return moves[0] ? fromOntologyMove(moves[0], where) : null;
}
