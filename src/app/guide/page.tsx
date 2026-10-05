import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Shield,
  BarChart3,
  ClipboardList,
  MessageSquare,
  Target,
  TrendingUp,
  HelpCircle,
  Building2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Client Guide",
  description:
    "How to use your StorageAds portal: your dashboard, your campaign data, and how to act on what you see.",
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5"
        style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
      >
        {n}
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div
        className="rounded-lg p-5 sm:p-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Icon size={20} className="text-[var(--color-blue)]" /> {title}
        </h2>
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        {title}
      </h3>
      <div className="space-y-2 pl-1">{children}</div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-sm"
      style={{
        background: "var(--accent-glow)",
        border: "1px solid rgba(68,99,134,0.2)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

const tocItems = [
  { id: "welcome", label: "Welcome to StorageAds" },
  { id: "getting-started", label: "Getting Started" },
  { id: "dashboard", label: "Your Dashboard" },
  { id: "charts", label: "Understanding Your Charts" },
  { id: "onboarding", label: "Onboarding Wizard" },
  { id: "messages", label: "Messages" },
  { id: "goals", label: "Campaign Goals" },
  { id: "digest", label: "Monthly Performance Digest" },
  { id: "faq", label: "FAQ" },
];

const faqs = [
  {
    q: "How often does my dashboard update?",
    a: "Your StorageAds team enters new campaign data monthly. You'll see updated numbers shortly after each month closes.",
  },
  {
    q: "What if my access code doesn't work?",
    a: "Double-check for typos (codes are case-sensitive). If it still doesn't work, contact your StorageAds team and they'll issue a new code.",
  },
  {
    q: "Who do I contact if I have questions?",
    a: "Use the Messages feature in your portal, or reach out directly via email or phone (see below). Your account team checks messages regularly.",
  },
  {
    q: "Can I change my campaign budget?",
    a: "Yes. Send a message through the portal or call your account team. They'll adjust your ad spend and update your projected metrics.",
  },
  {
    q: 'What counts as a "lead"?',
    a: "A lead is anyone who submits a contact form, calls, or messages through one of your Facebook or Instagram ads. These are people actively looking for storage.",
  },
  {
    q: "What's the difference between a lead and a move-in?",
    a: "A lead is someone who expressed interest. A move-in is a lead who actually signed a lease and started renting a unit. Move-ins are the number that matters most.",
  },
  {
    q: "How long before I see results?",
    a: "Most clients see their first leads within the first two weeks. It typically takes 2-3 months for campaigns to fully optimize and reach peak performance.",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-void)" }}>
      <header
        className="sticky top-0 z-[100] border-b"
        style={{
          background: "var(--bg-void)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            storage<span style={{ color: "var(--accent)" }}>ads</span>
          </span>
          <span
            className="text-xs ml-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            / Client Guide
          </span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Client Guide
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            How to use your StorageAds portal — your dashboard, your campaign
            data, and how to act on what you see.
          </p>
        </div>

        <nav
          className="rounded-lg p-5 mb-8"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h2
            className="text-sm font-semibold uppercase mb-3 flex items-center gap-2"
            style={{
              color: "var(--text-tertiary)",
              letterSpacing: "var(--tracking-wide)",
            }}
          >
            <BookOpen size={14} /> Contents
          </h2>
          <div className="grid sm:grid-cols-2 gap-1">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm rounded-lg px-3 py-1.5 transition-colors"
                style={{ color: "var(--accent)" }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-6">
          <Section id="welcome" icon={Building2} title="Welcome to StorageAds">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              StorageAds is a marketing platform built specifically for
              self-storage operators. We run targeted Facebook and Instagram ad
              campaigns to fill your vacant units with qualified tenants.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              As a StorageAds client, you get access to your own portal where you
              can track campaign performance, see how many leads and move-ins
              your ads are generating, communicate with your account team, and
              monitor your return on investment — all in one place.
            </p>
            <InfoBox>
              Your portal updates as your StorageAds team enters new campaign
              data each month. Check back regularly to see the latest numbers.
            </InfoBox>
          </Section>

          <Section id="getting-started" icon={Shield} title="Getting Started">
            <SubSection title="How to Log In">
              <Step n={1}>
                Go to{" "}
                <code
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "var(--bg-surface)" }}
                >
                  storageads.com/portal
                </code>{" "}
                or click &ldquo;Client Login&rdquo; in the website navigation.
              </Step>
              <Step n={2}>
                Enter the email address associated with your StorageAds account.
              </Step>
              <Step n={3}>
                Enter the access code provided by your StorageAds team. It looks
                like{" "}
                <code
                  className="text-xs px-1.5 py-0.5 rounded font-mono"
                  style={{ background: "var(--bg-surface)" }}
                >
                  A7K2MN9X
                </code>{" "}
                — a short combination of letters and numbers.
              </Step>
            </SubSection>
            <InfoBox>
              Your login stays saved in your browser, so you won&apos;t need to
              re-enter your credentials each time you visit. If you lose your
              access code, contact your StorageAds team and they&apos;ll send you a
              new one.
            </InfoBox>
          </Section>

          <Section id="dashboard" icon={BarChart3} title="Your Dashboard">
            <SubSection title="KPI Cards">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                At the top of your dashboard, you&apos;ll see your key campaign
                numbers at a glance:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {[
                  {
                    label: "Total Leads",
                    desc: "Everyone who filled out a form or called from your ads",
                  },
                  {
                    label: "Avg CPL",
                    desc: "How much each lead costs on average (lower is better)",
                  },
                  {
                    label: "Move-Ins",
                    desc: "Leads who actually signed a lease and moved in",
                  },
                  {
                    label: "Latest ROAS",
                    desc: "Your return on ad spend: how many dollars you earn per dollar spent on ads",
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className="rounded-lg p-3"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {k.label}
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {k.desc}
                    </p>
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection title="Monthly Performance Table">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Below your charts, a table breaks down each month&apos;s performance:
                how much was spent on ads, how many leads came in, what each lead
                cost, how many became move-ins, and your return on ad spend. The
                totals row at the bottom summarizes your entire campaign history.
              </p>
            </SubSection>
          </Section>

          <Section id="charts" icon={TrendingUp} title="Understanding Your Charts">
            <SubSection title="Cost Per Lead (CPL) Trend">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This line chart shows how much each lead costs over time. A
                downward trend means your ads are becoming more efficient — you&apos;re
                paying less for each inquiry. It&apos;s normal for CPL to start
                higher and improve as the campaigns optimize.
              </p>
            </SubSection>
            <SubSection title="Leads vs Move-Ins">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                This bar chart compares how many leads came in each month (blue
                bars) against how many actually became tenants (green bars). The
                gap between the two shows your conversion rate — a smaller gap
                means more of your leads are turning into real revenue.
              </p>
            </SubSection>
            <SubSection title="ROAS (Return on Ad Spend)">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                ROAS shows up after your third month of data. It tells you how
                many dollars of revenue your ads generate for each dollar spent.
                For example, a 3.2x ROAS means for every $1 you spend on ads,
                you get $3.20 back in lease revenue. Anything above 1.0x means
                your ads are profitable.
              </p>
            </SubSection>
          </Section>

          <Section id="onboarding" icon={ClipboardList} title="Onboarding Wizard">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              When you first sign on, you&apos;ll see a 5-step onboarding wizard.
              This collects the information we need to build effective ad
              campaigns for your specific facility.
            </p>
            <div className="space-y-2 mt-1">
              {[
                {
                  n: 1,
                  title: "Facility Details",
                  desc: "Your brand description, colors, and what makes your facility unique",
                },
                {
                  n: 2,
                  title: "Target Demographics",
                  desc: "Who your ideal tenants are: age range, location radius, and income level",
                },
                {
                  n: 3,
                  title: "Unit Mix & Pricing",
                  desc: "What unit types you have, their sizes, monthly rates, and how many are available",
                },
                {
                  n: 4,
                  title: "Competitor Intel",
                  desc: "Who your nearby competitors are, what they charge, and how you stand out",
                },
                {
                  n: 5,
                  title: "Ad Preferences",
                  desc: "Your preferred tone of voice, budget range, main goal, and any past ad experience",
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="flex items-start gap-3 rounded-lg px-4 py-3"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                    style={{
                      background: "var(--accent-glow)",
                      color: "var(--accent)",
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {s.title}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <InfoBox>
              Your progress saves automatically. You can close the wizard and
              come back later — everything you&apos;ve entered will still be there.
            </InfoBox>
          </Section>

          <Section id="messages" icon={MessageSquare} title="Messages">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              The Messages card on your dashboard lets you communicate directly
              with your StorageAds account team. Use it to ask questions, share
              feedback, or request changes to your campaigns.
            </p>
            <Step n={1}>
              Scroll to the Messages card on your dashboard.
            </Step>
            <Step n={2}>
              Type your message in the text box and click Send.
            </Step>
            <Step n={3}>
              Replies from your StorageAds team will appear in the same
              conversation thread.
            </Step>
            <InfoBox>
              Messages are checked regularly by your team. For urgent requests,
              you can also reach us by phone or email (see the bottom of this
              page).
            </InfoBox>
          </Section>

          <Section id="goals" icon={Target} title="Campaign Goals">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Your StorageAds team may set a monthly move-in target for your
              campaigns. When a goal is active, you&apos;ll see a progress bar on
              your dashboard showing how you&apos;re tracking against it.
            </p>
            <SubSection title="How to Read the Progress Bar">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                The bar fills up as move-ins are recorded each month. If the bar
                is green, you&apos;re on track or ahead of your goal. The number on
                the right shows the target, and the number on the left shows
                where you are right now.
              </p>
            </SubSection>
            <InfoBox>
              Goals are set collaboratively with your account team based on your
              facility&apos;s size, occupancy, and budget. If you&apos;d like to adjust
              your target, send a message through the portal or contact your team
              directly.
            </InfoBox>
          </Section>

          <Section id="digest" icon={TrendingUp} title="Monthly Performance Digest">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Once you have two or more months of campaign data, a digest card
              appears on your dashboard that compares your most recent month to
              the one before it.
            </p>
            <SubSection title="What the Arrows Mean">
              <div className="space-y-2 mt-1">
                <div className="flex items-start gap-2">
                  <span
                    className="font-semibold text-sm mt-0.5"
                    style={{ color: "rgba(34,197,94,0.8)" }}
                  >
                    ↑
                  </span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text-primary)" }}>
                      Green up arrow
                    </strong>{" "}
                    — this metric improved compared to last month (more leads,
                    more move-ins, better ROAS, or lower CPL).
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className="font-semibold text-sm mt-0.5"
                    style={{ color: "rgba(239,68,68,0.8)" }}
                  >
                    ↓
                  </span>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text-primary)" }}>
                      Red down arrow
                    </strong>{" "}
                    — this metric went the other direction. Don&apos;t worry about
                    small dips — campaigns naturally fluctuate month to month.
                    Your team watches these trends and adjusts accordingly.
                  </p>
                </div>
              </div>
            </SubSection>
            <InfoBox>
              The digest is a quick snapshot — for the full picture, check your
              charts and monthly table above.
            </InfoBox>
          </Section>

          <Section id="faq" icon={HelpCircle} title="Frequently Asked Questions">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="pb-3 last:pb-0"
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <p
                  className="text-sm font-semibold mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  {faq.q}
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </Section>
        </div>

        <div className="mt-12 mb-8 text-center">
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Questions? Contact{" "}
            <a
              href="mailto:blake@storageads.com"
              style={{ color: "var(--accent)" }}
            >
              blake@storageads.com
            </a>{" "}
            or call{" "}
            <a href="tel:+12699298541" style={{ color: "var(--accent)" }}>
              (269) 929-8541
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
