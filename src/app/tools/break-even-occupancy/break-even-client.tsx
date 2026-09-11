"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";
import ToolHeader, { ToolCta } from "@/components/tools/tool-header";
import RelatedTools from "@/components/tools/related-tools";
import { ShareButton, CsvButton, ResetButton } from "@/components/tools/tool-toolbar";
import {
  MoneyField,
  PlainNumber,
  SectionCard,
  ResultRow,
  MiniStat,
  Faq,
  usd0,
  pct,
} from "@/components/tools/fields";
import { deriveBreakEven, buildBreakEvenCsvRows } from "@/lib/tools/break-even";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { BREAK_EVEN_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   Break-even occupancy. Math lives in @/lib/tools/break-even (pure,
   unit-tested); this is the UI shell.
   ────────────────────────────────────────────────────────────────────────── */

export default function BreakEvenClient() {
  const [totalUnits, setTotalUnits] = useState(0);
  const [avgRate, setAvgRate] = useState(0);
  const [monthlyOpex, setMonthlyOpex] = useState(0);
  const [monthlyDebt, setMonthlyDebt] = useState(0);
  const [currentOccupied, setCurrentOccupied] = useState(0);

  // Seed from a shared link's query params once on mount (post-hydration).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "totalUnits",
        "avgRate",
        "monthlyOpex",
        "monthlyDebt",
        "currentOccupied",
      ])
    )
      return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a shared link, not a render loop */
    if (params.has("totalUnits")) setTotalUnits(numParam(params, "totalUnits"));
    if (params.has("avgRate")) setAvgRate(numParam(params, "avgRate"));
    if (params.has("monthlyOpex")) setMonthlyOpex(numParam(params, "monthlyOpex"));
    if (params.has("monthlyDebt")) setMonthlyDebt(numParam(params, "monthlyDebt"));
    if (params.has("currentOccupied"))
      setCurrentOccupied(numParam(params, "currentOccupied"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = {
    totalUnits,
    avgRate,
    monthlyOpex,
    monthlyDebt,
    currentOccupied,
  };
  const result = deriveBreakEven(state);
  const {
    opBreakEvenUnits,
    allInBreakEvenUnits,
    opBreakEvenPct,
    allInBreakEvenPct,
    currentPct,
    cushionUnits,
    cushionPct,
  } = result;

  const shareParams = state;
  const csvRows = buildBreakEvenCsvRows(state, result);
  const hasCore = avgRate > 0 && monthlyOpex > 0;

  const reset = () => {
    setTotalUnits(0);
    setAvgRate(0);
    setMonthlyOpex(0);
    setMonthlyDebt(0);
    setCurrentOccupied(0);
  };
  const hasCurrent = currentOccupied > 0 && totalUnits > 0;
  const above = cushionUnits >= 0;

  const fmtUnits = (n: number) =>
    `${Math.ceil(Math.max(0, n)).toLocaleString()} units`;

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
            Break-Even Occupancy Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            How full does the facility need to be just to cover the bills? Enter
            your units, average rate, and monthly costs to find the occupancy that
            covers operating expenses — and the higher one that covers your loan
            too. Then see how much cushion you have above it today.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("break-even")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard step="Step 1" title="The facility">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PlainNumber
                  label="Total units"
                  value={totalUnits}
                  onChange={setTotalUnits}
                />
                <MoneyField
                  label="Average monthly rate"
                  help="Blended monthly rent across your unit mix."
                  value={avgRate}
                  onChange={setAvgRate}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 2"
              title="Monthly costs"
              subtitle="Operating expenses keep the doors open; debt service is your mortgage. Enter both for an all-in break-even."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <MoneyField
                  label="Monthly operating expenses"
                  help="Payroll, taxes, insurance, utilities, marketing, management, etc. Not your loan."
                  value={monthlyOpex}
                  onChange={setMonthlyOpex}
                />
                <MoneyField
                  label="Monthly debt service"
                  help="Mortgage principal + interest. Leave at 0 to see operating break-even only."
                  value={monthlyDebt}
                  onChange={setMonthlyDebt}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 3"
              title="Where you are today (optional)"
              subtitle="Add your current occupied unit count to see your cushion above break-even."
            >
              <div className="max-w-xs">
                <PlainNumber
                  label="Currently occupied units"
                  value={currentOccupied}
                  onChange={setCurrentOccupied}
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
                All-in break-even occupancy
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: "var(--color-light)", letterSpacing: "-0.03em" }}
                  aria-label={`All-in break-even occupancy: ${
                    hasCore && totalUnits > 0 ? pct(allInBreakEvenPct) : "not set"
                  }`}
                >
                  {hasCore && totalUnits > 0 ? pct(allInBreakEvenPct) : "—"}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {hasCore
                  ? `${fmtUnits(allInBreakEvenUnits)} to cover costs + debt`
                  : "Enter rate and costs"}
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "rgba(250,249,245,0.12)" }}
              >
                <MiniStat
                  label="Operating break-even"
                  value={hasCore ? fmtUnits(opBreakEvenUnits) : "—"}
                />
                <MiniStat
                  label="Op. break-even %"
                  value={hasCore && totalUnits > 0 ? pct(opBreakEvenPct) : "—"}
                />
                <MiniStat
                  label="All-in break-even"
                  value={hasCore ? fmtUnits(allInBreakEvenUnits) : "—"}
                />
                <MiniStat
                  label="Current occupancy"
                  value={hasCurrent ? pct(currentPct) : "add today"}
                />
              </div>

              {hasCurrent && hasCore && (
                <div
                  className="mt-5 pt-5"
                  style={{ borderTop: "1px solid rgba(250,249,245,0.12)" }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className="text-sm"
                      style={{ color: "var(--color-mid-gray)" }}
                    >
                      Cushion above all-in break-even
                    </span>
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{
                        color: above ? "var(--color-light)" : "var(--color-red)",
                      }}
                    >
                      {above ? "+" : ""}
                      {Math.round(cushionUnits).toLocaleString()} u ·{" "}
                      {above ? "+" : ""}
                      {cushionPct.toFixed(1)} pts
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
                Widen the cushion
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                Every unit above break-even is close to pure profit. Filling them
                faster is the whole game.
              </p>
            </div>

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
                label="Monthly operating expenses"
                value={usd0(monthlyOpex)}
              />
              <ResultRow label="Monthly debt service" value={usd0(monthlyDebt)} muted />
              <ResultRow
                label="Total monthly cost"
                value={usd0(monthlyOpex + monthlyDebt)}
              />
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow label="÷ average rate" value={usd0(avgRate)} muted />
              <ResultRow
                label="= units to break even"
                value={hasCore ? fmtUnits(allInBreakEvenUnits) : "—"}
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
            {BREAK_EVEN_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="Get further above break-even"
              body="The units above your break-even line are where the profit lives. StorageAds runs the ads and proves which campaigns filled the gap. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/tools/break-even-occupancy" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          This calculator is an estimating tool for self-storage operators and
          does not constitute financial, accounting, or investment advice. Results
          are only as accurate as the inputs you provide.
        </p>
      </main>
    </div>
  );
}
