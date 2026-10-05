"use client";

import { Check, Minus } from "lucide-react";
import { SectionHeader, SectionMeta } from "@/components/mono/section-header";
import { useInView } from "./use-in-view";
import Cite from "./cite";
import { RevealText } from "./motion";

/**
 * Four-column vendor comparison. Replaces the older DIY-vs-Agency-vs-Us
 * three-way matrix. Frames StorageAds against the three categories of
 * thing an independent operator could spend a marketing budget on today:
 *
 *   - StorageRankers : SEO + storage-specific websites
 *   - Adverank       : Google-only PPC bid management
 *   - SpareFoot      : pay-per-lead aggregator / directory
 *
 * The point of the table is that everyone else does one slice. StorageAds
 * does the whole thing. The checks and dashes are the entire argument.
 */

type Cell = "yes" | "no" | "partial";
type Row = {
  capability: string;
  detail?: string;
  values: [Cell, Cell, Cell, Cell];
};

const COLUMNS = [
  { name: "StorageAds", subtitle: "The whole system" },
  { name: "StorageRankers", subtitle: "SEO + websites" },
  { name: "Adverank", subtitle: "Google PPC automation" },
  { name: "SpareFoot", subtitle: "Pay-per-lead directory" },
] as const;

const ROWS: Row[] = [
  {
    capability: "Meta ads",
    detail: "Facebook + Instagram, the cheaper channel most operators skip",
    values: ["yes", "no", "no", "no"],
  },
  {
    capability: "Google ads",
    detail: "Search + display, the channel renters are actively shopping in",
    values: ["yes", "partial", "yes", "no"],
  },
  {
    capability: "Custom landing page per campaign",
    detail: "Each ad sends to its own page with its own offer, not your homepage",
    values: ["yes", "partial", "no", "no"],
  },
  {
    capability: "storEDGE rental flow embedded",
    detail: "Renter reserves and pays without ever leaving your branded page",
    values: ["yes", "no", "no", "no"],
  },
  {
    capability: "Every move-in tracked back to its ad",
    detail: "The actual unit that got rented, traced to the ad that filled it",
    values: ["yes", "no", "partial", "no"],
  },
  {
    capability: "You own the leads",
    detail: "Tenants are yours from day one, not rented or resold",
    values: ["yes", "yes", "yes", "no"],
  },
  {
    capability: "Built for storage operators, nothing else",
    detail: "Not a general marketing tool with a storage page bolted on",
    values: ["yes", "no", "no", "no"],
  },
  {
    capability: "Free facility audit before you sign",
    detail: "See what's broken before you pay anyone a dollar",
    values: ["yes", "no", "no", "no"],
  },
];

function CellMark({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--color-dark)" }}>
        <Check size={13} strokeWidth={2.5} style={{ color: "var(--color-light)" }} />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span
        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
        style={{
          color: "var(--text-tertiary)",
          background: "var(--color-light-gray)",
          border: "1px solid var(--border-subtle)",
          fontFamily: "var(--font-heading)",
        }}
      >
        Limited
      </span>
    );
  }
  return <Minus size={14} style={{ color: "var(--text-tertiary)" }} aria-label="Not offered" />;
}

export default function FourWayComparison() {
  const { ref, isVisible } = useInView();

  return (
    <section
      aria-label="StorageAds vs StorageRankers, Adverank, and SpareFoot"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader number="03" kicker="VS THE ALTERNATIVES" right={<SectionMeta text="MATRIX · 4×8" />} style={{ marginBottom: 24 }} />

        <div
          className={`max-w-3xl mx-auto text-center mb-12 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tight"
            style={{ fontFamily: "var(--serif)" }}
          >
            <RevealText>Everyone else does one slice.</RevealText>
            <br />
            <span className="text-2xl sm:text-3xl md:text-4xl font-normal" style={{ color: "var(--text-secondary)" }}>
              <RevealText start={220}>We do the whole thing.</RevealText>
            </span>
          </h2>
          <p
            className="mt-5 text-base sm:text-lg mx-auto max-w-2xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Three categories of marketing software you could buy today.
            None of them takes a renter all the way from ad to signed lease.
          </p>
          <p
            className="mt-3 text-sm mx-auto max-w-2xl"
            style={{ color: "var(--text-tertiary)" }}
          >
            Closing the 5-point gap to the 92.6% REIT band
            <Cite n={[1, 2]} /> takes the whole system. Picking one slice
            below leaves the rest uncovered.
          </p>
        </div>

        {/* DESKTOP / TABLET — proper table */}
        <div
          className={`hidden md:block max-w-5xl mx-auto transition-all duration-700 delay-150 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border-subtle)" }}>
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <caption className="sr-only">
                Capability comparison: StorageAds vs StorageRankers, Adverank, and SpareFoot
              </caption>
              <thead>
                <tr style={{ background: "var(--color-light-gray)" }}>
                  <th
                    scope="col"
                    className="text-left p-4 align-bottom text-xs uppercase tracking-wide font-semibold"
                    style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}
                  >
                    Capability
                  </th>
                  {COLUMNS.map((col, i) => (
                    <th
                      key={col.name}
                      scope="col"
                      className="p-4 text-center align-bottom"
                      style={{
                        background: i === 0 ? "var(--color-dark)" : undefined,
                        color: i === 0 ? "var(--color-light)" : "var(--color-dark)",
                      }}
                    >
                      <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                        {col.name}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-wide mt-1 font-medium"
                        style={{ color: i === 0 ? "color-mix(in srgb, var(--bg) 70%, transparent)" : "var(--text-tertiary)" }}
                      >
                        {col.subtitle}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, rowIdx) => (
                  <tr
                    key={row.capability}
                    style={{ borderTop: "1px solid var(--border-subtle)" }}
                  >
                    <td className="p-4 align-top">
                      <div className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
                        {row.capability}
                      </div>
                      {row.detail && (
                        <div className="text-xs mt-1" style={{ color: "var(--text-tertiary)", maxWidth: 340 }}>
                          {row.detail}
                        </div>
                      )}
                    </td>
                    {row.values.map((cell, colIdx) => (
                      <td
                        key={colIdx}
                        className="p-4 text-center align-middle"
                        style={{
                          background:
                            colIdx === 0
                              ? rowIdx % 2 === 0
                                ? "rgba(20,20,19,0.03)"
                                : "rgba(20,20,19,0.05)"
                              : undefined,
                        }}
                      >
                        <CellMark value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE — stacked capability cards. Each capability shows the
            checkmark grid in a single row to keep the chart legible. */}
        <div
          className={`md:hidden space-y-3 transition-all duration-700 delay-150 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="grid grid-cols-[1fr_repeat(4,32px)] gap-2 px-1 pb-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <span />
            {COLUMNS.map((c, i) => (
              <span
                key={c.name}
                className="text-center text-[9px] font-semibold uppercase tracking-tight"
                style={{
                  color: i === 0 ? "var(--color-dark)" : "var(--text-tertiary)",
                  fontFamily: "var(--font-heading)",
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  height: 60,
                  lineHeight: 1.1,
                }}
              >
                {c.name}
              </span>
            ))}
          </div>
          {ROWS.map((row) => (
            <div
              key={row.capability}
              className="grid grid-cols-[1fr_repeat(4,32px)] gap-2 items-center px-1 py-2 border-b"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div>
                <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--color-dark)" }}>
                  {row.capability}
                </div>
                {row.detail && (
                  <div className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "var(--text-tertiary)" }}>
                    {row.detail}
                  </div>
                )}
              </div>
              {row.values.map((cell, i) => (
                <div key={i} className="flex justify-center">
                  <CellMark value={cell} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <p
          className={`text-center text-xs mt-6 transition-all duration-700 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
          style={{ color: "var(--text-tertiary)", maxWidth: 640, marginInline: "auto" }}
        >
          Competitor capabilities reflect publicly published product pages as of 2025.
          &ldquo;Limited&rdquo; means the vendor offers a partial version of the feature
          (one channel, generic template, no embedded rental). If something here is wrong, email blake@storageads.com and we&apos;ll fix it.
        </p>
      </div>
    </section>
  );
}
