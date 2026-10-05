# StorageAds — Design System (Light Only)

Canonical design-system reference. CLAUDE.md points here; this file is the source of truth for palette, typography, and visual rules. CSS custom properties are defined in `src/app/globals.css`.

Cool-light default. Paper/cream is an optional palette, not the shipped page ground.

## Core palette

The `--color-*` tokens are **palette-aware aliases**, not fixed hexes — they resolve to the active palette in `globals.css` (default: `:root` / `[data-palette="cool"]`). globals.css holds the live values; the cool-light defaults below are for reference only. `[data-palette="paper"]` still exists as a selectable cream theme and is not the default.

- `--color-dark` → `var(--text)`, default `#16161A` — primary text, never pure black
- `--color-light` → `var(--bg)`, default `#E0E0E5` — page ground (cool light)
- `--color-body-text` → `var(--text-dim)`, default `#3C3C46` — body text
- `--color-mid-gray` → `var(--text-faint)`, default `#484852` — secondary/muted
- `--color-light-gray` → `var(--bg-alt)`, default `#C0BFCF` — companion field for cards and alt surfaces

## Accent — Charcoal-on-light / Light-on-dark (no primary color accent)

- CTAs use `--color-dark` on light surfaces and `--color-light` on dark surfaces — contrast-based, not color-based.
- **Sienna gold (`#B58B3F`) is banned everywhere, the logo included** (the logo `ads` is now slate blue via `--brand-ads`; see Logo below). Do not use `--color-gold`, `--color-gold-hover`, `--color-gold-on-light`, `--color-gold-light`, or any near variant anywhere else — CTAs, links, metrics, charts, generated assets, etc. The older `--color-gold*` tokens still exist in `globals.css` for legacy compatibility but must not be referenced in new code. The A24/Kubrick editorial feel comes from typography and negative space, not a color accent.

**Secondary accents** (also palette-aware aliases): `--color-blue` (→ `var(--hue-a)`, default `#1f5a6b` deep teal — Google/informational), `--color-green` (→ `var(--hue-c)`, default `#4a6b2e` olive — success/growth) — use sparingly for categorical distinctions (chart series, informational callouts), never as a primary CTA color.
**Error only:** `--color-red` (→ `var(--accent)`, default `#c0452b` brick) — NEVER for CTAs or decorative use
**Dashboard surfaces:** `--color-dark-surface` (→ `var(--bg-ink)`, default `#16161A`) for inverse ink panels. Admin shell ground is cool light `#E0E0E5`, not cream.

## Typography

**Manrope variable font** (Google Fonts, weights 200–800) for everything — marketing, admin, partner, portal, ad mockups. No second font.

- **Body / paragraphs:** weight 400, line-height 1.6
- **UI (buttons, inputs, labels, captions):** weight 500–600, line-height 1.4
- **Headings (h1–h6):** weight 600–700, line-height 1.2, letter-spacing -0.03em
- **Display / hero / `<Display>` component:** weight 700–800, line-height 1.05–1.2
- **Emphasis:** use weight changes (font-medium / font-semibold / font-bold). **Never use italic** — Manrope has no true italic glyphs. globals.css forces `em`, `i`, `cite`, and Tailwind's `.italic` utility to `font-style: normal`; the `Display` component's `italic` prop is accepted but ignored.

**CSS variable mapping** (so the 125+ inline `MONO.mono` / `MONO.serif` / `var(--font-jetbrains)` / `var(--font-archivo)` / `var(--font-inter)` refs in components all resolve to Manrope without per-file edits): `--mono`, `--serif`, `--font-jetbrains`, `--font-inter`, `--font-archivo`, `--font-primary`, `--font-warm`, `--font-heading`, `--font-body`, `--font-display`, `--font-mono-family`, `--font` (admin scope), and legacy `--font-poppins` / `--font-lora` are all aliased to `--font-manrope`.

**Line-height tokens:** `--leading-body` (1.6), `--leading-tight` (1.2), `--leading-snug` (1.3), `--leading-ui` (1.4), `--leading-display` (1.2).

**Tabular numerals:** `.urbit-landing` in globals.css applies `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum" 1` globally so numbers in the editorial chrome (status bar timestamps, live monitor data cells, sparkline labels, `§ 00 · NUMBERS` count-up cards, ticker tape) keep tabular column alignment despite Manrope being a proportional font. Manrope ships tabular figures via OpenType.

## Logo

`storageads` (`storageads/attr` in the marketing nav). Manrope 700, lowercase, no icon. **Two-tone color split is brand-mandatory** — "storage" renders in the surface text color (palette-aware: `--text-accent` / `--color-dark` / `#1A1A1A`), "ads" always renders in `var(--brand-ads)`. That is one 212° blue at two luminance steps, defined in `:root` outside the palette blocks: `--brand-slate` `#446386` on light grounds (cool light, paper, bw, admin) and `--brand-sky` `#8EC1FF` on the dark palettes (oxblood, petrol, blueprint, eames, green), switched by one rule in `globals.css`. `.admin-theme` pins it to slate because the admin ground is cool light. Surfaces with a hardcoded light ground (e.g. the ideas gate) use `var(--brand-slate)` directly. Replaced the original sienna gold `#B58B3F` in Oct 2026; do not restore it. Used in marketing nav, footer, tool header, contact, cost-of-inaction, ideas gate, admin sidebar, and admin login.

## Charts

Admin charts use **recharts**. Color convention: dark=Meta, blue=Google, green=retargeting.

## Icons

**`lucide-react` is the sanctioned icon library** (imported in 200+ files — e.g. `ArrowLeft`, `ArrowRight`, `Clock`). Use lucide-react for icons. Do not add other icon libraries, and do not hand-roll inline SVG icon sets where a lucide glyph exists.

## Rules

- Never use pure #000 or #fff — always brand tokens
- Never use Tailwind default grays — only brand tokens
- Never use gradients, stock photos, or AI images
- Icons: lucide-react only (see above) — no other icon libraries
- Sienna gold is banned everywhere, the logo included — the logo `ads` uses `--brand-ads` (supersedes any older gold references in `globals.css`)
- No gold-reading color anywhere (sienna, goldenrod, mustard, amber, Tailwind `amber-*`/`yellow-*` hexes): not in palettes, admin status colors, emails, PDFs, OG images or icons. The warm/caution slot is burnt orange — `--hue-b` `#AB5505` on the cool-light default and on paper (Tailwind orange/amber/yellow classes remap to it); inline caution hexes use `#AB5505`; email CTAs are charcoal `#141413`; brand tints use slate `rgba(68,99,134,…)`
- Chart colors: dark=Meta, blue=Google, green=retargeting (recharts)
- All emails from *@storageads.com
