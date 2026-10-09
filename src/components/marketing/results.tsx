"use client";

import { SectionHeader, SectionMeta } from "@/components/mono/section-header";

import { useInView } from "./use-in-view";
import Cite from "./cite";
import { RevealText } from "./motion";

type CaseStudy = {
  name: string;
  context: string;
  stats: { value: string; label: string }[];
  /** Benchmark line shown below the stat grid. Anchors the result against the REIT band. */
  benchmark?: { text: string; cites: number[] };
};

const CASE_STUDIES: CaseStudy[] = [
  {
    name: "Ads in the trade area",
    context:
      "Meta reaches renters before they search. Google catches the ones already looking. Retargeting brings back the ones who left. Each ad points at its own page.",
    stats: [
      { value: "Meta", label: "before they search" },
      { value: "Google", label: "when they are looking" },
      { value: "Page", label: "one for every ad" },
      { value: "Offer", label: "the one that ad promised" },
    ],
  },
  {
    name: "From the page to a lease",
    context:
      "The renter reserves on your page, with storEDGE built in. Follow-up chases the reservation. When they move in, you mark it, and the report shows where they came from.",
    stats: [
      { value: "Reserve", label: "on your page" },
      { value: "Follow-up", label: "until they sign" },
      { value: "Mark", label: "the move-in yourself" },
      { value: "Report", label: "shows the source" },
    ],
  },
];

export default function Results() {
  const { ref, isVisible } = useInView();

  return (
    <section
      id="results"
      aria-label="Case studies and operator results"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader number="05" kicker="RESULTS" right={<SectionMeta text="CASE STUDIES" />} style={{ marginBottom: 24 }} />
        <div
          className={`text-center transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{ marginBottom: "56px" }}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>Here&apos;s what the system does once it&apos;s running.</RevealText>
          </h2>
          <p
            className="mt-5 mx-auto"
            style={{
              color: "var(--text-dim)",
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: 15,
              maxWidth: "60ch",
              lineHeight: 1.55,
            }}
          >
            Ads, a page, a reservation, and a move-in you can account for.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {CASE_STUDIES.map((study, i) => (
            <div
              key={study.name}
              className={`bg-[var(--color-light-gray)] border border-[var(--border-subtle)] rounded-2xl p-6 md:p-8 transition-all duration-700 ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${200 + i * 200}ms` }}
            >
              <h3 className="text-lg font-semibold text-[var(--color-dark)] mb-3">
                {study.name}
              </h3>
              <p
                className="text-sm mb-6"
                style={{
                  color: "var(--text-secondary)",
                  lineHeight: "var(--leading-normal)",
                }}
              >
                {study.context}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {study.stats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p
                      className="text-2xl font-semibold"
                      style={{
                        fontFamily: "var(--font-mono-family)",
                        color: "var(--color-dark)",
                        fontFeatureSettings: '"tnum" 1',
                      }}
                    >
                      {stat.value}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              {study.benchmark && (
                <div
                  className="mt-5 pt-4 text-xs"
                  style={{
                    borderTop: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  <span
                    className="inline-block mr-2 px-1.5 py-0.5 text-[9px] uppercase font-semibold"
                    style={{
                      letterSpacing: "var(--tracking-wide)",
                      background: "var(--color-light)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-heading)",
                      verticalAlign: "middle",
                    }}
                  >
                    Benchmark
                  </span>
                  {study.benchmark.text}
                  <Cite n={study.benchmark.cites} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ROI math */}
        <div
          className={`max-w-3xl mx-auto text-container transition-all duration-700 delay-500 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{ marginTop: 80 }}
        >
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <strong className="text-[var(--color-dark)]">A tenant pays rent for the stay.</strong>{" "}
            The system is built to fill empty units: map the trade area, run the ads, put the reservation on your page, and follow it until it becomes a lease.
          </p>
        </div>
      </div>
    </section>
  );
}
