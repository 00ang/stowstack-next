"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Crown,
  DollarSign,
  Loader2,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { usePartnerAuth } from "@/components/partner/use-partner-auth";

interface Tier {
  name: string;
  min: number;
  max: number | null;
  pct: number;
}

interface Referral {
  id: string;
  facility_name: string;
  status: string;
  commission: number;
  created_at: string | null;
}

interface PayoutEntry {
  id: string;
  period: string;
  amount: number;
  status: string;
  paid_at: string | null;
}

interface RevenueSummary {
  enabled: boolean;
  facilityCount: number;
  tier: Tier;
  nextTier: Tier | null;
  pct: number;
  grossMrr: number;
  monthlyEarnings: number;
  annualEarnings: number;
  lifetimeEarnings: number;
  tiers: Tier[];
  referrals: Referral[];
  payouts: PayoutEntry[];
}

// Icon + medal accent per tier name. These colors are a categorical signal
// on the tier icons only, and none of them is gold (banned everywhere) —
// the Gold tier gets navy. All earnings/CTA emphasis uses charcoal-on-light.
const TIER_VISUAL: Record<string, { icon: LucideIcon; color: string }> = {
  Bronze: { icon: Star, color: "#9A5B3C" },
  Silver: { icon: Award, color: "#8b94a3" },
  Gold: { icon: Crown, color: "#1E3C74" },
  Platinum: { icon: Sparkles, color: "#7c6f9c" },
};

const tierColor = (name: string): string =>
  TIER_VISUAL[name]?.color ?? "var(--color-mid-gray)";

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function RevenuePage() {
  const { session, loading: authLoading, authFetch } = usePartnerAuth();
  const [data, setData] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const res = await authFetch("/api/partner/revenue");
      if (res.ok) {
        setData((await res.json()) as RevenueSummary);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [session, authFetch]);

  useEffect(() => {
    fetchData(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch on mount
  }, [fetchData]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--color-mid-gray)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-8 text-center">
        <DollarSign className="mx-auto mb-3 h-8 w-8 text-[var(--color-mid-gray)]" />
        <p className="text-sm text-[var(--color-body-text)]">
          We couldn&apos;t load your revenue share right now.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            fetchData();
          }}
          className="mt-3 rounded-lg bg-[var(--color-dark)] px-4 py-2 text-xs font-semibold text-[var(--color-light)]"
        >
          Try again
        </button>
      </div>
    );
  }

  const {
    facilityCount,
    tier: currentTier,
    nextTier,
    pct,
    grossMrr,
    monthlyEarnings,
    annualEarnings,
    tiers,
    referrals,
    payouts,
  } = data;
  const TierIcon = TIER_VISUAL[currentTier.name]?.icon ?? Star;

  const facilitiesToNext = nextTier ? nextTier.min - facilityCount : 0;
  const nextTierMonthly = nextTier
    ? nextTier.min * (grossMrr / Math.max(1, facilityCount)) * (nextTier.pct / 100)
    : monthlyEarnings;

  return (
    <div className="space-y-6">
      {/* Hero Earnings Banner — charcoal-on-light per design system (no gold). */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--color-dark)] p-6 text-[var(--color-light)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.06),transparent_50%)]" />
        <div className="relative">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <TierIcon className="h-5 w-5" />
                <span className="text-sm font-semibold opacity-90">
                  {currentTier.name} Partner
                </span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {usd(monthlyEarnings)}
                <span className="text-lg font-medium opacity-75">/mo</span>
              </h2>
              <p className="mt-1 text-sm opacity-80">
                Current monthly revenue share earnings
              </p>
            </div>
            <div className="hidden text-right sm:block">
              <div className="text-3xl font-semibold">{pct}%</div>
              <div className="text-xs opacity-75">rev share rate</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Active Facilities", value: facilityCount.toString() },
              { label: "Gross MRR", value: usd(grossMrr) },
              { label: "Annual Earnings", value: usd(annualEarnings) },
              { label: "Revenue Share", value: `${pct}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl bg-[rgba(255,255,255,0.08)] p-3 backdrop-blur-sm"
              >
                <div className="text-xl font-semibold">{item.value}</div>
                <div className="text-[11px] opacity-75">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next Tier CTA */}
      {nextTier && (
        <div className="rounded-xl border border-[var(--color-green)]/25 bg-[var(--color-green)]/5 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-dark)]">
              <Rocket className="h-5 w-5 text-[var(--color-light)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--color-dark)]">
                Reach {nextTier.name}: {nextTier.pct}% Revenue Share
              </h3>
              <p className="mt-1 text-sm text-[var(--color-body-text)]">
                Add{" "}
                <span className="font-semibold text-[var(--color-dark)]">
                  {facilitiesToNext} more{" "}
                  {facilitiesToNext === 1 ? "facility" : "facilities"}
                </span>{" "}
                to reach {nextTier.name} tier and earn{" "}
                <span className="font-semibold text-[var(--color-dark)]">
                  {usd(nextTierMonthly)}/mo
                </span>
              </p>
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--color-mid-gray)]">
                  <span>
                    {facilityCount} / {nextTier.min} facilities
                  </span>
                  <span>
                    {Math.round((facilityCount / nextTier.min) * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-light-gray)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-dark)] transition-all"
                    style={{
                      width: `${Math.min(100, (facilityCount / nextTier.min) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tier Cards */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-[var(--color-dark)]" />
          <h3 className="text-sm font-semibold text-[var(--color-dark)]">
            Revenue Share Tiers
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {tiers.map((tier) => {
            const isActive = currentTier.name === tier.name;
            const TIcon = TIER_VISUAL[tier.name]?.icon ?? Star;
            return (
              <div
                key={tier.name}
                className={`rounded-xl border-2 p-4 text-center transition-all ${
                  isActive
                    ? "border-[var(--color-dark)] bg-[var(--color-dark)]/5"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-medium)]"
                }`}
              >
                <TIcon
                  className="mx-auto mb-2 h-6 w-6"
                  style={{ color: tierColor(tier.name) }}
                />
                <div
                  className="text-sm font-semibold"
                  style={{ color: tierColor(tier.name) }}
                >
                  {tier.name}
                </div>
                <div
                  className={`mt-1 text-3xl font-semibold ${isActive ? "text-[var(--color-dark)]" : "text-[var(--color-dark)]"}`}
                >
                  {tier.pct}%
                </div>
                <div className="mt-1 text-xs text-[var(--color-mid-gray)]">
                  {tier.max === null
                    ? `${tier.min}+ facilities`
                    : `${tier.min}–${tier.max} facilities`}
                </div>
                {isActive && (
                  <div className="mt-2 inline-block rounded-full bg-[var(--color-dark)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-dark)]">
                    YOUR TIER
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral List */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">
          Facilities Earning
        </h3>
        {referrals.length === 0 ? (
          <div className="py-8 text-center">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[var(--color-mid-gray)]" />
            <p className="text-sm text-[var(--color-body-text)]">
              No earnings booked yet
            </p>
            <p className="mt-1 text-xs text-[var(--color-mid-gray)]">
              Facilities appear here after your first monthly payout is calculated
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                    Facility
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                    Earned
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                    Since
                  </th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--color-dark)]">
                      {r.facility_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          r.status === "active"
                            ? "bg-[var(--color-green)]/10 text-[var(--color-green)]"
                            : "bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--color-dark)]">
                      {usd(r.commission)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--color-mid-gray)]">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleDateString()
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">
          Payout History
        </h3>
        {payouts.length === 0 ? (
          <div className="py-8 text-center">
            <DollarSign className="mx-auto mb-3 h-8 w-8 text-[var(--color-mid-gray)]" />
            <p className="text-sm text-[var(--color-body-text)]">No payouts yet</p>
            <p className="mt-1 text-xs text-[var(--color-mid-gray)]">
              Payouts are processed monthly within 15 days of billing cycle end
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                    Period
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--color-mid-gray)]">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--color-mid-gray)]">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-subtle)] last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-[var(--color-dark)]">
                      {p.period}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--color-dark)]">
                      {usd(p.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          p.status === "paid"
                            ? "bg-[var(--color-green)]/10 text-[var(--color-green)]"
                            : p.status === "processing"
                              ? "bg-[var(--color-blue)]/10 text-[var(--color-blue)]"
                              : "bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[var(--color-mid-gray)]">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString()
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-dark)]">
          How It Works
        </h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Recurring forever.",
              desc: "Your revenue share continues as long as each facility remains on StorageAds. No sunset clause, no cap.",
            },
            {
              title: "Tier upgrades are instant.",
              desc: `The moment you add your ${nextTier ? `${nextTier.min}th` : "next"} facility, your rate increases across all facilities.`,
            },
            {
              title: "Paid monthly.",
              desc: "Earnings are calculated at the end of each billing cycle and paid out within 15 days.",
            },
            {
              title: "No clawbacks.",
              desc: "If a facility churns, you simply stop earning on that facility. No repayment of prior earnings, ever.",
            },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-green)]" />
              <span className="text-xs text-[var(--color-body-text)]">
                <strong className="text-[var(--color-dark)]">{item.title}</strong>{" "}
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
