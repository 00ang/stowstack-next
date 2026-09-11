# StorageAds — Brand Voice Guidelines

> Generated 2026-05-27 from `.claude/copy-voice.md`, `.claude/pitch-voice.md`, `.claude/blake-copy-raw.md`, and project `CLAUDE.md`. These guidelines are LLM-readable — load them via `/brand-voice:enforce-voice` before drafting any customer- or investor-facing copy.
>
> **Message hierarchy is canonical in [.claude/positioning.md](.claude/positioning.md) — read it first.** The hero is marketing infrastructure that turns ad spend into move-ins; the product is the full acquisition funnel; attribution is the measurement layer underneath it, never the lede or the differentiator. These guidelines govern voice and register; positioning.md governs what we lead with.

---

## 1. The Company in One Line

StorageAds is the marketing infrastructure that independent self-storage operators (1–50 facilities) use to fill units the way the REITs do — built for storage and nothing else, priced per facility per month, no agency retainer, no PMS lock-in.

It is the full customer-acquisition funnel, not just ad management: market mapping, Meta + Google acquisition, per-ad landing pages with the storEDGE rental flow, reservation-to-move-in conversion, facility audit, and ancillary revenue, run self-serve or fully managed. Attribution — tying each move-in back to the ad that produced it — is the measurement layer that proves the funnel and guides optimization. It is support, never the headline. (Full hierarchy: `.claude/positioning.md`.)

## 2. Two Registers — Pick One Before You Write

StorageAds runs on **two strictly separated voices**. The register is determined by audience, not by topic. The same underlying claim is rendered differently depending on who reads it. Confusing the two is the most common voice failure and it must be caught in review.

| | **Customer voice (default)** | **Pitch voice (rare, gated)** |
|---|---|---|
| Audience | Self-storage operators, 1–5 facilities, age 35–65. Owner-operators and managers. | Vertical SaaS investors, Storable corp dev, technical DD reviewers, PMS-vendor partnership leads, industry analysts. |
| Surface | Website, landing pages, ads, cold emails, in-app text, audit tool output, blog, sales decks for operators. | Whitepaper, investor decks, due-diligence memos, partnership briefs, acquirer-targeted one-pagers. |
| Frame | "Storage is the only thing we build for. The REITs already run this system; independents haven't had the option." | "Vertical SaaS at the intersection of server-side attribution, PMS data, and operator-knowledge encoding — outside the PMS." |
| Test | "Would Nick Huber tweet this?" | "Would this survive a Storable corp dev review?" |
| Default | **Use this unless explicitly told otherwise.** | Only when the brief names an investor, acquirer, partner, or whitepaper context. If unsure, ask. |

**Confidence: HIGH** — explicit, well-documented in both source files, with worked examples in each.

---

## 3. Customer Voice (Default Register)

### 3.1 Audience persona

Independent self-storage operator. 1–50 facilities, most often 1–5. Owner-operator or facility manager reporting to the owner. Age 35–65. Busy. Smart. Skeptical of agencies (has been pitched and disliked it). Knows they should be marketing more. Feels mildly guilty about not doing it. Knows the REITs (Public Storage, Extra Space, CubeSmart) are doing this at a level they can't touch alone.

Voice models: Nick Huber, Michael Wagner (Storage Rebellion), AJ Osborne, Scott Meyers, Stacy Rosetti, Paul Moore.

### 3.2 What the reader actually cares about (in order)

1. Filling units.
2. Not getting ripped off by an agency.
3. Knowing what's working without having to learn marketing.
4. Closing the gap with the REITs in their trade area.

### 3.3 What the reader does NOT care about — never lead with these

Attribution as a concept. Cost-per-move-in as a phrase. Server-side conversion forwarding. CAPI. Click IDs. Pixels. "Full-funnel" anything. "Demand engine" (investor word). Our technical architecture. **The technical depth is real, but it lives in the whitepaper. It is proof, not pitch. Customers buy the outcome, not the mechanism.**

### 3.4 Word list — USE

Fill units · Move-ins · Trade area · Gate · Lease-up · Operator · Facility · Plug it in · Turn it on · The REITs · Independent · What it costs · What you got · One dashboard · No retainer · No agency · No mystery · 100% occupancy · Leaking revenue · Reservations to move-ins · Ancillary revenue · REIT-grade · Lifetime value · Bottom line.

### 3.5 Word list — BAN in customer-facing copy

Demand engine · Full-funnel · Attribution (as hero phrase) · Cost-per-move-in (as hero phrase) · CAPI · Server-side · Click ID · Pixel · Lookalike · Funnel · Conversion event · ROAS · CPL · CPMI · Engagement · Impressions · Optimize · Leverage · Solution · Platform · Stack · Synergy · Best-in-class · Cutting-edge · Empower · Unlock · Drive.

Acceptable only in deep product pages or docs (never hero, landing, or email): "cost per move-in", "attribution", "dashboard", "ad platforms".

**Never anywhere customer-facing:** demand engine, full-funnel attribution, server-side, CAPI.

### 3.6 Sentence rules

- Short sentences. Over 40 words = cut.
- One idea per sentence.
- Concrete over abstract. "Your 10x10s are renting at $94 a move-in" beats "unit-level attribution."
- Verbs over nouns. "Fill the place" beats "drive occupancy."
- Numbers over adjectives. "$94" beats "affordable."
- No semicolons in headlines or CTAs.
- No em-dashes in CTAs.
- Contractions: encouraged. We're, you're, don't, can't.

### 3.7 Right vs. wrong (customer voice)

| WRONG | RIGHT |
|---|---|
| "StorageAds is a full-funnel demand engine that delivers measurable cost-per-move-in attribution for self-storage operators." | "StorageAds is the marketing system the REITs run, built for independent operators. Plug it in and it fills units." |
| "Our server-side conversion forwarding architecture closes the attribution loop from click to PMS-confirmed move-in." | "We tie every ad dollar to the unit that actually got rented. You see what's filling the place." |
| "Leverage AI-powered insights to optimize your acquisition funnel." | "One dashboard. What you spent, what you got, what each move-in cost." |
| "Empower your facility with enterprise-grade marketing technology." | "The REITs have a marketing team. Now you do too." |

### 3.8 Who we're displacing (customer voice)

Not StoragePug. Not G5. Not Storable's marketing modules. **The competitor is the operator's inaction.** Most prospects are paying nobody right now and feeling slightly guilty. Copy lands on "you already knew this, here's the easy way" — never on "let us explain marketing to you."

### 3.9 Blake's raw voice — phrases to weave in

When drafting longer-form customer copy (about pages, audit explanations, sales conversations), reach for these phrases verbatim or near-verbatim — they're Blake's actual operator language:

- "Infrastructure and system to ensure move-ins are being generated"
- "One-stop shop to audit your facility and find where you're leaking revenue"
- "Ensuring reservations convert to move-ins"
- "Adding ancillary revenue streams"
- "Checking all the boxes that increase your bottom line"
- "The lifetime value of a storage tenant is thousands of dollars"
- "REIT-grade tools and tactics"
- "Reach 100% occupancy"

**Confidence: HIGH** — three independent source files reinforce these patterns.

---

## 4. Pitch Voice (Investor / Acquirer / Partnership Register)

### 4.1 Audience persona

Sophisticated investor or acquirer evaluating StorageAds as a strategic asset. Vertical SaaS investors (Bessemer, Insight, Sageview). Storage-focused PE. Storable corporate development. Technical DD reviewers. Partnership leads at PMS vendors and REIT innovation teams. Industry analysts (Inside Self Storage, MJ Partners). They are not buying marketing services — they are evaluating defensibility, position, and trajectory.

### 4.2 What the reader cares about (in order)

1. Defensibility — what is the moat, and is it a moat or a head start.
2. Addressable market — TAM, ICP density, vertical depth vs. horizontal width.
3. Architectural moat — what's been built, how hard to replicate, where encoded knowledge lives in code.
4. Unit-of-revenue argument — why measuring against move-ins (not leads) changes the math of the vertical.
5. Operator-knowledge encoding — defaults, schema decisions, AI prompts that ship operator instincts as software.
6. Path to Storable acquisition.

### 4.3 Word list — USE

Demand engine · Full-funnel attribution · Cost-per-move-in (CPMI) · Unit of revenue · Server-side conversion forwarding · Meta CAPI · Google Enhanced Conversions · PMS-integrated · Operator-knowledge-encoded · Vertical SaaS · Architectural commitment · Bounded novelty · Addressable market · Defensibility · Moat · Click-to-move-in chain · Operating outside the PMS · Vertical depth · Pattern analog (ServiceTitan) · Competitive analog (Storable) · Category fit.

### 4.4 Word list — BAN in pitch copy

Agency · Marketing service · Freelancer · Retainer · Plug-and-play (undersells the architectural depth — use "architectural commitment" instead) · "The REITs have a marketing team. Now you do too." (customer-side line) · Folksy operator language — gate motors, midnight calls, sign on a chainlink fence (signals register drift) · Anything that reads small-business when the audience is evaluating a category.

**Bad in any register:** synergy, leverage, best-in-class, cutting-edge, disruptive, revolutionize, game-changer, paradigm shift.

### 4.5 Sentence rules (pitch)

- Sentences can run longer than in customer voice. Subordinate clauses are fine when they carry weight.
- Category language is required, not avoided. Use the term and define it where the reader needs it.
- Numbers should be architectural and specific: 89 Prisma models, 178 API routes, 16 identifiers in the click-to-move-in spine, 13 cron jobs, 5 auth systems. **Not $94 per move-in — that's an operator number.**
- Hedging is part of the register. "To the analyst's knowledge" is a feature, not a weakness.
- Cite the whitepaper and `WHITEPAPER_REFERENCES.md` when an architectural claim needs proof.
- Em-dashes are for tightening a clause. Customer voice leans on em-dashes; pitch voice leans on commas, colons, and semicolons.

### 4.6 The bounded novelty claim (canonical)

Lifted from whitepaper §8.6 (`analysis/08_comparison.md`):

> To the analyst's knowledge, **the combination of (a) server-side multi-platform paid-acquisition attribution forwarding (Meta CAPI, Google Enhanced Conversions), (b) PMS-data-driven operational intelligence (occupancy, ECRI candidate flagging, churn prediction), and (c) operator-language AI audits as a public top-of-funnel demand-generation tool, in a single self-storage vertical software platform operating outside the PMS, is uncommon** — because (a) is typically the domain of generalist attribution platforms lacking the PMS data connection; (b) is typically the domain of the PMS vendor itself, which has not integrated cross-platform server-side ad attribution; and (c) is typically the domain of agencies operating the audit as a sales-team service rather than as automated software.

The novelty is not "first to do X." It is "first to combine A + B + C in this vertical from outside the PMS." Each clause is hedged because public information about comparators is incomplete. **Honesty about what is unknown is part of the register, not a weakness.**

### 4.7 Comparator landscape (pitch)

| Comparator | Position vs. StorageAds |
|---|---|
| **Storable's bundled marketing modules** | Competitively closest. Architecturally constrained by being inside the PMS. Ties the marketing decision to the PMS decision. |
| **Agency model** (StoragePug, G5, StorageRankers, local digital shops) | Billable-hour economics. Infrastructure ownership flows to the vendor. No compounding software asset. |
| **Generalist attribution platforms** (Triple Whale, Northbeam, Rockerbox) | Sophisticated server-side forwarding. No PMS data connection. No vertical knowledge encoding. |
| **DIY** (Google Ads + spreadsheet) | The modal state of the 95% below REIT scale. Baseline against which the audit's "cost of doing nothing" is computed. |

StorageAds occupies the intersection none of them hold: **vertical-specific + outside the PMS + multi-platform server-side + operator-knowledge-encoded.** ServiceTitan in home services is the pattern analog. Storable in self-storage is the competitive analog.

**Confidence: HIGH** — pitch-voice.md is the most detailed source file (11 KB), with explicit comparator framework and the canonical bounded-novelty paragraph.

---

## 5. We Are / We Are Not

| We Are | We Are Not |
|---|---|
| Operators who built software | Marketers selling to operators |
| Vertical-specific (self-storage only) | A horizontal marketing platform |
| Outside the PMS | Bundled into the PMS |
| Multi-platform (Meta + Google + TikTok + LinkedIn) | Single-platform |
| Server-side attribution | Pixel-only / client-side |
| Per-facility/month pricing | Retainer / billable hours |
| Self-serve software | An agency service |
| Built for 1–50-facility operators | Built for the REITs (they already have this in-house) |
| Operator-knowledge-encoded | A generalist tool the operator has to configure from scratch |
| Honest about what's unknown | Unhedged in technical claims |

## 6. Tone-by-Context Matrix

| Surface | Register | Tone | Length | Key rule |
|---|---|---|---|---|
| Homepage hero | Customer | Plain, confident, operator-to-operator | ≤ 15 words | Lead with the frame, not the feature. |
| Landing page body | Customer | Specific, concrete, numbers over adjectives | Short paragraphs, scannable | Show the dashboard, the numbers, the move-in. |
| Audit tool output | Customer | Diagnostic, plainspoken, slightly direct | Conversational | The audit is a diagnostic, not a sales pitch. |
| Cold email to operator | Customer | Operator-to-operator, no agency tells | ≤ 90 words | Open with shared context (gate codes, lease-ups). |
| Ad copy (Meta, Google) | Customer | Punchy, numbers, no jargon | Platform-native | "Fill the place" beats "drive occupancy." |
| In-app text / portal | Customer | Crisp, functional, contractions OK | UI-minimal | Buttons say what they do. |
| Blog (operator audience) | Customer | Conversational, story-led, specific | 600–1500 words | Lead with an operator anecdote, not a stat. |
| Sales deck for operators | Customer | Direct, low-jargon | Visual-led, short copy | Show the dashboard. |
| Investor deck | Pitch | Category language, architectural specificity | One claim per slide | Cite the whitepaper. |
| Whitepaper sections | Pitch | Technical, hedged where appropriate | Long-form | "To the analyst's knowledge" is a feature. |
| Storable / acquirer one-pager | Pitch | Strategic, comparator-framed | Tight, dense | Lead with the bounded-novelty claim. |
| PMS partnership brief | Pitch | Architectural, integration-focused | Technical | Define the integration surface. |
| DD response memo | Pitch | Precise, sourced, hedged | Full citations | Reference WHITEPAPER_REFERENCES.md. |

## 7. The "When in Doubt" Tests

- **Customer voice test:** Would Nick Huber tweet this? Would Michael Wagner say it on a podcast? If no → rewrite.
- **Pitch voice test:** Would this hold up in a Storable due-diligence room? Would a vertical SaaS investor recognize the category language? If no → rewrite.
- **Register-collision test:** If the draft uses both "REITs have a marketing team" and "server-side conversion forwarding" in the same surface, **stop** — you've mixed registers. Pick one and rewrite.

## 8. Open Questions

These are unresolved or under-documented in the source material. Surface them when you hit them so guidelines can evolve:

1. **Tone for management-company white-label.** The frame is "operator-built", but management cos are intermediaries selling to facility owners on behalf of multiple buildings. Is the customer voice still operator-to-operator, or does it shift toward operator-to-management-team? Recommend: keep operator voice but add a separate "white-label" sub-register if a management-company pitch surface becomes a regular need.
2. **Tone for support / portal in-app text.** Customer voice is the default, but should error messages and onboarding tooltips lean drier and more functional than landing-page copy? Recommend: yes — apply customer voice but strip rhetorical flourishes; UI text gets short, literal, and verb-led.
3. **Use of the "$94 per move-in" example specifically.** The figure appears as a customer-voice example in `copy-voice.md`. Is this a real Blake number or illustrative? Recommend: confirm with Blake; if illustrative, replace with the actual range observed across Blake's portfolio before it ships in any external copy.
4. **Voice for the blog (when it launches).** Current voice docs cover ads, landing pages, and pitch. Blog tone — operator-audience longform — is implied but not explicit. Recommend: blog = customer voice + Blake's raw phrasing from `blake-copy-raw.md`, lead with operator anecdotes (lease-up stories, REIT competition stories), 600–1500 words.
5. **AI-generated ad creative copy.** Angelo owns ad-platform integrations and AI image/video. Does the voice apply to AI-generated ad text? Recommend: yes — any text generated for customer-facing surfaces must pass the customer voice test, including AI-drafted ad copy. Banned-word list applies to LLM prompts too.

## 9. Source Provenance

| File | Size | Used for |
|---|---|---|
| `.claude/copy-voice.md` | 4.3 KB | §3 (customer voice) — primary source |
| `.claude/pitch-voice.md` | 11 KB | §4 (pitch voice) — primary source, most detailed |
| `.claude/blake-copy-raw.md` | 1.4 KB | §3.9 (Blake's raw phrases) |
| `CLAUDE.md` | — | Top-level project frame, register-separation rule |

No external platforms (Notion, Drive, Box, Confluence, Slack, Gong, Granola) were searched — none connected at generation time. Re-run `/brand-voice:discover-brand` after connecting a document platform to expand the corpus.

---

*Generated by `/brand-voice:generate-guidelines` on 2026-05-27. Update by editing this file directly or by re-running the skill with additional sources.*
