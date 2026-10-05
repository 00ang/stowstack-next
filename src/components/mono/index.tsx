"use client";

/**
 * NULL//TRACE primitives — ported from
 * design_handoff_storageads_theme/reference/src/mono-primitives.jsx
 *
 * Every primitive reads CSS custom properties so palette swaps
 * (html[data-palette]) cascade without re-renders. Never hardcode a hex.
 */

import React, { useState, type CSSProperties, type ReactNode } from "react";

export const MONO = {
  bg: "var(--bg)",
  bgAlt: "var(--bg-alt)",
  bgHi: "var(--bg-hi)",
  bgInk: "var(--bg-ink)",
  line: "var(--line)",
  lineHi: "var(--line-hi)",
  lineDim: "var(--line-dim)",
  text: "var(--text)",
  textDim: "var(--text-dim)",
  textFaint: "var(--text-faint)",
  textAccent: "var(--text-accent)",
  accent: "var(--accent)",
  accentDim: "var(--accent-dim)",
  accentSoft: "var(--accent-soft)",
  hueA: "var(--hue-a)",
  hueB: "var(--hue-b)",
  hueC: "var(--hue-c)",
  hueD: "var(--hue-d)",
  serif: "var(--serif)",
  mono: "var(--mono)",
} as const;

export type PaletteId =
  | "cool"
  | "paper"
  | "oxblood"
  | "petrol"
  | "blueprint"
  | "eames"
  | "green"
  | "bw";

/** Shipped page ground. Paper/cream stays in the picker and is not the default. */
export const DEFAULT_PALETTE_ID: PaletteId = "cool";

export const PALETTES: {
  id: PaletteId;
  label: string;
  sub: string;
  swatches: [string, string, string];
}[] = [
  { id: "cool",      label: "Cool Light",     sub: "Twilight light, companion field", swatches: ["#E0E0E5", "#16161A", "#C0BFCF"] },
  { id: "paper",     label: "Paper / Ink",    sub: "Cream broadsheet, brick accent",  swatches: ["#f2ede3", "#1c1a16", "#c0452b"] },
  { id: "oxblood",   label: "Oxblood & Oat",  sub: "Burgundy, oat, peach",            swatches: ["#2a0e0d", "#ebe1cc", "#FAC08A"] },
  { id: "petrol",    label: "Petrol Navy",    sub: "Deep petrol, bone, lichen",       swatches: ["#0d2336", "#e8e2d1", "#C9E098"] },
  { id: "blueprint", label: "Blueprint",      sub: "Architect navy, chalk, safety",   swatches: ["#0e2440", "#e8eef0", "#ff7a2a"] },
  { id: "eames",     label: "Eames Olive",    sub: "Warm olive, cream, rust",         swatches: ["#4a4a2a", "#f0ead5", "#e85a1e"] },
  { id: "green",     label: "Green Phosphor", sub: "VT100 CRT green",                 swatches: ["#040a05", "#33ff66", "#FAC08A"] },
  { id: "bw",        label: "Black & White",  sub: "High-contrast monochrome",        swatches: ["#ffffff", "#000000", "#5e5e5e"] },
];

/* ─── Label — tiny uppercase mono caption ─── */
export function Label({ children, color, style, className }: { children: ReactNode; color?: string; style?: CSSProperties; className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: MONO.mono,
        fontSize: 10,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: color || MONO.textFaint,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Val — mono value cell ─── */
export function Val({
  children,
  color,
  size = 12,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: MONO.mono,
        fontSize: size,
        color: color || MONO.text,
        letterSpacing: "0.01em",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Dot — 6x6 SQUARE status indicator (not round) ─── */
export function Dot({
  on = true,
  live = false,
  color,
  style,
}: {
  on?: boolean;
  live?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        background: on ? (color || MONO.text) : MONO.lineHi,
        animation: live ? "mono-pulse 1.6s ease-in-out infinite" : "none",
        ...style,
      }}
    />
  );
}

/* ─── Cursor — blinking block ─── */
export function Cursor({ color, style }: { color?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "0.5em",
        height: "0.9em",
        background: color || MONO.text,
        verticalAlign: "-0.1em",
        marginLeft: 2,
        animation: "mono-blink 1.05s steps(1) infinite",
        ...style,
      }}
    />
  );
}

/* ─── Panel — bordered container with optional header strip ─── */
export function Panel({
  label,
  right,
  children,
  style,
  bodyStyle,
  noBorder,
}: {
  label?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  noBorder?: boolean;
}) {
  return (
    <div
      style={{
        border: noBorder ? "none" : `1px solid ${MONO.line}`,
        // Cards always LIFT from the page bg. Using --bg-alt (not --bg)
        // means card stays distinguishable on every palette — light and
        // dark — without going blown-white on dark grounds.
        background: MONO.bgAlt,
        position: "relative",
        ...style,
      }}
    >
      {(label || right) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 10px",
            borderBottom: `1px solid ${MONO.line}`,
          }}
        >
          {label && <Label>{label}</Label>}
          {right && <div>{right}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
    </div>
  );
}

/* ─── Row — dotted label/value pair ─── */
export function Row({
  label,
  value,
  valueColor,
  style,
}: {
  label: ReactNode;
  value: ReactNode;
  valueColor?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "3px 0",
        borderBottom: `1px dotted ${MONO.line}`,
        gap: 12,
        ...style,
      }}
    >
      <Label style={{ color: MONO.textDim, letterSpacing: "0.08em" }}>{label}</Label>
      <Val color={valueColor} style={{ whiteSpace: "nowrap" }}>
        {value}
      </Val>
    </div>
  );
}

/* ─── Tag — mini chip ─── */
export function Tag({
  children,
  inverted,
  color,
  style,
}: {
  children: ReactNode;
  inverted?: boolean;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: MONO.mono,
        fontSize: 9,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        padding: "1px 5px",
        border: `1px solid ${color || MONO.lineHi}`,
        color: inverted ? MONO.bg : (color || MONO.textDim),
        background: inverted ? (color || MONO.text) : "transparent",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Marquee — scrolling tape ─── */
type MarqueeItem = string | { k?: string; v?: string; d?: string };
export function Marquee({
  items,
  speed = 50,
  style,
}: {
  items: MarqueeItem[];
  speed?: number;
  style?: CSSProperties;
}) {
  if (!items.length) return null;
  const stream = [...items, ...items];
  const n = items.length;
  return (
    <div
      style={{
        overflow: "hidden",
        whiteSpace: "nowrap",
        borderTop: `1px solid ${MONO.line}`,
        borderBottom: `1px solid ${MONO.line}`,
        padding: "6px 0",
        ...style,
      }}
    >
      <div
        style={{
          display: "inline-block",
          animation: `mono-tick ${(n * speed) / 10}s linear infinite`,
          willChange: "transform",
        }}
      >
        {stream.map((it, i) => (
          <span
            key={i}
            style={{
              fontFamily: MONO.mono,
              fontSize: 11,
              color: MONO.textDim,
              letterSpacing: "0.08em",
              padding: "0 16px",
              textTransform: "uppercase",
            }}
          >
            {typeof it === "string" ? (
              it
            ) : (
              <>
                <span style={{ color: MONO.textFaint }}>{it.k}</span>
                <span style={{ color: MONO.text, marginLeft: 8 }}>{it.v}</span>
                {it.d && <span style={{ color: MONO.textFaint, marginLeft: 8 }}>{it.d}</span>}
              </>
            )}
            <span style={{ color: MONO.textFaint, marginLeft: 16 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── BarMeter — ASCII horizontal bar ─── */
export function BarMeter({
  value,
  max = 100,
  width = 80,
  color,
  style,
}: {
  value: number;
  max?: number;
  width?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return (
    <span
      style={{
        fontFamily: MONO.mono,
        fontSize: 11,
        letterSpacing: 0,
        color: color || MONO.text,
        ...style,
      }}
    >
      <span>{"█".repeat(filled)}</span>
      <span style={{ color: MONO.lineHi }}>{"░".repeat(width - filled)}</span>
    </span>
  );
}

/* ─── Display — Manrope display headline ───
   The `italic` prop is accepted for back-compat but ignored — Manrope has
   no italic glyphs, and browser-synthesized italic looks rough. Emphasis
   is carried by weight (700+) and size. */
export function Display({
  children,
  size = 64,
  italic: _italic,
  style,
}: {
  children: ReactNode;
  size?: number;
  italic?: boolean;
  style?: CSSProperties;
}) {
  void _italic;
  return (
    <span
      style={{
        fontFamily: MONO.serif,
        fontSize: size,
        fontWeight: 800,                    /* max Manrope display weight for hero stats */
        lineHeight: 1.05,
        color: MONO.textAccent,
        letterSpacing: "-0.035em",          /* slightly tighter at 800 to keep numerals visually connected */
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─── Divider — ASCII break ─── */
export function Divider({ char = "─", style }: { char?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: MONO.mono,
        fontSize: 11,
        color: MONO.lineHi,
        overflow: "hidden",
        whiteSpace: "nowrap",
        letterSpacing: 0,
        ...style,
      }}
    >
      {char.repeat(400)}
    </div>
  );
}

/* ─── MonoBtn — ghost or solid ─── */
export function MonoBtn({
  children,
  solid,
  href,
  onClick,
  style,
}: {
  children: ReactNode;
  solid?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  style?: CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 16px",
    fontFamily: MONO.mono,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    fontWeight: 500,
    transition: "all 120ms",
    cursor: "pointer",
    background: solid ? MONO.accent : "transparent",
    color: solid ? MONO.bg : MONO.text,
    border: `1px solid ${solid ? MONO.accent : MONO.lineHi}`,
  };
  const hover: CSSProperties = hov
    ? {
        background: solid ? MONO.accentDim : MONO.bgHi,
        color: solid ? MONO.bg : MONO.accent,
        borderColor: solid ? MONO.accentDim : MONO.accent,
      }
    : {};
  return (
    <a
      href={href || "#"}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ ...base, ...hover, ...style }}
    >
      {children}
    </a>
  );
}
