import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "About StorageAds: Built for Storage Operators",
  description:
    "StorageAds is the marketing system independent storage operators never had: market mapping, Meta and Google ads, a page for every ad, and every reservation chased to a signed lease.",
  openGraph: {
    title: "About StorageAds: Built for Storage Operators",
    description: "StorageAds is the marketing system independent storage operators never had: market mapping, Meta and Google ads, a page for every ad, and every reservation chased to a signed lease.",
    url: "https://storageads.com/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "About StorageAds: Built for Storage Operators",
    description: "The marketing system independent storage operators never had.",
  },
};

export default function AboutPage() {
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
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: "-0.5px",
            }}
          >
            <span style={{ color: "var(--color-dark)" }}>storage</span>
            <span style={{ color: "var(--color-gold)" }}>ads</span>
          </span>
          <span
            className="text-sm ml-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            / About
          </span>
        </div>
      </header>

      {/* Content */}
      <article className="max-w-2xl mx-auto px-6 pt-24 pb-32">
        <h1
          className="font-semibold mb-12"
          style={{
            fontSize: "var(--text-section-head)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          Built for storage.{" "}
          <span style={{ color: "var(--color-gold)" }}>Nothing else.</span>
        </h1>

        <div
          className="space-y-6"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-lg)",
            lineHeight: "var(--leading-normal)",
            color: "var(--text-secondary)",
          }}
        >
          <p>
            Most independent operators have the same problem. Money goes out to
            ads every month, and nobody can say which of those ads actually
            filled a unit.
          </p>

          <p>
            The agency sends a tidy report. Clicks are up. Everything looks
            great. Ask how many of those clicks turned into tenants and the
            answer stops coming.
          </p>

          <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            StorageAds exists to answer that question, and then fix it.
          </p>

          <p>
            Not a general marketing tool with a storage page bolted on. Not
            something built for e-commerce and reshaped to fit. A system built
            around the way storage operators actually run the business:
            move-ins, occupancy, and revenue.
          </p>

          {/* Divider */}
          <div
            className="my-12"
            style={{
              height: "1px",
              background: "var(--border-subtle)",
            }}
          />

          <p>
            Every dollar of ad spend gets tracked to the phone call, the
            walk-in, and the move-in. Not a guess and not a model. The actual
            unit that got rented, traced back to the ad that filled it.
          </p>

          <p>
            That changes what you do next. Spend that looks good on paper but
            never fills a unit gets cut. What works gets more. The cost of
            filling a unit comes down, and every month you know why.
          </p>

          <p style={{ color: "var(--text-primary)", fontWeight: 500 }}>
            The REITs have run this way for years. Independents have not had the
            option.
          </p>

          {/* Divider */}
          <div
            className="my-12"
            style={{
              height: "1px",
              background: "var(--border-subtle)",
            }}
          />

          <p>
            You deserve to know where the money is going. Not
            &quot;impressions&quot; and &quot;click-through rates&quot;: real
            answers. How many move-ins did the ads bring this month? What did
            each one cost? Which campaigns stay and which ones go?
          </p>

          <p>
            Storage is the only thing we build for. Every feature has to earn
            its place against one test: does it fill units? If it
            doesn&apos;t, it doesn&apos;t ship.
          </p>

          <p
            className="text-xl font-medium"
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            This isn&apos;t a marketing agency. It&apos;s the marketing system
            the REITs already have, built for the operators who don&apos;t.
          </p>

        </div>

        {/* CTA */}
        <div
          className="mt-16 rounded-lg p-8 text-center"
          style={{
            background: "rgba(181,139,63,0.06)",
            border: "1px solid var(--color-gold)",
          }}
        >
          <p
            className="font-semibold mb-2"
            style={{
              fontSize: "var(--text-subhead)",
              fontFamily: "var(--font-heading)",
            }}
          >
            Want to see what this looks like for your facility?
          </p>
          <p
            className="mb-6 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Get a free diagnostic: no pitch deck, no commitment.
          </p>
          <Link href="/diagnostic" className="btn-primary inline-block">
            Get a Free Facility Audit
          </Link>
        </div>
      </article>
    </div>
  );
}
