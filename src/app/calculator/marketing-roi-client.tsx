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
  SliderField,
  SectionCard,
  ResultRow,
  MiniStat,
  Faq,
  usd0,
  usd2,
} from "@/components/tools/fields";
import {
  deriveMarketingRoi,
  buildMarketingRoiCsvRows,
  MARKETING_ROI_DEFAULTS,
  DEFAULT_COST_PER_MOVE_IN,
} from "@/lib/tools/marketing-roi";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { MARKETING_ROI_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   Marketing ROI calculator. Math lives in @/lib/tools/marketing-roi (pure,
   unit-tested); this is the UI shell, matched to the rest of the /tools suite.
   ────────────────────────────────────────────────────────────────────────── */

export default function MarketingRoiClient() {
  const [totalUnits, setTotalUnits] = useState(MARKETING_ROI_DEFAULTS.totalUnits);
  const [occupancyPct, setOccupancyPct] = useState(
    MARKETING_ROI_DEFAULTS.occupancyPct,
  );
  const [avgRate, setAvgRate] = useState(MARKETING_ROI_DEFAULTS.avgRate);
  const [monthlyBudget, setMonthlyBudget] = useState(
    MARKETING_ROI_DEFAULTS.monthlyBudget,
  );
  const [costPerMoveIn, setCostPerMoveIn] = useState(
    MARKETING_ROI_DEFAULTS.costPerMoveIn,
  );

  // Seed from a shared link's query params once on mount (post-hydration).
  // Accepts both the current keys and the legacy short keys the old calculator
  // shared (units/occ/rate/budget), so old links keep working.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "totalUnits",
        "units",
        "occupancyPct",
        "occ",
        "avgRate",
        "rate",
        "monthlyBudget",
        "budget",
        "costPerMoveIn",
      ])
    )
      return;
    const units = params.has("totalUnits")
      ? numParam(params, "totalUnits", MARKETING_ROI_DEFAULTS.totalUnits)
      : params.has("units")
        ? numParam(params, "units", MARKETING_ROI_DEFAULTS.totalUnits)
        : null;
    const occ = params.has("occupancyPct")
      ? numParam(params, "occupancyPct", MARKETING_ROI_DEFAULTS.occupancyPct)
      : params.has("occ")
        ? numParam(params, "occ", MARKETING_ROI_DEFAULTS.occupancyPct)
        : null;
    const rate = params.has("avgRate")
      ? numParam(params, "avgRate", MARKETING_ROI_DEFAULTS.avgRate)
      : params.has("rate")
        ? numParam(params, "rate", MARKETING_ROI_DEFAULTS.avgRate)
        : null;
    const budget = params.has("monthlyBudget")
      ? numParam(params, "monthlyBudget", MARKETING_ROI_DEFAULTS.monthlyBudget)
      : params.has("budget")
        ? numParam(params, "budget", MARKETING_ROI_DEFAULTS.monthlyBudget)
        : null;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a shared link, not a render loop */
    if (units != null) setTotalUnits(units);
    if (occ != null) setOccupancyPct(occ);
    if (rate != null) setAvgRate(rate);
    if (budget != null) setMonthlyBudget(budget);
    if (params.has("costPerMoveIn"))
      setCostPerMoveIn(numParam(params, "costPerMoveIn", DEFAULT_COST_PER_MOVE_IN));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = { totalUnits, occupancyPct, avgRate, monthlyBudget, costPerMoveIn };
  const d = deriveMarketingRoi(state);

  const shareParams = state;
  const csvRows = buildMarketingRoiCsvRows(state, d);

  const reset = () => {
    setTotalUnits(MARKETING_ROI_DEFAULTS.totalUnits);
    setOccupancyPct(MARKETING_ROI_DEFAULTS.occupancyPct);
    setAvgRate(MARKETING_ROI_DEFAULTS.avgRate);
    setMonthlyBudget(MARKETING_ROI_DEFAULTS.monthlyBudget);
    setCostPerMoveIn(MARKETING_ROI_DEFAULTS.costPerMoveIn);
  };

  // Hand off to the lease-up tool: at this move-in pace, how long to stabilize?
  const occupiedNow = Math.round((totalUnits * occupancyPct) / 100);
  const leaseUpHref =
    totalUnits > 0 && d.estMoveIns > 0
      ? `/tools/lease-up-calculator?totalUnits=${totalUnits}&currentOccupied=${occupiedNow}&moveInsPerMonth=${d.estMoveIns}${
          avgRate > 0 ? `&avgRate=${Math.round(avgRate)}` : ""
        }`
      : null;

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
            Storage Marketing ROI Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            Plug in your units, occupancy, average rate, and ad budget to model
            the move-ins a marketing program can produce, the revenue they add,
            and your return on ad spend. The cost per move-in starts as a sample.
            Replace it with yours. Runs in your browser.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("marketing-roi")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard step="Step 1" title="Your facility">
              <div className="flex flex-col gap-1">
                <SliderField
                  label="Total units"
                  value={totalUnits}
                  onChange={setTotalUnits}
                  min={50}
                  max={500}
                  step={10}
                  format={(v) => String(v)}
                />
                <SliderField
                  label="Current occupancy"
                  value={occupancyPct}
                  onChange={setOccupancyPct}
                  min={50}
                  max={100}
                  step={1}
                  format={(v) => `${v}%`}
                />
                <SliderField
                  label="Average monthly rate"
                  value={avgRate}
                  onChange={setAvgRate}
                  min={40}
                  max={250}
                  step={5}
                  format={(v) => `$${v}`}
                />
                <SliderField
                  label="Monthly ad budget"
                  value={monthlyBudget}
                  onChange={setMonthlyBudget}
                  min={500}
                  max={5000}
                  step={100}
                  format={(v) => `$${v.toLocaleString()}`}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 2"
              title="Cost per move-in"
              subtitle="Put in your own number. The field starts at a sample so the math has something to run."
            >
              <div className="max-w-xs">
                <MoneyField
                  label="Cost per move-in"
                  help="Your ad spend divided by the move-ins it produced. Replace the sample."
                  value={costPerMoveIn}
                  onChange={setCostPerMoveIn}
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
                Additional annual revenue
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: "var(--color-light)", letterSpacing: "-0.03em" }}
                  aria-label={`Additional annual revenue: ${usd0(d.additionalAnnualRevenue)}`}
                >
                  {usd0(d.additionalAnnualRevenue)}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {usd0(d.additionalMonthlyRevenue)} per month from {d.estMoveIns}{" "}
                move-ins
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <MiniStat label="Move-ins / mo" value={String(d.estMoveIns)} />
                <MiniStat label="Return on ad spend" value={`${d.roas.toFixed(1)}x`} />
                <MiniStat
                  label="Added revenue / mo"
                  value={usd0(d.additionalMonthlyRevenue)}
                />
                <MiniStat
                  label="Months to fill vacancy"
                  value={d.monthsToFill > 0 ? d.monthsToFill.toFixed(1) : "—"}
                />
              </div>

              <div
                className="mt-5 pt-5"
                style={{ borderTop: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                    Vacant units to fill
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {d.vacantUnits.toLocaleString()}
                  </span>
                </div>
              </div>

              <a
                href={CAL_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
              >
                Turn this budget into move-ins
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                This counts only the first month of rent from a single month of
                move-ins. Tenants stay for months and absorb rate increases, so
                the real return runs higher.
              </p>
            </div>

            {/* Cross-tool handoff — how long to stabilize at this pace? */}
            {leaseUpHref && (
              <ToolHandoff
                title="See it as a timeline"
                subtitle={`At ${d.estMoveIns} move-ins a month, how long until you stabilize?`}
                links={[
                  {
                    href: leaseUpHref,
                    label: "Open the lease-up calculator",
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
              <ResultRow label="Monthly ad budget" value={usd0(monthlyBudget)} />
              <ResultRow
                label="÷ cost per move-in"
                value={usd2(costPerMoveIn)}
                muted
              />
              <ResultRow label="= move-ins / month" value={String(d.estMoveIns)} />
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow label="× average rate" value={usd0(avgRate)} muted />
              <ResultRow
                label="= added revenue / month"
                value={usd0(d.additionalMonthlyRevenue)}
                strong
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
            {MARKETING_ROI_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="A sign on a chainlink fence is not an acquisition strategy"
              body="StorageAds runs the Meta and Google ads and builds a landing page for every ad. One bill per facility per month. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/calculator" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          These projections are estimates based on StorageAds operator averages.
          Actual results depend on market conditions, facility quality, demand,
          and competition. This is an estimating tool, not a guarantee of
          performance.
        </p>
      </main>
    </div>
  );
}
