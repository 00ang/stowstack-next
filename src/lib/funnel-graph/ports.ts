import type { PortType } from "./types";

/**
 * Identity hues are the ontology's existing `--onto-*` tokens
 * (space = units, audience = campaigns, ad = ads, visit = pages,
 * lead = leads, hold = links, move-in = tenants). Words stay ink.
 */
export const PORTS: Record<
  PortType,
  { label: string; phrase: string; hue: string }
> = {
  space: { label: "Space", phrase: "sizes to sell", hue: "var(--onto-units)" },
  audience: { label: "Audience", phrase: "an audience", hue: "var(--onto-campaigns)" },
  ad: { label: "Ad", phrase: "an ad", hue: "var(--onto-ads)" },
  visit: { label: "Visit", phrase: "a source of visits", hue: "var(--onto-pages)" },
  lead: { label: "Lead", phrase: "leads coming in", hue: "var(--onto-leads)" },
  hold: { label: "Hold", phrase: "reservations", hue: "var(--onto-links)" },
  "move-in": { label: "Move-in", phrase: "move-ins", hue: "var(--onto-tenants)" },
};

export function article(title: string): "a" | "an" {
  return /^[aeiou]/i.test(title) ? "an" : "a";
}
