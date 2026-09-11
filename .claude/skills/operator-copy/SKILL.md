---
name: operator-copy
description: Write or rewrite any StorageAds customer-facing copy in Blake's operator-to-operator voice. Use when the user asks to "write copy for", "rewrite this hero/headline/CTA", "fix the copy/microcopy/wording", "draft an email/ad/landing page", "make this sound like us", "this doesn't sound right", "the copy on [page] is bad", or any request to produce or edit text that appears on storageads.com, in cold emails, in ads, on landing pages, or in marketing surfaces. Also use when editing files under src/components/marketing/, marketing-related src/app/**/page.tsx, src/components/marketing/cta-section.tsx, or email templates if the change is to user-visible copy. Do NOT use for whitepaper, investor deck, pitch, due-diligence, partnership, or acquirer content (that is a separate register, see pitch-voice.md). Do NOT use for admin UI labels, code comments, error logs, internal tool text, or code refactors that only incidentally touch strings.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash(grep:*)
  - Bash(rg:*)
---

# operator-copy

You're writing for an independent self-storage operator. 1–5 facilities. Owns or manages. 35–65. Busy, smart, skeptical. Has been pitched by agencies before and didn't like it. Knows they should be marketing more. Slightly guilty about it. Knows the REITs are out-spending them.

Voice references: Nick Huber, Michael Wagner (Storage Rebellion), AJ Osborne, Scott Meyers, Stacy Rosetti, Paul Moore. **Plain language. Operator-to-operator. No MBA words.**

## Step 1 — Load voice + positioning context

Read all three before drafting anything:
- `.claude/positioning.md` — canonical message hierarchy: the hero, the funnel pillars (the product), and attribution's demoted role. This governs *what you lead with*.
- `.claude/copy-voice.md` — full voice/word rules and right-vs-wrong examples
- `.claude/blake-copy-raw.md` — Blake's raw voice in his own words, with always-good phrases

If any file is missing, STOP and tell Blake. Do not freelance the voice or the positioning from memory.

**Lead with the funnel, not the measurement.** The product is the full acquisition system: market mapping, Meta + Google acquisition, per-ad landing pages with the storEDGE flow, reservation-to-move-in conversion, audit and ancillary revenue, toward 100% occupancy. Attribution is the proof underneath it — at most one supporting line, never the headline.

## Step 2 — Classify the surface

Different rules apply by surface. Confirm with Blake if ambiguous:

| Surface | Sentence cap | Banned-word strictness |
|---|---|---|
| Hero / above-the-fold / CTA / button | ≤ 12 words ideal, ≤ 18 max | Strictest. No demand engine, full-funnel, attribution, CAPI, server-side, ROAS, CPL, optimize, leverage, etc. |
| Body / section copy | ≤ 40 words per sentence | Same blocklist as hero |
| Email subject / ad headline | ≤ 9 words, one idea | Same blocklist as hero |
| Cold email body | ≤ 40 words per sentence, ≤ 90 words per paragraph | Same blocklist as hero |
| Deep product page / docs / help center | Relaxed | "cost per move-in", "attribution", "dashboard", "ad platforms" allowed; demand engine / full-funnel / server-side / CAPI still banned |
| Whitepaper / pitch deck / investor / acquirer | — | **STOP. Wrong skill.** Tell Blake this is pitch register — refer to `pitch-voice.md`. |

## Step 3 — Hard validator pass (run BEFORE showing anything)

Scan every draft. If anything matches, rewrite. Do not present copy that fails this pass.

**Banned anywhere customer-facing (always rewrite):**
```
demand engine, full-funnel, full-funnel attribution, closed-loop,
closed-loop attribution, ad-to-move-in attribution, cost per reservation,
server-side, CAPI
```

**Banned in hero / CTA / email / ad (allowed only in deep product/help pages):**
```
attribution, cost-per-move-in, cost per move-in, click ID, pixel, lookalike,
funnel, conversion event, ROAS, CPL, CPMI
```

**Agency / SaaS slop — banned everywhere customer-facing:**
```
engagement, impressions, optimize, leverage, solution, platform, stack,
synergy, best-in-class, cutting-edge, empower, unlock, drive, robust,
seamless, scalable, transform, revolutionize, supercharge, turnkey,
enterprise-grade, AI-powered, world-class, next-generation, holistic
```

**Positioning framing — banned everywhere customer-facing:**
- **Attribution as the lede.** If a headline, opening line, section opener, or primary differentiator is about tracking/measurement, rewrite. Attribution is at most one supporting line inside a funnel or optimization section. Lead with move-ins, occupancy, revenue, and the full system.
- **"Only ones who do X right" framing.** Drop "the only," "nobody else," "no one else does this," "the only platform/system that," and every variant when X is a measurement or attribution capability. We do not differentiate by owning a tracking term. Differentiate on the full acquisition system and on being built for storage and nothing else. Never claim we own or operate facilities.
- **Translate measurement to outcomes** (from positioning.md):
  - "closed-loop / full-funnel attribution" → "you'll know exactly which ads brought paying tenants"
  - "cost-per-move-in attribution" → "every dollar tracked to a move-in, so we cut what doesn't work"
  - "we A/B test and optimize the funnel" → "we test against move-ins, not clicks"

**Punctuation:**
- **Em-dashes (—) banned everywhere in drafted copy.** Use periods, commas, or recast. (See [[feedback_no_em_dash]].)
- No semicolons in headlines or CTAs.
- Contractions encouraged. We're, you're, don't, can't.

**Italics banned everywhere.** Manrope has no true italic glyphs and `globals.css` overrides `em`, `i`, `cite`, `.italic` to `font-style: normal`. Use **bold** or recast the sentence for emphasis.

**Pure black / pure white banned in any color references.** Use brand tokens (`--color-dark`, `--color-light`).

If your draft mentions a color, never reference sienna gold (`#B58B3F`, `--color-gold*`) — banned per design system. The only exception is the brand-locked `storage` + gold `ads` logo two-tone, and that's already coded; don't write copy describing it as the brand color.

## Step 4 — The Nick Huber test

For every hero, headline, and CTA, ask:

> Would Nick Huber tweet this? Would Michael Wagner say this on a podcast?

If no, rewrite.

Acid test for SaaS-slop: if a competitor (StoragePug, G5, SpareFoot, Storable, SiteLink marketing modules) could put the same line on their website without changing a word, it's wrong. Our voice is **storage-only, built-for-this**. Theirs is **agency-sells-this**.

## Step 5 — The frame we lead with

> Storage is the only thing we build for, and the system is the whole acquisition machine, not ads bolted onto a website. The REITs already run this. Independents haven't had the option. We turned it into software so you can plug it in.

That frame replaces the agency frame, the attribution frame, and the SaaS frame. Use it when in doubt.

## Step 6 — The competitor we're actually displacing

It's **inaction**, not StoragePug. Most prospects are paying nobody for marketing right now and feeling slightly bad about it. Copy should land on "you already knew this, here's the easy way" — never on "let us explain marketing to you."

## Step 7 — Output format (required)

Always show drafts in this exact shape. One block per option. If you produce A/B/C variants, repeat the block with the next letter.

```
SURFACE: <hero / body / cta / email-subject / email-body / ad-headline / deep-page>

ORIGINAL:
<the line(s) being replaced, or (new) if from scratch>

DRAFT [A]:
<the new copy>

WHY:
<one sentence on what frame this hits — REIT gap, operator-to-operator,
anti-agency, anti-inaction, plug-it-in, or one of Blake's raw phrases>

VALIDATOR:
- banned words: <none, or list each match>
- em-dashes: <none, or count>
- italics: <none, or count>
- max sentence length: <N words>
- Nick Huber test: <pass / fail + one-line reason>
```

If you can't write a draft that passes the validator, say so plainly — don't ship a fail.

## Step 8 — Phrases from Blake's raw voice (use when they fit)

Lifted from `blake-copy-raw.md` — always on-brand, weave in naturally, don't force:

- "infrastructure and system to ensure move-ins are being generated"
- "one-stop shop to audit your facility and find where you're leaking revenue"
- "ensuring reservations convert to move-ins"
- "adding ancillary revenue streams"
- "lifetime value of a storage tenant is thousands of dollars"
- "REIT-grade tools and tactics"
- "reach 100% occupancy"
- "a sign on a chainlink fence is not an acquisition strategy" (Blake's tagline instinct)
- "fill the place" / "fill units"
- "the REITs have a marketing team. Now you do too."

Vocabulary always allowed: fill units, move-ins, trade area, gate, lease-up, operator, facility, plug it in, turn it on, the REITs, independent, what it costs, what you got, one dashboard, no retainer, no agency, no mystery.

## Step 9 — Refusal cases

Push back, don't comply, if Blake (or anyone) asks you to:

- **"Make it sound more professional"** → ask which surface. If it's customer-facing, the answer is no. Offer a Nick Huber-style rewrite instead and explain why "professional" usually means "agency-slop" for this audience.
- **"Add more marketing terms"** → no. This skill exists specifically to prevent that.
- **"Make it more enterprisey"** → if customer-facing, no. If it's actually for an enterprise sales motion or investor doc, redirect to the pitch register (`pitch-voice.md`).
- **"Use AI/cutting-edge/world-class to make it stand out"** → no. Banned. Suggest the concrete-outcome version instead ("$94 per move-in", "filled 17 of 23 vacant units in 60 days").
- **"Write it the way StoragePug/G5 would"** → no. That's the voice we're displacing.

When you refuse, do it in one sentence, then provide the on-voice alternative immediately. Don't lecture.

## Step 10 — Files to edit, not files to create

Prefer editing existing components over creating new ones:

- Marketing chapters live in `src/components/marketing/` — hero.tsx, problem-statement.tsx, four-way-comparison.tsx, results.tsx, cta-section.tsx, faq.tsx, pricing-calculator.tsx, etc.
- Landing pages are DB-driven via section configs at `/lp/[slug]` — copy edits there go through the landing-page builder, not source files.
- Email templates live wherever Resend templates are stored (search `src/` for `resend` or template files before assuming).

Do not create new marketing components when an existing chapter would hold the copy.

## Final checklist before responding

- [ ] Voice docs were actually read this turn (not assumed from memory)
- [ ] Surface classified
- [ ] Validator pass run on every option
- [ ] WRONG → RIGHT (or ORIGINAL → DRAFT) shown so Blake can see what changed
- [ ] WHY references the frame, not just "this reads better"
- [ ] Nick Huber test marked pass with a one-line reason
- [ ] No em-dashes anywhere in the response (including your prose around the draft)
