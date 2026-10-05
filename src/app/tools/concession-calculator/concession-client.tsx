"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";
import ToolHeader, { ToolCta } from "@/components/tools/tool-header";
import RelatedTools from "@/components/tools/related-tools";
import { ShareButton, CsvButton, ResetButton } from "@/components/tools/tool-toolbar";
import {
  MoneyField,
  PercentField,
  PlainNumber,
  SectionCard,
  ResultRow,
  MiniStat,
  Faq,
  usd0,
  usd2,
  pct,
} from "@/components/tools/fields";
import {
  deriveConcession,
  buildConcessionCsvRows,
  CONCESSION_DEFAULTS,
} from "@/lib/tools/concession";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { CONCESSION_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   Concession / "first month free" true-cost. Math lives in
   @/lib/tools/concession (pure, unit-tested); this is the UI shell.
   ────────────────────────────────────────────────────────────────────────── */

export default function ConcessionClient() {
  const [moveInsPerMonth, setMoveInsPerMonth] = useState(0);
  const [avgRate, setAvgRate] = useState(0);
  const [freeMonths, setFreeMonths] = useState(CONCESSION_DEFAULTS.freeMonths);
  const [discountPct, setDiscountPct] = useState(CONCESSION_DEFAULTS.discountPct);
  const [discountMonths, setDiscountMonths] = useState(
    CONCESSION_DEFAULTS.discountMonths,
  );
  const [avgStayMonths, setAvgStayMonths] = useState(
    CONCESSION_DEFAULTS.avgStayMonths,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "moveInsPerMonth",
        "avgRate",
        "freeMonths",
        "discountPct",
        "discountMonths",
        "avgStayMonths",
      ])
    )
      return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a link, not a render loop */
    if (params.has("moveInsPerMonth"))
      setMoveInsPerMonth(numParam(params, "moveInsPerMonth"));
    if (params.has("avgRate")) setAvgRate(numParam(params, "avgRate"));
    if (params.has("freeMonths")) setFreeMonths(numParam(params, "freeMonths", 1));
    if (params.has("discountPct")) setDiscountPct(numParam(params, "discountPct"));
    if (params.has("discountMonths"))
      setDiscountMonths(numParam(params, "discountMonths"));
    if (params.has("avgStayMonths"))
      setAvgStayMonths(numParam(params, "avgStayMonths", 12));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = {
    moveInsPerMonth,
    avgRate,
    freeMonths,
    discountPct,
    discountMonths,
    avgStayMonths,
  };
  const d = deriveConcession(state);

  const shareParams = state;
  const csvRows = buildConcessionCsvRows(state, d);

  const reset = () => {
    setMoveInsPerMonth(0);
    setAvgRate(0);
    setFreeMonths(1);
    setDiscountPct(0);
    setDiscountMonths(0);
    setAvgStayMonths(12);
  };

  const hasCore = avgRate > 0 && d.concessionPerMoveIn > 0;

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
            Storage Concession True-Cost Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            A free month feels expensive because you measure it against one
            month. Measured against a tenant&apos;s whole stay, it&apos;s usually
            a thin slice of lifetime revenue. Enter your concession and average
            length of stay to see what it really costs — per move-in, per year,
            and as a share of lifetime revenue. Runs in your browser.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("concession")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard step="Step 1" title="The tenant">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <MoneyField
                  label="Average monthly rate"
                  help="Street rate the concession discounts from."
                  value={avgRate}
                  onChange={setAvgRate}
                />
                <PlainNumber
                  label="Average length of stay (months)"
                  help="How long the typical tenant stays. Spreads the concession over lifetime revenue."
                  value={avgStayMonths}
                  onChange={setAvgStayMonths}
                />
                <PlainNumber
                  label="Move-ins / month getting it"
                  value={moveInsPerMonth}
                  onChange={setMoveInsPerMonth}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 2"
              title="The concession"
              subtitle="Combine free months with an optional temporary discount. Set either to zero if you don't use it."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PlainNumber
                  label="Free months"
                  help="Months of waived rent at move-in (e.g. first month free)."
                  value={freeMonths}
                  onChange={setFreeMonths}
                />
                <div className="hidden sm:block" />
                <PercentField
                  label="Additional discount"
                  help="An extra % off the rate for the months below."
                  value={discountPct}
                  onChange={setDiscountPct}
                />
                <PlainNumber
                  label="Discount months"
                  help="How many months that discount applies."
                  value={discountMonths}
                  onChange={setDiscountMonths}
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
                Cost per move-in
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: "var(--color-light)", letterSpacing: "-0.03em" }}
                  aria-label={`Cost per move-in: ${hasCore ? usd0(d.concessionPerMoveIn) : "not set"}`}
                >
                  {hasCore ? usd0(d.concessionPerMoveIn) : "—"}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {hasCore
                  ? `${pct(d.concessionPctOfLifetime)} of a tenant's lifetime revenue`
                  : "Enter a rate and a concession"}
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <MiniStat
                  label="Effective rate / mo"
                  value={hasCore ? usd2(d.effectiveMonthlyRate) : "—"}
                />
                <MiniStat
                  label="% of lifetime"
                  value={hasCore ? pct(d.concessionPctOfLifetime) : "—"}
                />
                <MiniStat
                  label="Cost / month"
                  value={
                    moveInsPerMonth > 0 && hasCore
                      ? usd0(d.monthlyConcessionCost)
                      : "—"
                  }
                />
                <MiniStat
                  label="Cost / year"
                  value={
                    moveInsPerMonth > 0 && hasCore
                      ? usd0(d.annualConcessionCost)
                      : "—"
                  }
                />
              </div>

              <div
                className="mt-5 pt-5"
                style={{ borderTop: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                    Lifetime revenue / tenant
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {hasCore ? usd0(d.lifetimeRevenuePerTenant) : "—"}
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
                Win move-ins without giving away margin
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                A concession only pays off on a move-in you&apos;d have lost.
                Marketing that brings ready-to-rent demand lets you discount less.
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
                label={`Free months (${freeMonths})`}
                value={hasCore ? usd0(freeMonths * avgRate) : "—"}
              />
              <ResultRow
                label={`Discount (${pct(discountPct)} × ${discountMonths} mo)`}
                value={hasCore ? usd0((discountPct / 100) * avgRate * discountMonths) : "—"}
                muted
              />
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow
                label="= concession per move-in"
                value={hasCore ? usd2(d.concessionPerMoveIn) : "—"}
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
            How to think about concessions
          </h2>
          <div className="flex flex-col gap-6">
            {CONCESSION_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="Discount less by marketing more"
              body="A full funnel of ready-to-rent demand means you win move-ins on visibility, not giveaways. StorageAds runs the ads that bring it. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/tools/concession-calculator" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          This calculator is an estimating tool for self-storage operators and
          does not constitute financial advice. It assumes the average length of
          stay you enter; actual tenant behavior varies. Results are only as
          accurate as the inputs you provide.
        </p>
      </main>
    </div>
  );
}
