"use client";

import { SectionHeader, SectionMeta } from "@/components/mono/section-header";

import { useState } from "react";
import { useInView } from "./use-in-view";
import { RevealText } from "./motion";

const PARTS = [
  {
    id: "market",
    number: "01",
    title: "Your market, mapped",
    summary:
      "We pull your competitors, their pricing, their reviews, and your trade area. You see what they're charging on the units you're competing for.",
    detail: [
      "Competitor pricing and review tracking",
      "Census demographics for your trade area",
      "Search volume for storage in your zip code",
    ],
  },
  {
    id: "ads",
    number: "02",
    title: "Meta and Google ads",
    summary:
      "Meta ads reach renters before they search. Google captures the ones already looking. Retargeting brings back the ones who left. All three from one dashboard.",
    detail: [
      "Facebook and Instagram campaigns",
      "Google Search and Display",
      "Retargeting across both",
    ],
  },
  {
    id: "pages",
    number: "03",
    title: "Landing pages built for the ad",
    summary:
      "Each ad gets its own page. Your facility. Your rates. Your offer. Built around your storEDGE reserve button so the renter books on your branded page.",
    detail: [
      "One page per ad, with the offer that ad promised",
      "The renter reserves on that page",
      "Fast on a phone, built for the reserve button",
    ],
  },
  {
    id: "reserve",
    number: "04",
    title: "Reserve right on the page",
    summary:
      "storEDGE handles the unit, the rate, the reservation. The renter never leaves your page. The reservation lands in your storEDGE the same as a walk-in.",
    detail: [
      "Embedded storEDGE reservation widget",
      "Renter stays on your branded page",
      "Live unit availability and pricing",
    ],
  },
  {
    id: "tracking",
    number: "05",
    title: "You mark the move-in",
    summary:
      "When someone moves in, you mark it. The report shows the ad, the page, or the office. What you spent and what you got, in one place.",
    detail: [
      "You mark the move-in",
      "The report shows the source",
      "Spend and leases, side by side",
    ],
  },
  {
    id: "compound",
    number: "06",
    title: "Gets sharper every month",
    summary:
      "A/B tests on headlines, offers, and pages. Winners get picked by move-ins, not clicks. The system you turn on this month is better six months from now.",
    detail: [
      "Move-in based A/B testing",
      "Creative scored by what filled units",
      "Compounding returns over time",
    ],
  },
];

export default function SystemOverview() {
  const { ref, isVisible } = useInView();
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <section
      id="system"
      aria-label="The six parts of the StorageAds system"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div className="section-content"><SectionHeader number="02" kicker="THE SYSTEM" right={<SectionMeta text="COMPONENTS · 6" />} style={{ marginBottom: 24 }} /></div>
      <div ref={ref} className="text-container">
        <div
          className={`max-w-3xl mx-auto text-center mb-16 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>One system. Six parts.</RevealText>{" "}
            <span style={{ color: "var(--color-dark)", fontWeight: 700 }}>
              <RevealText start={180}>Built to fill units.</RevealText>
            </span>
          </h2>
          <p
            className="mt-4"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
            }}
          >
            Market intelligence, ads, pages, the reserve flow, and reservation follow-up. One system, wired together, that fills units and shows its work.
          </p>
        </div>

        <div className="space-y-0">
          {PARTS.map((part, i) => {
            const isActive = activeId === part.id;
            return (
              <div key={part.id}>
                {/* Divider */}
                <div
                  className={`h-px transition-all duration-700 ${
                    isVisible ? "w-full" : "w-0"
                  }`}
                  style={{
                    background: "var(--border-subtle)",
                    transitionDelay: `${200 + i * 100}ms`,
                  }}
                />

                <button
                  onClick={() => setActiveId(isActive ? null : part.id)}
                  aria-expanded={isActive}
                  className={`w-full text-left py-8 transition-all duration-500 cursor-pointer ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <div className="flex items-baseline gap-4 md:gap-6">
                    <span
                      className="text-sm font-semibold tabular-nums flex-shrink-0"
                      style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)", opacity: 0.5 }}
                    >
                      {part.number}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <h3
                          className="font-semibold"
                          style={{
                            fontSize: "var(--text-subhead)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {part.title}
                        </h3>
                        <span
                          className="text-sm flex-shrink-0 hidden md:block"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {isActive ? "−" : "+"}
                        </span>
                      </div>
                      <p
                        className="mt-1 text-sm"
                        style={{
                          color: "var(--text-secondary)",
                          maxWidth: "580px",
                        }}
                      >
                        {part.summary}
                      </p>

                      {/* Expandable detail */}
                      <div
                        className="overflow-hidden transition-all duration-300"
                        style={{
                          maxHeight: isActive ? "200px" : "0",
                          opacity: isActive ? 1 : 0,
                        }}
                      >
                        <ul className="mt-4 space-y-2">
                          {part.detail.map((item, j) => (
                            <li
                              key={j}
                              className="flex items-center gap-3 text-sm"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <span
                                className="w-1 h-1 rounded-full flex-shrink-0"
                                style={{ background: "var(--color-dark)", opacity: 0.6 }}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}

          {/* Final divider */}
          <div
            className={`h-px transition-all duration-700 ${
              isVisible ? "w-full" : "w-0"
            }`}
            style={{
              background: "var(--border-subtle)",
              transitionDelay: "800ms",
            }}
          />
        </div>
      </div>
    </section>
  );
}
