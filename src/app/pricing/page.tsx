import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { conversionPlans, demandEnginePlans } from "@/lib/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "StorageAds pricing per facility. Paid media, custom landing pages, ad-to-move-in tracking. From $750/mo.",
  openGraph: {
    title: "Pricing | StorageAds",
    description: "StorageAds pricing per facility. Paid media, custom landing pages, ad-to-move-in tracking. From $750/mo.",
    url: "https://storageads.com/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | StorageAds",
    description: "StorageAds pricing per facility. Paid media, custom landing pages, ad-to-move-in tracking. From $750/mo.",
  },
};

export default function PricingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-[100] border-b"
        style={{
          background: "var(--color-light)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, letterSpacing: "-0.5px" }}>
            <span style={{ color: "var(--color-dark)" }}>storage</span><span style={{ color: "var(--color-gold)" }}>ads</span>
          </span>
        </div>
      </header>

      {/* Intro */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1
          className="font-semibold mb-6"
          style={{
            fontSize: "var(--text-section-head)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          Before you look at the price, look at the math.
        </h1>
        <div
          className="mx-auto space-y-4"
          style={{
            maxWidth: "680px",
            color: "var(--text-secondary)",
            fontSize: "var(--text-body)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          <p>
            A single move-in at a typical self-storage facility generates
            $100-150 per month in recurring revenue. The average tenant stays 12
            months. That&apos;s $1,200-1,800 in lifetime value from one move-in.
          </p>
          <p>
            If StorageAds produces 5 additional move-ins in a month, that&apos;s
            $6,000-9,000 in annualized revenue. If it produces 10, that&apos;s
            $12,000-18,000.
          </p>
          <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            Now look at the price.
          </p>
        </div>
      </section>

      {/* Demand Engine */}
      <section
        className="py-20"
        style={{ background: "var(--color-light)" }}
      >
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-4">
            <span
              className="text-xs font-semibold uppercase"
              style={{
                color: "var(--accent)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              Product A
            </span>
          </div>
          <h2
            className="font-semibold mb-2"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            Paid Media
          </h2>
          <p
            className="mb-4"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
              maxWidth: "680px",
            }}
          >
            We create, manage, and tune paid ad campaigns. Every campaign
            maps to its own landing page.
          </p>
          <p
            className="mb-12"
            style={{
              color: "var(--text-tertiary)",
              fontSize: "var(--text-small)",
            }}
          >
            Monthly retainer. Ad spend paid directly to Meta/Google: separate
            from StorageAds fees.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {demandEnginePlans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg p-6 flex flex-col relative"
                style={{
                  background: "var(--color-light)",
                  border: plan.isRecommended
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border-subtle)",
                }}
              >
                {plan.isRecommended && (
                  <span
                    className="absolute -top-3 left-6 text-xs font-semibold uppercase px-3 py-1 rounded-full"
                    style={{
                      background: "var(--accent)",
                      color: "var(--text-inverse)",
                      letterSpacing: "var(--tracking-wide)",
                    }}
                  >
                    recommended
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-2">{plan.name}</h3>
                <div className="mb-3">
                  <span
                    className="text-2xl font-semibold"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className="text-sm mb-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {plan.description}
                </p>
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Check
                        size={16}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: "var(--accent)" }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.bestFor && (
                  <p
                    className="text-xs mt-auto pt-4 border-t"
                    style={{
                      color: "var(--text-tertiary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Best for:{" "}
                    </span>
                    {plan.bestFor}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Layer */}
      <section className="py-20" style={{ background: "var(--color-light)" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-4">
            <span
              className="text-xs font-semibold uppercase"
              style={{
                color: "var(--accent)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              Product B
            </span>
          </div>
          <h2
            className="font-semibold mb-2"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            Conversion Layer (Custom Website + storEDGE Embed)
          </h2>
          <p
            className="mb-4"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
              maxWidth: "680px",
            }}
          >
            A branded facility website with embedded reservation and move-in
            functionality. Sold standalone or bundled with the Demand Engine.
          </p>
          <p
            className="mb-12"
            style={{
              color: "var(--text-tertiary)",
              fontSize: "var(--text-small)",
            }}
          >
            One-time build fee + monthly hosting and management.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {conversionPlans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-lg p-6 flex flex-col relative"
                style={{
                  background: "var(--color-light)",
                  border:
                    plan.tag
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border-subtle)",
                }}
              >
                {plan.tag && (
                  <span
                    className="absolute -top-3 left-6 text-xs font-semibold uppercase px-3 py-1 rounded-full"
                    style={{
                      background: "var(--accent)",
                      color: "var(--text-inverse)",
                      letterSpacing: "var(--tracking-wide)",
                    }}
                  >
                    {plan.tag}
                  </span>
                )}
                <h3 className="text-lg font-semibold mb-3">{plan.name}</h3>
                <div
                  className="mb-6 text-sm font-semibold"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {plan.price}
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Check
                        size={16}
                        className="flex-shrink-0 mt-0.5"
                        style={{ color: "var(--accent)" }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.bestFor && (
                  <p
                    className="text-xs mt-auto pt-4 border-t"
                    style={{
                      color: "var(--text-tertiary)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Best for:{" "}
                    </span>
                    {plan.bestFor}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bundle */}
      <section className="py-20" style={{ background: "var(--color-light)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2
            className="font-semibold mb-2"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            The Bundle: One System, One Bill
          </h2>
          <p
            className="mb-8"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
            }}
          >
            One system. The ad, the page, the rental flow, the reporting. All
            connected.
          </p>
          <div
            className="rounded-lg p-8 text-left space-y-4"
            style={{
              background: "var(--color-light)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-body)" }}>
              Commit to 6 months of Growth and the site build drops from $5,000
              to $2,500. That&apos;s a $2,500 discount that locks in your full
              acquisition system from day one.
            </p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <li className="flex gap-2">
                <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <span><strong style={{ color: "var(--text-primary)" }}>One-time build:</strong> $2,500-4,000 (waived or discounted with 6-month Growth commitment)</span>
              </li>
              <li className="flex gap-2">
                <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <span><strong style={{ color: "var(--text-primary)" }}>Monthly retainer:</strong> $1,500-2,000/mo per facility</span>
              </li>
              <li className="flex gap-2">
                <Check size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <span><strong style={{ color: "var(--text-primary)" }}>Optional performance bonus:</strong> $X per move-in above your target baseline</span>
              </li>
            </ul>
            <p className="pt-4" style={{ color: "var(--text-secondary)", fontSize: "var(--text-body)" }}>
              You&apos;re paying one company for a website and another for ads.
              Neither one can tell you which ad produced a move-in. With
              StorageAds, it&apos;s one system: the ad, the page, the rental flow,
              and the reporting. All connected.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20" style={{ background: "var(--color-light)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <h2
            className="font-semibold mb-8 text-center"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            What you&apos;re actually paying for
          </h2>
          <div className="space-y-6">
            {[
              {
                price: "$299-899/mo on an SEO shop",
                copy: "You get a nice website and a promise that organic traffic will build in 3-6 months. No paid traffic. No embedded rental flow. No attribution. No idea which page produced a move-in.",
              },
              {
                price: "$149-399/mo on a Google-only tool",
                copy: 'You get automated Google ads that send clicks to your default rental page. No custom landing pages. No Meta ads. No way to tell which click filled a unit. They chase clicks, not leases.',
              },
              {
                price: "$750-1,500/mo on StorageAds",
                copy: "You get Meta ads, Google ads, and retargeting, each pointed at its own page with the storEDGE reserve flow. You mark a move-in when it happens, and the report shows where that person came from.",
                isHighlighted: true,
              },
            ].map((item) => (
              <div
                key={item.price}
                className="rounded-lg p-6"
                style={{
                  background: item.isHighlighted
                    ? "rgba(68,99,134,0.06)"
                    : "transparent",
                  border: item.isHighlighted
                    ? "1px solid var(--color-gold)"
                    : "1px solid var(--border-subtle)",
                }}
              >
                <h3
                  className="text-sm font-semibold uppercase mb-3"
                  style={{
                    color: item.isHighlighted
                      ? "var(--accent)"
                      : "var(--text-tertiary)",
                    letterSpacing: "var(--tracking-wide)",
                  }}
                >
                  {item.price}
                </h3>
                <p
                  className="text-sm"
                  style={{
                    color: "var(--text-secondary)",
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SpareFoot Comparison */}
      <section className="py-20" style={{ background: "var(--color-light)" }}>
        <div className="max-w-3xl mx-auto px-6">
          <h2
            className="font-semibold mb-4 text-center"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            The SpareFoot math
          </h2>
          <p
            className="mb-10 text-center mx-auto"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
              maxWidth: "580px",
            }}
          >
            Most operators are already paying for marketing through aggregator
            commissions. Here&apos;s what that actually costs.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* SpareFoot */}
            <div
              className="rounded-lg p-6"
              style={{ border: "1px solid var(--border-subtle)" }}
            >
              <h3
                className="text-sm font-semibold uppercase mb-4"
                style={{
                  color: "var(--text-tertiary)",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                SpareFoot / Aggregator
              </h3>
              <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <p>
                  Standard commission: <strong style={{ color: "var(--text-primary)" }}>2x first month&apos;s rent</strong>
                </p>
                <p>
                  On a $130/month unit: <strong style={{ color: "var(--text-primary)" }}>$260 per move-in</strong>
                </p>
                <p>
                  Two full months of rent gone before the tenant unpacks.
                </p>
                <p>
                  Typical range across unit sizes: <strong style={{ color: "var(--text-primary)" }}>$130-390 per move-in</strong>
                </p>
              </div>
            </div>

            {/* StorageAds */}
            <div
              className="rounded-lg p-6"
              style={{
                background: "rgba(68,99,134,0.06)",
                border: "1px solid var(--color-gold)",
              }}
            >
              <h3
                className="text-sm font-semibold uppercase mb-4"
                style={{
                  color: "var(--accent)",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                StorageAds
              </h3>
              <div className="space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <p>
                  Monthly retainer: <strong style={{ color: "var(--text-primary)" }}>$750-1,500</strong>
                </p>
                <p>
                  Target cost per move-in via Meta: <strong style={{ color: "var(--text-primary)" }}>$30-80</strong>
                </p>
                <p>
                  Break even at just <strong style={{ color: "var(--accent)" }}>3-5 move-ins per month</strong>
                </p>
                <p>
                  Every move-in after that is pure upside: you keep your first month&apos;s rent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24" style={{ background: "var(--color-light)" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2
            className="font-semibold mb-4"
            style={{
              fontSize: "var(--text-subhead)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            Let&apos;s talk about your facilities.
          </h2>
          <p
            className="mb-8 mx-auto"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
              maxWidth: "520px",
            }}
          >
            This isn&apos;t a self-serve checkout. StorageAds is built for operators
            who want a real conversation about their vacancy, their market, and
            what the full system would look like at their facilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#cta"
              className="btn-primary inline-block text-center"
            >
              Get a Free Facility Audit
            </Link>
            <Link
              href="/signup"
              className="btn-secondary inline-block text-center"
            >
              Start a 14-day trial
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
