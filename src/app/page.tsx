"use client";

import dynamic from "next/dynamic";
import Hero, {
  BecauseLetterboard,
  CapabilitiesGrid,
  BeforeAfterComparison,
  LiveStatsStrip,
  StatsBar,
} from "@/components/marketing/hero";
import ProblemStatement from "@/components/marketing/problem-statement";
import Nav from "@/components/marketing/nav";
import { LiveMonitorTriptych } from "@/components/marketing/live-monitors";
import { useInView } from "@/components/marketing/use-in-view";
import { RevealText } from "@/components/marketing/motion";

const SystemOverview = dynamic(
  () => import("@/components/marketing/system-overview"),
);
const HowItWorks = dynamic(
  () => import("@/components/marketing/how-it-works"),
);
const FourWayComparison = dynamic(
  () => import("@/components/marketing/four-way-comparison"),
);
const QuickCalculator = dynamic(
  () => import("@/components/marketing/quick-calculator"),
);
const Results = dynamic(() => import("@/components/marketing/results"));
const CTASection = dynamic(
  () => import("@/components/marketing/cta-section"),
);
const FAQ = dynamic(() => import("@/components/marketing/faq"));
const DemandTriggers = dynamic(
  () => import("@/components/marketing/demand-triggers"),
);
const SourcesNote = dynamic(
  () => import("@/components/marketing/sources-note"),
);
const Footer = dynamic(() => import("@/components/marketing/footer"));
// Sticky mobile CTA — mounts client-side after the page becomes interactive.
// 80% of homepage traffic is FB-IAB on iPhone-class devices, where the user
// almost never scrolls back up to convert. Always-on bottom button.
const StickyMobileCTA = dynamic(
  () => import("@/components/marketing/sticky-mobile-cta"),
  { ssr: false },
);
const HomepageLeadPopup = dynamic(
  () => import("@/components/marketing/homepage-lead-popup"),
  { ssr: false },
);

/* ───────────────────────────────────────────────────────────────────────────
 * Homepage IA — Product-first SaaS conversion sequence (consolidated)
 *
 *  §   Component               Role
 *  ──  ──────────────────────   ──────────────────────────────────────
 *  —   <Hero />                 Hook + primary CTA + mobile dashboard proof
 *  01  <HowItWorks />           Steps + pipeline flow + feature highlights
 *  02  <SystemOverview />       The system — 6 parts wired together
 *  —   <CapabilitiesSection />  Full platform capabilities grid
 *  03  <FourWayComparison />    StorageAds vs alternatives
 *  —   <BeforeAfterSection />   Before/after broken-workflow pairs
 *  04  <ProblemStatement />     The underlying problem
 *  —   <BecauseLetterboard />   Pain refrain (split-flap)
 *  —   <InactionTimeline />     Cost of inaction → moved to its own page (/cost-of-inaction)
 *  05  <Results />              Proof — case studies + stats + StatsBar
 *  —   <LiveStatsSection />     Industry/forecast numbers
 *  —   <StatsBar />             4 hero-stat counters
 *  —   <DemandTriggers />       Operator-credibility interlude
 *  06  <QuickCalculator />      Revenue calculator (surfaces $749)
 *  07  <FAQ />                  Objection handling (8 Q+A pairs)
 *  08  <CTASection />           Final CTA (4-field audit form + Cal.com)
 * ───────────────────────────────────────────────────────────────────────────
 */

/* ─── Slot 4 — before/after extension ─── */
function BeforeAfterSection() {
  const { ref, isVisible } = useInView(0.1);
  return (
    <section
      ref={ref}
      aria-label="Before and after: replacing broken workflows"
      className="relative border-t"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-alt)",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 py-12 sm:py-16">
        <div
          className={`text-center mb-6 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <h2
            className="text-lg sm:text-xl font-semibold"
            style={{
              fontFamily: "var(--serif)",
              letterSpacing: "-0.03em",
              color: "var(--color-dark)",
            }}
          >
            <RevealText>Stop waiting. Start filling.</RevealText>
          </h2>
          <p
            className="text-sm mt-1 mx-auto"
            style={{ color: "var(--text-secondary)", maxWidth: "420px" }}
          >
            How StorageAds replaces the workflows operators are still running by hand.
          </p>
        </div>
        <BeforeAfterComparison isVisible={isVisible} />
      </div>
    </section>
  );
}

/* ─── Slot 5 — capabilities grid ─── */
function CapabilitiesSection() {
  const { ref, isVisible } = useInView(0.1);
  return (
    <section
      ref={ref}
      aria-label="Everything in the system: capabilities grid"
      className="relative border-t"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 py-12 sm:py-16">
        <div
          className={`text-center mb-6 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
        >
          <h2
            className="text-lg sm:text-xl font-semibold"
            style={{
              fontFamily: "var(--serif)",
              letterSpacing: "-0.03em",
              color: "var(--color-dark)",
            }}
          >
            <RevealText>Everything in the system</RevealText>
          </h2>
        </div>
        <CapabilitiesGrid isVisible={isVisible} />
      </div>
    </section>
  );
}

/* ─── Slot 6 — §00 NUMBERS strip + monitor triptych ─── */
function LiveStatsSection() {
  const { ref, isVisible } = useInView(0.1);
  return (
    <section
      ref={ref}
      aria-label="Industry and forecast numbers"
      className="relative border-t"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 py-12 sm:py-16">
        <LiveStatsStrip isVisible={isVisible} />
        <div className="mt-8">
          <LiveMonitorTriptych />
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main-content">
        {/* Hero */}
        <Hero />

        {/* §01 — How it works + feature highlights (merged) */}
        <HowItWorks />

        {/* §02 — The system (6 parts wired together) */}
        <SystemOverview />
        <CapabilitiesSection />

        {/* §03 — Differentiator vs alternatives */}
        <FourWayComparison />
        <BeforeAfterSection />

        {/* §04 — The underlying problem */}
        <ProblemStatement />
        <BecauseLetterboard />

        {/* §05 — Proof (Results + stats + ROI consolidated) */}
        <Results />
        <LiveStatsSection />
        <StatsBar />

        {/* Demand triggers — operator-credibility / market knowledge.
            Moved from after SolutionVisuals (was too high up) to right
            before pricing so it acts as the final "why us — we live this
            market every week" reassurance before the conversion ask. */}
        <DemandTriggers />

        {/* §06 — Pricing (partial fit; QuickCalculator surfaces $749) */}
        <QuickCalculator />

        {/* §07 — FAQ */}
        <FAQ />

        {/* §08 — Final CTA */}
        <CTASection />

        {/* Source disclosure for every market stat cited above. Sits inside
            <main> so it's part of the page content, not chrome. */}
        <SourcesNote />
      </main>
      <Footer />
      {/* Mobile-only sticky CTA. Hides itself when the audit form (§08)
          enters the viewport so it doesn't sit on top of the form fields. */}
      <StickyMobileCTA />
      <HomepageLeadPopup />
    </>
  );
}
