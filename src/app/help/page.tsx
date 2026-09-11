"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, MessageCircle, ChevronDown } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_CATEGORIES: { title: string; items: FaqItem[] }[] = [
  {
    title: "Getting Started",
    items: [
      { question: "How does StorageAds work?", answer: "StorageAds creates ad-specific landing pages with embedded reservation flows. We track every click from your ads through to a signed lease, giving you real cost-per-move-in data instead of just clicks." },
      { question: "How long does setup take?", answer: "Most facilities are live within 48 hours. We handle the initial setup, including ad account connections, landing page creation, and campaign configuration." },
      { question: "Do I need a storEDGE account?", answer: "Yes. StorageAds integrates with storEDGE for online reservations and move-in tracking. This connection is how we tie each move-in back to the ad that produced it." },
    ],
  },
  {
    title: "Billing",
    items: [
      { question: "How much does StorageAds cost?", answer: "Pricing is per facility per month. Plans range from $750 to $2,000+ depending on services. Visit storageads.com/pricing for current rates." },
      { question: "Is there a contract?", answer: "Month-to-month. No long-term contracts. You can cancel anytime from your Settings page." },
      { question: "How does billing work for multiple facilities?", answer: "Each facility is billed separately. Multi-facility operators get a single invoice with per-facility line items." },
    ],
  },
  {
    title: "Campaigns & Reporting",
    items: [
      { question: "What is cost per move-in?", answer: "Cost per move-in is your total ad spend divided by the number of attributed move-ins. Unlike cost per lead or cost per click, this measures actual revenue: a signed lease." },
      { question: "How accurate is the attribution?", answer: "We track the full journey: ad click → landing page → storEDGE reservation → move-in. Attribution is based on this complete chain, not estimates." },
      { question: "Can I download reports?", answer: "Yes. Go to Reports in your dashboard to generate PDF or CSV reports for any date range. Reports include move-in attribution, campaign performance, and ROI breakdowns." },
    ],
  },
];

function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mb-8">
      <h3 className="text-base font-medium mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="rounded-lg border" style={{ borderColor: "var(--color-light-gray)" }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
                  {item.question}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  style={{ color: "var(--color-mid-gray)" }}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-3">
                  <p className="text-sm" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)", lineHeight: 1.6 }}>
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-light)" }}>
      <header className="border-b" style={{ borderColor: "var(--color-light-gray)" }}>
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            <span>storage</span><span style={{ color: "var(--color-gold)" }}>ads</span>
          </Link>
          <span style={{ color: "var(--color-mid-gray)" }}>/</span>
          <span className="text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-mid-gray)" }}>Help</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
          Help Center
        </h1>
        <p className="text-base mb-10" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}>
          Answers to common questions. Can&apos;t find what you need? Reach out directly.
        </p>

        {/* Contact options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Mail, label: "Email", value: "blake@storageads.com", href: "mailto:blake@storageads.com", external: false },
            { icon: Phone, label: "Call", value: "Book a call", href: CAL_BOOKING_URL, external: true },
            { icon: MessageCircle, label: "Chat", value: "Coming soon", href: undefined, external: false },
          ].map((item) => {
            const Icon = item.icon;
            const linkClass = "text-xs";
            const linkStyle = { fontFamily: "var(--font-body)", color: "var(--color-gold)" };
            return (
              <div
                key={item.label}
                className="rounded-xl border p-4 text-center"
                style={{ borderColor: "var(--color-light-gray)" }}
              >
                <Icon className="mx-auto mb-2 h-5 w-5" style={{ color: "var(--color-gold)" }} />
                <p className="text-xs font-medium mb-0.5" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
                  {item.label}
                </p>
                {item.href ? (
                  item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass} style={linkStyle}>
                      {item.value}
                    </a>
                  ) : (
                    <Link href={item.href} className={linkClass} style={linkStyle}>
                      {item.value}
                    </Link>
                  )
                ) : (
                  <span className="text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
                    {item.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <h2 className="text-xl font-medium mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
          Frequently Asked Questions
        </h2>

        {FAQ_CATEGORIES.map((cat) => (
          <FaqSection key={cat.title} title={cat.title} items={cat.items} />
        ))}
      </main>
    </div>
  );
}
