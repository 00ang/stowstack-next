import type { FunnelContext } from "./types";
import type { TemplateKey } from "./templates";

/**
 * The campaign to build from the goal, chosen from the facility's own facts.
 * Rules, not a model, so the same facility always gets the same suggestion,
 * and every suggestion carries the facts that chose it.
 *
 *  - Mostly empty (at least a third vacant across every size): lease-up.
 *  - More climate units empty than drive-up, with a special running: the
 *    shoulder-season push, which leads with that special.
 *  - Otherwise: fill the drive-up sizes that are sitting empty.
 */

export interface Suggestion {
  key: TemplateKey;
  /** Short, true sentences citing the facts behind the choice. */
  because: string[];
}

/** At or above this share vacant, a facility is in lease-up. */
export const LEASE_UP_VACANCY = 1 / 3;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function suggestTemplate(ctx: FunnelContext): Suggestion {
  const units = ctx.units ?? [];
  const goal = ctx.goal ? `Goal: ${plural(ctx.goal.moveIns, "move-in")} in ${ctx.goal.month}.` : null;
  const withGoal = (because: string[]) => (goal ? [goal, ...because] : because);

  const summary = ctx.unitsSummary;
  if (summary && summary.total > 0 && summary.empty / summary.total >= LEASE_UP_VACANCY) {
    const pct = Math.round((summary.empty / summary.total) * 100);
    return {
      key: "lease",
      because: withGoal([`${summary.empty} of ${summary.total} units are empty (${pct}%), so every size needs reach.`]),
    };
  }

  const drive = units.filter((u) => u.driveUp && u.empty > 0).sort((a, b) => b.empty - a.empty || a.name.localeCompare(b.name));
  const climate = units.filter((u) => u.climate && u.empty > 0).sort((a, b) => b.empty - a.empty || a.name.localeCompare(b.name));
  const driveEmpty = drive.reduce((n, u) => n + u.empty, 0);
  const climateEmpty = climate.reduce((n, u) => n + u.empty, 0);
  const special = (ctx.offers ?? []).find((o) => o.active);

  if (climateEmpty > driveEmpty && special) {
    return {
      key: "shoulder",
      because: withGoal([
        `${plural(climateEmpty, "climate unit")} empty against ${driveEmpty} drive-up.`,
        `${special.name} is running, so the push can lead with it.`,
      ]),
    };
  }

  if (drive.length) {
    const top = drive.slice(0, 3).map((u) => `${u.name} has ${u.empty} empty`);
    return { key: "drive", because: withGoal([`${top.join(", ")}.`]) };
  }

  return {
    key: "drive",
    because: withGoal(["Start from the drive-up sizes; add your unit mix and this will name them."]),
  };
}
