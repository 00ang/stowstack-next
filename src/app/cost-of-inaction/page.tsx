import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import InactionTimeline from "@/components/marketing/inaction-timeline";

export const metadata: Metadata = {
  title: "The Cost of Inaction | StorageAds",
  description:
    "Six months of an unmarketed self-storage facility, month by month: vacant units, a competitor's ad machine, and the revenue spiral. The math on doing nothing.",
  openGraph: {
    title: "The Cost of Inaction | StorageAds",
    description:
      "Six months of an unmarketed self-storage facility, month by month. The math on doing nothing.",
    url: "https://storageads.com/cost-of-inaction",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Cost of Inaction | StorageAds",
    description:
      "Six months of an unmarketed self-storage facility, month by month. The math on doing nothing.",
  },
};

export default function CostOfInactionPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
    >
      {/* Lightweight nav — matches the secondary-page pattern (see /about) */}
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
            aria-label="Back to homepage"
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
            <span style={{ color: "var(--brand-ads)" }}>ads</span>
          </span>
          <span
            className="text-sm ml-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            / Cost of Inaction
          </span>
        </div>
      </header>

      {/* The former homepage §05 section, now standalone */}
      <main id="main-content">
        <InactionTimeline />

        {/* CTA — mirrors the /about page's conversion block */}
        <div className="max-w-2xl mx-auto px-6 pb-24">
          <div
            className="p-8 text-center"
            style={{
              background: "var(--bg-alt)",
              border: "1px solid var(--line)",
            }}
          >
            <p
              className="font-semibold mb-2"
              style={{
                fontSize: "var(--text-subhead)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Stop the bleed before month six.
            </p>
            <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
              Get a free facility audit: no pitch deck, no commitment.
            </p>
            <Link href="/diagnostic" className="btn-primary inline-block">
              Get your free facility audit
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
