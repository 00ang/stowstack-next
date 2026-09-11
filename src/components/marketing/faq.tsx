"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { SectionHeader, SectionMeta } from "@/components/mono/section-header";
import { useInView } from "./use-in-view";
import Cite from "./cite";
import { RevealText } from "./motion";

/**
 * Homepage FAQ. The questions are phrased the way an operator would
 * actually ask them, not the way a marketing team would headline them.
 * Detailed billing / contract / ROI questions live on /pricing — these
 * are the eight things a curious operator wants answered before they
 * book a call.
 */

type FaqEntry = {
  q: string;
  a: string;
  /** Optional source ids appended at the end of the answer as superscript footnotes. */
  cite?: number[];
};

const FAQS: FaqEntry[] = [
  {
    q: "We're not running any ads right now.",
    a: "Most independent operators aren't. The system is built for that starting point. Market mapping, ads, landing pages, and follow-up all deploy from zero in the first week.",
  },
  {
    q: "What does the system include?",
    a: "Market intelligence. Ad creation and publishing to Meta and Google. Dedicated landing pages with storEDGE rental embedded. Retargeting. A/B testing scored by move-in outcome. Reservation-to-move-in conversion. Revenue intelligence. Organic capture. One dashboard.",
  },
  {
    q: "Do we need marketing experience to run it?",
    a: "No. The system builds campaigns from your facility data and puts them live, then handles targeting, bidding, and creative rotation. You approve and watch the numbers.",
  },
  {
    q: "How fast is it live?",
    a: "Ads are live in the first week. Move-ins start in weeks two through three as the campaigns gather data and retargeting kicks in. By month three you have a real baseline.",
  },
  {
    q: "How does the AI Creative Studio work?",
    a: "It generates ad copy, headlines, and landing page variants from your facility data: unit types, pricing, location, competitive positioning. You review and publish. New creative on demand without a retainer.",
  },
  {
    q: "We already get plenty of walk-ins and Google traffic.",
    a: "Good. That puts you ahead of most independents. The catch is Google's local algorithm weights proximity and review recency over brand size, which is the one place independents can outrank REIT locations. If you're not actively managing Google Business Profile, reviews, and retargeting the visitors you already get, you're sitting on the lever that costs the REITs $250M a year to operate at scale. The audit shows you which side of that gap you're on.",
    cite: [6],
  },
  {
    q: "We're in Texas (or Florida, or a Sun Belt metro). The market is rough.",
    a: "It is. San Antonio added roughly 656,000 square feet of new supply in 2026. Houston added 430,000. National supply growth is still slowing to 1.5% a year through 2027, but the oversupplied metros are absorbing first. You can't make new supply disappear. You can control how your facility prices against competitors, how fast you respond to leads, how your reviews read, and how the page performs at 11pm on a Sunday. That's the lever, and it's what the system runs.",
    cite: [10],
  },
  {
    q: "California passed SB 709. Should we worry about ECRI legislation?",
    a: "If you're in California, yes: SB 709 caps annual existing-customer rate increases at the lower of 5% + CPI or 10% as of January 2026. Twenty-four states introduced storage pricing bills in 2025. The NYC Department of Consumer and Worker Protection has an active case against Extra Space over the bait-and-switch ECRI playbook. The era of low introductory rate plus aggressive ECRI is closing. Operators who can't run real demand generation get squeezed first. The system is built so new-customer acquisition is your durable lever, not pricing tactics regulators are killing.",
    cite: [7, 8],
  },
  {
    q: "We only have one facility. Is this for us?",
    a: "Yes. One facility is the primary use case. The Portfolio plan covers operators with five or more.",
  },
  {
    q: "How does the storEDGE integration work?",
    a: "Landing pages embed the storEDGE reservation widget. The renter books on your branded page, and the reservation lands in storEDGE the same as a walk-in. Rates, availability, and payments stay in your existing system.",
  },
  {
    q: "What if it doesn't work?",
    a: "If move-ins haven't improved by the end of month three, month four is free. You carry no risk for a quarter that didn't fill units.",
  },
];

export default function FAQ() {
  const { ref, isVisible } = useInView();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      aria-label="Frequently asked questions"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader
          number="07"
          kicker="QUESTIONS"
          right={<SectionMeta text={`${FAQS.length} ANSWERS`} />}
          style={{ marginBottom: 24 }}
        />

        <div
          className={`max-w-3xl mx-auto text-center mb-10 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>Common questions from operators.</RevealText>
          </h2>
          <p className="mt-4 mx-auto max-w-xl" style={{ color: "var(--text-secondary)" }}>
            If yours isn&apos;t here, email{" "}
            <a
              href="mailto:blake@storageads.com"
              className="font-medium underline decoration-1 underline-offset-4 transition-colors hover:text-[var(--color-dark)]"
              style={{ color: "var(--color-dark)" }}
            >
              blake@storageads.com
            </a>
            . You&apos;ll get the founder, not a help desk.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {FAQS.map((faq, i) => {
            const isOpen = open === i;
            return (
              <div
                key={faq.q}
                className={`border-b transition-all duration-700 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                }`}
                style={{
                  borderColor: "var(--border-subtle)",
                  borderTop: i === 0 ? "1px solid var(--border-subtle)" : undefined,
                  transitionDelay: `${100 + i * 60}ms`,
                }}
              >
                <button
                  type="button"
                  id={`faq-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 text-left py-5 transition-colors hover:bg-[var(--color-light-gray)]/30 cursor-pointer"
                >
                  <h3
                    className="text-base sm:text-lg font-semibold flex-1"
                    style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}
                  >
                    {faq.q}
                  </h3>
                  <span
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center mt-1"
                    aria-hidden="true"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isOpen ? <Minus size={16} /> : <Plus size={16} />}
                  </span>
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  aria-hidden={!isOpen}
                  className="overflow-hidden transition-all duration-300"
                  style={{
                    maxHeight: isOpen ? 400 : 0,
                    opacity: isOpen ? 1 : 0,
                  }}
                >
                  <p
                    className="pb-5 pr-12 text-[15px]"
                    style={{
                      color: "var(--text-secondary)",
                      lineHeight: "var(--leading-normal)",
                    }}
                  >
                    {faq.a}
                    {faq.cite && <Cite n={faq.cite} />}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
