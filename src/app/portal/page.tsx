"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  Users,
  Bell,
  Activity,
  Phone,
  Mail,
  ChevronRight,
  CheckCircle2,
  ShieldAlert,
  Info,
  AlertTriangle,
  PhoneCall,
  Footprints,
  FileText,
  ClipboardCheck,
  Megaphone,
  Search,
} from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import {
  type Alert,
  type ActivityItem,
  firstName,
  fmt,
  relativeTime,
  accountManagerOf,
  telHref,
} from "@/lib/portal-helpers";
import { Card, EmptyState, SectionSkeleton, ErrorState } from "@/components/portal/ui";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullIndicator } from "@/components/ui/pull-indicator";
import { PortalFacilitySection } from "@/components/ontology/portal-facility-section";
import { clearOntologyCache } from "@/components/ontology/use-ontology";
import { HomeAtmosphere } from "@/components/design/dl003/ui";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";

/* ─── types ─── */

interface OnboardingData {
  onboarding: {
    accessCode: string;
    updatedAt: string;
    completedAt: string | null;
    steps: Record<string, { completed: boolean; data: Record<string, unknown> }>;
  };
  completionPct: number;
}

/* ─── main page ─── */

export default function PortalDashboard() {
  usePortal();
  const [refreshKey, setRefreshKey] = useState(0);

  const { containerRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      clearOntologyCache();
      setRefreshKey((k) => k + 1);
    },
  });

  const sample = isPortalDemo();

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className="h-full overflow-y-auto pb-24"
    >
      <PullIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={80} />
      {sample && <HomeAtmosphere />}
      <div className="mx-auto max-w-3xl space-y-8 px-4 pt-6">
        <WelcomeBanner key={`welcome-${refreshKey}`} />
        <OnboardingProgress key={`onboarding-${refreshKey}`} />
        <PortalFacilitySection key={`facility-${refreshKey}`} />
        <CampaignGoalProgress key={`goal-${refreshKey}`} />
        <CampaignAlerts key={`alerts-${refreshKey}`} />
        <RecentActivity key={`activity-${refreshKey}`} />
        <ContactCard />
      </div>
    </div>
  );
}

/* ─── welcome banner ─── */

function WelcomeBanner() {
  const { session, client } = usePortal();
  const [stats, setStats] = useState<{ leads: number; moveIns: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const end = new Date().toISOString().split("T")[0];
    const start = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    fetch(`/api/attribution?accessCode=${session.accessCode}&startDate=${start}&endDate=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // move_ins_actual = move-ins by event date (reconciles with the goal
        // tracker); fall back to the cohort count for older API shapes.
        if (data?.totals)
          setStats({
            leads: data.totals.leads,
            moveIns: data.totals.move_ins_actual ?? data.totals.move_ins,
          });
      })
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  }, [session.accessCode]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hi)] p-5">
      <h1 className="text-xl font-semibold tracking-tight">
        {greeting}, {firstName(client.name)}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-body-text)]">
        Here is what is happening at {client.facilityName}
      </p>
      {statsLoading ? (
        <div className="mt-4 flex gap-6">
          <div><div className="h-8 w-16 animate-pulse rounded bg-[var(--color-light-gray)]" /><p className="mt-1 text-xs text-[var(--color-mid-gray)]">Total Leads (90d)</p></div>
          <div><div className="h-8 w-16 animate-pulse rounded bg-[var(--color-light-gray)]" /><p className="mt-1 text-xs text-[var(--color-mid-gray)]">Move-Ins (90d)</p></div>
        </div>
      ) : statsError ? (
        <p className="mt-4 text-xs text-[var(--color-mid-gray)]">Unable to load stats right now</p>
      ) : stats ? (
        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-2xl font-semibold">{fmt(stats.leads)}</p>
            <p className="text-xs text-[var(--color-mid-gray)]">Total Leads (90d)</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{fmt(stats.moveIns)}</p>
            <p className="text-xs text-[var(--color-mid-gray)]">Move-Ins (90d)</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── onboarding progress ─── */

function OnboardingProgress() {
  const { session } = usePortal();
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/client-onboarding?code=${session.accessCode}&email=${encodeURIComponent(session.email)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session.accessCode, session.email]);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch

  if (loading) return <SectionSkeleton />;
  if (error) return <ErrorState message="Failed to load onboarding status" onRetry={loadData} />;
  if (!data || data.completionPct >= 100 || data.onboarding.completedAt) return null;

  const steps = data.onboarding.steps;
  const totalSteps = Object.keys(steps).length || 5;
  const completedSteps = Object.values(steps).filter((s) => s.completed).length;

  return (
    <Card as="section">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[var(--color-dark)]" />
          <h2 className="text-sm font-semibold">Onboarding</h2>
        </div>
        <span className="text-xs text-[var(--color-body-text)]">{completedSteps}/{totalSteps} steps</span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-[var(--color-light-gray)]">
        <div className="h-full rounded-full bg-[var(--color-dark)] transition-all duration-500" style={{ width: `${data.completionPct}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-mid-gray)]">{data.completionPct}% complete</p>
        <a href="/portal/onboarding" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-dark)] hover:opacity-80">
          Continue Setup <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </Card>
  );
}

/* ─── campaign goal progress ─── */

function CampaignGoalProgress() {
  const { session } = usePortal();
  const [goal, setGoal] = useState<{ target: number; actual: number; pct: number | null } | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/client-goals?accessCode=${session.accessCode}&email=${encodeURIComponent(session.email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.current) {
          setGoal({ target: data.current.target ?? 0, actual: data.current.actual ?? 0, pct: data.current.pct ?? null });
        } else {
          setGoal({ target: 0, actual: 0, pct: null });
        }
      })
      .catch(() => setGoal({ target: 0, actual: 0, pct: null }))
      .finally(() => setGoalLoading(false));
  }, [session.accessCode, session.email]);

  if (goalLoading) return <SectionSkeleton />;
  if (!goal) return null;

  // No goal set yet: prompt rather than divide-by-zero.
  if (goal.target <= 0) {
    return (
      <Card as="section">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-[var(--color-mid-gray)]" />
          <h2 className="text-sm font-semibold">Monthly Goal</h2>
        </div>
        <p className="text-sm text-[var(--color-body-text)]">
          {goal.actual} move-in{goal.actual === 1 ? "" : "s"} this month.
        </p>
        <a href="/portal/settings" className="mt-1 inline-block text-xs font-medium text-[var(--color-body-text)] underline">
          Set a monthly goal
        </a>
      </Card>
    );
  }

  const pct = goal.pct ?? Math.min(100, Math.round((goal.actual / goal.target) * 100));

  // Pace: how far through the month we are vs. how far toward the goal we are.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  const expectedByNow = goal.target * (dayOfMonth / daysInMonth);
  const onTrack = goal.actual >= expectedByNow;

  return (
    <Card as="section">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-4 w-4 text-[var(--color-body-text)]" />
        <h2 className="text-sm font-semibold">Monthly Goal</h2>
      </div>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <span className="text-3xl font-semibold">{goal.actual}</span>
          <span className="text-lg text-[var(--color-mid-gray)]"> / {goal.target}</span>
        </div>
        <span className={`text-xs font-medium ${onTrack ? "text-[var(--color-green)]" : "text-[var(--color-dark)]"}`}>{pct}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-light-gray)]">
        <div className={`h-full rounded-full transition-all duration-700 ${onTrack ? "bg-[var(--color-green)]" : "bg-[var(--color-dark)]"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[var(--color-mid-gray)]">
        {onTrack ? "On pace" : "Behind pace"} &middot; {daysLeft} day{daysLeft === 1 ? "" : "s"} left this month
      </p>
    </Card>
  );
}

/* ─── campaign alerts ─── */

function CampaignAlerts() {
  const { session } = usePortal();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/alert-history?accessCode=${session.accessCode}&email=${encodeURIComponent(session.email)}&limit=20`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setAlerts((d.data || []) as Alert[]))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session.accessCode, session.email]);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch

  if (loading) return <SectionSkeleton />;
  if (error) return <ErrorState message="Failed to load alerts" onRetry={loadData} />;
  if (alerts.length === 0) return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-[var(--color-dark)]" />
        <h2 className="text-sm font-semibold">Campaign Alerts</h2>
      </div>
      <EmptyState
        icon={<CheckCircle2 className="h-6 w-6 text-[var(--color-green)]" />}
        title="No active alerts"
        message="You're all caught up. We'll surface campaign issues here as they come up."
      />
    </div>
  );

  // No amber token in the design system: critical -> red (alarm), warning ->
  // blue (heads-up), info -> charcoal. Color is paired with a distinct icon.
  const severityConfig = {
    critical: { bg: "bg-[var(--color-red)]/[0.06]", border: "border-[var(--color-red)]/20", text: "text-[var(--color-red)]", icon: <ShieldAlert className="h-4 w-4" /> },
    warning: { bg: "bg-[var(--color-blue)]/[0.06]", border: "border-[var(--color-blue)]/20", text: "text-[var(--color-blue)]", icon: <AlertTriangle className="h-4 w-4" /> },
    info: { bg: "bg-[var(--color-dark)]/[0.06]", border: "border-[var(--color-dark)]/20", text: "text-[var(--color-dark)]", icon: <Info className="h-4 w-4" /> },
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-[var(--color-dark)]" />
        <h2 className="text-sm font-semibold">Campaign Alerts</h2>
      </div>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const cfg = severityConfig[alert.severity] || severityConfig.info;
          return (
            <div key={alert.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${cfg.text}`}>{cfg.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-dark)]">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-body-text)]">{alert.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--color-mid-gray)]">{relativeTime(alert.created_at)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── recent activity ─── */

function RecentActivity() {
  const { session } = usePortal();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/client-activity?accessCode=${session.accessCode}&email=${encodeURIComponent(session.email)}&limit=20`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setItems((d.data || []) as ActivityItem[]))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session.accessCode, session.email]);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch

  if (loading) return <SectionSkeleton />;
  if (error) return <ErrorState message="Failed to load activity" onRetry={loadData} />;
  if (items.length === 0) return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--color-dark)]" />
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>
      <EmptyState icon={<Activity className="h-6 w-6" />} title="No recent activity yet" />
    </div>
  );

  const typeIcons: Record<string, React.ReactNode> = {
    lead_created: <Users className="h-3.5 w-3.5" />,
    lead_captured: <Users className="h-3.5 w-3.5" />,
    call_received: <PhoneCall className="h-3.5 w-3.5" />,
    walkin_logged: <Footprints className="h-3.5 w-3.5" />,
    report_sent: <FileText className="h-3.5 w-3.5" />,
    onboarding_step: <CheckCircle2 className="h-3.5 w-3.5" />,
    campaign_added: <Megaphone className="h-3.5 w-3.5" />,
    audit_generated: <Search className="h-3.5 w-3.5" />,
    audit_approved: <ClipboardCheck className="h-3.5 w-3.5" />,
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[var(--color-dark)]" />
        <h2 className="text-sm font-semibold">Recent Activity</h2>
      </div>
      <div className="max-h-96 overflow-y-auto rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        {items.map((item, i) => (
          <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${i < items.length - 1 ? "border-b border-[var(--border-subtle)]" : ""}`}>
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-light-gray)] text-[var(--color-body-text)]">
              {typeIcons[item.type] || <Activity className="h-3.5 w-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-dark)]">{item.label}</p>
              {item.detail && <p className="mt-0.5 truncate text-xs text-[var(--color-mid-gray)]">{item.detail}</p>}
              {item.leadName && <p className="mt-0.5 text-xs text-[var(--color-body-text)]">{item.leadName}</p>}
            </div>
            <span className="shrink-0 text-[10px] text-[var(--color-mid-gray)]">{relativeTime(item.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── contact card ─── */

function ContactCard() {
  const { client } = usePortal();
  const manager = accountManagerOf(client);
  const managerTel = telHref(manager.phone);
  const signedDate = client.signedAt
    ? new Date(client.signedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <Card as="section">
      <div className="mb-3 flex items-center gap-2">
        <Phone className="h-4 w-4 text-[var(--color-dark)]" />
        <h2 className="text-sm font-semibold">Your Team</h2>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-dark)]/[0.06] text-sm font-semibold text-[var(--color-dark)]">{manager.initial}</div>
          <div>
            <p className="text-sm font-medium">{manager.name}</p>
            <p className="text-xs text-[var(--color-mid-gray)]">Account Manager</p>
          </div>
        </div>
        <div className="space-y-2">
          <a href={`mailto:${manager.email}`} className="flex items-center gap-2 text-sm text-[var(--color-body-text)] hover:text-[var(--color-dark)]">
            <Mail className="h-3.5 w-3.5" /> {manager.email}
          </a>
          {manager.phone && managerTel && (
            <a href={managerTel} className="flex items-center gap-2 text-sm text-[var(--color-body-text)] hover:text-[var(--color-dark)]">
              <Phone className="h-3.5 w-3.5" /> {manager.phone}
            </a>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center justify-between text-xs text-[var(--color-mid-gray)]">
          <span>{client.facilityName}</span>
          {client.occupancyRange && <span>Occupancy at sign: {client.occupancyRange}</span>}
        </div>
        {signedDate && <p className="mt-1 text-xs text-[var(--color-mid-gray)]">Client since {signedDate}</p>}
      </div>
    </Card>
  );
}
