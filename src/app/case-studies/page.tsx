import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CASE_STUDIES } from "@/types/case-study";
import { CAL_BOOKING_URL } from "@/lib/booking";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Case Studies | StorageAds",
  description: "How StorageAds turns ad spend into reservations: ads, a page for each one, and follow-up to a lease.",
  openGraph: {
    title: "Case Studies | StorageAds",
    description: "How StorageAds turns ad spend into reservations: ads, a page for each one, and follow-up to a lease.",
    url: "https://storageads.com/case-studies",
  },
  twitter: {
    card: "summary_large_image",
    title: "Case Studies | StorageAds",
    description: "How StorageAds turns ad spend into reservations.",
  },
};

export default function CaseStudiesIndexPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-light)" }}>
      <header className="border-b" style={{ borderColor: "var(--color-light-gray)" }}>
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" aria-label="StorageAds">
            <Logo mark={28} />
          </Link>
          <a
            href={CAL_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
            style={{ fontFamily: "var(--font-heading)", color: "#fff", backgroundColor: "var(--color-gold)" }}
          >
            Book a Call
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12 md:py-20">
        <h1
          className="text-3xl md:text-4xl font-semibold mb-3 text-center"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}
        >
          Case Studies
        </h1>
        <p
          className="text-base text-center max-w-xl mx-auto mb-12"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}
        >
          Ads in the trade area. A page for each one. A reservation you follow to a lease. You mark the move-in, and the report shows where that person came from.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CASE_STUDIES.map((study) => (
            <Link
              key={study.slug}
              href={`/case-studies/${study.slug}`}
              className="block rounded-xl border p-6 transition-colors group"
              style={{ borderColor: "var(--color-light-gray)", backgroundColor: "var(--color-light)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3
                    className="text-base font-medium"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}
                  >
                    {study.facilityName}
                  </h3>
                  <p className="text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
                    {study.location} · {study.unitCount} units
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--color-gold)" }} />
              </div>

              {/* Hero metric */}
              <div
                className="rounded-lg p-4 mb-4"
                style={{ backgroundColor: "var(--color-gold-light)" }}
              >
                <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-body-text)" }}>
                  {study.heroMetric.label}
                </p>
                <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-gold)" }}>
                  {study.heroMetric.value}
                </p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-2">
                {study.metrics.slice(0, 2).map((m) => (
                  <div key={m.label} className="text-center">
                    <p className="text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>{m.label}</p>
                    <p className="text-sm font-medium" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
                      {m.before} → <span style={{ color: "var(--color-gold)" }}>{m.after}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {study.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ fontFamily: "var(--font-heading)", backgroundColor: "var(--color-light-gray)", color: "var(--color-mid-gray)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-sm mb-4" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}>
            See what the system would do at your facility.
          </p>
          <Link
            href="/audit-tool"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium"
            style={{ fontFamily: "var(--font-heading)", color: "#fff", backgroundColor: "var(--color-gold)" }}
          >
            Get a Free Facility Audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
