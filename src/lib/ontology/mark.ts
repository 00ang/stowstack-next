/**
 * Object marks: one small glyph per object, generated from its address, so
 * the same object carries the same mark on every screen.
 *
 * The structure follows the sigil system studied in reference library entry
 * 006: a 2×2 grid of discrete cells, each one shape from a fixed vocabulary at
 * one of four rotations. Their designers dropped overlapping primitives as
 * "too difficult to read and differentiate"; discrete cells survive small.
 *
 * The drawing follows entry 008 (Instrument Calm, the facility identity marks
 * he loved): a heavy square frame holding four line-drawn cells, in ink. The
 * vocabulary comes from the buildings the product is about: a door arch,
 * roll-up slats, a lot of small units, a gable peak. Shape says which one;
 * the label beside it says what kind.
 */

/** Shapes a cell can hold. Order is part of the contract: changing it changes every mark. */
export const MARK_GLYPHS = [
  "arch",
  "slats",
  "ring",
  "target",
  "box",
  "cross",
  "diamond",
  "peak",
  "cup",
  "lots",
  "lines",
  "open",
] as const;

export type MarkGlyph = (typeof MARK_GLYPHS)[number];

export interface MarkCell {
  glyph: MarkGlyph;
  /** Quarter turns clockwise, 0–3. */
  turn: 0 | 1 | 2 | 3;
}

/** Four cells: top-left, top-right, bottom-left, bottom-right. */
export type MarkSpec = [MarkCell, MarkCell, MarkCell, MarkCell];

/** FNV-1a, 32-bit. Small, fast, and identical in every JavaScript engine. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A second, independent stream for rotations and tie-breaks. */
function mix(h: number): number {
  let x = h ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * The mark for an address. Deterministic: same address, same mark.
 * At most one cell is left open, so a mark never reads as a fragment.
 */
export function markFor(address: string): MarkSpec {
  const a = fnv1a(address);
  const b = mix(a);
  const open = MARK_GLYPHS.indexOf("open");
  let openUsed = false;
  const cells = [0, 1, 2, 3].map((i) => {
    let g = (a >>> (i * 8)) % MARK_GLYPHS.length;
    if (g === open) {
      if (openUsed) g = (b >>> (i * 8)) % open; // any closed shape
      openUsed = true;
    }
    const turn = ((b >>> (i * 2)) & 3) as 0 | 1 | 2 | 3;
    return { glyph: MARK_GLYPHS[g], turn };
  });
  return cells as MarkSpec;
}

/**
 * Each glyph as stroke paths in a 10×10 cell, drawn upright (turn 0). Strokes,
 * not fills: the marks are line glyphs. Every shape keeps a margin inside its
 * cell so four cells never touch each other or the frame.
 */
export const GLYPH_PATHS: Record<MarkGlyph, string> = {
  arch: "M2 7.5V5.5A3 3 0 0 1 8 5.5V7.5",
  slats: "M2 3H8M2 5H8M2 7H8",
  ring: "M8 5A3 3 0 1 1 2 5A3 3 0 1 1 8 5Z",
  target: "M8.2 5A3.2 3.2 0 1 1 1.8 5A3.2 3.2 0 1 1 8.2 5ZM6.4 5A1.4 1.4 0 1 1 3.6 5A1.4 1.4 0 1 1 6.4 5Z",
  box: "M2.5 2.5H7.5V7.5H2.5Z",
  cross: "M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5",
  diamond: "M5 1.8L8.2 5L5 8.2L1.8 5Z",
  peak: "M2 8L5 2L8 8",
  cup: "M2 3A3 3 0 0 0 8 3",
  lots: "M2 2H4.4V4.4H2ZM5.6 2H8V4.4H5.6ZM2 5.6H4.4V8H2ZM5.6 5.6H8V8H5.6Z",
  lines: "M2 3.8H8M2 6.2H8",
  open: "",
};
