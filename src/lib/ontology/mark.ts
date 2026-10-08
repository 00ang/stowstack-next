/**
 * Object marks: one small geometric glyph per object, generated from its
 * address, so the same object carries the same mark on every screen.
 *
 * The structure follows the sigil system the reference library studies
 * (entry 006): a 2×2 grid of discrete, non-overlapping cells, each cell one
 * shape from a fixed vocabulary at one of four rotations. Their designers
 * tried overlapping primitives first and dropped them as "too difficult to
 * read and differentiate"; discrete cells survive being drawn at 16px.
 *
 * The vocabulary is ours, drawn from the buildings the product is about: a
 * roll-up door's slats, the arc of a door swing, a ramp, an aisle, a stair, a
 * keypad light. The colour is not part of the mark: the object's type supplies
 * it, so shape says *which one* and hue says *what kind*.
 */

/** Shapes a cell can hold. Order is part of the contract: changing it changes every mark. */
export const MARK_GLYPHS = [
  "block",
  "slats",
  "swing",
  "ramp",
  "half",
  "arch",
  "light",
  "aisle",
  "stair",
  "band",
  "notch",
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
 * Each glyph as SVG path data in a 10×10 cell, drawn upright (turn 0).
 * Shapes stay inside their cell and never touch the far edges by accident, so
 * four cells read as one figure without bleeding into each other.
 */
export const GLYPH_PATHS: Record<MarkGlyph, string> = {
  block: "M0 0H10V10H0Z",
  slats: "M0 0H10V2.6H0ZM0 3.7H10V6.3H0ZM0 7.4H10V10H0Z",
  swing: "M0 10V0A10 10 0 0 1 10 10Z",
  ramp: "M0 0V10H10Z",
  half: "M0 0H5V10H0Z",
  arch: "M0 10A5 5 0 0 1 10 10Z",
  light: "M5 1.8A3.2 3.2 0 1 1 4.99 1.8Z",
  aisle: "M0 0H10V2.2H0ZM0 7.8H10V10H0Z",
  stair: "M0 6.67H10V10H0ZM0 3.33H6.67V6.67H0ZM0 0H3.33V3.33H0Z",
  band: "M0 0A10 10 0 0 1 10 10H6A6 6 0 0 0 0 4Z",
  notch: "M0 0H5V5H10V10H0Z",
  open: "",
};
