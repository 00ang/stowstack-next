"use client";

import { SectionHeader, SectionMeta } from "@/components/mono/section-header";

import { Check, X, Minus } from "lucide-react";
import { useInView } from "./use-in-view";

/**
 * Repetition-grid disruptor (concept-copy/02). A 5×5 grid where all cells
 * carry the same label except one, which breaks the pattern to deliver
 * the message. Translates Urbit's "Discord sells you out" structural
 * device into StorageAds' category frame.
 */
const GRID_SIZE = 25;
const DISRUPTOR_INDEX = 12; // center
const GRID_LABELS = ["DIY", "Ad Agency"];

const ROWS = [
  {
    label: "Landing Pages",
    diy: "Your homepage (2% conv)",
    agency: "Generic template (3-4% conv)",
    storageads: "Ad-specific pages (8.7% conv)",
  },
  {
    label: "Rental Flow",
    diy: "Customer bounces to storEDGE",
    agency: "Same bounce, different URL",
    storageads: "Embedded on your branded page",
  },
  {
    label: "Move-in Visibility",
    diy: '"We got some calls this month"',
    agency: "Clicks and impressions (40% may be existing tenants)",
    storageads: "Cost per move-in by specific ad",
  },
  {
    label: "Ad Channels",
    diy: "Boosted Facebook post",
    agency: "Google or Facebook, not both",
    storageads: "Meta + Google PPC + Retargeting",
  },
  {
    label: "A/B Testing",
    diy: "None",
    agency: "Occasionally tests ad copy",
    storageads: "Tests pages, offers, creative on revenue",
  },
  {
    label: "Reporting Cadence",
    diy: "Nothing",
    agency: "Monthly PDF of vanity metrics",
    storageads: "Real-time: leads to reservations to move-ins",
  },
  {
    label: "Who Builds It",
    diy: "You, at 11pm after gate calls",
    agency: "Agency that also does dentists",
    storageads: "A team that builds for storage and nothing else",
  },
  {
    label: "Time to Results",
    diy: "Months (if ever)",
    agency: "30-60 days (maybe)",
    storageads: "7 days to first leads",
  },
  {
    label: "Follow-Up",
    diy: "You forgot to call them back",
    agency: "Not their job",
    storageads: "Automated SMS + email nurture sequences",
  },
  {
    label: "Cost",
    diy: "Your time + wasted ad spend",
    agency: "$1,500-5,000/mo + ad spend (% of spend = misaligned)",
    storageads: "$499-1,499/mo + ad spend",
  },
];

export default function ThreeWayComparison() {
  const { ref, isVisible } = useInView();

  return (
    <section
      aria-label="Comparison of DIY, agency, and StorageAds approaches"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader
          number="03"
          kicker="VS THE ALTERNATIVES"
          right={<SectionMeta text="MATRIX · 3×10" />}
          style={{ marginBottom: 24 }}
        />
        <div
          className={`max-w-3xl mx-auto text-center mb-10 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2 className="font-semibold text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tight">
            Three approaches.
            <br />
            <span className="text-2xl sm:text-3xl md:text-4xl font-normal">
              Only one fills units and proves it.
            </span>
          </h2>
        </div>

        {/* Repetition-grid disruptor — everyone else is one of two things,
            StorageAds is a third thing. The message lives in the cell
            that breaks the pattern. */}
        <div
          className={`max-w-3xl mx-auto mb-14 transition-all duration-700 delay-150 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          <div
            className="grid grid-cols-5 border border-[var(--border-subtle)]"
            style={{ gap: "1px", background: "var(--border-subtle)" }}
          >
            {Array.from({ length: GRID_SIZE }).map((_, i) => {
              const isDisruptor = i === DISRUPTOR_INDEX;
              const label = isDisruptor
                ? "StorageAds fills the unit."
                : GRID_LABELS[i % GRID_LABELS.length];
              return (
                <div
                  key={i}
                  className={`aspect-square flex items-center justify-center text-center px-1.5 py-2 transition-colors ${
                    isDisruptor
                      ? "bg-[var(--color-dark)] text-[var(--color-light)]"
                      : "bg-[var(--color-light)] text-[var(--text-tertiary)]"
                  }`}
                >
                  <span
                    className={
                      isDisruptor
                        ? "text-[9px] sm:text-[11px] md:text-[13px] font-semibold leading-tight tracking-tight"
                        : "text-[9px] sm:text-[11px] md:text-[13px] tracking-tight"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column headers */}
        <div
          className={`hidden md:grid grid-cols-4 gap-3 mb-4 px-2 transition-all duration-700 delay-100 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <div />
          <div className="flex items-center gap-2 px-4">
            <div className="w-6 h-6 bg-[var(--color-dark)]/5 rounded-full flex items-center justify-center">
              <Minus size={12} className="text-stone-500" />
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Do It Yourself
            </span>
          </div>
          <div className="flex items-center gap-2 px-4">
            <div className="w-6 h-6 bg-orange-500/10 rounded-full flex items-center justify-center">
              <X size={12} className="text-orange-500" />
            </div>
            <span className="text-[10px] font-semibold text-orange-800 uppercase tracking-[0.14em]">
              Ad Agency
            </span>
          </div>
          <div className="flex items-center gap-2 px-4">
            <div className="w-6 h-6 bg-[var(--color-dark)]/10 rounded-full flex items-center justify-center">
              <Check size={12} className="text-[var(--color-dark)]" />
            </div>
            <span
              className="text-[10px] font-semibold text-[var(--color-dark)] uppercase tracking-[0.14em]"
            >
              StorageAds
            </span>
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3 transition-all duration-500 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: `${200 + i * 50}ms` }}
            >
              <div className="flex items-center px-4 py-2">
                <span className="text-sm font-semibold text-[var(--color-dark)]">
                  {row.label}
                </span>
              </div>

              <div className="bg-[var(--color-light-gray)] border border-[var(--border-subtle)] rounded-xl px-4 py-3">
                <span
                  className="md:hidden text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  DIY
                </span>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {row.diy}
                </p>
              </div>

              <div className="bg-orange-500/[0.05] border border-orange-500/10 rounded-xl px-4 py-3">
                <span className="md:hidden text-[10px] font-semibold text-orange-800 uppercase tracking-[0.14em]">
                  Agency
                </span>
                <p className="text-sm text-orange-800">{row.agency}</p>
              </div>

              <div className="bg-[var(--color-dark)] border border-[var(--color-dark)] rounded-xl px-4 py-3">
                <span className="md:hidden text-[10px] font-semibold text-[var(--color-light)] uppercase tracking-[0.14em]">
                  StorageAds
                </span>
                <p className="text-sm text-[var(--color-light)] font-medium">
                  {row.storageads}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
