import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  TrendingUp,
  ClipboardCheck,
  LineChart,
  Percent,
  Gauge,
  Building2,
  Landmark,
  CalendarClock,
  Hammer,
  TicketPercent,
} from "lucide-react";
import ToolHeader, { ToolCta } from "@/components/tools/tool-header";
import { BreadcrumbJsonLd } from "@/components/tools/tool-jsonld";

const title = "Free Tools for Storage Operators";
const description =
  "Free, no-signup calculators for self-storage operators: NOI, rate-increase (ECRI) impact, break-even occupancy, valuation by cap rate, DSCR & loan sizing, lease-up, expansion ROI, concession cost, marketing ROI, and a free facility audit. Built for storage operators.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://storageads.com/tools" },
  openGraph: {
    title: `${title} | StorageAds`,
    description,
    url: "https://storageads.com/tools",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | StorageAds`,
    description,
  },
  robots: { index: true, follow: true },
};

type Tool = {
  href: string;
  label: string;
  blurb: string;
  cta: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
};

type ToolGroup = { heading: string; tools: Tool[] };

const GROUPS: ToolGroup[] = [
  {
    heading: "Calculators",
    tools: [
      {
        href: "/tools/noi-calculator",
        label: "NOI Calculator",
        blurb:
          "Tally storage-specific income and operating expenses (labor, property tax, utilities, insurance, management), then triangulate net operating income, your expense ratio, per-unit economics, and what it implies your facility is worth.",
        cta: "Open calculator",
        icon: Calculator,
      },
      {
        href: "/tools/rate-increase-calculator",
        label: "Rate Increase (ECRI) Impact",
        blurb:
          "Model the net revenue an existing-customer rate increase actually adds after move-outs, plus the break-even move-out rate and the value lift it creates at your cap rate.",
        cta: "Open calculator",
        icon: Percent,
      },
      {
        href: "/tools/break-even-occupancy",
        label: "Break-Even Occupancy",
        blurb:
          "Find the occupancy you need to cover operating expenses, and the higher one that covers your loan too, then see how much cushion you have above it today.",
        cta: "Open calculator",
        icon: Gauge,
      },
      {
        href: "/tools/valuation-calculator",
        label: "Valuation & Cap Rate",
        blurb:
          "Value a facility on a cap rate. Solve for value, cap rate, or NOI from the other two, plus value per unit and per square foot for quick comps.",
        cta: "Open calculator",
        icon: Building2,
      },
      {
        href: "/tools/dscr-calculator",
        label: "DSCR & Loan Sizing",
        blurb:
          "Size the largest loan your NOI supports at a target debt service coverage ratio, or check the DSCR, debt yield, LTV, and post-debt cash flow on a loan you're weighing.",
        cta: "Open calculator",
        icon: Landmark,
      },
      {
        href: "/tools/lease-up-calculator",
        label: "Lease-Up & Stabilization",
        blurb:
          "Estimate months to stabilized occupancy from your current fill, monthly move-in pace, and move-out rate, and see when your pace can't reach the target at all.",
        cta: "Open calculator",
        icon: CalendarClock,
      },
      {
        href: "/tools/expansion-calculator",
        label: "Expansion ROI",
        blurb:
          "Test whether building more units pays. Yield on cost versus your cap rate, added NOI, value created, and the development spread that is your profit.",
        cta: "Open calculator",
        icon: Hammer,
      },
      {
        href: "/tools/concession-calculator",
        label: "Concession True-Cost",
        blurb:
          "See what a first-month-free or move-in discount really costs, per move-in, per year, and as a share of a tenant's lifetime revenue.",
        cta: "Open calculator",
        icon: TicketPercent,
      },
      {
        href: "/calculator",
        label: "Marketing ROI Calculator",
        blurb:
          "Plug in your units, occupancy, rate, and ad budget to model the move-ins, added revenue, and return on ad spend a marketing program can produce.",
        cta: "Open calculator",
        icon: TrendingUp,
      },
    ],
  },
  {
    heading: "Diagnostics",
    tools: [
      {
        href: "/audit-tool",
        label: "Free Facility Marketing Audit",
        blurb:
          "Enter your facility and get a marketing diagnostic in minutes: how you show up on Google, where you're leaking move-ins, and the gaps a competitor is using against you.",
        cta: "Run the audit",
        icon: ClipboardCheck,
      },
      {
        href: "/diagnostic",
        label: "Visibility Diagnostic",
        blurb:
          "A quick read on how findable your facility is when someone in your market searches for storage right now.",
        cta: "Run the diagnostic",
        icon: LineChart,
      },
    ],
  },
];

const ITEM_LIST_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Free tools for storage operators",
  itemListElement: GROUPS.flatMap((g) => g.tools).map((t, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: t.label,
    url: `https://storageads.com${t.href}`,
  })),
};

export default function ToolsPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-light)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ITEM_LIST_JSONLD) }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://storageads.com" },
          { name: "Tools", url: "https://storageads.com/tools" },
        ]}
      />
      <ToolHeader backHref="/" backLabel="Back to homepage" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl mb-12">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-mid-gray)" }}
          >
            Operator tools
          </span>
          <h1
            className="text-3xl sm:text-4xl font-bold mt-2 mb-3"
            style={{ color: "var(--color-dark)", letterSpacing: "-0.03em" }}
          >
            Free tools for storage operators
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            No signup, no email wall. Run the numbers on your facility the way an
            operator actually thinks about them. Built for storage operators,
            not adapted from another industry.
          </p>
        </div>

        {GROUPS.map((group) => (
          <section key={group.heading} className="mb-12">
            <h2
              className="text-xs font-semibold uppercase tracking-wider mb-4"
              style={{ color: "var(--color-mid-gray)" }}
            >
              {group.heading}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {group.tools.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group rounded-2xl p-6 flex flex-col transition-all hover:-translate-y-0.5"
                    style={{
                      background: "var(--color-light)",
                      border: "1px solid var(--color-light-gray)",
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-xl h-11 w-11 mb-4"
                      style={{ background: "var(--color-light-gray)" }}
                    >
                      <Icon size={20} style={{ color: "var(--color-dark)" }} />
                    </span>
                    <h3
                      className="text-lg font-semibold mb-2"
                      style={{
                        color: "var(--color-dark)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {t.label}
                    </h3>
                    <p
                      className="text-sm leading-relaxed flex-1"
                      style={{ color: "var(--color-body-text)" }}
                    >
                      {t.blurb}
                    </p>
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium mt-5"
                      style={{ color: "var(--color-dark)" }}
                    >
                      {t.cta}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <ToolCta
          heading="Want the numbers to move in your favor?"
          body="StorageAds runs the Meta and Google ads, builds a landing page for every ad, and proves which campaigns filled units. One bill per facility per month."
        />
      </main>
    </div>
  );
}
