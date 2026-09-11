# Homepage Copy Inventory — storageads.com

> **Purpose:** Source-of-truth inventory for the homepage redesign. Every user-visible string, link, form, tracking touchpoint, number, and behavior on `src/app/page.tsx` as of 2026-06-11 (branch `main`, HEAD `53ea97b`). Verbatim — JSX entities (`&apos;`, `&nbsp;`, `&ldquo;`) are rendered as the characters users see.
>
> **Render order (from `src/app/page.tsx`):** Nav → Hero → HowItWorks → SystemOverview → CapabilitiesSection → FourWayComparison → BeforeAfterSection → ProblemStatement → BecauseLetterboard → Results → LiveStatsSection (LiveStatsStrip + LiveMonitorTriptych) → StatsBar → DemandTriggers → QuickCalculator → FAQ → CTASection → SourcesNote → Footer → StickyMobileCTA.
>
> `<main id="main-content">` wraps everything from Hero through SourcesNote. Nav, Footer, StickyMobileCTA sit outside `<main>`.

---

## 0. Site chrome — `src/app/layout.tsx` (wraps homepage)

### Verbatim copy
- Skip link (visually hidden until focused): > Skip to content
- `<title>` default: `StorageAds — Fill units. Prove which ads did it.` (template: `%s | StorageAds`)
- Meta description / OG / Twitter description:
  > StorageAds runs the Meta and Google ads, builds the landing pages with your storEDGE rental flow embedded, and shows you which campaigns filled units. Built by an operator. Tested on our own facilities first.
- OG image: `/og-image.png` (1200×630). Icons: `/favicon.svg`, `/apple-touch-icon.png`. Theme color `#faf9f5`.

### JSON-LD (structured data, layout.tsx:61–107)
- Organization: name `StorageAds`, url `https://storageads.com`, email `blake@storageads.com`, telephone `+12699298541`, founder `Blake Burkett` (jobTitle `Founder`), areaServed US, logo `https://storageads.com/og-image.png`.
- SoftwareApplication: description `Marketing system for self-storage operators. Meta and Google ads, custom landing pages with embedded storEDGE rental flow, and per-move-in tracking from click to lease.` Offers: `AggregateOffer`, USD, **lowPrice "499", highPrice "2499", offerCount "4"** (layout.tsx:93–95 — note: does not match /pricing tiers $299/$749/$1,249; see Pricing Truth).
- WebSite: `https://storageads.com`.

### Behavioral / tracking notes
- **In-app-browser detection** (layout.tsx:150–154): inline pre-paint script stamps `data-iab="fb|ig|tiktok|line|none"` on `<html>` by UA sniffing (`FBAN|FBAV` → fb, `Instagram` → ig, `TikTok|musical_ly` → tiktok, `Line/` → line). CSS can branch on it; comment says "we never branch behavior on it". `suppressHydrationWarning` on `<html>` because of this.
- **Service worker**: registers `/sw.js` on load.
- `<body className="urbit-landing">` — tabular-numerals scope (globals.css).
- Renders `<Analytics />` (Suspense-wrapped), `<ScrollProgress />`, `<GrainOverlay />`, `<TweaksPanel />` around children.
- Preconnects: fonts.googleapis.com, fonts.gstatic.com, cal.com. DNS-prefetch: maps.googleapis.com, places.googleapis.com. Manifest `/manifest.json`.

### Analytics — `src/components/analytics.tsx`
- Meta Pixel: loads `https://connect.facebook.net/en_US/fbevents.js` if `NEXT_PUBLIC_META_PIXEL_ID` set; `fbq('init', ID)`; `fbq('track', 'PageView')` on load and on every SPA route change.
- gtag.js: loads `https://www.googletagmanager.com/gtag/js?id=…` if `NEXT_PUBLIC_GA4_MEASUREMENT_ID` and/or `NEXT_PUBLIC_GOOGLE_ADS_ID` set. GA4 configured with `send_page_view: false`; manual `gtag('event','page_view',{page_path,page_title})` on every route change (path includes query string). Google Ads ID gets plain `config`.
- `window.dataLayer` created by gtag bootstrap. No UTM read/write, no cookies set directly in homepage code.

---

## 1. Nav — `src/components/marketing/nav.tsx`

### Verbatim copy
- Logo (link to `/`): `storage` (text-accent) + `ads` (`var(--brand-gold)`) + `/attr` (faint, weight 400). Font 18px, weight 700.
- LIVE chip next to logo (hidden below `sm`): > LIVE (with live pulsing Dot)
- Desktop link labels: `How It Works`, `Results`, `Calculator`, `Pricing`, `About`, `Blog`, `Insights`
- Desktop CTA buttons: `Book a Call` · `Request Audit →`
- Hamburger `aria-label`: `Open menu` / `Close menu` (`aria-expanded` bound)
- Mobile panel (`role="dialog"`, `aria-modal="true"`, `aria-label="Navigation menu"`):
  - Group label: > On this page
  - Group label: > Explore
  - Pinned CTAs: `Book a Call` (outline) · `Request Audit` (filled, with ArrowRight icon)
  - Panel footer: > Built by storage operators
    > storageads.com
- `<nav aria-label="Main navigation">`

### Links / CTAs
| Anchor text | Destination | Notes |
|---|---|---|
| logo `storageads/attr` | `/` | Next `<Link>` |
| How It Works | `#how-it-works` | section link, active-state underline |
| Results | `#results` | section link |
| Calculator | `#calculator` | section link |
| Pricing | `/pricing` | page link |
| About | `/about` | page link |
| Blog | `/blog` | page link |
| Insights | `/insights` | page link |
| Book a Call (desktop + mobile) | `https://cal.com/stowstack/30min` (`CAL_BOOKING_URL` from `src/lib/booking.ts`; env override `NEXT_PUBLIC_CALCOM_LINK`) | `target="_blank" rel="noopener noreferrer"` |
| Request Audit → (desktop) / Request Audit (mobile) | `#cta` | in-page |

### Behavioral notes
- Scroll progress bar: 2px charcoal bar at nav bottom, width = scroll %, only visible (opacity .6) when `isScrolled` (scrollY > 60). Nav bg goes from `rgba(250,249,245,0.6)` blur(12px) to `0.92` blur(24px) saturate(180%) + bottom border when scrolled.
- Active section highlighting: IntersectionObserver per id (`how-it-works`, `results`, `calculator`) with `rootMargin: "-40% 0px -55% 0px"`.
- Mobile menu: iOS-safe body scroll lock (position:fixed + restore scrollY); swipe-right-to-close (closes at >30% panel width or velocity >0.5); Escape closes and returns focus to hamburger; full focus trap (Tab cycles within panel, first focusable focused on open); staggered link entrance animations; backdrop `rgba(20,20,19,0.3)` blur(4px) click-to-close.
- Safe-area handling: nav height = `var(--nav-height) + env(safe-area-inset-top)`.

---

## 2. Hero — `src/components/marketing/hero.tsx` (default export `Hero`)

`<section id="hero" aria-label="StorageAds: predictable move-ins for independent storage. Ad spend in. Move-ins out.">`

### 2a. HeroStatusStrip (thin ribbon under nav)
- Left label (mobile): > MARKETING INFRASTRUCTURE
- Left label (sm+): > MARKETING INFRASTRUCTURE · BUILT FOR SELF-STORAGE
  (with live pulsing Dot)
- Center tile (lg+ only): > OCC GAP **5 PTS** · REIT 92.6 / IND 87.2
  with `<Cite n={[1, 2]} />` superscript.
- Right label (mobile): > REV {MM/DD/YY}
- Right label (sm+): > REV {MM/DD/YY} · {HH:MM:SS} CT · SOC2
  Clock from `useClock()` (1Hz; SSR placeholders `--:--:--`, `--/--/--`, tz hardcoded `CT`). **Note: "SOC2" compliance tag is displayed.**

### 2b. Hero left column
- Eyebrow: > REIT-grade marketing for independents
- H1: > Ad spend in. Move-ins out.
  (non-breaking spaces inside each half; "Move-ins out." wrapped in `whitespace-nowrap`)
- Typewriter line (cycles, 80ms/char typing, 2200ms pause, half-speed delete; starts with word 1 pre-typed; blinking charcoal cursor) — `TYPEWRITER_WORDS` verbatim:
  1. > 34 move-ins in 90 days.
  2. > 71% to 84% occupancy in one quarter.
  3. > Create demand. Capture demand. Recapture demand.
  4. > REIT-grade tools to reach 100% occupancy.
  5. > Stop leaking $72,000 a year to the REIT down the road.
- Subheadline:
  > Public Storage and Extra Space run this exact machine to hit 92.6% occupancy¹. We built the same system for our own facilities, then turned it into software you can plug in. Meta and Google ads, a landing page per ad, reservations that become signed leases, and an audit that finds where you're leaking revenue.
  (`<Cite n={1} />` after "occupancy")
- Primary CTA (`.btn-primary`): `Get your free facility audit` → `#cta` (ArrowRight icon)
- Secondary CTA (`.btn-secondary`): `Book a 30-minute walkthrough` → `https://cal.com/stowstack/30min` (`target="_blank"`)
- Reassurance line: > No contracts. **Cancel anytime.**
- Trust badges (3, with Star / Layers / TrendingUp icons):
  1. > Built and tested on our own facilities
  2. > storEDGE rental built in
  3. > Ads live in your first week
- Scroll indicator (hidden on mobile, `aria-label="Scroll to learn more"` → `#how-it-works`): > Learn more

### 2c. DashboardMockup (right column, all breakpoints)
`role="region" aria-label="Interactive 6-month campaign demo for a sample storage facility"`

- Sidebar logo tile: `SA` (sidebar is `aria-hidden="true"`)
- Search bar text (sm+ only): > Search campaigns…
- Header: > Campaign performance
  > {Month label} · Month {N} of 6
- Sparkline label: > Cost / move-in
- Scrubber row: `tabIndex={0}` `role="group"` `aria-label="Campaign month scrubber. Use arrow keys to navigate, space to play."`
- Play/pause button `aria-label`s: `Pause campaign playback` / `Replay campaign from month 1` / `Play campaign from current month` (`aria-pressed` bound)
- Month segment buttons: `aria-label="Jump to {Oct 2025 … Mar 2026}"`, `title={month label}`, `aria-current` on active
- Status text (sm+, aria-hidden): `LIVE` (playing, with green dot) / `PAUSED` (hovered or off-screen while playing) / `OCT`…`MAR` (month short, idle)
- Stat strip (`role="group"` `aria-label="Campaign totals through {month}"` `aria-live="polite"`), three cards:
  | Label | Value | Delta line |
  |---|---|---|
  | Total spend | `$X,XXX` (cumulative, tweened) | `Through {Oct…Mar}` |
  | Move-ins | cumulative count | `+{N} this month` (green) |
  | Avg cost / move-in | `$N` | `−$N vs Oct` (green) or `Starting point` (month 1) |
- Table (`<caption class="sr-only">Campaign performance for {label}, month {N} of 6</caption>`), headers:
  `Campaign` · `Spend` · `Clicks` · `Res.` · `Move-ins` · `Cost / MI`
- Table rows (`DASHBOARD_ROWS`, final-month values; earlier months scale by `rowScale` and CPM ratio):
  | Campaign | Channel | Spend | Clicks | Res. | Move-ins | Cost/MI | Trend |
  |---|---|---|---|---|---|---|---|
  | 10x10 Climate | Meta | $847 | 312 | 14 | 9 | $94 | down |
  | Drive-up Units | Google | $612 | 198 | 11 | 7 | $87 | down |
  | Boat / RV Storage | Meta | $423 | 156 | 6 | 4 | $106 | flat |
  | Climate Retargeting | Meta | $298 | 89 | 5 | 4 | $74 | down |
  - Channel dot `aria-label="{Meta|Google} channel"`; trend arrow svg `aria-label="trending down"`; flat dash `aria-label="flat"`. Channel dot colors: Meta = dark, Google = blue, Retargeting = green.
- 6-month demo data (`HERO_DEMO_MONTHS`; starting occupancy 64%):
  | Month | Spend | Leads | Move-ins | CPM (cost/move-in) | Occupancy | Top audience | Top creative |
  |---|---|---|---|---|---|---|---|
  | Oct 2025 | $1,800 | 42 | 8 | $225 | 68% | Lookalike 1% | "Your Stuff Deserves Better" |
  | Nov 2025 | $2,100 | 58 | 12 | $175 | 73% | Recently Moved | "Unit Size Guide" |
  | Dec 2025 | $2,100 | 51 | 10 | $210 | 76% | 14-Day Retarget | "Holiday Declutter" |
  | Jan 2026 | $2,400 | 67 | 15 | $160 | 80% | Phone Call LAL | "$1 First Month" |
  | Feb 2026 | $2,400 | 74 | 18 | $133 | 85% | Life Event | "Move-In in 10 Minutes" |
  | Mar 2026 | $2,800 | 89 | 22 | $127 | 89% | Broad + Advantage+ | "Customer Testimonial Reel" |
- Demo footer caption (state-dependent): `Playing · hover to pause` / `Demo complete · see the full version` / `Interactive · use the scrubber` (reduced-motion) / `Interactive · press play`
- Demo footer link: `Open the full demo` → `/demo` (ArrowUpRight icon; pulses with `hero-cta-pulse` once playback finishes, unless reduced motion)
- Floating channel pills (lg+ only, decorative): `Meta Ads` · `Landing Pages` · `Move-ins` · `storEDGE`

### 2d. DemoPreviewStrip (lg+ only, under dashboard)
`role="list" aria-label="More dashboard modules in the full demo"` — three tiles, **each a Link to `/demo`**:
1. Tile label `Occupancy`, sub `64% → {current occupancy}%` (area sparkline)
2. Tile label `Live lead feed`, sub `{N} this month` — cycling pairs from `HERO_DEMO_LEADS`:
   | Name | Unit | Status label |
   |---|---|---|
   | Sarah M. | 10x10 Standard | Move-in |
   | David K. | 10x15 Drive-up | Tour |
   | Jennifer L. | 5x10 Climate | Move-in |
   | Mike R. | 10x20 Drive-up | New |
   | Amanda T. | 10x10 Standard | Move-in |
   | Chris B. | 10x30 Vehicle | New |
   (Status labels: `New` blue, `Tour` purple #8a70b0, `Move-in` green)
3. Tile label `Campaign intelligence`, sub `Top: {topAudience}`; body shows topAudience + "{topCreative}" in curly quotes.

### 2e. Hero behavioral notes
- Reveal driven by `useInView(0.02)`; dashboard auto-plays after 1100ms delay (`HERO_DEMO_AUTOSTART_DELAY_MS`), tick 1400ms (`HERO_DEMO_TICK_MS`). Initial SSR state shows the FINAL month (best numbers). Auto-play skipped entirely if user already interacted or `prefers-reduced-motion`.
- Playback pauses on hover and when the panel scrolls off-screen (`useLiveInViewport` 0.2 threshold); resumes on return.
- Keyboard on scrubber: ←/→ step months, Home/End jump, Space/Enter toggle play.
- Mouse tilt on dashboard card (±3°, disabled for reduced motion).
- Reduced motion: scoped `@media (prefers-reduced-motion: reduce)` kills all `#hero` animations (duration 0.001ms, single iteration); count-ups snap to final value; tweens bypass; value-flash suppressed.
- Background `DotGrid`: dot pattern at 0.03 opacity + three drifting gradient orbs **hidden on mobile** (`hidden sm:block`) for FB-IAB perf.
- Mobile fold tuning comments: 80% of homepage traffic is FB in-app browser on iPhone; pt-5 tight band; scroll indicator hidden on mobile.

### 2f. Exported from hero.tsx but NOT rendered anywhere (dead exports — copy still in bundle source)
- **`ROITeaser`** — header `90-Day Performance Snapshot`; stats: `Ad Spend` `$2,400` `per month` · `Move-ins` `34` `this quarter` · `Cost / Move-in` `$41` `average` · `Revenue` `$27,200` `90 days`; bar label `ROAS`, value `35x`.
- **`MobileLiveTicker`** — header `Live`; items `{A facility in {locale}|A facility} published a {platform} campaign` + relative time (`just now`, `{N}m ago`, `{N}h ago`, `{N}d ago`); fetches `GET /api/public-activity` every 60s; renders only with ≥3 events; `sm:hidden`. Platform glyphs: google `↗`, tiktok `▸`, default `●`.

---

## 3. HowItWorks — `src/components/marketing/how-it-works.tsx`

`<section id="how-it-works" aria-label="How StorageAds works in four steps">`

### Verbatim copy
- SectionHeader: `§ 01` · kicker `HOW IT WORKS` · right meta `STEPS · 4`
- H2: > From ad dollar to signed lease.
- Intro:
  > Market intelligence, ads, landing pages, the storEDGE reserve flow, and follow-up that turns reservations into move-ins. One system, start to finish.
- PipelineFlow (animated, from hero.tsx): steps `Ad` (`Meta / Google`) → `Page` (`Custom LP`) → `Reserve` (`storEDGE`) → `Move-in` (`Signed lease`). Steps light sequentially starting 1200ms after reveal, 500ms apart.
- Steps (numbered `01`–`04`):
  - **01 — Your market, mapped.**
    > We map your trade area: every competitor, their pricing, their reviews, their positioning. It updates automatically. You see the field before you spend a dollar.
  - **02 — Ads on Meta and Google.**
    > The Ad Creator builds Meta and Google campaigns from your facility data. The Publishing Manager puts them live. Meta reaches renters before they search. Google catches the ones already looking. Retargeting brings back the ones who left.
    Examples (mono, left-border):
    > [your-facility].storageads.com/climate-pawpaw: climate-controlled search campaign
    > [your-facility].storageads.com/10x10-offer: first-month-free Meta campaign
    > [your-facility].storageads.com/finish-your-rental: retargeting campaign
    Kicker:
    > A page for every ad. 8.7% of visitors reserve, against a 2.1% industry average on generic pages.
  - **03 — The renter books on your page.**
    > Every campaign gets its own landing page with your storEDGE reserve flow built in. The renter books on your page, under your brand. The reservation lands in storEDGE the same as a walk-in. No redirects. No third-party directory.
  - **04 — You see what's working.**
    > Every ad dollar tied to the unit it filled. What you spent, what you got, what each move-in cost. One dashboard. No mystery.
- Capabilities sub-block heading: > Capabilities.
- Capabilities sub-block intro:
  > Everything the REITs staff a marketing department for, in one dashboard.
- FeatureHighlights cards (`FEATURE_HIGHLIGHTS` from hero.tsx — icon, badge "stat", title, desc):
  | Badge | Title | Description |
  |---|---|---|
  | Map | Facility audit and market map | Competitor pricing, review gaps, trade area positioning. See the field before you spend a dollar. |
  | Launch | Ad creation and publishing | Meta and Google ads built from your facility data and published from one dashboard. Creative studio included. |
  | Convert | Landing pages with embedded rental | A page for every campaign. storEDGE reserve flow built in. The renter never leaves your brand. |
  | Run | Self-serve or fully managed | Run it yourself or have us run it. Same system either way. |

### Links / CTAs
None (no anchors in this section).

---

## 4. SystemOverview — `src/components/marketing/system-overview.tsx`

`<section id="system" aria-label="The six parts of the StorageAds system">`

### Verbatim copy
- SectionHeader: `§ 02` · `THE SYSTEM` · `COMPONENTS · 6`
- H2: > One system. Six parts. **Built to fill units.**
- Intro:
  > Market intelligence, ads, pages, the reserve flow, and reservation follow-up. One system, wired together, that fills units and shows its work.
- Six expandable parts (button rows, `aria-expanded`, `+`/`−` toggle shown md+; click to expand detail list):

  **01 — Your market, mapped**
  > We pull your competitors, their pricing, their reviews, and your trade area. You see what they're charging on the units you're competing for.
  - Competitor pricing and review tracking
  - Census demographics for your trade area
  - Search volume for storage in your zip code

  **02 — Meta and Google ads**
  > Meta ads reach renters before they search. Google captures the ones already looking. Retargeting brings back the ones who left. All three from one dashboard.
  - Facebook and Instagram campaigns
  - Google Search and Display
  - Retargeting across both

  **03 — Landing pages built for the ad**
  > Each ad gets its own page. Your facility. Your rates. Your offer. Built around your storEDGE reserve button so the renter books on your branded page.
  - One page per ad, with the offer that ad promised
  - 8.7% average reservation rate
  - Fast on mobile, built for the reserve button

  **04 — Reserve right on the page**
  > storEDGE handles the unit, the rate, the reservation. The renter never leaves your page. The reservation lands in your storEDGE the same as a walk-in.
  - Embedded storEDGE reservation widget
  - Renter stays on your branded page
  - Live unit availability and pricing

  **05 — Ad → move-in tracking**
  > Every move-in traces back to the ad that produced it. What you spent. What you got. What each move-in cost. Numbers, not adjectives.
  - Click → page → reservation → move-in
  - What each move-in cost, by campaign
  - What you got back, by ad

  **06 — Gets sharper every month**
  > A/B tests on headlines, offers, and pages. Winners get picked by move-ins, not clicks. The system you turn on this month is better six months from now.
  - Move-in based A/B testing
  - Creative scored by what filled units
  - Compounding returns over time

### Links / CTAs
None.

---

## 5. CapabilitiesSection — wrapper in `src/app/page.tsx` (73–141) + `CapabilitiesGrid` from hero.tsx

`<section aria-label="Everything in the system: capabilities grid">` — **no id**.

### Verbatim copy
- H2: > Everything in the system
- `CAPABILITIES` grid (8 cells; description revealed on hover on pointer devices, always shown on touch):
  | Label | Description |
  |---|---|
  | Market Intelligence | Competitor pricing, reviews, positioning, and trade area analysis. See the field before you spend a dollar. |
  | Ad Creator | Generate Meta and Google ads from facility data. Copy, headlines, creative. |
  | Publishing Manager | Publish to Meta and Google from one dashboard. Both channels, side by side. |
  | Landing Pages | A page for every campaign. storEDGE rental flow embedded so the renter books on your branded page. |
  | Organic Capture | Google Business Profile, review management, walk-in capture. The leads you already get, organized. |
  | Reservation Conversion | Automated follow-up that turns reservations into move-ins. Stop leaking revenue at the last step. |
  | A/B Testing | Headlines, offers, and pages scored by move-ins, not clicks. |
  | Revenue Intelligence | Rate moves, ancillary revenue, tax advantages, occupancy modeling. Every tenant worth more. |

### Behavioral notes
- Touch devices (`(hover: hover)` false): all descriptions expanded by default (maxHeight 160px vs 40px hover-reveal on desktop).

---

## 6. FourWayComparison — `src/components/marketing/four-way-comparison.tsx`

`<section aria-label="StorageAds vs StorageRankers, Adverank, and SpareFoot">` — **no id**.

### Verbatim copy
- SectionHeader: `§ 03` · `VS THE ALTERNATIVES` · `MATRIX · 4×8`
- H2: > Everyone else does one slice.
  > We do the whole thing.
  (second line smaller/lighter)
- Intro:
  > Three categories of marketing software you could buy today. None of them takes a renter all the way from ad to signed lease.
- Sub-intro:
  > Closing the 5-point gap to the 92.6% REIT band¹˒² takes the whole system. Picking one slice below leaves the rest uncovered.
  (`<Cite n={[1, 2]} />`)
- Table caption (sr-only): > Capability comparison: StorageAds vs StorageRankers, Adverank, and SpareFoot
- Column headers (+ subtitles):
  | StorageAds — The whole system | StorageRankers — SEO + websites | Adverank — Google PPC automation | SpareFoot — Pay-per-lead directory |
- First column header label: `Capability`
- Rows (✓ = filled check circle, `Limited` = chip, — = Minus icon with `aria-label="Not offered"`):

  | Capability + detail | StorageAds | StorageRankers | Adverank | SpareFoot |
  |---|---|---|---|---|
  | **Meta ads** — Facebook + Instagram, the cheaper channel most operators skip | yes | no | no | no |
  | **Google ads** — Search + display, the channel renters are actively shopping in | yes | Limited | yes | no |
  | **Custom landing page per campaign** — Each ad sends to its own page with its own offer, not your homepage | yes | Limited | no | no |
  | **storEDGE rental flow embedded** — Renter reserves and pays without ever leaving your branded page | yes | no | no | no |
  | **Every move-in tracked back to its ad** — Not clicks. Not leads. The actual unit that got rented | yes | no | Limited | no |
  | **You own the leads** — Tenants are yours from day one, not rented or resold | yes | yes | yes | no |
  | **Built by a working storage operator** — Tested on our own facilities before anyone else's | yes | no | no | no |
  | **Free facility audit before you sign** — See what's broken before you pay anyone a dollar | yes | no | no | no |
- Footnote:
  > Competitor capabilities reflect publicly published product pages as of 2025. "Limited" means the vendor offers a partial version of the feature (one channel, generic template, no embedded rental). If something here is wrong, email blake@storageads.com and we'll fix it.
  (**plain text email — not a mailto link**)

### Behavioral notes
- Desktop md+: real `<table>`; StorageAds column gets dark header + zebra-tinted cells. Mobile: stacked card grid with vertical (rotated) column headers.

---

## 7. BeforeAfterSection — wrapper in `src/app/page.tsx` (73–110) + `BeforeAfterComparison` from hero.tsx

`<section aria-label="Before and after: replacing broken workflows">` — **no id**.

### Verbatim copy
- H2: > Stop waiting. Start filling.
- Sub:
  > How StorageAds replaces the workflows operators are still running by hand.
- `BEFORE_AFTER` pairs (before = strikethrough w/ red X, after = bold w/ animated green check):
  | Before (struck through) | After |
  |---|---|
  | No ads running | Meta and Google ads live in your trade area |
  | No idea what competitors charge | Market map with pricing, reviews, and positioning |
  | Every ad dumps onto the homepage | A branded page per campaign with storEDGE built in |
  | Reservations that never move in | Automated follow-up from reservation to signed lease |

---

## 8. ProblemStatement — `src/components/marketing/problem-statement.tsx`

`<section id="problem" aria-label="The problem with current self-storage marketing">`

### Verbatim copy
- SectionHeader: `§ 04` · `THE PROBLEM` · `TRUTH · 4`
- H2:
  > The economics are simple. The infrastructure to act on them hasn't existed for independents. Until now.
- Intro:
  > REITs hit 92.6% occupancy¹. Independents average 87.2%². The gap is worth around $72,000 a year at a 500-unit facility, and around $1.3M in asset value at a 5.5% cap³. Most operators can't tell which ads filled which units. Most aren't running ads at all.
  (`<Cite n={1} />`, `<Cite n={2} />`, `<Cite n={3} />`)
- Lead-in: > Here's what's actually happening.
- Four problems (heading + body; `highlight` phrase rendered in accent color; cites superscript after heading):

  **The REIT-to-independent occupancy gap is 5+ points.** ¹˒²˒³
  > Extra Space ran 92.6% same-store occupancy in Q4 2025. The independent average sits at 87.2% across a panel of 70,000+ properties. At a 500-unit facility, that gap is around **$72,000 a year** in revenue you're not collecting, and around $1.3M of asset value at a 5.5% cap. The gap closes with marketing infrastructure, not a renovation, a new sign, or a better location.

  **Independents are outspent 1,000-to-1 on Google search.** ⁶
  > The top REITs spend $250M+ a year on digital marketing and handle 85% of customer interactions digitally. The independent down the road is competing for the same renter with no ads running, a default rental page, and a Google Business Profile no one is tending. The good news: Google weighs proximity and review recency over brand size in local search. The lever exists. Most operators just aren't pulling it.
  (highlight: `1,000-to-1`)

  **Revenue leakage compounds monthly.**
  > Reservations that never move in. Competitors you haven't priced against. Reviews unanswered. Google traffic uncaptured. Visitors who leave and never come back. Each one is money leaking out of the building. The system **finds the leaks and plugs them**.

  **The economics still work at independent scale.** ³
  > A storage tenant is worth $1,820 over an average 14-month stay at $130 a month. Landing that tenant on the StorageAds system costs $41. That's **44-to-1** on every extra move-in, the same math the REITs run on. It works the same for 150 units as it does for 15,000.

- Kicker (accent color):
  > Every month you wait, the REIT down the road fills the units you didn't.

### Links / CTAs
None (cites link to `#source-N`).

---

## 9. BecauseLetterboard — exported from hero.tsx (1843–1872) + `split-flap.tsx`

`<section aria-label="Because (split-flap pain refrain)">` — **no id**. Dark background (`--color-dark`).

### Verbatim copy
- Label line: > storageads.com — rendered in **`var(--color-gold)`** (⚠ banned token still referenced here, hero.tsx:1855)
- Label suffix: > because...
- `BECAUSE_MESSAGES` (13, cycled on the split-flap board, ALL CAPS, hold 4500ms each):
  1. > A SIGN ON A CHAINLINK FENCE IS NOT AN ACQUISITION STRATEGY
  2. > WE'RE ON PAGE 2 OF GOOGLE IS NOT A MARKETING PLAN
  3. > YOUR COMPETITOR FILLED 40 UNITS LAST MONTH AND YOU HAVE NO IDEA HOW
  4. > YOU ASKED YOUR AGENCY WHICH ADS DROVE MOVE-INS AND THEY CHANGED THE SUBJECT
  5. > YOU'RE PAYING $200 PER MOVE-IN AND CALLING IT BRAND AWARENESS
  6. > YOUR AGENCY SENDS YOU A REPORT EVERY MONTH AND YOU DON'T UNDERSTAND A SINGLE LINE ON IT
  7. > DRONE FOOTAGE OF YOUR ROOF HAS 200 VIEWS AND ZERO RESERVATIONS
  8. > YOU JUST PAID GOOGLE $6 SO SOMEONE COULD CLICK YOUR AD TO PAY THEIR BILL
  9. > EXTRA SPACE IS RUNNING 14 CAMPAIGNS IN YOUR ZIP CODE AND YOU'RE RUNNING VIBES
  10. > YOUR BEST AD GOT 3 LIKES AND TWO WERE EMPLOYEES
  11. > YOU'VE BEEN ABOUT TO LAUNCH A CAMPAIGN SINCE Q2 OF LAST YEAR
  12. > YOUR GOOGLE BUSINESS LISTING IS DOING MORE WORK THAN YOUR ENTIRE MARKETING BUDGET
  13. > THE MARKETING MEETING WAS YOU AND YOUR MANAGER STARING AT GOOGLE REVIEWS

### Behavioral notes (split-flap.tsx)
- Character set: `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@&!?+-=`. Cascade delay 50ms per cell (left→right, top→bottom); 4–10 random intermediate flips per cell; flip duration 320ms; intervals ramp 35→60ms; initial 800ms sleep; loops messages forever.
- Responsive columns (`ResponsiveSplitFlap` in hero.tsx): <400px→14 cols, <480→16, <640→20, <768→24, <1024→30, else 36; rows = max rows needed so every message fits at that width. Flap cell size clamps 12–42px wide.
- **No reduced-motion handling in the split-flap loop itself** (the `#hero` reduce-motion override does not cover this section — it relies on CSS-class animations in `split-flap.module.css` and JS timers).

---

## 10. Results — `src/components/marketing/results.tsx`

`<section id="results" aria-label="Case studies and operator results">`

### Verbatim copy
- SectionHeader: `§ 05` · `RESULTS` · `CASE STUDIES`
- H2: > We tested it on our own facilities first. Here's what happened.
- Italic sub:
  > Two facilities. Real campaigns. Numbers pulled directly from storEDGE and the StorageAds reporting layer. No case-study polish.

**Case study 1 — Single-Site Independent: Cassopolis, MI**
> A 247-unit facility at 71% occupancy with no paid ads and a default storEDGE rental page. StorageAds launched a Meta campaign with 3 ad-specific landing pages targeting climate-controlled, vehicle storage, and first-month-free audiences.

| Value | Label |
|---|---|
| 34 | move-ins in 90 days |
| $41 | per move-in |
| 71% → 84% | occupancy in one quarter |
| 35x | return on ad spend |

Benchmark chip `Benchmark` +:
> 84% lands above the 87.2% independent average and inside reach of the 92.6% REIT band. One quarter, one facility, no new units built.
(`<Cite n={[1, 2]} />`)

**Case study 2 — Lakeshore Storage: South Haven, MI**
> A seasonal market with 60% winter occupancy. StorageAds ran targeted campaigns for boat/RV storage and temperature-sensitive items during the fall shoulder season.

| Value | Label |
|---|---|
| 22 | move-ins in 60 days |
| $38 | per move-in |
| 74% | winter occupancy (vs 60% prior year) |
| 8.7% | of page visitors reserved (vs 2.1% industry) |

Benchmark chip `Benchmark` +:
> +14 points of winter occupancy in a market where the national web rate dropped 4.71% YoY. The renters were there. The system just had to reach them.
(`<Cite n={[3]} />`)

**ROI math paragraphs:**
> **Here's the math.** A move-in at a typical facility pays $130 a month and stays 14 months. That's about $1,820 per move-in. Five to ten extra move-ins a month adds $9,000-18,000 in future rent every month. The System tier plus a typical ad budget runs about $1,750 a month. That's 5-10x before the system even starts tightening up.

> And it compounds. As the move-in data stacks up over six months, what you pay for each move-in drops and the reserve rate climbs. The math only gets better with time.

### Links / CTAs
None.

---

## 11. LiveStatsSection — wrapper in `src/app/page.tsx` (144–161): `LiveStatsStrip` (hero.tsx) + `LiveMonitorTriptych` (live-monitors.tsx)

`<section aria-label="Industry and forecast numbers">` — **no id**.

### 11a. LiveStatsStrip (hero.tsx 2218–2352)
- Strip header: `§ 00 · NUMBERS` · (sm+) `n = 6 · industry · forecast` · `LIVE · {HH:MM:SS}` (live dot + 1Hz clock)
- Six stat cells (index `#01`–`#06`; big animated Display number; italic caption; count-up on reveal, snaps if reduced motion). **Hardcoded data — despite the code comment mentioning `/api/public-stats`, this strip makes no fetch.**

  | # | Context | Label | Displayed value | Caption (italic, verbatim) | Cites |
  |---|---|---|---|---|---|
  | 01 | INDUSTRY · 2025 | U.S. storage asset class | $432B | Total value of U.S. self-storage real estate. NOI growth has beat inflation by 190 basis points a year since 2008. | 4, 9 |
  | 02 | INDUSTRY · 2025 | Occupancy gap | 5 pts | REITs run 92.6% same-store occupancy. Independents average 87.2%. The space between is the lever, and it closes with marketing, not location. | 1, 2 |
  | 03 | INDUSTRY · BENCHMARK | Revenue in the building | $72k | What a 500-unit facility leaves in the building at the typical occupancy gap, $120 a unit. Roughly $1.3M in asset value at a 5.5% cap. | 3 |
  | 04 | FORECAST · YEAR 1 | Ad spend goal | $10M | ad spend StorageAds will put to work by EOY. Every dollar buying move-ins, not sitting in a vendor's queue. | — |
  | 05 | FORECAST · YEAR 1 | Facilities goal | 250 | operators live on the system by EOY. Partner operators carry the growth. | — |
  | 06 | FORECAST · YEAR 1 | Move-ins generated | 10k | signed leases generated by StorageAds campaigns. Operators pay for outcomes, not vendor reports. | — |

  (Code comment flags forecast cards as "Placeholder targets — replace with Blake's actual year-one goals.")

### 11b. LiveMonitorTriptych (live-monitors.tsx)
Three mini panels, **all synthetic/fake data** (code comment: "synthetic on all three (plausible drift) because we don't have a public real-time source wired yet"):

1. **LiveChannelMini** — Panel label `CHANNEL · 24H`, right label `USD`. Rows from `useLiveChannelsSynthetic` (src/hooks/use-live-data.ts): channel IDs/base spends `GOOG` $48,900 · `META` $34,200 · `YELP` $8,450 · `BING` $12,100 · `DMAIL` $6,800 · `CALL` $4,300; values drift every 2300ms; shown as `$X.Xk` + `▲ N` / `▽ N` delta; bar meters.
2. **LiveMovesMini** — Panel label `MOVE-IN TAPE · T-5M`, right Tag `STRM`. Streaming fake move-in events every 3800ms: time `HH:MM:SS`, facility code + unit, source, rent. Fake facility codes (use-live-data.ts FACILITIES): ATX-01 CEDAR BARTON SKWY (Austin), ATX-03 CEDAR RIVERSIDE, PHX-02 REDROCK S. MTN, PHX-04 REDROCK DEER VLY, DAL-01 TRINITY OAK CLIFF, DAL-02 TRINITY IRVING, DEN-01 FRONT RNG CHERRY CK, SEA-01 EMERALD BALLARD, NSH-01 HARPETH GREEN HL, ORL-01 SUNBELT KISSIMMEE, MIA-02 SUNBELT COCONUT GV, SAT-01 ALAMO WESTOVER. Sources: GOOG/META/YELP/BING/DMAIL/SEO/CALL. Units 5x5–10x30. Rent $79–$399.
3. **LiveAttrMini** — Panel label `TRACKED MOVE-INS · 90D`, right value `{N.N}%` (random walk around 92, clamped 84–97, drifts every 900ms). Axis labels: `-90D` · `NOW`.

---

## 12. StatsBar — exported from hero.tsx (2360–2373)

`<section aria-label="Key performance stats">` — **no id**.

### Verbatim copy (`STATS`, count-up on reveal)
| Value | Label |
|---|---|
| 34 | Move-ins, 90 days |
| 84% | Occupancy, one quarter |
| 8.7% | Page conversion rate |
| 35x | Return on ad spend |

---

## 13. DemandTriggers — `src/components/marketing/demand-triggers.tsx`

`<section id="demand-triggers" aria-label="Storage demand triggers we target with Meta ads">`

### Verbatim copy
- H2:
  > We understand storage demand because we see these triggers in our own facilities every week.
- Intro:
  > This isn't persona research from an agency deck. It's what we see at our own gates every week. Meta puts your facility in front of these renters before they ever open Google.
- Demand mix strip header: > Why renters get a unit
- Strip meta: > Multi-select · n = 6 · SSA Demand Study⁵ (`<Cite n={5} />`)
- Strip cells:
  | % | Label |
  |---|---|
  | 57% | Not enough space at home |
  | 45% | Downsizing or decluttering |
  | 34% | During a move |
  | 30% | Change in household size |
  | 15% | Home renovation |
  | 5% | Business and e-commerce |
- Trigger cards (9):

  **Moving & Relocation**
  > Local and long-distance moves. We know this demand from running U-Haul dealerships and a moving company.

  **Divorce & Life Disruption**
  > Someone needs their stuff out of the house this week. They rent fast, and the first facility in front of them usually wins.

  **Downsizing**
  > Moving to a smaller place means the overflow has to go somewhere. These tenants stay for years.

  **Estate Cleanouts**
  > Sorting a family member's belongings takes months. Big units, real urgency. Agencies miss this demand because they've never run a facility.

  **Remodeling & Renovation**
  > Clearing rooms for a home project. Predictable and seasonal, so we run the campaigns before the season hits.

  **Business Overflow**
  > Contractors, e-commerce sellers, and small businesses that need somewhere to stage inventory. Commercial tenants stay longer and pay on time.

  **College Transitions**
  > Students cycling in and out between semesters. Repeatable annual demand we build campaign calendars around.

  **Vehicle / RV / Boat Storage**
  > Seasonal vehicle storage at premium rates. We built and operate heated indoor vehicle storage ourselves.

  **Seasonal & Overflow**
  > Holiday items, sports gear, off-season belongings. Consistent base demand that fills standard units year-round.

### Links / CTAs
None.

---

## 14. QuickCalculator — `src/components/marketing/quick-calculator.tsx`

`<section id="calculator" aria-label="Quick revenue calculator">`

### Verbatim copy
- SectionHeader: `§ 06` · `REVENUE CALCULATOR` · `LEDGER · LIVE`
- H2: > What your empty units cost you.
- Slider 1: label `Total Units` (id `slider-total-units`, aria-label "Total units", aria-valuetext "{N} units") — range 20–600 step 10, default **150**; endpoint labels `20` / `600`.
- Slider 2: label `Current Occupancy` (id `slider-occupancy`, aria-label "Current occupancy percentage", aria-valuetext "{N}% occupancy") — range 40–99 step 1, default **78**; endpoint labels `40%` / `99%`; readout turns red below 85%.
- Loss card (red): label > You're Losing
  value > ${monthlyLoss}/mo
  sub > {vacantUnits} vacant units × $130 avg rate = ${annualLoss}/yr
- Gain card (green): label > With StorageAds
  value > {projectedMoveIns} move-ins/mo
  sub > ${projectedRecovery}/mo recovered · {roi}x annual return on System plan (at 14-mo avg tenure)
- Assumptions line:
  > Assumes $130/mo avg unit rate · $749/mo System plan · $1,000/mo ad spend floor · ~20% vacancy recovery rate
- CTA (`.btn-primary`): `Get your free facility audit` → `#cta`

### Math constants (quick-calculator.tsx:14–29)
`avgRate = 130` · `avgTenureMonths = 14` · `storageadsCost = 749` · `adSpendFloor = 1000` · projected move-ins = `clamp(2, 30, round(vacantUnits × 0.2))` · ROI = annualRevenueLift / ((749+1000)×12), 1 decimal.

---

## 15. FAQ — `src/components/marketing/faq.tsx`

`<section id="faq" aria-label="Frequently asked questions">`

### Verbatim copy
- SectionHeader: `§ 07` · `QUESTIONS` · `11 ANSWERS` (dynamic `${FAQS.length} ANSWERS` — currently 11; page.tsx IA comment says "8 Q+A pairs", stale)
- H2: > Common questions from operators.
- Sub:
  > If yours isn't here, email blake@storageads.com. You'll get the founder, not a help desk.
  (email is a `mailto:blake@storageads.com` link)
- Accordion (first item open by default; ids `faq-btn-{i}` / `faq-panel-{i}`, aria-expanded/aria-controls/aria-hidden wired). All 11 Q&A:

**Q1: We're not running any ads right now.**
> Most independent operators aren't. The system is built for that starting point. Market mapping, ads, landing pages, and follow-up all deploy from zero in the first week.

**Q2: What does the system include?**
> Market intelligence. Ad creation and publishing to Meta and Google. Dedicated landing pages with storEDGE rental embedded. Retargeting. A/B testing scored by move-in outcome. Reservation-to-move-in conversion. Revenue intelligence. Organic capture. One dashboard.

**Q3: Do we need marketing experience to run it?**
> No. The Ad Creator builds campaigns from your facility data. The Publishing Manager puts them live. The system handles targeting, bidding, and creative rotation. You approve and watch the numbers.

**Q4: How fast is it live?**
> Ads are live in the first week. Move-ins start in weeks two through three as the campaigns gather data and retargeting kicks in. By month three you have a real baseline.

**Q5: How does the AI Creative Studio work?**
> It generates ad copy, headlines, and landing page variants from your facility data: unit types, pricing, location, competitive positioning. You review and publish. New creative on demand without a retainer.

**Q6: We already get plenty of walk-ins and Google traffic.** (cite 6)
> Good. That puts you ahead of most independents. The catch is Google's local algorithm weights proximity and review recency over brand size, which is the one place independents can outrank REIT locations. If you're not actively managing Google Business Profile, reviews, and retargeting the visitors you already get, you're sitting on the lever that costs the REITs $250M a year to operate at scale. The audit shows you which side of that gap you're on.

**Q7: We're in Texas (or Florida, or a Sun Belt metro). The market is rough.** (cite 10)
> It is. San Antonio added roughly 656,000 square feet of new supply in 2026. Houston added 430,000. National supply growth is still slowing to 1.5% a year through 2027, but the oversupplied metros are absorbing first. You can't make new supply disappear. You can control how your facility prices against competitors, how fast you respond to leads, how your reviews read, and how the page performs at 11pm on a Sunday. That's the lever, and it's what the system runs.

**Q8: California passed SB 709. Should we worry about ECRI legislation?** (cites 7, 8)
> If you're in California, yes: SB 709 caps annual existing-customer rate increases at the lower of 5% + CPI or 10% as of January 2026. Twenty-four states introduced storage pricing bills in 2025. The NYC Department of Consumer and Worker Protection has an active case against Extra Space over the bait-and-switch ECRI playbook. The era of low introductory rate plus aggressive ECRI is closing. Operators who can't run real demand generation get squeezed first. The system is built so new-customer acquisition is your durable lever, not pricing tactics regulators are killing.

**Q9: We only have one facility. Is this for us?**
> Yes. The system was built on a single facility and runs on our own portfolio. One facility is the primary use case. Enterprise tiers exist for ten or more.

**Q10: How does the storEDGE integration work?**
> Landing pages embed the storEDGE reservation widget. The renter books on your branded page, and the reservation lands in storEDGE the same as a walk-in. Rates, availability, and payments stay in your existing system.

**Q11: What if it doesn't work?**
> If move-ins haven't improved by the end of month three, month four is free. We run this same system on our own facilities. We're in the same boat.

### Links / CTAs
- `mailto:blake@storageads.com` in the section intro.

---

## 16. CTASection — `src/components/marketing/cta-section.tsx`

`<section id="cta" aria-label="Request a free facility audit">`

### Verbatim copy
- SectionHeader: `§ 08` · `FREE AUDIT` · `STEP · FINAL`
- H2: > Get your free facility audit.
- Intro:
  > Where you sit against the REITs' 92.6% occupancy¹˒². Where revenue's leaking. What it takes to close the gap at your facility. Free, and yours to keep either way.
  (`<Cite n={[1, 2]} />`)
- Sub: > No commitment. No sales deck.
- Mobile toggle tabs (below lg): `Get the audit` · `Book a call`

**Left card — Audit form**
- Card heading: > Facility information.
- Form `aria-label="Free facility audit request"`
- Fields (all `className="input-field"`, all required, errors inline below field in accent color):
  | name attr | Placeholder | type / autocomplete | required | error id |
  |---|---|---|---|---|
  | `name` | Your name | text / `name`, autoCapitalize words | yes | `name-error` |
  | `email` | Email address | email / `email`, inputMode email, no autocap/autocorrect/spellcheck | yes | `email-error` |
  | `facilityName` | Facility name | text / `organization` | yes | `facilityName-error` |
  | `location` | Facility location (city, state) | text / `address-level2` | yes | `location-error` |
  | `website_url` | (honeypot — visually hidden, `tabIndex={-1}`, `aria-hidden`) | text | no | — |
- Inline validation messages (on blur):
  > Please enter a valid email address.
  > This field is required.
- Submit button: `Request audit` / while submitting: `Submitting...`
- Submit error messages (role="alert", aria-live="assertive"):
  - 429: > Too many requests from your network. Please wait a minute and try again.
  - other non-OK: server `error` field, else > We couldn't send your audit request. Please try again or email blake@storageads.com.
  - timeout (20s abort): > The request took too long. Please check your connection and try again.
  - network: > Network error — please check your connection and try again.
- Success state (role="status", aria-live="polite", replaces form):
  > Audit requested
  > You'll hear from me within 24 hours with the numbers.
  > Don't want to wait? Just book a call right now.
  ("Just book a call right now" → `https://cal.com/stowstack/30min`, `_blank`)
- Checklist under button (with check icons):
  > Response within 24 hours. · Free. · No commitment.
- Diagnostic upsell card (link → `/diagnostic`):
  > Want numbers right now? Run the instant diagnostic
  > Scored across 8 categories against industry benchmarks. No waiting.

**Right card — Cal.com embed**
- Heading: > Book a 30-minute walkthrough
- Body:
  > Thirty minutes. Your market map, your competitors, and what the system would do at your facility. You talk to the founders, not a sales rep.
- Loading skeleton text: > Loading calendar...
- Failure state:
  > Calendar couldn't load.
  > Book directly on Cal.com (→ `https://cal.com/stowstack/30min`, `_blank`)
- Fallback link (always shown): > Open in new tab (→ same Cal URL, `_blank`)
- Trust signals (4, with Shield/Clock/Wrench/Zap icons):
  1. > No long-term contracts
  2. > Live in your first week
  3. > Built and tested on our own facilities
  4. > storEDGE built in

### Form mechanics
- **Endpoint:** `POST /api/audit-form`, `Content-Type: application/json`.
- **Payload:** `{ name, email, facilityName, location }` (FormData → object; `website_url` honeypot deleted before send; if honeypot filled → silent fake success, no request).
- **Behavior:** double-submit guard (`isSubmitting || isSubmitted`); 20s `AbortController` timeout; success swaps form for success panel (no redirect); errors render inline.

### Cal.com embed mechanics
- Official queue snippet pattern, lazy-loads `https://app.cal.com/embed/embed.js`; `Cal("init", { origin: "https://cal.com" })`; `Cal("inline", { calLink: "stowstack/30min", elementOrSelector: "#cal-embed", config: { theme: "light", layout: "month_view" } })`; `Cal("ui", { theme: "light", styles: { branding: { brandColor: "#141413" } }, hideEventTypeDetails: false })`.
- MutationObserver flips loaded state when iframe mounts; 8s timeout → `calFailed` fallback UI; script onerror → fallback. Strict-mode double-init guard.
- `CAL_EMBED_SLUG = "stowstack/30min"` fallback (env `NEXT_PUBLIC_CALCOM_LINK` override) — `src/lib/booking.ts`. The `storageads` Cal handle is unclaimed.

---

## 17. SourcesNote — `src/components/marketing/sources-note.tsx` + `src/lib/sources.ts`

`<section id="sources" aria-label="Sources for the market data cited on this page">`

### Verbatim copy
- Header: > Sources
- Header meta: > n = 10 · upstream publishers · click any¹ inline above
- Intro:
  > Every market stat cited on this page is sourced from a third-party publisher. The superscript number next to each claim links here. Links are included where the publisher has a stable public page. Most industry reports are paid or members-only, so for those we cite by publisher and date.
- Column labels per row: `Publisher` / `Backs`
- Numbered badge per row: `aria-label="Source {N}"`. Row anchor ids `source-1` … `source-10` (via `sourceAnchorId`).

### Full citation list (SOURCES, verbatim — ref / title / backs / url)

**1 — Extra Space Storage, Q4 2025 earnings release**
- Title: > Institutional same-store occupancy benchmark.
- Backs: > REIT same-store occupancy at 92.6%.
- URL: https://ir.extraspace.com/news-events/press-releases

**2 — TractIQ Self-Storage Market Report, September 2025**
- Title: > Independent operator occupancy panel, n = 70,000+ properties.
- Backs: > Independent average occupancy at 87.2%. The 5+ point gap. National average at 82.2%.
- URL: (none)

**3 — Yardi Matrix National Self-Storage Report, January 2026**
- Title: > National asking rate, street rate, and web rate benchmarks.
- Backs: > $16.27/sq ft asking rate. $133 street, $119 web. Per-unit rate used to model the $72,000/yr revenue gap and $1.3M asset-value impact at a 5.5% cap.
- URL: (none)

**4 — Inland Research, 2025**
- Title: > U.S. self-storage real-estate value and NOI growth history.
- Backs: > Asset class size ($432B). NOI growth vs. inflation since 2008 (+4.4% / yr, 190 bps over inflation).
- URL: (none)

**5 — Self Storage Association (SSA) Demand Study, 2025**
- Title: > U.S. renter demand drivers, multi-select survey responses.
- Backs: > Why renters get a unit: 57% / 45% / 34% / 30% / 15% / 5%. 1-in-3 U.S. households use storage.
- URL: https://www.selfstorage.org/research

**6 — ICR REIT Market Review, 2025**
- Title: > Public REIT marketing spend and digital footprint analysis.
- Backs: > Top REITs spend $250M+/yr on digital marketing. Independents are outspent ~1,000:1 on Google search. REITs handle 85% of customer interactions digitally.
- URL: (none)

**7 — California Senate Bill 709, effective January 1, 2026**
- Title: > Self-storage pricing disclosure and rate-increase cap legislation.
- Backs: > Caps annual existing-customer rate increases at the lower of 5% + CPI or 10%. Requires promotional rate disclosure.
- URL: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB709

**8 — NYC DCWP enforcement action vs. Extra Space, 2026**
- Title: > Active litigation over existing-customer rate-increase practices.
- Backs: > $5M civil penalties + $18M restitution sought. 100+ tenant complaints. The end of the bait-and-switch ECRI playbook.
- URL: (none)

**9 — Cushman & Wakefield U.S. Self-Storage Report, 2025**
- Title: > Cross-asset-class CRE comparison and cap-rate environment.
- Backs: > Self-storage NOI growth of +4.4%/yr vs. multifamily +3.1%, office +1.8%, retail +1.5%. CapEx at 8% of NOI vs. 13%+ for other CRE.
- URL: (none)

**10 — Yardi Matrix Sun Belt Supply Pipeline, 2026**
- Title: > New self-storage square footage by metro, 2026 deliveries.
- Backs: > San Antonio +656,000 sq ft in 2026. Houston +430,000. National supply growth slowing to 1.5%/yr through 2027.
- URL: (none)

- Closing line:
  > Spotted a stat that looks off? Email blake@storageads.com. We'd rather get a correction than ship a wrong number.
  (email is a `mailto:blake@storageads.com` link)

### Cite component (`cite.tsx`)
- Superscript numbers linking `#source-{N}`; multiple ids separated by `,&thinsp;`; `title` attr = publisher ref (e.g. "Extra Space Storage, Q4 2025 earnings release"); `aria-label="Footnote {N}: {publisher ref}"`; dotted underline; opacity 0.55→1 on hover. Plain hash anchors, work without JS.

### Cite usage map (homepage)
| Cite ids | Where |
|---|---|
| 1 | Hero subheadline ("92.6% occupancy") |
| 1, 2 | HeroStatusStrip OCC GAP tile; FourWayComparison sub-intro; Results case study 1 benchmark; CTASection intro |
| 1, 2, 3 | ProblemStatement problem 1 heading |
| 1 / 2 / 3 separately | ProblemStatement intro paragraph |
| 3 | ProblemStatement problem 4; Results case study 2 benchmark; LiveStatsStrip card 03 |
| 4, 9 | LiveStatsStrip card 01 |
| 5 | DemandTriggers demand-mix strip meta |
| 6 | ProblemStatement problem 2; FAQ Q6 |
| 7, 8 | FAQ Q8 |
| 10 | FAQ Q7 |

---

## 18. Footer — `src/components/marketing/footer.tsx`

### Verbatim copy
- Brand: `storage` (dark) + `ads` (`var(--brand-gold)`)
- Tagline: > REIT-grade marketing infrastructure for independent operators.
- Italic line: > Deployed on our own portfolio before any client engagement.
- Column labels: `Navigation` · `Contact` · `Legal`
- Copyright: > © {current year} StorageAds. All rights reserved.

### Links (`<nav aria-label="Footer navigation">`)
| Anchor text | Destination | external |
|---|---|---|
| How It Works | `#how-it-works` | no |
| Pricing | `/pricing` | no |
| Free Diagnostic | `/diagnostic` | no |
| About | `/about` | no |
| Blog | `/blog` | no |
| Insights | `/insights` | no |
| Demo | `/demo` | no |
| Book a Call | `https://cal.com/stowstack/30min` | yes (`_blank noopener noreferrer`) |
| blake@storageads.com | `mailto:blake@storageads.com` | — (Mail icon) |
| Privacy Policy | `/privacy` | no |
| Terms of Service | `/terms` | no |
| Data Deletion | `/data-deletion` | no |

---

## 19. StickyMobileCTA — `src/components/marketing/sticky-mobile-cta.tsx`

### Verbatim copy
- Button: `Get your free facility audit` (ArrowRight icon) → `#cta`
- Attribute: `data-analytics="sticky-mobile-cta"` (the only data-analytics attr on the homepage)

### Behavioral notes (must survive redesign)
- `lg:hidden`, fixed bottom bar, `z-40`, frosted bg `rgba(250,249,245,0.92)` blur(18px) saturate(160%), top border.
- Mounted with `ssr: false` (client-only) from page.tsx.
- **Show** only when BOTH: (a) the hero's primary CTA (`section#hero a.btn-primary`) has scrolled above the viewport (IntersectionObserver, threshold 0, `boundingClientRect.top < 0`), AND (b) `section#cta` is NOT in view (IntersectionObserver threshold 0.05). Hides again when the audit form enters viewport so it never covers form fields.
- Hidden state: `translateY(120%)`, opacity 0, `pointer-events: none`, `aria-hidden` bound.
- Safe area: `paddingBottom: max(env(safe-area-inset-bottom), 12px)` (+left/right 12px floors) — designed for FB IAB bottom toolbar + iPhone home indicator.

---

## 20. Off-homepage marketing components checked for completeness

### exit-intent-popup.tsx — NOT rendered on homepage (used only by `/audit-tool`)
Verbatim copy (for reference):
- Eyebrow: > Before you go
- Heading: > Your facility scored {auditScore}/100 (if score) / > Get your full audit results
- Body (with facilityName): > We'll email the complete breakdown for {facilityName}: the fixes that matter most.
- Body (without): > Enter your email and we'll send you the complete breakdown with actionable recommendations.
- Email placeholder: `you@facility.com` (aria-label "Your email address")
- Submit: `Send` / `Sending…`
- Success: > Check your inbox / > We'll send your full audit results shortly.
- Footer: > No spam. Just your audit results and one follow-up.
- Errors: 429 > Too many requests. Please try again in a minute. · other > Couldn't send. Please try again. · timeout (15s) > Request timed out. Please check your connection. · network > Network error. Please try again.
- Close `aria-label="Close"`; dialog labelled by `exit-intent-popup-title`.
- **Endpoint:** `POST /api/consumer-lead` JSON `{ email, facilityName: facilityName || "Unknown", source: "exit_intent", utm_source: "exit_intent" }`; honeypot `website_url` → fake success.
- **Trigger:** armed 10s after mount; fires on `mouseleave` with `clientY <= 5` (top of window); suppressed if `sessionStorage.exit_intent_dismissed === "1"` (set on dismiss); Escape dismisses. Desktop-only by nature (mouse event).

### three-way-comparison.tsx — ORPHANED (imported nowhere)
Contains stale pricing string `"$499-1,499/mo + ad spend"` (three-way-comparison.tsx:77). Superseded by four-way-comparison.

### inaction-timeline.tsx — moved off homepage; used only by `/cost-of-inaction` (per page.tsx IA comment "moved to its own page").

### use-in-view.ts
One-shot IntersectionObserver hook (default threshold 0.1; sticks `true` once intersected). Drives every section's fade/slide-in reveal. No copy.

---

## Appendix A — Cross-route usage map

`grep -rn "components/marketing" src/ --include="*.tsx" --include="*.ts"` (plus relative-import check — none found). Every import of `@/components/marketing/*` outside the marketing dir itself:

| Marketing component | Non-homepage importers |
|---|---|
| `inaction-timeline` | `src/app/cost-of-inaction/page.tsx` (line 4) |
| `exit-intent-popup` | `src/app/audit-tool/audit-client.tsx` (line 5) |
| `pricing-calculator` | `src/app/pricing/page.tsx` (line 4) |
| `nav`, `hero`, `problem-statement`, `live-monitors`, `use-in-view`, `system-overview`, `how-it-works`, `four-way-comparison`, `quick-calculator`, `results`, `cta-section`, `faq`, `demand-triggers`, `sources-note`, `footer`, `sticky-mobile-cta` | **homepage only** (`src/app/page.tsx`) |
| `split-flap`, `cite` | only imported within the marketing dir (`hero.tsx`; `cite` also by `problem-statement`, `results`, `faq`, `four-way-comparison`, `demand-triggers`, `cta-section`) |
| `three-way-comparison` | **imported nowhere — dead file** |

Implications:
- **Nav and Footer are homepage-exclusive** — legal pages, blog, audit pages, /pricing, /about etc. do NOT import the marketing nav/footer. Redesigning them only changes the homepage.
- Shared components that constrain the redesign because other routes depend on them: `inaction-timeline` (/cost-of-inaction), `exit-intent-popup` (/audit-tool), `pricing-calculator` (/pricing).
- `hero.tsx` is an internal dependency hub: `how-it-works.tsx` imports `PipelineFlow` + `FeatureHighlights` from it; `page.tsx` imports 5 named exports + default. Splitting hero.tsx must preserve these exports or update both importers.
- Dead exports in hero.tsx: `ROITeaser`, `MobileLiveTicker` (and `DASHBOARD_ROWS`-driven `useCountUp` paths they own).

---

## Appendix B — Pricing truth (public-facing figures, verbatim, file:line)

| Figure | Context (verbatim) | File:line |
|---|---|---|
| **$749** | `const storageadsCost = 749;` → shown as "$749/mo System plan" in calculator assumptions | `src/components/marketing/quick-calculator.tsx:19` (display :197) |
| **$1,000** | `const adSpendFloor = 1000;` → "$1,000/mo ad spend floor" | `src/components/marketing/quick-calculator.tsx:20` (display :197) |
| **$749 / $1,249** | `TIER_FEE = { system: 749, compound: 1249 }` → buttons "System · $749/mo", "Compound · $1,249/mo"; `AD_SPEND_FLOOR = 1000` ("Fee + $1,000/mo ad spend") | `src/components/marketing/pricing-calculator.tsx:8–11,18` (used on /pricing) |
| **$299** | Signal tier: `price: "$299"`, `priceNote: "/mo per facility"` — "The cheapest way to find out if paid ads work at your facility." | `src/app/pricing/page.tsx:42–43` |
| **$749** | System tier: `price: "$749"` /mo per facility — "Most operators pick this" (recommended badge) | `src/app/pricing/page.tsx:66–67,84` |
| **$1,249** | Compound tier: `price: "$1,249"` /mo per facility — "For facilities where every move-in is worth $2,400 or more." | `src/app/pricing/page.tsx:89–91` |
| **$599 / $499 / $449** | Enterprise volume pricing: "Volume pricing: $599/facility at 10–24, $499 at 25–49, $449 at 50+" | `src/app/pricing/page.tsx:206` |
| **$1,749** | Comparison row "All-in / mo (1 facility)": `["$1,749", "$3,000 at 10 moves", "$199–499", "$3,000+", "$0 + 30–60 hrs"]` | `src/app/pricing/page.tsx:194` |
| **$749/mo + $1,000 ad spend** | Pricing page inline summary | `src/app/pricing/page.tsx:689` |
| **$1,000/mo minimum** | "Ad spend — Paid directly to Meta and Google. $1,000/mo minimum per facility. We don't mark it up." | `src/app/pricing/page.tsx:211–213` |
| **$199–499** | Adverank competitor cost: "$199–499 / mo per facility" | `src/app/pricing/page.tsx:124` |
| **$1,500–4,500 + 15–20%** | G5/agency competitor cost: "$1,500–4,500 / mo + 15–20% markup on ad spend" | `src/app/pricing/page.tsx:132` |
| **2× first month's rent** | SpareFoot cost: "2× first month's rent, per move-in" (calculator uses `SPAREFOOT_MULTIPLIER = 2`) | `src/app/pricing/page.tsx:116`; `pricing-calculator.tsx:20` |
| **499 / 2499** | JSON-LD AggregateOffer `lowPrice: "499"`, `highPrice: "2499"`, `offerCount: "4"` — ⚠ inconsistent with visible tiers ($299 low; $1,249 top non-enterprise) | `src/app/layout.tsx:93–95` |
| **$1,750** | Homepage Results ROI math: "The System tier plus a typical ad budget runs about $1,750 a month." (= 749 + ~1,000) | `src/components/marketing/results.tsx:185–186` |
| **$499-1,499/mo + ad spend** | Stale figure in ORPHANED `three-way-comparison.tsx` (not rendered anywhere) | `src/components/marketing/three-way-comparison.tsx:77` |

**The only price shown on the homepage itself is $749 (+ $1,000 ad-spend floor and the "$1,750 a month" all-in line in Results).** Tier names mentioned on homepage: "System plan" (calculator), "The System tier" (Results), "Enterprise tiers exist for ten or more" (FAQ Q9).

---

## Appendix C — Anchor map

### Section ids that exist on the homepage (anchor targets)
| id | Component | Targeted by |
|---|---|---|
| `main-content` | `<main>` in page.tsx | layout.tsx skip link (`#main-content`) |
| `hero` | Hero section | StickyMobileCTA observer (`section#hero a.btn-primary`); not linked in nav |
| `how-it-works` | HowItWorks | Nav "How It Works", Footer "How It Works", Hero "Learn more" scroll indicator |
| `system` | SystemOverview | **nothing links to it** |
| `problem` | ProblemStatement | **nothing links to it** |
| `results` | Results | Nav "Results" |
| `demand-triggers` | DemandTriggers | **nothing links to it** |
| `calculator` | QuickCalculator | Nav "Calculator" (note: `pricing-calculator.tsx` on /pricing also uses `id="calculator"`) |
| `faq` | FAQ | **nothing links to it** |
| `cta` | CTASection | Nav "Request Audit" (desktop + mobile), Hero primary CTA, QuickCalculator CTA, StickyMobileCTA, StickyMobileCTA hide-observer |
| `sources` | SourcesNote | **nothing links to it directly** (individual rows are linked) |
| `source-1` … `source-10` | SourcesNote rows | every `<Cite>` superscript on the page (`#source-{n}`) |
| `cal-embed` | div in CTASection | Cal.com embed `elementOrSelector` |
| `faq-btn-0…10` / `faq-panel-0…10` | FAQ accordion | aria-controls/labelledby only |
| `slider-total-units`, `slider-occupancy` | QuickCalculator inputs | label `htmlFor` only |

### Sections with NO id (cannot be deep-linked today)
FourWayComparison, BeforeAfterSection, CapabilitiesSection, LiveStatsSection, StatsBar, BecauseLetterboard.

### Nav anchor contract (must keep working post-redesign)
`#how-it-works`, `#results`, `#calculator`, `#cta` — plus active-section observer expects ids `how-it-works`, `results`, `calculator` to exist. StickyMobileCTA expects `section#hero a.btn-primary` and `section#cta` selectors to exist.

---

## Appendix D — Consolidated numbers & claims index (where each figure appears)

| Claim / figure | Cite | Appears in |
|---|---|---|
| 92.6% REIT same-store occupancy | 1 | status strip, hero subhead, four-way intro, problem intro + P1, results CS1 benchmark, stats card 02, CTA intro |
| 87.2% independent average occupancy | 2 | status strip, problem intro + P1, results CS1 benchmark, stats card 02 |
| 5 / 5+ point occupancy gap | 1, 2 | status strip ("5 PTS"), four-way intro, problem P1 heading, stats card 02 |
| 82.2% national average occupancy | 2 | sources backs text only |
| $72,000/yr revenue gap (500-unit) | 3 | typewriter word 5, problem intro + P1, stats card 03 |
| $1.3M asset value @ 5.5% cap | 3 | problem intro + P1, stats card 03 |
| $120 a unit (gap model) | 3 | stats card 03 caption |
| $432B U.S. storage asset class | 4, 9 | stats card 01 |
| 190 bps NOI over inflation since 2008 (+4.4%/yr) | 4, 9 | stats card 01 caption |
| $250M+/yr REIT digital marketing spend | 6 | problem P2, FAQ Q6 |
| 1,000-to-1 Google outspend | 6 | problem P2 |
| 85% of interactions digital | 6 | problem P2 |
| SSA demand mix 57/45/34/30/15/5% | 5 | demand-triggers strip |
| SB 709 cap: lower of 5%+CPI or 10%, Jan 2026 | 7 | FAQ Q8 |
| 24 states introduced pricing bills 2025 | 7/8 context | FAQ Q8 |
| NYC DCWP vs Extra Space ($5M + $18M sought) | 8 | FAQ Q8 (sources backs) |
| San Antonio +656,000 sq ft; Houston +430,000; 1.5%/yr supply growth through 2027 | 10 | FAQ Q7 |
| 34 move-ins / 90 days | portfolio | typewriter 1, StatsBar, results CS1, (dead ROITeaser) |
| $41 per move-in | portfolio | problem P4, results CS1, (dead ROITeaser) |
| 71% → 84% occupancy one quarter | portfolio | typewriter 2, StatsBar (84%), results CS1 |
| 35x ROAS | portfolio | StatsBar, results CS1, (dead ROITeaser) |
| 22 move-ins / 60 days; $38/move-in; 74% vs 60% winter occupancy | portfolio | results CS2 |
| 8.7% page conversion vs 2.1% industry | portfolio | how-it-works step 02 kicker, system part 03 detail, StatsBar, results CS2 |
| −4.71% national web rate YoY | 3 | results CS2 benchmark |
| $130/mo avg rate × 14-month stay = $1,820 LTV | 3 (rate) | problem P4, results ROI math, quick-calculator constants |
| $9,000–18,000/mo added rent (5–10 move-ins) | — | results ROI math |
| $1,750/mo all-in (System + ad budget); 5-10x | — | results ROI math |
| 44-to-1 per move-in | 3 | problem P4 |
| $749 System / $1,000 ad floor / ~20% recovery | — | quick-calculator |
| Year-1 forecasts: $10M ad spend, 250 facilities, 10k move-ins | — (labeled FORECAST) | stats cards 04–06 |
| Month-4-free guarantee ("month four is free") | — | FAQ Q11 |
| Hero demo: $1,800→$2,800 spend, $225→$127 cost/move-in, 64→89% occupancy | demo data | DashboardMockup |
| "SOC2" tag | — | HeroStatusStrip (⚠ verify claim before keeping) |

---

## Appendix E — Known inconsistencies caught during inventory (for redesign QA)

1. `page.tsx` IA comment says FAQ has "8 Q+A pairs" — there are **11**.
2. JSON-LD price range (499–2499) doesn't match visible tiers (299 / 749 / 1,249; enterprise volume 449–599).
3. `BecauseLetterboard` label uses `var(--color-gold)` (hero.tsx:1855) — CLAUDE.md bans gold outside the logo's `--brand-gold`.
4. `LiveStatsStrip` doc-comment claims "Real aggregates from /api/public-stats" but renders hardcoded cards; forecast cards flagged as placeholders in code.
5. `useClock` hardcodes timezone label `CT`.
6. LiveMonitorTriptych data is entirely synthetic (fake facility names like "CEDAR BARTON SKWY"), presented under a "LIVE"-flavored chrome.
7. Status strip displays "SOC2" — compliance claim to verify.
8. Orphans/dead code shipping copy: `three-way-comparison.tsx` (stale "$499-1,499/mo" pricing), hero exports `ROITeaser` + `MobileLiveTicker`.
9. Cal.com handle is `stowstack/30min`, not `storageads` (unclaimed).
