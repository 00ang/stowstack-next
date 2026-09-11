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
  deriveExpansion,
  buildExpansionCsvRows,
  EXPANSION_DEFAULTS,
} from "@/lib/tools/expansion";
import { csvFileName } from "@/lib/tools/csv";
import { numParam, hasAnyParam } from "@/lib/tools/share";
import { EXPANSION_FAQS } from "@/lib/tools/faqs";

/* ──────────────────────────────────────────────────────────────────────────
   Expansion / add-units ROI. Math lives in @/lib/tools/expansion (pure,
   unit-tested); this is the UI shell.
   ────────────────────────────────────────────────────────────────────────── */

export default function ExpansionClient() {
  const [newUnits, setNewUnits] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);
  const [avgRate, setAvgRate] = useState(0);
  const [stabilizedOccupancyPct, setStabilizedOccupancyPct] = useState(
    EXPANSION_DEFAULTS.stabilizedOccupancyPct,
  );
  const [opexRatioPct, setOpexRatioPct] = useState(EXPANSION_DEFAULTS.opexRatioPct);
  const [capRatePct, setCapRatePct] = useState(EXPANSION_DEFAULTS.capRatePct);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      !hasAnyParam(params, [
        "newUnits",
        "costPerUnit",
        "avgRate",
        "stabilizedOccupancyPct",
        "opexRatioPct",
        "capRatePct",
      ])
    )
      return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time seed from a link, not a render loop */
    if (params.has("newUnits")) setNewUnits(numParam(params, "newUnits"));
    if (params.has("costPerUnit")) setCostPerUnit(numParam(params, "costPerUnit"));
    if (params.has("avgRate")) setAvgRate(numParam(params, "avgRate"));
    if (params.has("stabilizedOccupancyPct"))
      setStabilizedOccupancyPct(numParam(params, "stabilizedOccupancyPct", 90));
    if (params.has("opexRatioPct"))
      setOpexRatioPct(numParam(params, "opexRatioPct", 35));
    if (params.has("capRatePct")) setCapRatePct(numParam(params, "capRatePct", 6.5));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const state = {
    newUnits,
    costPerUnit,
    avgRate,
    stabilizedOccupancyPct,
    opexRatioPct,
    capRatePct,
  };
  const d = deriveExpansion(state);

  const shareParams = state;
  const csvRows = buildExpansionCsvRows(state, d);

  const reset = () => {
    setNewUnits(0);
    setCostPerUnit(0);
    setAvgRate(0);
    setStabilizedOccupancyPct(90);
    setOpexRatioPct(35);
    setCapRatePct(6.5);
  };

  // Hand off to the lease-up tool: how long to fill the new units?
  const leaseUpHref =
    newUnits > 0
      ? `/tools/lease-up-calculator?totalUnits=${newUnits}&currentOccupied=0&targetOccupancyPct=${Math.round(
          stabilizedOccupancyPct,
        )}${avgRate > 0 ? `&avgRate=${Math.round(avgRate)}` : ""}`
      : null;

  const hasCore = newUnits > 0 && costPerUnit > 0 && avgRate > 0;
  const spreadColor =
    !hasCore || capRatePct <= 0
      ? "var(--color-light)"
      : d.developmentSpread > 0
        ? "var(--color-green)"
        : "var(--color-red)";

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
            Storage Expansion ROI Calculator
          </h1>
          <p
            className="text-base leading-relaxed"
            style={{ color: "var(--color-body-text)" }}
          >
            You can build more units — but does the NOI justify the capex? This
            runs the development test: yield on cost versus your cap rate. The
            spread between them is the value you create per dollar spent. Positive
            spread means building beats buying. Runs in your browser.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 mb-6 print:hidden">
          <ShareButton params={shareParams} />
          <CsvButton rows={csvRows} filename={csvFileName("expansion")} />
          <ResetButton onReset={reset} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
          {/* Inputs */}
          <div className="flex flex-col gap-6">
            <SectionCard step="Step 1" title="The build">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PlainNumber
                  label="New units"
                  value={newUnits}
                  onChange={setNewUnits}
                />
                <MoneyField
                  label="Build cost per unit"
                  help="All-in: construction, site work, soft costs, per unit added."
                  value={costPerUnit}
                  onChange={setCostPerUnit}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 2"
              title="The income"
              subtitle="What the new units will earn once they've stabilized."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <MoneyField
                  label="Expected monthly rate"
                  help="Street rate you expect the new units to hold."
                  value={avgRate}
                  onChange={setAvgRate}
                />
                <PercentField
                  label="Stabilized occupancy"
                  value={stabilizedOccupancyPct}
                  onChange={setStabilizedOccupancyPct}
                />
                <PercentField
                  label="Operating expense ratio"
                  help="Operating cost as a share of gross rent. Storage commonly runs 35–45%; bolt-on units can run leaner."
                  value={opexRatioPct}
                  onChange={setOpexRatioPct}
                />
              </div>
            </SectionCard>

            <SectionCard
              step="Step 3"
              title="The benchmark"
              subtitle="The cap rate you'd pay to buy this NOI instead of building it. The gap to your yield on cost is the development profit."
            >
              <div className="max-w-xs">
                <PercentField
                  label="Market cap rate"
                  help="Self-storage cap rates commonly run ~5.5–7.5%."
                  value={capRatePct}
                  onChange={setCapRatePct}
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
                Yield on cost
              </span>
              <div className="mt-2 mb-1" role="status" aria-live="polite">
                <span
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: "var(--color-light)", letterSpacing: "-0.03em" }}
                  aria-label={`Yield on cost: ${hasCore ? pct(d.yieldOnCost) : "not set"}`}
                >
                  {hasCore ? pct(d.yieldOnCost) : "—"}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                {hasCore && capRatePct > 0 ? (
                  <span style={{ color: spreadColor }}>
                    {d.developmentSpread >= 0 ? "+" : ""}
                    {d.developmentSpread.toFixed(2)} pts vs a {pct(capRatePct)} cap
                  </span>
                ) : (
                  "Stabilized NOI ÷ total cost to build"
                )}
              </p>

              <div
                className="grid grid-cols-2 gap-px mt-6 rounded-xl overflow-hidden"
                style={{ background: "rgba(250,249,245,0.12)" }}
              >
                <MiniStat label="Total capex" value={hasCore ? usd0(d.capex) : "—"} />
                <MiniStat
                  label="Added annual NOI"
                  value={hasCore ? usd0(d.addedNoi) : "—"}
                />
                <MiniStat
                  label="Value created"
                  value={hasCore && capRatePct > 0 ? usd0(d.valueCreated) : "—"}
                />
                <MiniStat
                  label="Profit over cost"
                  value={hasCore && capRatePct > 0 ? usd0(d.profitOverCost) : "—"}
                />
              </div>

              <div
                className="mt-5 pt-5"
                style={{ borderTop: "1px solid rgba(250,249,245,0.12)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm" style={{ color: "var(--color-mid-gray)" }}>
                    Value created @ {pct(capRatePct)} cap
                  </span>
                  <span className="text-xl font-bold tabular-nums">
                    {hasCore && capRatePct > 0 ? usd0(d.valueCreated) : "—"}
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
                Fill the new units faster
                <ArrowRight className="h-4 w-4" />
              </a>
              <p
                className="text-xs mt-3 leading-snug"
                style={{ color: "var(--color-mid-gray)" }}
              >
                The development spread only pays out once the new units are full.
                Marketing that leases them up is what turns capex into value.
              </p>
            </div>

            {/* Cross-tool handoff — how long to fill the new units? */}
            {leaseUpHref && (
              <ToolHandoff
                title="Then lease them up"
                subtitle="The spread only pays out once the units fill. Estimate how long that takes."
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
              <ResultRow
                label="Stabilized added NOI"
                value={hasCore ? usd0(d.addedNoi) : "—"}
              />
              <ResultRow
                label="÷ total capex"
                value={hasCore ? usd0(d.capex) : "—"}
                muted
              />
              <div
                className="my-1.5"
                style={{ borderTop: "1px solid var(--color-light-gray)" }}
              />
              <ResultRow
                label="= yield on cost"
                value={hasCore ? pct(d.yieldOnCost) : "—"}
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
            How the development test works
          </h2>
          <div className="flex flex-col gap-6">
            {EXPANSION_FAQS.map((f) => (
              <Faq key={f.q} q={f.q}>
                {f.a}
              </Faq>
            ))}
          </div>

          <div className="mt-12">
            <ToolCta
              heading="Capex only pays once the units fill"
              body="A great development spread is worth nothing until the new units lease up. StorageAds runs the ads that fill them and proves which campaigns did it. Built for storage operators, not adapted from another industry."
            />
          </div>
        </div>

        <RelatedTools currentHref="/tools/expansion-calculator" />

        <p
          className="text-xs mt-12 max-w-2xl leading-relaxed"
          style={{ color: "var(--color-mid-gray)" }}
        >
          This calculator is an estimating tool and does not constitute
          construction, financial, or investment advice. It models a stabilized
          year and ignores lease-up time, financing, and phasing. Confirm costs
          and rents with your builder and market before committing capital.
        </p>
      </main>
    </div>
  );
}
