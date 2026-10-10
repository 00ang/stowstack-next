import type { Metadata } from "next";
import Link from "next/link";
import { getSampleAuditData, SAMPLE_AUDIT_SLUG } from "@/lib/sample-audit";
import { getSampleIntakeAudit, SAMPLE_INTAKE_SLUG } from "@/lib/sample-intake-audit";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Rocket,
  Eye,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Building2,
  Users,
  Megaphone,
  Globe,
  PiggyBank,
  Wrench,
  Swords,
  MapPin,
  Skull,
  Timer,
  CheckCircle2,
  XCircle,
  Flame,
  Calendar,
} from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CategoryAudit {
  name: string;
  slug: string;
  score: number;
  summary: string;
  greenFlags: [string, string];
  yellowFlag: string;
  redFlags: [string, string, string];
  doNothingConsequence?: string;
  inactionCost?: number;
  actions: Array<{
    title: string;
    detail: string;
    priority: "high" | "medium" | "low";
  }>;
}

interface IndustryBenchmark {
  metric: string;
  facilityValue: string;
  industryAverage: string;
  topPerformers: string;
  gap: string;
}

interface RevenueOpportunity {
  source: string;
  estimatedMonthlyGain: number;
  timeToImplement: string;
  difficulty: "easy" | "moderate" | "hard";
}

interface RevenueOptimization {
  currentEstimatedRevenue: number;
  potentialMonthlyRevenue: number;
  monthlyGap: number;
  annualGap: number;
  topOpportunities: RevenueOpportunity[];
}

interface CostOfInaction {
  monthlyBleed: number;
  projectedOccupancy6Months: string;
  projectedOccupancy12Months: string;
  competitorGapWidening: string;
  urgencyStatement: string;
}

interface NinetyDayProjection {
  ifYouAct: {
    occupancyTarget: string;
    additionalMoveIns: number;
    revenueRecaptured: number;
    keyWins: [string, string, string];
  };
  ifYouDont: {
    occupancyProjection: string;
    additionalMoveOuts: number;
    revenueLost: number;
    consequences: [string, string, string];
  };
}

interface ConversionFunnelStage {
  name: string;
  status: "strong" | "weak" | "critical";
  evidence: string;
  leakPercentage: number;
}

interface ConversionFunnel {
  stages: ConversionFunnelStage[];
  biggestLeak: string;
  narrative: string;
}

interface OperatorAlignment {
  accuracy: "accurate" | "partially_accurate" | "misdiagnosed";
  operatorSaid: string;
  auditFound: string;
  note: string;
}

interface DiagnosticAudit {
  generatedAt: string;
  facility: {
    name: string;
    address: string;
    contactName: string;
    contactEmail: string;
    websiteUrl: string;
    occupancy: string;
    totalUnits: string;
    facilityAge: string;
  };
  overallScore: number;
  overallGrade: string;
  categories: CategoryAudit[];
  executiveSummary: string;
  industryBenchmarks?: IndustryBenchmark[];
  revenueOptimization?: RevenueOptimization;
  costOfInaction?: CostOfInaction;
  ninetyDayProjection?: NinetyDayProjection;
  conversionFunnel?: ConversionFunnel;
  operatorAlignment?: OperatorAlignment;
  vacancyCost: {
    vacantUnits: number;
    monthlyLoss: number;
    annualLoss: number;
    avgUnitRate: number;
    dollarsKnown?: boolean;
  };
}

interface AuditData {
  audit: DiagnosticAudit;
  facilityName: string;
  createdAt: string;
  expiresAt: string;
  views: number;
}

/* ------------------------------------------------------------------ */
/*  Data Fetching                                                      */
/* ------------------------------------------------------------------ */

async function loadAudit(slug: string): Promise<AuditData | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  try {
    const res = await fetch(
      `${baseUrl}/api/audit-load?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data =
    slug === SAMPLE_AUDIT_SLUG
      ? (getSampleAuditData() as unknown as AuditData)
      : slug === SAMPLE_INTAKE_SLUG
        ? (getSampleIntakeAudit() as unknown as AuditData)
        : await loadAudit(slug);
  if (!data) {
    return { title: "Audit Not Found | StorageAds" };
  }
  const { audit, facilityName } = data;
  const description = audit.executiveSummary
    ? audit.executiveSummary.slice(0, 200)
    : `Facility diagnostic audit for ${facilityName}. Overall score: ${audit.overallScore}/100 (${audit.overallGrade}).`;
  return {
    title: `${facilityName}: Facility Diagnostic | StorageAds`,
    description,
    openGraph: {
      title: `${facilityName}: Facility Diagnostic`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${facilityName}: Facility Diagnostic`,
      description,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function gradeColor(grade: string) {
  switch (grade) {
    case "A":
      return { text: "text-emerald-400", bg: "bg-emerald-500", ring: "ring-emerald-500/30", bgFaint: "bg-emerald-500/10", border: "border-emerald-500/20" };
    case "B":
      return { text: "text-[var(--color-blue)]", bg: "bg-[var(--color-blue)]", ring: "ring-[var(--color-blue)]/30", bgFaint: "bg-[var(--color-blue)]/10", border: "border-[var(--color-blue)]/20" };
    case "C":
      return { text: "text-amber-400", bg: "bg-amber-500", ring: "ring-amber-500/30", bgFaint: "bg-amber-500/10", border: "border-amber-500/20" };
    case "D":
      return { text: "text-orange-400", bg: "bg-orange-500", ring: "ring-orange-500/30", bgFaint: "bg-orange-500/10", border: "border-orange-500/20" };
    default:
      return { text: "text-red-400", bg: "bg-red-500", ring: "ring-red-500/30", bgFaint: "bg-red-500/10", border: "border-red-500/20" };
  }
}

function categoryIcon(slug: string) {
  switch (slug) {
    case "occupancy": return <Building2 className="w-5 h-5" />;
    case "lead-generation": return <Users className="w-5 h-5" />;
    case "sales": return <Target className="w-5 h-5" />;
    case "marketing": return <Megaphone className="w-5 h-5" />;
    case "digital-presence": return <Globe className="w-5 h-5" />;
    case "revenue": return <PiggyBank className="w-5 h-5" />;
    case "operations": return <Wrench className="w-5 h-5" />;
    case "competition": return <Swords className="w-5 h-5" />;
    default: return <BarChart3 className="w-5 h-5" />;
  }
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-500/15 text-red-400";
    case "medium":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-[var(--color-blue)]/15 text-[var(--color-blue)]";
  }
}

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  grade,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  grade: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const colors = gradeColor(grade);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`w-full h-full`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-black/5"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={strokeWidth}
        className={colors.text}
        stroke="currentColor"
        strokeDasharray={`${(score / 100) * circ} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-[var(--text-primary)] font-semibold"
        fontSize={size * 0.23}
        dominantBaseline="middle"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + size * 0.14}
        textAnchor="middle"
        className="fill-[var(--text-tertiary)]"
        fontSize={size * 0.09}
      >
        / 100
      </text>
    </svg>
  );
}

function CategoryCard({ category }: { category: CategoryAudit }) {
  const grade = letterGrade(category.score);
  const colors = gradeColor(grade);

  return (
    <div
      className={`rounded-2xl border ${colors.border} bg-[var(--bg-elevated)] overflow-hidden`}
      id={category.slug}
    >
      {/* Header */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Score ring */}
          <div className="w-20 h-20 shrink-0">
            <ScoreRing score={category.score} size={80} strokeWidth={6} grade={grade} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`${colors.text}`}>
                {categoryIcon(category.slug)}
              </span>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {category.name}
              </h3>
              <span
                className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${colors.bgFaint} ${colors.text}`}
              >
                {grade}
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {category.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="px-5 sm:px-6 pb-4 space-y-2">
        {/* Green flags */}
        {category.greenFlags.map((flag, i) => (
          <div key={`green-${i}`} className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300/90 leading-relaxed">{flag}</p>
          </div>
        ))}

        {/* Yellow flag */}
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300/90 leading-relaxed">
            {category.yellowFlag}
          </p>
        </div>

        {/* Red flags */}
        {category.redFlags.map((flag, i) => (
          <div key={`red-${i}`} className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300/90 leading-relaxed">{flag}</p>
          </div>
        ))}
      </div>

      {/* Cost of Inaction Warning */}
      {category.doNothingConsequence && (
        <div className="mx-5 sm:mx-6 mb-4 rounded-xl bg-red-950/40 border border-red-500/20 p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <Skull className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  If You Do Nothing
                </p>
                {typeof category.inactionCost === "number" && category.inactionCost > 0 && (
                  <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                    ${category.inactionCost.toLocaleString()}/yr at risk
                  </span>
                )}
              </div>
              <p className="text-sm text-red-200/80 leading-relaxed">
                {category.doNothingConsequence}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {category.actions.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-5 sm:px-6 py-4">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
            Recommended Actions
          </p>
          <div className="space-y-3">
            {category.actions.map((action, i) => (
              <div
                key={i}
                className="bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-subtle)] p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${priorityBadge(action.priority)}`}
                  >
                    {action.priority}
                  </span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {action.title}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {action.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryNav({ categories }: { categories: CategoryAudit[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => {
        const grade = letterGrade(cat.score);
        const colors = gradeColor(grade);
        return (
          <a
            key={cat.slug}
            href={`#${cat.slug}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors hover:bg-black/5 ${colors.border} ${colors.text}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
            {cat.name}
            <span className="opacity-60">{cat.score}</span>
          </a>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function SharedAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { sample } = await searchParams;
  const isSampleSlug = slug === SAMPLE_AUDIT_SLUG || slug === SAMPLE_INTAKE_SLUG;
  const isSample = sample === "true" || isSampleSlug;
  // The public sample lives in /lib (not the DB) so it never expires, never
  // inflates view counts, and renders even if the DB is unreachable.
  const data =
    slug === SAMPLE_INTAKE_SLUG
      ? (getSampleIntakeAudit() as unknown as AuditData)
      : isSampleSlug
        ? (getSampleAuditData() as unknown as AuditData)
        : await loadAudit(slug);

  if (!data) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="max-w-md text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-[var(--text-tertiary)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Audit Not Found
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            This audit link may have expired or is invalid.
          </p>
          <Link
            href="/"
            className="inline-flex px-6 py-2.5 rounded-lg bg-[var(--color-dark)] text-[var(--color-light)] font-medium hover:opacity-90 transition-opacity"
          >
            Visit StorageAds
          </Link>
        </div>
      </div>
    );
  }

  const { audit, facilityName, createdAt, expiresAt, views } = data;
  const expiresIn = expiresAt ? daysUntil(expiresAt) : null;
  const isExpired = expiresIn !== null && expiresIn <= 0;

  if (isExpired) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="max-w-md text-center px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Audit Expired
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            This audit report for {facilityName} has expired. Request a fresh
            audit to get updated data.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--color-dark)] text-[var(--color-light)] font-medium hover:opacity-90 transition-opacity"
          >
            Get a New Audit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Check if this is a new diagnostic-format audit or old format
  const isDiagnostic = !!(audit.categories && audit.categories.length > 0);

  if (!isDiagnostic) {
    // Fall back to legacy format — redirect or render basic
    return <LegacyAuditPage data={data} />;
  }

  const { categories, executiveSummary, vacancyCost, overallScore, overallGrade, costOfInaction, ninetyDayProjection, industryBenchmarks, revenueOptimization, conversionFunnel, operatorAlignment } = audit;
  const facility = audit.facility;
  const colors = gradeColor(overallGrade);

  // Sort categories by score ascending (worst first)
  const sortedCategories = [...categories].sort((a, b) => a.score - b.score);

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      {/* Sample Banner */}
      {isSample && (
        <div className="bg-amber-500 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Eye className="w-4 h-4 text-amber-950" />
            <span className="text-sm font-medium text-amber-950">
              This is a sample diagnostic.
            </span>
            <Link
              href="/diagnostic"
              className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-200 hover:bg-amber-900 transition-colors"
            >
              Get your free audit &rarr;
            </Link>
          </div>
        </div>
      )}
      {/* Top CTA Banner */}
      <div className="bg-[var(--color-dark)] px-4 py-2.5 text-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Rocket className="w-4 h-4 text-[var(--color-light)]/80" />
          <span className="text-sm text-[var(--color-light)]/90">
            This diagnostic was generated by{" "}
            <strong className="text-[var(--color-light)]">StorageAds</strong>{" "}
            <span className="text-[var(--color-light)]/70">storageads.com</span>
          </span>
          <Link
            href="/"
            className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-light)]/15 text-[var(--color-light)] hover:bg-[var(--color-light)]/25 transition-colors"
          >
            Get a Free Facility Audit
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-dark)] flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-[var(--color-light)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--text-primary)] font-medium tracking-wide uppercase">
                StorageAds Facility Diagnostic
              </p>
              <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
                {facilityName || facility.name}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
            {facility.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {facility.address}
              </span>
            )}
            {facility.totalUnits && <span>{facility.totalUnits} units</span>}
            {facility.occupancy && <span>{facility.occupancy} occupancy</span>}
            {createdAt && (
              <span>
                Generated{" "}
                {new Date(createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {views} view{views !== 1 ? "s" : ""}
              </span>
            )}
            {expiresIn !== null && expiresIn > 0 && (
              <span
                className={`flex items-center gap-1 ${expiresIn <= 7 ? "text-amber-500" : ""}`}
              >
                <Clock className="w-3 h-3" />
                {expiresIn <= 7
                  ? `Expires in ${expiresIn} day${expiresIn !== 1 ? "s" : ""}`
                  : `Valid for ${expiresIn} days`}
              </span>
            )}
          </div>
        </div>

        {/* Overall Score Card */}
        <div
          className={`rounded-2xl border ${colors.border} ${colors.bgFaint} p-6 sm:p-8 mb-8`}
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-32 h-32 shrink-0">
              <ScoreRing
                score={overallScore}
                size={128}
                strokeWidth={10}
                grade={overallGrade}
              />
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center gap-3 justify-center sm:justify-start mb-2">
                <p className="text-sm text-[var(--text-tertiary)] uppercase tracking-wide">
                  Overall Diagnostic Score
                </p>
                <span
                  className={`text-lg font-semibold px-3 py-0.5 rounded-lg ${colors.bgFaint} ${colors.text}`}
                >
                  {overallGrade}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xl">
                {executiveSummary}
              </p>
            </div>
          </div>
        </div>

        {/* Operator Alignment — what you said vs what the data shows */}
        {operatorAlignment && operatorAlignment.auditFound && (() => {
          const acc = operatorAlignment.accuracy;
          const tone =
            acc === "accurate"
              ? { border: "border-green-500/20", bg: "bg-green-500/5", icon: "text-green-400", iconBg: "bg-green-500/10", label: "On the money", labelCls: "text-green-400", Icon: CheckCircle2 }
              : acc === "misdiagnosed"
              ? { border: "border-red-500/20", bg: "bg-red-500/5", icon: "text-red-400", iconBg: "bg-red-500/10", label: "Different root cause", labelCls: "text-red-400", Icon: AlertTriangle }
              : { border: "border-amber-500/20", bg: "bg-amber-500/5", icon: "text-amber-400", iconBg: "bg-amber-500/10", label: "Partly right", labelCls: "text-amber-400", Icon: AlertCircle };
          const ToneIcon = tone.Icon;
          return (
            <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-6 mb-8`}>
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-8 h-8 rounded-lg ${tone.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Target className={`w-4 h-4 ${tone.icon}`} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    Your Read vs The Data
                  </h2>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg ${tone.iconBg} ${tone.labelCls}`}>
                    <ToneIcon className="w-3.5 h-3.5" />
                    {tone.label}
                  </span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-4">
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
                    You said your biggest issue is
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {operatorAlignment.operatorSaid}
                  </p>
                </div>
                <div className={`bg-[var(--bg-primary)]/50 rounded-xl border ${tone.border} p-4`}>
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1.5">
                    The data points to
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
                    {operatorAlignment.auditFound}
                  </p>
                </div>
              </div>
              {operatorAlignment.note && (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {operatorAlignment.note}
                </p>
              )}
            </div>
          );
        })()}

        {/* Vacancy Cost Alert */}
        {vacancyCost && vacancyCost.dollarsKnown === false && vacancyCost.vacantUnits > 0 && (
          <p className="mb-8 text-sm text-[var(--text-secondary)]">
            About {vacancyCost.vacantUnits} units look empty from the bands you gave.
            No dollar figure. We don&apos;t have a street rate.
          </p>
        )}
        {vacancyCost && vacancyCost.vacantUnits > 0 && vacancyCost.dollarsKnown !== false && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/15 p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <DollarSign className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Vacancy Cost
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  What empty units are costing you right now
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Vacant Units
                </p>
                <p className="text-lg font-semibold text-red-400">
                  {vacancyCost.vacantUnits}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Avg Unit Rate
                </p>
                <p className="text-lg font-semibold text-[var(--text-primary)]">
                  ${vacancyCost.avgUnitRate}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Monthly Loss
                </p>
                <p className="text-lg font-semibold text-red-400">
                  ${vacancyCost.monthlyLoss.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Annual Loss
                </p>
                <p className="text-xl font-semibold text-red-500">
                  ${vacancyCost.annualLoss.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Industry Benchmarks */}
        {industryBenchmarks && industryBenchmarks.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--text-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Industry Benchmark Comparison
                </h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                How {facilityName} compares to REIT averages and top-performing facilities
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/50">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Metric</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Your Facility</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Industry Avg</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Top 25%</th>
                    <th className="text-center px-4 py-3 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {industryBenchmarks.map((b, i) => {
                    const isNegative = b.gap.startsWith("-") || b.gap.toLowerCase().includes("behind") || b.gap.toLowerCase().includes("below");
                    const isPositive = b.gap.startsWith("+") || b.gap.toLowerCase().includes("ahead") || b.gap.toLowerCase().includes("above");
                    return (
                      <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-black/[0.02] transition-colors">
                        <td className="px-5 py-3 text-[var(--text-primary)] font-medium">{b.metric}</td>
                        <td className="px-4 py-3 text-center font-semibold text-[var(--text-primary)]">{b.facilityValue}</td>
                        <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{b.industryAverage}</td>
                        <td className="px-4 py-3 text-center text-emerald-400/80">{b.topPerformers}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isNegative ? "bg-red-500/10 text-red-400" :
                            isPositive ? "bg-emerald-500/10 text-emerald-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>
                            {isNegative && <ArrowDown className="w-3 h-3" />}
                            {isPositive && <ArrowUp className="w-3 h-3" />}
                            {b.gap}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Optimization */}
        {revenueOptimization && revenueOptimization.potentialMonthlyRevenue > 0 && (
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-emerald-500/10">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Revenue Optimization Opportunity
                </h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Identified revenue you&apos;re leaving on the table
              </p>
            </div>

            {/* Revenue gap summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5">
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3 text-center">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Current Monthly Rev
                </p>
                <p className="text-lg font-semibold text-[var(--text-secondary)]">
                  ${revenueOptimization.currentEstimatedRevenue.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3 text-center">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Potential Monthly Rev
                </p>
                <p className="text-lg font-semibold text-emerald-400">
                  ${revenueOptimization.potentialMonthlyRevenue.toLocaleString()}
                </p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/15 p-3 text-center">
                <p className="text-[10px] text-emerald-400/80 uppercase tracking-wide mb-1">
                  Monthly Gap
                </p>
                <p className="text-lg font-semibold text-emerald-400">
                  +${revenueOptimization.monthlyGap.toLocaleString()}
                </p>
              </div>
              <div className="bg-emerald-500/15 rounded-xl border border-emerald-500/20 p-3 text-center">
                <p className="text-[10px] text-emerald-400/80 uppercase tracking-wide mb-1">
                  Annual Opportunity
                </p>
                <p className="text-xl font-semibold text-emerald-400">
                  +${revenueOptimization.annualGap.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Revenue opportunities */}
            {revenueOptimization.topOpportunities && revenueOptimization.topOpportunities.length > 0 && (
              <div className="px-5 pb-5">
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                  Top Revenue Opportunities
                </p>
                <div className="space-y-2">
                  {revenueOptimization.topOpportunities.map((opp, i) => {
                    const difficultyColors = {
                      easy: "bg-emerald-500/15 text-emerald-400",
                      moderate: "bg-amber-500/15 text-amber-400",
                      hard: "bg-red-500/15 text-red-400",
                    };
                    return (
                      <div key={i} className="flex items-center gap-3 bg-[var(--bg-primary)]/50 rounded-lg border border-[var(--border-subtle)] p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)]">{opp.source}</p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{opp.timeToImplement} to implement</p>
                        </div>
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 ${difficultyColors[opp.difficulty] || difficultyColors.moderate}`}>
                          {opp.difficulty}
                        </span>
                        <span className="text-sm font-semibold text-emerald-400 shrink-0">
                          +${opp.estimatedMonthlyGain.toLocaleString()}/mo
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 90-Day Projection: Act vs. Don't */}
        {ninetyDayProjection && ninetyDayProjection.ifYouAct && ninetyDayProjection.ifYouDont && (
          <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-[var(--text-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  90-Day Projection
                </h2>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Two paths, same facility, very different outcomes
              </p>
            </div>

            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)]">
              {/* IF YOU ACT */}
              <div className="p-6 bg-emerald-500/[0.03]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      If You Act Now
                    </p>
                    <p className="text-xs text-emerald-300/60">Execute top recommendations</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg border border-emerald-500/10 p-3">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Target Occupancy
                    </p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {ninetyDayProjection.ifYouAct.occupancyTarget}
                    </p>
                  </div>
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg border border-emerald-500/10 p-3">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Add&apos;l Move-Ins/Mo
                    </p>
                    <p className="text-lg font-semibold text-emerald-400">
                      +{ninetyDayProjection.ifYouAct.additionalMoveIns}
                    </p>
                  </div>
                </div>

                <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/15 p-3 mb-4">
                  <p className="text-[10px] text-emerald-400/80 uppercase tracking-wide mb-0.5">
                    Revenue Recaptured
                  </p>
                  <p className="text-2xl font-semibold text-emerald-400">
                    +${ninetyDayProjection.ifYouAct.revenueRecaptured.toLocaleString()}
                    <span className="text-sm font-medium text-emerald-400/60">/mo</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                    Key Wins
                  </p>
                  {ninetyDayProjection.ifYouAct.keyWins.map((win, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-300/80 leading-relaxed">
                        <span className="font-semibold text-emerald-400">{i === 0 ? "30 days:" : i === 1 ? "60 days:" : "90 days:"}</span>{" "}
                        {win}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* IF YOU DON'T */}
              <div className="p-6 bg-red-500/[0.03]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                      If You Do Nothing
                    </p>
                    <p className="text-xs text-red-300/60">Continue current trajectory</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg border border-red-500/10 p-3">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Projected Occupancy
                    </p>
                    <p className="text-lg font-semibold text-red-400">
                      {ninetyDayProjection.ifYouDont.occupancyProjection}
                    </p>
                  </div>
                  <div className="bg-[var(--bg-primary)]/50 rounded-lg border border-red-500/10 p-3">
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                      Net Unit Loss
                    </p>
                    <p className="text-lg font-semibold text-red-400">
                      -{ninetyDayProjection.ifYouDont.additionalMoveOuts}
                    </p>
                  </div>
                </div>

                <div className="bg-red-500/10 rounded-lg border border-red-500/15 p-3 mb-4">
                  <p className="text-[10px] text-red-400/80 uppercase tracking-wide mb-0.5">
                    Additional Revenue Lost
                  </p>
                  <p className="text-2xl font-semibold text-red-500">
                    -${ninetyDayProjection.ifYouDont.revenueLost.toLocaleString()}
                    <span className="text-sm font-medium text-red-400/60">/90 days</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                    What Happens
                  </p>
                  {ninetyDayProjection.ifYouDont.consequences.map((con, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-300/80 leading-relaxed">{con}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cost of Inaction Summary */}
        {costOfInaction && costOfInaction.monthlyBleed > 0 && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/20 p-6 mb-8">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  The Cost of Waiting
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  Every month without action, this facility is losing ground
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-red-500/10 p-3 text-center">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Monthly Revenue Bleed
                </p>
                <p className="text-xl font-semibold text-red-400">
                  ${costOfInaction.monthlyBleed.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-red-500/10 p-3 text-center">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Occupancy in 6 Months
                </p>
                <p className="text-xl font-semibold text-orange-400 flex items-center justify-center gap-1">
                  <ArrowDown className="w-4 h-4" />
                  {costOfInaction.projectedOccupancy6Months}
                </p>
              </div>
              <div className="bg-[var(--bg-primary)]/50 rounded-xl border border-red-500/10 p-3 text-center col-span-2 sm:col-span-1">
                <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                  Occupancy in 12 Months
                </p>
                <p className="text-xl font-semibold text-red-500 flex items-center justify-center gap-1">
                  <ArrowDown className="w-4 h-4" />
                  {costOfInaction.projectedOccupancy12Months}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Swords className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-200/80 leading-relaxed">
                  {costOfInaction.competitorGapWidening}
                </p>
              </div>
              <div className="flex items-start gap-2.5 bg-red-500/10 rounded-lg p-3">
                <Calendar className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-300 leading-relaxed">
                  {costOfInaction.urgencyStatement}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Total Inaction Cost Rollup */}
        {sortedCategories.some(c => typeof c.inactionCost === "number" && c.inactionCost > 0) && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-red-400" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Annual Cost of Inaction by Category
              </h2>
            </div>
            <div className="space-y-2">
              {sortedCategories
                .filter(c => typeof c.inactionCost === "number" && c.inactionCost > 0)
                .map(cat => {
                  const maxCost = Math.max(...sortedCategories.map(c => c.inactionCost || 0));
                  const pct = maxCost > 0 ? ((cat.inactionCost || 0) / maxCost) * 100 : 0;
                  const catGrade = letterGrade(cat.score);
                  const catColors = gradeColor(catGrade);
                  return (
                    <div key={cat.slug} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)] w-40 shrink-0 truncate">
                        {cat.name}
                      </span>
                      <div className="flex-1 h-6 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${catColors.bg} rounded-full flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(pct, 8)}%`, opacity: 0.7 }}
                        >
                          <span className="text-[10px] font-semibold text-[var(--color-light)] whitespace-nowrap">
                            ${(cat.inactionCost || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              }
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--border-medium)]">
                <span className="text-xs font-semibold text-[var(--text-primary)] w-40 shrink-0">
                  TOTAL AT RISK
                </span>
                <span className="text-base font-semibold text-red-400">
                  ${sortedCategories.reduce((sum, c) => sum + (c.inactionCost || 0), 0).toLocaleString()}/yr
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Conversion Funnel — where prospects leak out */}
        {conversionFunnel && conversionFunnel.stages && conversionFunnel.stages.length > 0 && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 mb-8">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  Where You&apos;re Losing Move-Ins
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  Every prospect passes through five stages. This is where they fall out.
                </p>
              </div>
            </div>

            <div className="space-y-2.5 mb-5">
              {conversionFunnel.stages.map((stage, i) => {
                const leak = Math.max(0, Math.min(100, stage.leakPercentage ?? 0));
                const tone =
                  stage.status === "critical"
                    ? { bar: "bg-red-500", text: "text-red-400", Icon: AlertTriangle }
                    : stage.status === "weak"
                    ? { bar: "bg-amber-500", text: "text-amber-400", Icon: AlertCircle }
                    : { bar: "bg-green-500", text: "text-green-400", Icon: CheckCircle2 };
                const StageIcon = tone.Icon;
                return (
                  <div key={i} className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <StageIcon className={`w-4 h-4 shrink-0 ${tone.text}`} />
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {stage.name}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${tone.text}`}>
                        {leak}% leak
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full ${tone.bar} rounded-full`}
                        style={{ width: `${Math.max(leak, 3)}%`, opacity: 0.75 }}
                      />
                    </div>
                    {stage.evidence && (
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {stage.evidence}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {conversionFunnel.biggestLeak && (
              <div className="flex items-start gap-2.5 bg-orange-500/10 rounded-lg p-3 mb-3">
                <Swords className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-orange-300 leading-relaxed">
                  <span className="uppercase tracking-wide text-[10px] text-orange-400/80 mr-1.5">Biggest leak</span>
                  {conversionFunnel.biggestLeak}
                </p>
              </div>
            )}
            {conversionFunnel.narrative && (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {conversionFunnel.narrative}
              </p>
            )}
          </div>
        )}

        {/* Category Navigation */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
            Jump to Category
          </p>
          <CategoryNav categories={sortedCategories} />
        </div>

        {/* Category Cards — sorted worst-first */}
        <div className="space-y-6 mb-10">
          {sortedCategories.map((category) => (
            <CategoryCard key={category.slug} category={category} />
          ))}
        </div>

        {/* StorageAds Platform CTA — What We'd Do For You */}
        <div className="rounded-2xl border border-[var(--border-subtle)] overflow-hidden mb-8">
          <div className="bg-[var(--bg-surface)] px-6 py-5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-dark)] flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5 text-[var(--color-light)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                  What StorageAds Would Fix First
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Every fix in this diagnostic maps to a feature we already built.
                </p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-px bg-[var(--color-light-gray)]">
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ad-Specific Landing Pages</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Every ad campaign gets its own landing page, built for the reserve button, with live unit availability, your pricing, and online rental. No more sending prospects to a generic website.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ad-to-Move-in Tracking</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Track every renter from first click to move-in. See what each move-in cost, by campaign and keyword. No more guessing.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Automated Drip Campaigns</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Automated follow-up sequences for abandoned reservations, no-shows, and past inquiries. No lead falls through the cracks, even when your team is busy.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Google Listing, on Auto</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Your Google Business Profile gets new posts on schedule, review responses drafted by AI, and a review-solicitation flow to lift your rating and local rank.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">One Screen, Every Number</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Live dashboard showing ad spend, leads, move-ins, and revenue across every channel. One login. Every number that matters.
              </p>
            </div>
            <div className="bg-[var(--bg-elevated)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">PMS Integration</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Direct integration with storEDGE, SiteLink, and other PMS platforms. Pulls live unit data, pushes leads, and validates move-ins automatically.
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] px-6 py-5 border-t border-[var(--border-subtle)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Ready to turn these findings into move-ins?
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  30-minute walkthrough. No commitment. We&apos;ll show you exactly how we&apos;d tackle your top 3 issues.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={CAL_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-dark)] text-[var(--color-light)] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Book a Walkthrough <ArrowRight className="w-4 h-4" />
                </a>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border-medium)] text-sm text-[var(--text-secondary)] font-medium hover:bg-black/5 transition-colors"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-xs text-[var(--text-tertiary)]">
          Generated by StorageAds · storageads.com
          {createdAt &&
            ` · ${new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy Audit Fallback (old format without categories)              */
/* ------------------------------------------------------------------ */

function LegacyAuditPage({ data }: { data: AuditData }) {
  const { audit, facilityName, createdAt, expiresAt, views: _views } = data;
  const legacy = audit as unknown as {
    facility: { name: string; location?: string; totalUnits: number; occupancy: number; vacantUnits: number };
    vacancyCost: { monthlyLoss: number; annualLoss: number; vacantUnits: number; avgUnitRate: number };
    marketOpportunity: { score: number; grade: string };
    projections: {
      recommendedSpend: number; projectedCpl: number; projectedLeadsPerMonth: number;
      projectedMoveInsPerMonth: number; projectedMonthlyRevenue: number; projectedRoas: number;
      projectedMonthsToFill: number; conversionRate: number;
    };
    competitiveInsights: string[];
    recommendations: { title: string; detail: string; priority: string }[];
  };
  const _expiresIn = expiresAt ? daysUntil(expiresAt) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-void)] text-[var(--text-primary)]">
      <div className="bg-[var(--color-dark)] px-4 py-2.5 text-center">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Rocket className="w-4 h-4 text-[var(--color-light)]/80" />
          <span className="text-sm text-[var(--color-light)]/90">
            Generated by <strong className="text-[var(--color-light)]">StorageAds</strong>
          </span>
          <Link
            href="/"
            className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-light)]/15 text-[var(--color-light)] hover:bg-[var(--color-light)]/25 transition-colors"
          >
            Get a Free Facility Audit
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-10">
          <h1 className="text-xl sm:text-2xl font-semibold mb-2">
            {facilityName || legacy.facility?.name}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
            {legacy.facility?.location && <span>{legacy.facility.location}</span>}
            {legacy.facility?.totalUnits && <span>{legacy.facility.totalUnits} units</span>}
            {legacy.facility?.occupancy && <span>{legacy.facility.occupancy}% occupancy</span>}
          </div>
        </div>

        {/* Score */}
        {legacy.marketOpportunity && (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 mb-8 text-center">
            <p className="text-sm text-[var(--text-tertiary)] mb-2">Market Opportunity Score</p>
            <p className="text-5xl font-semibold text-[var(--text-primary)] mb-1">{legacy.marketOpportunity.score}</p>
            <p className="text-lg font-semibold text-[var(--text-secondary)]">{legacy.marketOpportunity.grade}</p>
          </div>
        )}

        {/* Vacancy cost */}
        {legacy.vacancyCost && (
          <div className="rounded-2xl bg-red-500/5 border border-red-500/15 p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Vacancy Cost Analysis</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Vacant</p>
                <p className="text-lg font-semibold text-red-400">{legacy.vacancyCost.vacantUnits}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Avg Rate</p>
                <p className="text-lg font-semibold">${legacy.vacancyCost.avgUnitRate}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Monthly Loss</p>
                <p className="text-lg font-semibold text-red-400">${legacy.vacancyCost.monthlyLoss.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Annual Loss</p>
                <p className="text-xl font-semibold text-red-500">${legacy.vacancyCost.annualLoss.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Projections */}
        {legacy.projections && (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Projected Performance
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
              <div><p className="text-[var(--text-tertiary)] text-xs">Spend</p><p className="font-semibold">${legacy.projections.recommendedSpend.toLocaleString()}/mo</p></div>
              <div><p className="text-[var(--text-tertiary)] text-xs">CPL</p><p className="font-semibold">${legacy.projections.projectedCpl}</p></div>
              <div><p className="text-[var(--text-tertiary)] text-xs">Leads/mo</p><p className="font-semibold">{legacy.projections.projectedLeadsPerMonth}</p></div>
              <div><p className="text-[var(--text-tertiary)] text-xs">ROAS</p><p className="font-semibold text-emerald-400">{legacy.projections.projectedRoas}x</p></div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {legacy.recommendations?.length > 0 && (
          <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
            <div className="space-y-3">
              {legacy.recommendations.map((rec, i) => (
                <div key={i} className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${rec.priority === "high" ? "bg-red-500/15 text-red-400" : "bg-[var(--color-blue)]/15 text-[var(--color-blue)]"}`}>
                      {rec.priority}
                    </span>
                    <h3 className="text-sm font-semibold">{rec.title}</h3>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{rec.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
          <Rocket className="w-8 h-8 text-[var(--text-primary)] mx-auto mb-3" />
          <h2 className="text-xl font-semibold mb-2">Ready to Fill Your Vacant Units?</h2>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--color-dark)] text-[var(--color-light)] font-medium hover:opacity-90 transition-opacity"
          >
            Get a Free Facility Audit <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="text-center py-8 text-xs text-[var(--text-tertiary)]">
          Generated by StorageAds
          {createdAt && ` · ${new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
        </div>
      </div>
    </div>
  );
}
