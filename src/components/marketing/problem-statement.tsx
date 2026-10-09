"use client";

import { useInView } from "./use-in-view";
import { SectionHeader, SectionMeta } from "@/components/mono/section-header";
import Cite from "./cite";
import { RevealText } from "./motion";

type Problem = {
  heading: string;
  body: string;
  highlight: string;
  /** Optional source ids to cite at the end of the heading. */
  cite?: number[];
};

const PROBLEMS: Problem[] = [
  {
    heading: "The REIT-to-independent occupancy gap is 5+ points.",
    body: "Extra Space ran 92.6% same-store occupancy in Q4 2025. The independent average sits at 87.2% across a panel of 70,000+ properties. At a 500-unit facility, that gap is around $72,000 a year in revenue you're not collecting, and around $1.3M of asset value at a 5.5% cap. You close that gap with marketing infrastructure, the same lever the REITs already pull.",
    highlight: "$72,000 a year",
    cite: [1, 2, 3],
  },
  {
    heading: "Independents are outspent 1,000-to-1 on Google search.",
    body: "The top REITs spend $250M+ a year on digital marketing and handle 85% of customer interactions digitally. The independent down the road is competing for the same renter with no ads running, a default rental page, and a Google Business Profile no one is tending. The good news: Google weighs proximity and review recency over brand size in local search. The lever exists. Most operators just aren't pulling it.",
    highlight: "1,000-to-1",
    cite: [6],
  },
  {
    heading: "Revenue leakage compounds monthly.",
    body: "Reservations that never move in. Competitors you haven't priced against. Reviews unanswered. Google traffic uncaptured. Visitors who leave and never come back. Each one is money leaking out of the building. The system finds the leaks and plugs them.",
    highlight: "finds the leaks and plugs them",
  },
  {
    heading: "The economics still work at independent scale.",
    body: "A tenant pays rent for the length of the stay. The same system that fills a REIT fills a 150-unit yard: ads in the trade area, a page for each one, and a reservation that can become a lease.",
    highlight: "a 150-unit yard",
  },
];

export default function ProblemStatement() {
  const { ref, isVisible } = useInView();

  return (
    <section
      id="problem"
      aria-label="The problem with current self-storage marketing"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="text-container">
        <SectionHeader number="04" kicker="THE PROBLEM" right={<SectionMeta text="TRUTH · 4" />} style={{ marginBottom: 24 }} />
        {/* Section headline */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>The economics are simple. Independents never had the infrastructure to act on them. Now you do.</RevealText>
          </h2>
          <p
            className="mt-6 mx-auto"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
            }}
          >
            REITs hit 92.6% occupancy<Cite n={1} />. Independents average
            87.2%<Cite n={2} />. The gap is worth around $72,000 a year at a
            500-unit facility, and around $1.3M in asset value at a 5.5% cap
            <Cite n={3} />. Most operators can&apos;t tell which ads filled
            which units. Most aren&apos;t running ads at all.
          </p>
          <p
            className="mt-4 font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            Here&apos;s what&apos;s actually happening.
          </p>
        </div>

        {/* Pain points */}
        <div className="space-y-0">
          {PROBLEMS.map((problem, i) => (
            <div key={i}>
              {/* Divider */}
              <div
                className={`h-px mx-auto transition-all duration-700 ${
                  isVisible ? "w-full" : "w-0"
                }`}
                style={{
                  background: "var(--border-subtle)",
                  transitionDelay: `${300 + i * 200}ms`,
                }}
              />

              <div
                className={`py-12 transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${400 + i * 200}ms` }}
              >
                <h3
                  className="font-semibold mb-4"
                  style={{
                    fontSize: "var(--text-subhead)",
                    color: "var(--text-primary)",
                  }}
                >
                  {problem.heading}
                  {problem.cite && <Cite n={problem.cite} />}
                </h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "var(--text-body)",
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  {problem.body.split(problem.highlight).map((part, j) => (
                    <span key={j}>
                      {part}
                      {j === 0 && (
                        <span style={{ color: "var(--accent)" }}>
                          {problem.highlight}
                        </span>
                      )}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}

          {/* Final divider */}
          <div
            className={`h-px mx-auto transition-all duration-700 ${
              isVisible ? "w-full" : "w-0"
            }`}
            style={{
              background: "var(--border-subtle)",
              transitionDelay: "900ms",
            }}
          />
        </div>

        {/* Kicker */}
        <div
          className={`text-center mt-12 transition-all duration-700 delay-1000 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <p
            className="text-xl font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Every month you wait, the REIT down the road fills the units you
            didn&apos;t.
          </p>
        </div>
      </div>
    </section>
  );
}
