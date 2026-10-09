"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";

export type SkyMode = "off" | "hero" | "strip" | "canvas";

/** Sample portal only. `?sky=hero|strip|canvas`. Default on the builder is the hero band. */
export function useSkyMode(): SkyMode {
  const [mode, setMode] = useState<SkyMode>("off");
  useEffect(() => {
    if (!isPortalDemo()) {
      setMode("off");
      return;
    }
    const v = new URLSearchParams(window.location.search).get("sky");
    if (v === "strip" || v === "canvas" || v === "hero") setMode(v);
    else setMode("hero");
  }, []);
  return mode;
}

/**
 * Design folder 003 pieces for the sample-portal mock.
 * Sky is a plate. Text sits in a white pane, never on the dots.
 * On a phone the 780px dither is shown at 390 CSS px, pixelated.
 */

const PHONE = "/design/cloud-dither/cloud-dither-phone-390@2x.png";
const DESKTOP = "/design/cloud-dither/cloud-dither-desktop-1440.png";
const STRIP = "/design/cloud-dither/cloud-dither-strip-1440.png";

export function SkyBand({
  variant = "hero",
  short = false,
  label,
}: {
  variant?: "hero" | "strip";
  short?: boolean;
  label: string;
}) {
  const desktop = variant === "strip" ? STRIP : DESKTOP;
  const height = variant === "strip" ? "d3-sky-strip" : short ? "d3-sky-short" : "d3-sky-hero";
  return (
    <div className={`d3-sky ${height}`}>
      <picture>
        <source media="(max-width: 760px)" srcSet={PHONE} />
        <img src={desktop} alt="" />
      </picture>
      <span className="d3-sky-chip">{label}</span>
    </div>
  );
}

export function Awning() {
  return (
    <div>
      <div className="d3-awning" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="d3-kicker" style={{ marginTop: 4 }}>
        003 · signage trio · red green blue together
      </div>
    </div>
  );
}

export type LevelTone = "fill" | "gain" | "risk";

export function toneFor(pct: number): LevelTone {
  if (pct >= 90) return "gain";
  if (pct < 60) return "risk";
  return "fill";
}

/** Maple Street sample mix. Same counts as the demo rows. */
export const SAMPLE_LEVELS: { label: string; filled: number; total: number; note?: string }[] = [
  { label: "5×5", filled: 37, total: 40 },
  { label: "5×10", filled: 55, total: 60 },
  { label: "10×10 drive-up", filled: 62, total: 80, note: "18 empty" },
  { label: "10×10 climate", filled: 28, total: 40 },
  { label: "10×15", filled: 36, total: 40 },
  { label: "10×20", filled: 24, total: 30 },
  { label: "10×30", filled: 12, total: 12 },
  { label: "Parking", filled: 14, total: 20 },
];

export function LevelTile({
  label,
  filled,
  total,
  note,
}: {
  label: string;
  filled: number;
  total: number;
  note?: string;
}) {
  const pct = Math.round((filled / total) * 100);
  const tone = toneFor(pct);
  return (
    <div className="d3-level">
      <div className="d3-level-name">{label}</div>
      <div className="d3-level-meter" aria-hidden>
        <div className={`d3-level-fill ${tone}`} style={{ height: `${pct}%` }} />
        <div className={`d3-level-num ${tone === "risk" ? "risk" : ""}`}>{pct}%</div>
      </div>
      <div className="d3-level-sub">
        {filled} of {total} rented
      </div>
      {note && (
        <div className="d3-crayon">
          <svg viewBox="0 0 78 36" aria-hidden>
            <path
              d="M6 20 C 8 6, 28 4, 40 8 C 58 2, 72 10, 70 20 C 74 32, 52 34, 40 30 C 22 34, 4 30, 6 20"
              fill="none"
              stroke="#83372F"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <span>{note}</span>
        </div>
      )}
    </div>
  );
}

export function LevelGrid() {
  return (
    <div className="d3-levels" data-dl003="levels">
      {SAMPLE_LEVELS.map((u) => (
        <LevelTile key={u.label} {...u} />
      ))}
    </div>
  );
}

export function Question({
  kicker,
  q,
  a,
  sage = false,
}: {
  kicker: string;
  q: string;
  a: string;
  sage?: boolean;
}) {
  return (
    <div className={sage ? "d3-q" : "d3-q d3-q-white"}>
      <div className="d3-kicker">{kicker}</div>
      <h3>{q}</h3>
      <p>{a}</p>
    </div>
  );
}

export function FigureOne() {
  return (
    <figure className="d3-fig" data-dl003="figure">
      <div className="d3-fig-plate">
        <img src="/design/facility-teal.png" alt="" />
        <svg className="d3-fig-grain" aria-hidden>
          <filter id="d3grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#d3grain)" />
        </svg>
      </div>
      <figcaption className="d3-fig-copy">
        <div className="d3-kicker">003 · B figure · callouts stay off the plate</div>
        <h3>Figure 1. How a move-in gets on the ledger.</h3>
        <ol className="d3-fig-list">
          <li>
            <b>1</b>
            <span>An ad. Meta or Google. It points at one page.</span>
          </li>
          <li>
            <b>2</b>
            <span>The page. One offer, the sizes you still have open.</span>
          </li>
          <li>
            <b>3</b>
            <span>A reservation. Someone asks to take a unit.</span>
          </li>
          <li>
            <b>4</b>
            <span>You mark the move-in. The ledger shows what you marked, and how you know.</span>
          </li>
        </ol>
        <div className="d3-titleblock">
          <div>Sheet 01</div>
          <div>Scale 1:1</div>
          <div>Maple Street · sample</div>
          <div>Oct 2026</div>
        </div>
      </figcaption>
    </figure>
  );
}

export function HomeAtmosphere() {
  return (
    <div className="d3-block" data-dl003="home">
      <SkyBand variant="hero" label="003 · A sky · hero band" />
      <div className="d3-pad">
        <div className="d3-pane d3-pane-overlap">
          <div className="d3-sign">
            <Logo mark={52} />
            <Awning />
          </div>
          <h2 className="d3-display">Maple Street Storage</h2>
          <p className="d3-lead">Sample facility. Tiles use its unit mix. Nothing here is a client result.</p>
        </div>
      </div>
      <div className="d3-pad">
        <div className="d3-kicker" style={{ marginBottom: 6 }}>
          003 · C levels · the tile is the gauge
        </div>
        <LevelGrid />
      </div>
      <div className="d3-pad">
        <Question
          sage
          kicker="003 · sage band · one question"
          q="Which sizes still have room?"
          a="The 10×10 drive-up has 18 of 80 empty. That is the size to put on the page. Risk tint is for under 60%. None of these sizes are there."
        />
      </div>
    </div>
  );
}

export function CampaignLiveCard() {
  return (
    <div className="d3-pane d3-live" data-dl003="live" style={{ marginTop: 10 }}>
      <div className="d3-kicker">003 · campaign is built · sample</div>
      <h3>Fall Move Season is on the canvas.</h3>
      <p>It is not spending. You publish, then you switch it on. This screen does not trace a move-in back to an ad by itself.</p>
    </div>
  );
}
