import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, MapPin, Building2 } from "lucide-react";
import { CASE_STUDIES } from "@/types/case-study";
import { MetricComparison } from "@/components/case-studies/metric-comparison";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return CASE_STUDIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const study = CASE_STUDIES.find((s) => s.slug === slug);
  if (!study) return { title: "Not Found" };
  return {
    title: `${study.facilityName} Case Study | StorageAds`,
    description: `${study.facilityName}: ${study.heroMetric.value} ${study.heroMetric.label}. Here's how.`,
  };
}

export default async function CaseStudyPage({ params }: PageProps) {
  const { slug } = await params;
  const study = CASE_STUDIES.find((s) => s.slug === slug);
  if (!study) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-light)" }}>
      <header className="border-b" style={{ borderColor: "var(--color-light-gray)" }}>
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <Link href="/case-studies" className="flex items-center gap-1 text-sm" style={{ color: "var(--color-body-text)" }}>
            <ArrowLeft className="h-4 w-4" />
            Case Studies
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="flex items-center gap-1 text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
              <MapPin className="h-3 w-3" />{study.location}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
              <Building2 className="h-3 w-3" />{study.unitCount} units
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
              <Clock className="h-3 w-3" />{study.timelineWeeks} weeks to results
            </span>
          </div>
          <h1
            className="text-3xl font-semibold mb-4"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}
          >
            {study.facilityName}
          </h1>

          {/* Hero metric */}
          <div
            className="rounded-xl p-6 inline-block"
            style={{ backgroundColor: "var(--color-gold-light)", border: "2px solid var(--color-gold)" }}
          >
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-body-text)" }}>
              {study.heroMetric.label}
            </p>
            <p className="text-4xl font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-gold)" }}>
              {study.heroMetric.value}
            </p>
          </div>
        </div>

        {/* Challenge */}
        <section className="mb-10">
          <h2 className="text-xl font-medium mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            The Challenge
          </h2>
          <p className="text-base" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)", lineHeight: 1.7 }}>
            {study.challenge}
          </p>
        </section>

        {/* Solution */}
        <section className="mb-10">
          <h2 className="text-xl font-medium mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            The Solution
          </h2>
          <p className="text-base" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)", lineHeight: 1.7 }}>
            {study.solution}
          </p>
        </section>

        {/* Results */}
        <section className="mb-10">
          <h2 className="text-xl font-medium mb-4" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            The Results
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {study.metrics.map((m) => (
              <MetricComparison key={m.label} metric={m} />
            ))}
          </div>
        </section>

        {/* Quote */}
        <section className="mb-10">
          <blockquote
            className="rounded-xl p-6"
            style={{
              borderLeft: "3px solid var(--color-gold)",
              backgroundColor: "var(--color-gold-light)",
            }}
          >
            <p
              className="text-lg italic mb-3"
              style={{ fontFamily: "var(--font-body)", color: "var(--color-dark)", lineHeight: 1.7 }}
            >
              &quot;{study.quote.text}&quot;
            </p>
            <footer>
              <p className="text-sm font-medium" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
                {study.quote.author}
              </p>
              <p className="text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
                {study.quote.role}
              </p>
            </footer>
          </blockquote>
        </section>

        {/* CTA */}
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "var(--color-gold-light)", border: "1px solid rgba(68,99,134,0.2)" }}
        >
          <h3 className="text-xl font-medium mb-2" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            Get results like {study.facilityName.split(" ")[0]}
          </h3>
          <p className="text-sm mb-5" style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}>
            See what StorageAds could deliver for your facility.
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
