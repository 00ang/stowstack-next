"use client";

import { SectionHeader, SectionMeta } from "@/components/mono/section-header";
import { PipelineFlow, FeatureHighlights } from "./hero";

import { useInView } from "./use-in-view";
import { RevealText } from "./motion";

const STEPS = [
  {
    number: "01",
    title: "Your market, mapped.",
    body: "We map your trade area: every competitor, their pricing, their reviews, their positioning. It updates automatically. You see the field before you spend a dollar.",
  },
  {
    number: "02",
    title: "Ads on Meta and Google.",
    body: "We build Meta and Google campaigns from your facility data and put them live from one dashboard. Meta reaches renters before they search. Google catches the ones already looking. Retargeting brings back the ones who left.",
    examples: [
      "[your-facility].storageads.com/climate-controlled: climate-controlled search campaign",
      "[your-facility].storageads.com/10x10-offer: first-month-free Meta campaign",
      "[your-facility].storageads.com/finish-your-rental: retargeting campaign",
    ],
    kicker:
      "A page for every ad. 8.7% of visitors reserve, against a 2.1% industry average on generic pages.",
  },
  {
    number: "03",
    title: "The renter books on your page.",
    body: "Every campaign gets its own landing page with your storEDGE reserve flow built in. The renter books on your page, under your brand. The reservation lands in storEDGE the same as a walk-in. No redirects. No third-party directory.",
  },
  {
    number: "04",
    title: "You see what's working.",
    body: "Every ad dollar tied to the unit it filled. What you spent, what you got, what each move-in cost. One dashboard. No mystery.",
  },
];

export default function HowItWorks() {
  const { ref, isVisible } = useInView();

  return (
    <section
      id="how-it-works"
      aria-label="How StorageAds works in four steps"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader number="01" kicker="HOW IT WORKS" right={<SectionMeta text="STEPS · 4" />} style={{ marginBottom: 24 }} />
        <div
          className={`text-center mb-10 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold max-w-3xl mx-auto"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>From ad dollar to signed lease.</RevealText>
          </h2>
          <p
            className="mt-4 mx-auto max-w-2xl"
            style={{ color: "var(--text-secondary)" }}
          >
            Market intelligence, ads, landing pages, the storEDGE reserve flow,
            and follow-up that turns reservations into move-ins. One system,
            start to finish.
          </p>

          {/* Pipeline flow — Ad → Page → Reserve → Move-in */}
          <div className="mt-8 max-w-sm mx-auto">
            <PipelineFlow isVisible={isVisible} />
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-0">
          {STEPS.map((step, i) => (
            <div key={step.number}>
              <div
                className={`h-px mx-auto transition-all duration-700 ${
                  isVisible ? "w-full" : "w-0"
                }`}
                style={{
                  background: "var(--border-subtle)",
                  transitionDelay: `${200 + i * 150}ms`,
                }}
              />

              <div
                className={`py-12 transition-all duration-700 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${300 + i * 150}ms` }}
              >
                <div className="flex items-start gap-6 min-w-0">
                  <span
                    className="text-3xl font-semibold flex-shrink-0"
                    style={{
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono-family)",
                    }}
                  >
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-semibold mb-3"
                      style={{ fontSize: "var(--text-subhead)" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      style={{
                        color: "var(--text-secondary)",
                        lineHeight: "var(--leading-normal)",
                      }}
                    >
                      {step.body}
                    </p>

                    {step.examples && (
                      <div className="mt-4 space-y-2">
                        {step.examples.map((ex, j) => (
                          <p
                            key={j}
                            className="text-sm pl-4 border-l-2"
                            style={{
                              borderColor: "var(--accent)",
                              color: "var(--text-secondary)",
                              fontFamily: "var(--font-mono-family)",
                              fontSize: "var(--text-small)",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                            }}
                          >
                            {ex}
                          </p>
                        ))}
                        {step.kicker && (
                          <p
                            className="mt-3 font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {step.kicker}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature highlights — merged from SolutionVisuals */}
        <div className={`mt-12 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h3
            className="text-lg sm:text-xl font-semibold text-center mb-2"
            style={{
              fontFamily: "var(--serif)",
              letterSpacing: "-0.03em",
            }}
          >
            <RevealText>Capabilities.</RevealText>
          </h3>
          <p
            className="text-sm text-center mx-auto mb-6"
            style={{ color: "var(--text-secondary)", maxWidth: "480px" }}
          >
            Everything the REITs staff a marketing department for, in one
            dashboard.
          </p>
          <FeatureHighlights isVisible={isVisible} />
        </div>
      </div>
    </section>
  );
}
