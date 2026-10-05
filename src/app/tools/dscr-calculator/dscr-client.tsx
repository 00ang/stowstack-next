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
  DecimalField,
  SectionCard,
  ResultRow,
  MiniStat,
  Faq,
  usd0,
  usd2,
  pct,
} from "@/components/tools/fields";
import {
  deriveDscr,
  buildDscrCsvRows,
  DSCR_DEFAULTS,
  type DscrMode,
} from "@/lib/tools/dscr";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { DSCR_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   DSCR / loan-sizing calculator. Math lives in @/lib/tools/dscr (pure,
   unit-tested); this is the UI shell.
   ────────────────────────────────────────────────────────────────────────── */

const MODE_OPTIONS: { key: DscrMode; label: string }[] = [
  { key: "size", label: "Size a loan" },
  { key: "check", label: "Check a loan" },
];

export default function DscrClient() {
  const [mode, setMode] = useState<DscrMode>(DSCR_DEFAULTS.mode);
  const [noi, setNoi] = useState(0);
  const [interestRatePct, setInterestRatePct] = useState(
    DSCR_DEFAULTS.interestRatePct,
  );
  const [amortYears, setAmortYears] = useState(DSCR_DEFAULTS.amortYears);
  const [targetDscr, setTargetDscr] = useState(DSCR_DEFAULTS.targetDscr);
  const [loanAmount, setLoanAmount] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState(0);

  // Seed from a shared/deep link's query params once on mount (post-hydration).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "mode",
        "noi",
        "interestRatePct",
        "amortYears",
        "targetDscr",
        "loanAmount",
        "purchasePrice",
      ])
    )
      return;
    const m = params.get("mode");
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a link, not a render loop */
    if (m === "size" || m === "check") setMode(m);
    if (params.has("noi")) setNoi(numParam(params, "noi"));
    if (params.has("interestRatePct"))
      setInterestRatePct(numParam(params, "interestRatePct", 6.5));
    if (params.has("amortYears")) setAmortYears(numParam(params, "amortYears", 25));
    if (params.has("targetDscr")) setTargetDscr(numParam(params, "targetDscr", 1.25));
    if (params.has("loanAmount")) setLoanAmount(numParam(params, "loanAmount"));
    if (params.has("purchasePrice"))
      setPurchasePrice(numParam(params, "purchasePrice"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = {
    mode,
    noi,
    interestRatePct,
    amortYears,
    targetDscr,
    loanAmount,
    purchasePrice,
  };
  const d = deriveDscr(state);

  const shareParams = state;
  const csvRows = buildDscrCsvRows(state, d);

  const reset = () => {
    setMode("size");
    setNoi(0);
    setInterestRatePct(6.5);
    setAmortYears(25);
    setTargetDscr(1.25);
    setLoanAmount(0);
    setPurchasePrice(0);
  };

  const hasCore =
    noi > 0 && (mode === "size" ? targetDscr > 0 : loanAmount > 0);

  // DSCR health colour: green at/above target, red below 1.0x, light between.
  const dscrColor =
    d.dscr <= 0
      ? "var(--color-light)"
      : d.dscr < 1
        ? "var(--color-red)"
        : d.dscr >= 1.25
          ? "var(--color-green)"
          : "var(--color-light)";

  const headlineLabel = mode === "size" ? "Maximum loan" : "Debt service coverage";
  const headline =
    mode === "size"
      ? hasCore
        ? usd0(d.loanAmount)
        : "—"
      : hasCore
        ? `${d.dscr.toFixed(2)}x`
        : "—";
  const headlineSub =
    mode === "size"
      ? hasCore
        ? `at ${targetDscr.toFixed(2)}x DSCR · ${pct(interestRatePct)} · ${amortYears}-yr amortization`
        : "Enter NOI and a target DSCR"
      : hasCore
        ? `${usd0(d.annualDebtService)}/yr debt service`
        : "Enter NOI and a loan amount";

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
            Storage DSCR & Loan-Sizing Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            Lenders size storage loans off NOI and a target debt service coverage
            ratio. Size the largest loan your NOI supports at a target DSCR, or
            check the DSCR, debt yield, and post-debt cash flow on a loan
            you&apos;re weighing. Need the NOI first? Run the{" "}
            <a
              href="/tools/noi-calculator"
              className="font-medium underline underline-offset-2"
              style={{ color: "var(--color-dark)" }}
            >
              NOI calculator
            </a>
            . The math runs in your browser.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("dscr")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard
              step="Step 1"
              title="What do you want to do?"
              subtitle="Size the biggest loan your NOI supports, or stress-test a specific loan amount."
            >
              <div
                role="group"
                aria-label="Mode"
                className="inline-flex rounded-lg p-1 w-full sm:w-auto"
                style={{ background: "var(--color-light-gray)" }}
              >
                {MODE_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={mode === o.key}
                    onClick={() => setMode(o.key)}
                    className="px-4 py-1.5 text-sm font-medium rounded-md transition-all flex-1 sm:flex-none"
                    style={{
                      background:
                        mode === o.key ? "var(--color-light)" : "transparent",
                      color:
                        mode === o.key
                          ? "var(--color-dark)"
                          : "var(--color-mid-gray)",
                      boxShadow:
                        mode === o.key ? "0 1px 2px rgba(20,20,19,0.08)" : "none",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard step="Step 2" title="The income">
              <div className="max-w-xs">
                <MoneyField
                  label="Annual NOI"
                  help="Net operating income for the year. Use the NOI calculator if you need it."
                  value={noi}
                  onChange={setNoi}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 3"
              title="The loan terms"
              subtitle="A fully-amortizing fixed-rate loan. Storage commonly amortizes over 25–30 years."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PercentField
                  label="Interest rate"
                  help="Annual rate. We compound it monthly."
                  value={interestRatePct}
                  onChange={setInterestRatePct}
                />
                <PlainNumber
                  label="Amortization (years)"
                  value={amortYears}
                  onChange={setAmortYears}
                />
                {mode === "size" ? (
                  <DecimalField
                    label="Target DSCR"
                    suffix="x"
                    help="The coverage floor your lender requires. 1.20–1.35x is typical; 1.25x is common."
                    value={targetDscr}
                    onChange={setTargetDscr}
                  />
                ) : (
                  <MoneyField
                    label="Loan amount"
                    help="The principal you're testing."
                    value={loanAmount}
                    onChange={setLoanAmount}
                  />
                )}
              </div>
            </SectionCard>

            <SectionCard
              step="Step 4"
              title="Purchase price / value (optional)"
              subtitle="Add the price or appraised value to see loan-to-value alongside coverage."
            >
              <div className="max-w-xs">
                <MoneyField
                  label="Purchase price / value"
                  value={purchasePrice}
                  onChange={setPurchasePrice}
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
                {headlineLabel}
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{
                    color: mode === "check" ? dscrColor : "var(--color-light)",
                    letterSpacing: "-0.03em",
                  }}
                  aria-label={`${headlineLabel}: ${headline}`}
                >
                  {headline}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {headlineSub}
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <MiniStat
                  label="Monthly payment"
                  value={hasCore ? usd2(d.monthlyPayment) : "—"}
                />
                <MiniStat
                  label="Annual debt service"
                  value={hasCore ? usd0(d.annualDebtService) : "—"}
                />
                <MiniStat
                  label={mode === "size" ? "DSCR" : "Debt yield"}
                  value={
                    mode === "size"
                      ? hasCore
                        ? `${d.dscr.toFixed(2)}x`
                        : "—"
                      : hasCore
                        ? pct(d.debtYield)
                        : "—"
                  }
                />
                <MiniStat
                  label="Cash flow after debt"
                  value={hasCore ? usd0(d.cashFlowAfterDebt) : "—"}
                />
              </div>

              <div
                className="mt-5 pt-5"
                style={{ borderTop: "1px solid color-mix(in srgb, var(--bg) 12%, transparent)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                    {purchasePrice > 0 ? "Loan-to-value" : "Debt yield"}
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {!hasCore
                      ? "—"
                      : purchasePrice > 0
                        ? pct(d.ltv)
                        : pct(d.debtYield)}
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
                Grow the NOI that sizes the loan
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                The loan you can carry is a function of NOI. Filling units and
                holding rate raises NOI, which raises the loan your facility
                supports.
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
              <ResultRow label="Annual NOI" value={noi > 0 ? usd0(noi) : "—"} />
              {mode === "size" ? (
                <ResultRow
                  label={`÷ target DSCR (${targetDscr.toFixed(2)}x)`}
                  value={hasCore ? usd0(d.annualDebtService) : "—"}
                  muted
                />
              ) : (
                <ResultRow
                  label="÷ annual debt service"
                  value={hasCore ? usd0(d.annualDebtService) : "—"}
                  muted
                />
              )}
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow
                label={mode === "size" ? "= supportable loan" : "= DSCR"}
                value={
                  !hasCore
                    ? "—"
                    : mode === "size"
                      ? usd0(d.loanAmount)
                      : `${d.dscr.toFixed(2)}x`
                }
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
            How storage lenders think about DSCR
          </h2>
          <div className="flex flex-col gap-6">
            {DSCR_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="The loan follows the NOI"
              body="Every unit you fill and rate you hold lifts NOI, and the loan your facility can carry rises with it. StorageAds runs the ads that move NOI. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/tools/dscr-calculator" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          This calculator is an estimating tool and does not constitute a loan
          commitment, appraisal, or financial advice. It uses a single fixed rate
          and a full amortization; real terms depend on appraised value, recourse,
          reserves, interest-only periods, and balloon dates. Confirm with your
          lender or mortgage broker before transacting.
        </p>
      </main>
    </div>
  );
}
