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
    name: "Single-Site Independent: Cassopolis, MI",
    context:
      "A 247-unit facility at 71% occupancy with no paid ads and a default storEDGE rental page. StorageAds launched a Meta campaign with 3 ad-specific landing pages targeting climate-controlled, vehicle storage, and first-month-free audiences.",
    stats: [
      { value: "34", label: "move-ins in 90 days" },
      { value: "$41", label: "per move-in" },
      { value: "71% → 84%", label: "occupancy in one quarter" },
      { value: "35x", label: "return on ad spend" },
    ],
    benchmark: {
      text: "84% lands above the 87.2% independent average and inside reach of the 92.6% REIT band. One quarter, one facility, no new units built.",
      cites: [1, 2],
    },
  },
  {
    name: "Lakeshore Storage: South Haven, MI",
    context:
      "A seasonal market with 60% winter occupancy. StorageAds ran targeted campaigns for boat/RV storage and temperature-sensitive items during the fall shoulder season.",
    stats: [
      { value: "22", label: "move-ins in 60 days" },
      { value: "$38", label: "per move-in" },
      { value: "74%", label: "winter occupancy (vs 60% prior year)" },
      { value: "8.7%", label: "of page visitors reserved (vs 2.1% industry)" },
    ],
    benchmark: {
      text: "+14 points of winter occupancy in a market where the national web rate dropped 4.71% YoY. The renters were there. The system just had to reach them.",
      cites: [3],
    },
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
            <RevealText>We tested it on our own facilities first. Here&apos;s what happened.</RevealText>
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
            Two facilities. Real campaigns. Numbers pulled directly from
            storEDGE and the StorageAds reporting layer. No case-study polish.
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
            <strong className="text-[var(--color-dark)]">Here&apos;s the math.</strong>{" "}
            A move-in at a typical facility pays $130 a month and stays 14
            months. That&apos;s about $1,820 per move-in. Five to ten extra
            move-ins a month adds $9,000-18,000 in future rent every month.
            The Launch plan plus a typical ad budget runs about $1,750 a
            month. That&apos;s 5-10x before the system even starts tightening
            up.
          </p>
          <p
            className="text-sm leading-relaxed mt-4"
            style={{ color: "var(--text-secondary)" }}
          >
            And it compounds. As the move-in data stacks up over six months,
            what you pay for each move-in drops and the reserve rate climbs.
            The math only gets better with time.
          </p>
        </div>
      </div>
    </section>
  );
}
