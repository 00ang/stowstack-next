# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Voice & Copy

**Positioning is canonical.** Before any copy in any register, read [.claude/positioning.md](.claude/positioning.md). It is the single source of truth for what StorageAds is, what we lead with, and how we differentiate. The hero is marketing infrastructure that turns ad spend into move-ins; the product is the full acquisition funnel; attribution is the measurement layer underneath it, never the pitch. If a voice doc or prompt conflicts with positioning.md on message hierarchy or differentiation, positioning.md wins.

For customer-facing copy (website, landing pages, cold emails, ads, in-app text), read [.claude/copy-voice.md](.claude/copy-voice.md) before writing.

For investor, acquirer, due-diligence, partnership, or whitepaper-adjacent copy, read [.claude/pitch-voice.md](.claude/pitch-voice.md) before writing.

Supporting voice references:
- [.claude/brand-voice-guidelines.md](.claude/brand-voice-guidelines.md) — long-form, LLM-readable guidelines generated from the voice docs + this file. Load via `/brand-voice:enforce-voice` before drafting customer- or investor-facing copy.
- [.claude/blake-copy-raw.md](.claude/blake-copy-raw.md) — raw voice samples. Read when you need to hear Blake's actual phrasing.
- The `operator-copy` skill (`.claude/skills/operator-copy/`) writes/rewrites customer-facing copy in Blake's operator-to-operator voice. Prefer invoking it over hand-rolling marketing copy; it already reads the voice docs.

If unsure which register applies, ask before drafting.

## Market Data

For any customer-facing copy, audit-tool insights, blog content, ads, or investor materials that reference self-storage market conditions, occupancy benchmarks, pricing trends, regulatory context, or the acquisition environment, read [.claude/market-data-2026.md](.claude/market-data-2026.md) before drafting. Never fabricate market stats — pull from that file or our own data.

## Build & Development Commands

```bash
npm run dev            # Start dev server (localhost:3000) — next dev
npm run build          # Production build — generate-changelog + prisma generate && next build (next build type-checks)
npm run start          # Start production server
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit (type-check without building)
npm run test           # vitest run (one-shot); npm run test:watch for watch mode
npm run db:push        # prisma db push — LOCAL/DEV ONLY; never production (see Database)
npm run db:migrate:dev # prisma migrate dev — create + apply a dev migration
npm run db:migrate:deploy # prisma migrate deploy — apply pending migrations (production: explicit approval only)
npm run lint:safety    # bash scripts/check-no-data-loss.sh — blocks --accept-data-loss reintroduction
npx prisma generate    # Regenerate Prisma client after schema changes
```

**Tests:** Vitest is configured (`vitest.config.ts`, `src/test/setup.ts`). Run `npm run test`. Coverage is partial — API helpers, V1 routes, Stripe webhook, auth helpers (test files live in `src/**/__tests__/`). Verify type-level changes with `npm run typecheck` and full builds with `npm run build`.

**Never run `prisma db push` / `db:migrate:deploy` against production without explicit approval** — it can drop tables irreversibly. `npm run lint:safety` guards against `--accept-data-loss` slipping back in.

## Product Context

**StorageAds.com** — Marketing automation SaaS for the self-storage industry. Two product lines (names live in `src/app/pricing/page.tsx`): per-facility/month subscription tiers — **Launch / Growth / Portfolio** — and one-time site-build packages — **Single Site / Site + Landing Pages / Portfolio Build**. No "Enterprise" tier. Primary buyers: facility owners, operators, managers, and management companies (white-label for management cos).

**Status:** Pre-launch. Finishing build, then alpha testing. Not live with paying customers yet.

**Domain:** storageads.com (live). Deploys straight to production on Vercel — no staging environment.

**Top-of-funnel:** Free audit tool at `/audit-tool` and `/audit/[slug]`. Prospect enters facility info → gets a marketing diagnostic → "Schedule a call" to review results → sales pitch for StorageAds.

**Demo page:** Used for both self-serve demos AND live sales call demos.

**Blog:** Live at `/blog` with RSS at `/blog/feed.xml`. File-based content in `/content/blog/`, parsed by `src/lib/blog.ts`.

## Architecture

**Stack:** Next.js 16 App Router, React 19, Prisma 5 (PostgreSQL/Neon), Tailwind CSS 4, Clerk (proxy only), Stripe, Resend, Anthropic Claude API, Upstash Redis, Twilio, Sentry (error tracking + route tagging), Vercel Blob (asset storage), recharts (admin charts), framer-motion (animations), lucide-react (icons), sharp (image processing), @react-pdf/renderer (PDF reports), cheerio (HTML scraping), otpauth (TOTP 2FA), web-push, Vercel deployment.

### Authentication — Four Independent Systems

1. **Clerk** — Proxy at `src/proxy.ts` (Next 16 renamed the `middleware` convention to `proxy`) wraps all routes but marks everything public; Clerk enforces nothing — each system gates itself. **`proxy.ts` is the security layer, not just a Clerk shim:** it sets the CSP (currently `Report-Only`) and security headers, manages the `__csrf_token` cookie + enforces CSRF on mutating methods (`src/lib/csrf.ts`, `requiresCsrf()`), and tags routes for Sentry.
2. **Admin key** — `X-Admin-Key` header checked against `ADMIN_SECRET` env var. Used by all `/admin` pages and most `/api/admin-*` routes. Helper: `requireAdminKey()` from `src/lib/api-helpers.ts`. Multiple admins (Blake + Angelo are founders).
3. **Client portal** — Email + access code login. Access codes are generated when a lead status changes to `client_signed`. Session stored in localStorage. Portal pages at `/portal`.
4. **Partner/org sessions** — Email + password + org slug login via `POST /api/organizations`. Session tokens (prefixed `ss_`) stored in the **`sessions`** table (Prisma `model sessions`), 30-day expiry (`SESSION_DURATION_DAYS = 30` in `src/lib/session-auth.ts`). Helper: `getSession()` from `src/lib/session-auth.ts`, which uses raw SQL (`$queryRaw`/`$executeRaw`) against that table. Partner pages at `/partner`. Partners = both resellers and referral partners.
5. **Facility tools session** (rides on 3 and 4) — the portal login and the partner session also mint a signed, facility-scoped `sa_manage` httpOnly cookie (`src/lib/manage-session.ts`) that opens the admin facility tools for owners at `/portal/tools` and `/partner/tools`. Routes check it with `requireFacilityAccess()`. Video generation is Portfolio-plan only for owners. Details: `docs/systems/01-authentication.md` §④½.

### API Route Patterns

All API routes are in `src/app/api/`. The surface is large (~200 route directories) and grows fast — map it with `find src/app/api -type d` rather than guessing. Common patterns:

- Most public-facing routes export `OPTIONS` for CORS preflight via `corsResponse()` from `src/lib/api-helpers.ts` (not universal — don't assume every route has it)
- Admin routes call `requireAdminKey(req)` at the top
- Portal-facing routes accept `Authorization: Bearer <accessCode>` and look up the client record
- Partner routes call `getSession(req)` to validate the org session token
- Cron routes use shared `verifyCronSecret()` from `src/lib/cron-auth.ts` (fail-closed when `CRON_SECRET` is unset)
- V1 external API routes at `src/app/api/v1/` use API key auth via `src/lib/v1-auth.ts`

### Frontend Structure

- **Marketing site** — Homepage at `src/app/page.tsx` with lazy-loaded chapter components in `src/components/marketing/` (~24 component files). Light theme, Manrope font, cool-light ground (`#E0E0E5`; paper/cream is optional, not the default). Charcoal-on-light CTAs (no color accent); the logo's `ads` is slate blue via `--brand-ads` (see Design System). Copy is governed by the voice docs above (`.claude/copy-voice.md` et al.).
- **Admin dashboard** — `src/app/admin/` pages wrapped by `src/components/admin/admin-shell.tsx` (sidebar + login gate). Facility manager at `/admin/facilities` has ~48 files (~123 incl. subdirs) in `src/components/admin/facility-tabs/`, including feature subdirs (`ad-studio/`, `ad-publisher/`, `creative-studio/`, `google-ads-lab/`, `tiktok-creator/`, `occupancy-intelligence/`, `revenue-analytics/`, etc.). The ad-creation/publishing split is partially shipped via those subdirs; further menu reorganization is still on the roadmap.
- **Client portal** — `src/app/portal/page.tsx` with inline login gate. Onboarding wizard at `/portal/onboarding`. Sub-pages: campaigns, billing, reports, messaging, settings.
- **Partner dashboard** — `src/app/partner/` pages wrapped by `src/components/partner/partner-shell.tsx` (sidebar + login gate).
- **Landing pages** — Dynamic at `/lp/[slug]`, rendered from DB-stored section configs.

### Database

Prisma schema at `prisma/schema.prisma` (large — ~98 models; count with `grep -c '^model ' prisma/schema.prisma` rather than trusting a fixed number). All tables use UUID primary keys. Key models: `organizations`, `org_users`, `sessions`, `facilities`, `clients`, `shared_audits`, `landing_pages`, `drip_sequences`, `platform_connections`.

Singleton client at `src/lib/db.ts`. Raw SQL (`$queryRaw`/`$executeRaw`) is used in `src/lib/session-auth.ts` for direct `sessions`-table operations; everywhere else, use Prisma client methods.

**Migrations are the source of truth for the database.** As of 2026-10-05 `prisma/migrations` replays onto an empty database to exactly `schema.prisma`, and production's `_prisma_migrations` records every migration (`prisma migrate status` is clean). Keep it that way:
- Every schema change ships as a migration in `prisma/migrations/` — additive and idempotent (`IF NOT EXISTS`, guarded constraints), like the existing ones. Never change the schema with `db push` against production: that is how June–September changes ended up with no migration files and production drifted from the code (missing tables, broken routes).
- Apply to production with `npm run db:migrate:deploy`, with explicit approval, **before** merging code that depends on it — Prisma names every column of a model in its queries, so a declared column the database lacks breaks every query on that table.
- Known, deliberate differences between production and the schema: legacy table `audit_report_cache` (unreferenced; not dropped to avoid data loss), extra FKs on `client_invoices` / `client_messages`, and the `gbp_connections.sync_config` default.

### Design System — Light Only

**Full reference lives in [.claude/design-system.md](.claude/design-system.md). Read it before any visual/UI work.** Quick summary:

- **Palette:** Cool-light default in `src/app/globals.css` (exact values in design-system.md). `--color-dark` text, `--color-light` backgrounds (`#E0E0E5`). Paper/cream is a selectable palette, not the shipped ground. Never pure #000/#fff, never Tailwind default grays.
- **CTAs:** charcoal-on-light / light-on-dark — contrast-based, no color accent. Secondary accents `--color-blue` / `--color-green` for categorical use only; `--color-red` for errors only.
- **Gold:** banned everywhere, the logo included. The logo `ads` is slate blue via `--brand-ads` (`#446386` on light grounds, `#8EC1FF` on dark palettes). Legacy `--color-gold*` tokens exist but must not be used in new code.
- **Type:** Manrope variable font only, no second font, no italic. Numerous legacy font vars alias to `--font-manrope`.
- **Icons:** `lucide-react` is the sanctioned icon library — no others.
- **Charts:** recharts; dark=Meta, blue=Google, green=retargeting.
- No gradients, stock photos, or AI images. All emails from *@storageads.com.

### Cron Jobs

Vercel cron jobs are configured in `vercel.json`, all at `src/app/api/cron/` (~23 jobs — read `vercel.json` for the current list rather than assuming a count). Each validates `CRON_SECRET` via shared `src/lib/cron-auth.ts`.

### Key Integrations

| Service | Env Var | Used For | Notes |
|---------|---------|----------|-------|
| Anthropic | `ANTHROPIC_API_KEY` | Audit generation, copy, marketing plans, GBP responses | |
| Resend | `RESEND_API_KEY` | All transactional email | Free tier (100/day), domain: storageads.com |
| Stripe | `STRIPE_SECRET_KEY` | Billing, webhooks, checkout | |
| Twilio | `TWILIO_ACCOUNT_SID` | SMS, call tracking | Not set up yet |
| FAL.ai / Runway ML | `FAL_KEY` / `RUNWAY_API_KEY` | AI video + image generation | **Angelo's work — do not modify** |
| Upstash | `KV_REST_API_URL` | Redis caching, rate limiting | |
| Google Places | `GOOGLE_PLACES_API_KEY` | Facility lookup, audit tool | |
| Cal.com | — | Demo call booking embed | Handle is **`stowstack/30min`** (the `storageads` handle was never claimed). URL is centralized in `src/lib/booking.ts` (`CAL_BOOKING_URL` / `CAL_EMBED_SLUG`) — do not hardcode it elsewhere. |
| Meta/Google/TikTok Ads | various | Ad platform integrations | **Angelo's work — do not modify** |
| Meta CAPI / Google conversion | various | Server-side conversion events (`/api/meta-capi`, `/api/google-conversion`) | **Angelo's domain** |
| Sentry | `SENTRY_*` | Error tracking + route tagging (via `src/proxy.ts`) | |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | Asset/media storage | |

**Important:** All ad platform integrations and video/image generation tools are Angelo's domain. Do not modify these without coordination.

### PMS Integration

Phase 1 (current): Manual upload of facility management reports — **CSV only** (`accept=".csv"` in `src/components/admin/facility-tabs/pms-upload-tab.tsx`). No PDF/XLSX path and no API integrations yet.

### Data Scraping Strategy

Occupancy intelligence and market intelligence features should scrape ALL available sources aggressively (HTML parsing via `cheerio`): Google Maps, competitor websites, RentCafe, SpareFoot, Yardi, Crexi, and any other public data sources. Mix external scraped data with uploaded FMS report data.

### Path Alias

`@/*` maps to `src/*` — use `@/lib/db`, `@/components/admin/admin-shell`, etc.

## Build Priorities

1. **Alpha-readiness** — onboarding flow polish, PMS upload UX, audit-funnel conversion (prep for alpha)
2. **Feature completion** across the platform

## Team

- **Blake** — Founder, product direction, sales
- **Angelo** — Co-founder. **Owns all design decisions** — anything to do with design (visual design, brand, logo, color, type, UI/UX across the marketing site, admin, portal and partner dashboards) plus all marketing site decisions. Built facility overview tools, ad platform integrations, video/image generation. Actively contributing code daily.

## Remediation Tasks

The `tasks/` directory holds self-contained, surgical remediation specs. **Read [tasks/README.md](tasks/README.md) for the current task list, execution rules, and how to run one.** Tasks 01–23 are archived; the live set is 24+.

When told "run task NN", work ONLY on that one file, follow its steps in order, run its verification, commit as specified, then stop and report. After every task the build must pass:

```bash
npx prisma validate && npx tsc --noEmit && npm run build
```
