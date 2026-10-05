"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";
import ToolHeader, { ToolCta } from "@/components/tools/tool-header";
import RelatedTools from "@/components/tools/related-tools";
import { ShareButton, CsvButton, ResetButton } from "@/components/tools/tool-toolbar";
import ToolHandoff from "@/components/tools/tool-handoff";
import {
  MoneyField,
  PercentField,
  PlainNumber,
  SectionCard,
  ResultRow,
  MiniStat,
  Faq,
  usd0,
  pct,
} from "@/components/tools/fields";
import {
  deriveLeaseUp,
  buildLeaseUpCsvRows,
  LEASE_UP_DEFAULTS,
} from "@/lib/tools/lease-up";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { LEASE_UP_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   Lease-up / months-to-stabilization. Math lives in @/lib/tools/lease-up
   (pure, unit-tested); this is the UI shell.
   ────────────────────────────────────────────────────────────────────────── */

export default function LeaseUpClient() {
  const [totalUnits, setTotalUnits] = useState(0);
  const [currentOccupied, setCurrentOccupied] = useState(0);
  const [targetOccupancyPct, setTargetOccupancyPct] = useState(
    LEASE_UP_DEFAULTS.targetOccupancyPct,
  );
  const [moveInsPerMonth, setMoveInsPerMonth] = useState(0);
  const [monthlyChurnPct, setMonthlyChurnPct] = useState(
    LEASE_UP_DEFAULTS.monthlyChurnPct,
  );
  const [avgRate, setAvgRate] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "totalUnits",
        "currentOccupied",
        "targetOccupancyPct",
        "moveInsPerMonth",
        "monthlyChurnPct",
        "avgRate",
      ])
    )
      return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a link, not a render loop */
    if (params.has("totalUnits")) setTotalUnits(numParam(params, "totalUnits"));
    if (params.has("currentOccupied"))
      setCurrentOccupied(numParam(params, "currentOccupied"));
    if (params.has("targetOccupancyPct"))
      setTargetOccupancyPct(numParam(params, "targetOccupancyPct", 90));
    if (params.has("moveInsPerMonth"))
      setMoveInsPerMonth(numParam(params, "moveInsPerMonth"));
    if (params.has("monthlyChurnPct"))
      setMonthlyChurnPct(numParam(params, "monthlyChurnPct", 3));
    if (params.has("avgRate")) setAvgRate(numParam(params, "avgRate"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = {
    totalUnits,
    currentOccupied,
    targetOccupancyPct,
    moveInsPerMonth,
    monthlyChurnPct,
    avgRate,
  };
  const d = deriveLeaseUp(state);

  const shareParams = state;
  const csvRows = buildLeaseUpCsvRows(state, d);

  const reset = () => {
    setTotalUnits(0);
    setCurrentOccupied(0);
    setTargetOccupancyPct(90);
    setMoveInsPerMonth(0);
    setMonthlyChurnPct(3);
    setAvgRate(0);
  };

  const hasCore = totalUnits > 0 && moveInsPerMonth > 0;

  // Hand off to the marketing-ROI planner: same facility, "what budget buys
  // this pace?" Carry units, current occupancy %, and rate.
  const marketingHref =
    totalUnits > 0
      ? `/calculator?totalUnits=${totalUnits}&occupancyPct=${Math.round(
          (Math.min(currentOccupied, totalUnits) / totalUnits) * 100,
        )}${avgRate > 0 ? `&avgRate=${Math.round(avgRate)}` : ""}`
      : null;

  const headline = !hasCore
    ? "—"
    : d.unitsToFill === 0
      ? "At target"
      : d.reachable
        ? `${d.monthsToStabilize} mo`
        : "Not at this pace";
  const headlineColor =
    hasCore && !d.reachable && d.unitsToFill > 0
      ? "var(--color-red)"
      : "var(--color-light)";

  return (
    <div className="min-h-screen" style={{ background: "var(--color-light)" }}>
      <ToolHeader backHref="/tools" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-2xl mb-8">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-mid-gray)" }}
          >
            Free operator tool
          </span>
          <h1
            className="text-3xl sm:text-4xl font-bold mt-2 mb-3"
            style={{ color: "var(--color-dark)", letterSpacing: "-0.03em" }}
          >
            Storage Lease-Up Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            How long until the facility hits stabilized occupancy? Enter where you
            are today, your monthly move-in pace, and your move-out rate. Because
            churn compounds against a growing occupied base, we simulate it month
            by month — and flag when your pace can&apos;t reach the target at all.
            Runs in your browser.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("lease-up")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard step="Step 1" title="Where you are">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PlainNumber
                  label="Total units"
                  value={totalUnits}
                  onChange={setTotalUnits}
                />
                <PlainNumber
                  label="Currently occupied"
                  value={currentOccupied}
                  onChange={setCurrentOccupied}
                />
                <PercentField
                  label="Target occupancy"
                  help="The stabilized occupancy you're shooting for, often around 90%."
                  value={targetOccupancyPct}
                  onChange={setTargetOccupancyPct}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 2"
              title="The pace"
              subtitle="Gross move-ins is everyone who rents in a month; the move-out rate is the share of occupied units that vacate each month."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PlainNumber
                  label="Gross move-ins / month"
                  value={moveInsPerMonth}
                  onChange={setMoveInsPerMonth}
                />
                <PercentField
                  label="Monthly move-out rate"
                  help="Share of occupied units that move out each month. Storage churn is often a few percent."
                  value={monthlyChurnPct}
                  onChange={setMonthlyChurnPct}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 3"
              title="Revenue (optional)"
              subtitle="Add your average monthly rate to see the monthly revenue you're leaving on the table until you stabilize."
            >
              <div className="max-w-xs">
                <MoneyField
                  label="Average monthly rate"
                  value={avgRate}
                  onChange={setAvgRate}
                />
              </div>
            </SectionCard>
          </div>

          {/* Results */}
          <div className="lg:sticky lg:top-20">
            <div
              className="rounded-2xl p-6 sm:p-7"
              style={{ background: "var(--color-dark)", color: "var(--color-light)" }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-mid-gray)" }}
              >
                Time to stabilization
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: headlineColor, letterSpacing: "-0.03em" }}
                  aria-label={`Time to stabilization: ${headline}`}
                >
                  {headline}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {!hasCore
                  ? "Enter units and a move-in pace"
                  : d.reachable && d.unitsToFill > 0
                    ? `to fill ${d.unitsToFill.toLocaleString()} units to ${pct(targetOccupancyPct)}`
                    : !d.reachable
                      ? `move-ins only support ~${Math.round(d.equilibriumUnits).toLocaleString()} occupied at this churn`
                      : "already at or above target"}
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <MiniStat
                  label="Units to fill"
                  value={hasCore ? d.unitsToFill.toLocaleString() : "—"}
                />
                <MiniStat
                  label="Net month 1"
                  value={hasCore ? d.netFirstMonth.toFixed(1) : "—"}
                />
                <MiniStat
                  label="Target units"
                  value={totalUnits > 0 ? d.targetUnits.toLocaleString() : "—"}
                />
                <MiniStat
                  label="Steady-state ceiling"
                  value={
                    hasCore && d.equilibriumUnits > 0
                      ? Math.round(d.equilibriumUnits).toLocaleString()
                      : "—"
                  }
                />
              </div>

              {avgRate > 0 && (
                <div
                  className="mt-5 pt-5"
                  style={{ borderTop: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                      Monthly revenue gap to target
                    </span>
                    <span className="text-xl font-bold tabular-nums">
                      {usd0(d.monthlyRevenueGap)}
                    </span>
                  </div>
                </div>
              )}

              <a
                href={CAL_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
              >
                Pull the stabilization date forward
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                Every extra move-in a month compounds: a higher pace shortens
                lease-up by months. That&apos;s the line StorageAds is built to
                move.
              </p>
            </div>

            {/* Cross-tool handoff — plan the ad budget that buys this pace */}
            {marketingHref && (
              <ToolHandoff
                title="Plan the move-in pace"
                subtitle="Model the ad budget it takes to hit a move-in pace like this."
                links={[
                  {
                    href: marketingHref,
                    label: "Open the marketing ROI calculator",
                  },
                ]}
              />
            )}

            {/* breakdown */}
            <div
              className="rounded-2xl p-6 mt-6"
              style={{
                background: "var(--color-light)",
                border: "1px solid var(--color-light-gray)",
              }}
            >
              <h3
                className="text-sm font-semibold mb-3"
                style={{ color: "var(--color-dark)" }}
              >
                The math
              </h3>
              <ResultRow
                label="Target occupied units"
                value={totalUnits > 0 ? d.targetUnits.toLocaleString() : "—"}
              />
              <ResultRow
                label="− currently occupied"
                value={currentOccupied.toLocaleString()}
                muted
              />
              <ResultRow label="= units to fill" value={d.unitsToFill.toLocaleString()} />
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow
                label="Net absorption, month 1"
                value={hasCore ? d.netFirstMonth.toFixed(1) : "—"}
                strong
                negative={d.netFirstMonth < 0}
              />
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mt-16">
          <h2
            className="text-2xl font-bold mb-6"
            style={{ color: "var(--color-dark)", letterSpacing: "-0.02em" }}
          >
            How to read this
          </h2>
          <div className="flex flex-col gap-6">
            {LEASE_UP_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="Stabilize faster"
              body="Lease-up is a race between move-ins and move-outs. StorageAds runs the ads that raise the move-in pace and proves which campaigns filled the gap. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/tools/lease-up-calculator" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          This calculator is an estimating tool for self-storage operators. It
          models a constant move-in pace and a constant move-out rate; real
          lease-up moves with season, price, and demand. Results are only as
          accurate as the inputs you provide.
        </p>
      </main>
    </div>
  );
}
