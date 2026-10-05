import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, ArrowRight } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";

interface PageProps {
  params: Promise<{ competitor: string }>;
}

interface ComparisonFeature {
  category: string;
  feature: string;
  storageads: boolean;
  competitor: boolean;
}

const COMPETITORS: Record<string, { name: string; description: string }> = {
  storagerankers: { name: "StorageRankers", description: "SEO-focused storage marketing" },
  adverank: { name: "Adverank", description: "Storage advertising platform" },
  agencies: { name: "Traditional Agencies", description: "Full-service marketing agencies" },
};

const FEATURES: ComparisonFeature[] = [
  { category: "Ad Management", feature: "Meta (Facebook/Instagram) ad management", storageads: true, competitor: true },
  { category: "Ad Management", feature: "Google Search ad management", storageads: true, competitor: true },
  { category: "Ad Management", feature: "AI-generated ad creative", storageads: true, competitor: false },
  { category: "Ad Management", feature: "Automated creative rotation", storageads: true, competitor: false },
  { category: "Landing Pages", feature: "Ad-specific landing pages", storageads: true, competitor: false },
  { category: "Landing Pages", feature: "Sub-second page load times", storageads: true, competitor: false },
  { category: "Landing Pages", feature: "A/B testing", storageads: true, competitor: false },
  { category: "Rental Flow", feature: "Embedded storEDGE reservation", storageads: true, competitor: false },
  { category: "Rental Flow", feature: "2-click ad-to-reserve path", storageads: true, competitor: false },
  { category: "Attribution", feature: "Cost per click tracking", storageads: true, competitor: true },
  { category: "Attribution", feature: "Cost per lead tracking", storageads: true, competitor: true },
  { category: "Attribution", feature: "Cost per move-in tracking", storageads: true, competitor: false },
  { category: "Attribution", feature: "Ad-to-move-in tracking", storageads: true, competitor: false },
  { category: "Pricing", feature: "Transparent per-facility pricing", storageads: true, competitor: false },
  { category: "Pricing", feature: "No long-term contracts", storageads: true, competitor: false },
  { category: "Pricing", feature: "No setup fees", storageads: true, competitor: false },
];

export async function generateStaticParams() {
  return Object.keys(COMPETITORS).map((competitor) => ({ competitor }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { competitor } = await params;
  const comp = COMPETITORS[competitor];
  const name = comp?.name || competitor;
  return {
    title: `StorageAds vs ${name}: Compare Self-Storage Marketing Platforms`,
    description: `See how StorageAds compares to ${name}. Feature-by-feature comparison of ad management, attribution, and pricing.`,
  };
}

export default async function ComparisonPage({ params }: PageProps) {
  const { competitor } = await params;
  const comp = COMPETITORS[competitor] ?? { name: competitor, description: "" };

  // Group features by category
  const categories = [...new Set(FEATURES.map((f) => f.category))];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--color-light)" }}>
      <header className="border-b" style={{ borderColor: "var(--color-light-gray)" }}>
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}>
            <span>storage</span><span style={{ color: "var(--color-gold)" }}>ads</span>
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
          StorageAds vs {comp.name}
        </h1>
        <p
          className="text-base text-center max-w-xl mx-auto mb-12"
          style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}
        >
          A factual, feature-by-feature comparison to help you choose the right self-storage marketing platform.
        </p>

        {/* Comparison table */}
        <div className="rounded-xl border overflow-hidden mb-12" style={{ borderColor: "var(--color-light-gray)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-light-gray)" }}>
                <th className="px-5 py-4 text-left" style={{ fontFamily: "var(--font-heading)", color: "var(--color-mid-gray)", fontSize: "12px", fontWeight: 500 }}>
                  Feature
                </th>
                <th
                  className="px-5 py-4 text-center w-32"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--color-gold)", fontSize: "13px", fontWeight: 600, borderLeft: "2px solid var(--color-gold)" }}
                >
                  StorageAds
                </th>
                <th className="px-5 py-4 text-center w-32" style={{ fontFamily: "var(--font-heading)", color: "var(--color-mid-gray)", fontSize: "13px", fontWeight: 500 }}>
                  {comp.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <>
                  <tr key={`cat-${cat}`} style={{ backgroundColor: "rgba(0,0,0,0.02)" }}>
                    <td colSpan={3} className="px-5 py-2 text-xs font-medium uppercase tracking-wider" style={{ fontFamily: "var(--font-heading)", color: "var(--color-mid-gray)" }}>
                      {cat}
                    </td>
                  </tr>
                  {FEATURES.filter((f) => f.category === cat).map((feature, _idx) => (
                    <tr key={feature.feature} style={{ borderBottom: "1px solid var(--color-light-gray)" }}>
                      <td className="px-5 py-3" style={{ fontFamily: "var(--font-body)", color: "var(--color-dark)" }}>
                        {feature.feature}
                      </td>
                      <td className="px-5 py-3 text-center" style={{ borderLeft: "2px solid var(--color-gold-light)" }}>
                        {feature.storageads ? (
                          <Check className="h-5 w-5 mx-auto" style={{ color: "var(--color-gold)" }} />
                        ) : (
                          <Minus className="h-5 w-5 mx-auto" style={{ color: "var(--color-light-gray)" }} />
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {feature.competitor ? (
                          <Check className="h-5 w-5 mx-auto" style={{ color: "var(--color-mid-gray)" }} />
                        ) : (
                          <Minus className="h-5 w-5 mx-auto" style={{ color: "var(--color-light-gray)" }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Key differentiator */}
        <div
          className="rounded-xl p-8 text-center mb-12"
          style={{ backgroundColor: "var(--color-gold-light)", border: "1px solid rgba(68,99,134,0.2)" }}
        >
          <h2
            className="text-xl font-medium mb-3"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}
          >
            The core difference: we track cost per move-in, not clicks
          </h2>
          <p
            className="text-sm max-w-lg mx-auto mb-5"
            style={{ fontFamily: "var(--font-body)", color: "var(--color-body-text)" }}
          >
            Most storage marketing platforms stop at cost per click or cost per lead. StorageAds tracks
            every step from the first ad click through to a signed lease, so you know exactly what each
            move-in costs.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium"
            style={{ fontFamily: "var(--font-heading)", color: "#fff", backgroundColor: "var(--color-gold)" }}
          >
            Watch the demo dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="text-center text-xs" style={{ fontFamily: "var(--font-body)", color: "var(--color-mid-gray)" }}>
          Comparison based on publicly available information as of March 2026. If any information is inaccurate, contact us at blake@storageads.com.
        </p>
      </main>
    </div>
  );
}
