"use client";

/**
 * Three readings of what the system does. No live facility tape: there
 * isn't a public stream of move-ins to show.
 */

import { Panel, MONO } from "@/components/mono";

function Cell({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <Panel label={kicker}>
      <div style={{ padding: "14px 12px 16px" }}>
        <div style={{ fontFamily: MONO.serif, fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", color: MONO.text, lineHeight: 1.15 }}>
          {title}
        </div>
        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: MONO.textDim }}>{body}</p>
      </div>
    </Panel>
  );
}

export function LiveMonitorTriptych() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3"
      style={{ gap: 0, borderTop: `1px solid ${MONO.line}`, borderBottom: `1px solid ${MONO.line}` }}
    >
      <div style={{ borderRight: `1px solid ${MONO.line}` }}>
        <Cell kicker="MARKET" title="See the field" body="Competitors, their rates, and their reviews, before you spend a dollar." />
      </div>
      <div style={{ borderRight: `1px solid ${MONO.line}` }}>
        <Cell kicker="ADS" title="A page per ad" body="Meta reaches renters before they search. Google catches the ones already looking. Each ad has its own page." />
      </div>
      <Cell kicker="MOVE-IN" title="You mark it" body="When someone moves in, you mark it. The report shows where that person came from." />
    </div>
  );
}
