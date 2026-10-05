"use client";

/**
 * The Proven Ads vocabulary: one hue per kind of information, the run-length
 * figure, labels. Hues come from the palette-aware --hue-* tokens so every
 * palette keeps working; chip text is the hue pulled 20% toward ink, which
 * holds 4.5:1 on its own tint across the light palettes (olive alone does
 * not). Secondary text is --color-body-text, never --color-mid-gray, which
 * measures 3.2:1 on the cream.
 */

import type { CSSProperties, ReactNode } from "react";
import {
  ANGLE_LABELS,
  AUDIENCE_LABELS,
  FORMAT_LABELS,
  OFFER_LABELS,
  SCALE_LABELS,
  UNIT_LABELS,
} from "@/lib/proven-ads/types";
import type { LibraryPatterns } from "@/lib/proven-ads/patterns";
import type { ProvenAdInsight } from "@/lib/proven-ads/types";

export const FONT = "var(--font), var(--font-manrope), system-ui, sans-serif";

/** What each kind of fact means, and the hue that carries it everywhere it appears. */
export const KIND = {
  offer: { hue: "var(--hue-c)", label: "Offer", labels: OFFER_LABELS as Record<string, string> },
  angle: { hue: "var(--hue-d)", label: "Lead", labels: ANGLE_LABELS as Record<string, string> },
  unit: { hue: "var(--hue-a)", label: "Unit", labels: UNIT_LABELS as Record<string, string> },
  format: { hue: "var(--color-dark)", label: "Format", labels: FORMAT_LABELS as Record<string, string> },
  audience: { hue: "var(--color-dark)", label: "For", labels: AUDIENCE_LABELS as Record<string, string> },
  scale: { hue: "var(--color-dark)", label: "Advertiser", labels: SCALE_LABELS as Record<string, string> },
} as const;
export type Kind = keyof typeof KIND;

export function ink(hue: string, strength = 80): string {
  return `color-mix(in srgb, ${hue} ${strength}%, var(--color-dark))`;
}

export function tint(hue: string, strength = 9): string {
  return `color-mix(in srgb, ${hue} ${strength}%, transparent)`;
}

export function labelFor(kind: Kind, key: string | null | undefined): string | null {
  if (!key || key === "unknown" || key === "no_offer" || key === "general" || key === "other") return null;
  return KIND[kind].labels[key] ?? null;
}

/** Client-side shape of one library row (see presentProvenAd). */
export interface ProvenAd {
  id: string;
  source: string;
  platform: string;
  publisher_platforms: string[];
  advertiser_name: string;
  advertiser_url: string | null;
  format: string;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  landing_url: string | null;
  snapshot_url: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  offer_type: string | null;
  unit_type: string | null;
  angle: string | null;
  audience: string | null;
  advertiser_scale: string | null;
  family_size: number;
  study_value: number | null;
  started_at: string;
  last_seen_at: string;
  confirmed_through: string;
  ended_at: string | null;
  active: boolean;
  notes: string | null;
  days_running: number;
  proven: boolean;
  why_flagged: string;
  insight: ProvenAdInsight | null;
  insight_pending: boolean;
}

export interface LibraryResponse {
  ads: ProvenAd[];
  total: number;
  offset: number;
  limit: number;
  sort: string;
  patterns: LibraryPatterns | null;
  states: string[];
  sources: { id: string; coverage: string; automated: boolean; configured: boolean }[];
}

export function Chip({ kind, value, style }: { kind: Kind; value: string | null | undefined; style?: CSSProperties }) {
  const label = labelFor(kind, value);
  if (!label) return null;
  const hue = KIND[kind].hue;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-[4px] px-2 py-[3px] text-[12px] leading-none"
      style={{ color: ink(hue), background: tint(hue), fontWeight: 650, ...style }}
    >
      {label}
    </span>
  );
}

/** A plain fact chip in ink (needs, fits). */
export function Tag({ children, hue = "var(--color-dark)" }: { children: ReactNode; hue?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-[4px] px-2 py-[4px] text-[12px] leading-tight"
      style={{ color: ink(hue, hue === "var(--color-dark)" ? 100 : 80), background: tint(hue, 7), fontWeight: 600 }}
    >
      {children}
    </span>
  );
}

/** Small caps label for a section or a field. */
export function Eyebrow({ children, hue, className = "" }: { children: ReactNode; hue?: string; className?: string }) {
  return (
    <div
      className={`text-[11px] uppercase tracking-[0.08em] ${className}`}
      style={{ color: hue ? ink(hue) : "var(--color-body-text)", fontWeight: 700 }}
    >
      {children}
    </div>
  );
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "7 months", "1 year 2 months", or "45 days". Mirrors spanLabel in lib. `short` for tight stat cells. */
export function span(days: number, short = false): string {
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} year${years === 1 ? "" : "s"}`;
  if (!rest || short) return short && rest >= 6 ? `${years}½ years` : y;
  return `${y} ${rest} month${rest === 1 ? "" : "s"}`;
}

export function where(ad: Pick<ProvenAd, "city" | "state" | "country">): string | null {
  const parts = [ad.city, ad.state].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (ad.country && ad.country !== "US") return ad.country;
  return null;
}

/** The ad's own words worth showing: skip a headline that only repeats the advertiser's name. */
export function originalLine(ad: Pick<ProvenAd, "headline" | "primary_text" | "advertiser_name">): string | null {
  const norm = (t: string | null) => (t ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const headline = ad.headline && norm(ad.headline) !== norm(ad.advertiser_name) ? ad.headline : null;
  return headline || ad.primary_text || null;
}

export function landingDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The proof: days running, set heavy and tabular. */
export function DaysFigure({ days, size = "md" }: { days: number; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-baseline gap-1.5" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span
        className={big ? "text-[40px] leading-none" : "text-[30px] leading-none"}
        style={{ color: "var(--color-dark)", fontWeight: 800, letterSpacing: "-0.03em" }}
      >
        {days.toLocaleString("en-US")}
      </span>
      <span className="text-[13px]" style={{ color: "var(--color-body-text)", fontWeight: 650 }}>
        days running
      </span>
    </div>
  );
}
