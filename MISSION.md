# MISSION.md — the gated build sequence

**This is the gate document.** `next.md`, `continue.md` and `.claude/commands/continue.md` all
resolve priority from this file: *"Current gate = lowest unchecked step. At/below it is in scope;
above it is forbidden."* Until now it did not exist, and every agent workflow in the repo was
pointing at nothing.

**Interactive version, with comment threads:**
https://claude.ai/code/artifact/cdac036d-c074-4d32-ad8d-88d878025cbf
Same content, plus per-capability comments and filters. **This file is canonical for gates**; the
artifact is where Angelo and Blake argue about them. Capability ids (`s1`, `r4`, `m6` …) are shared
between the two — keep them in sync.

**Relationship to the other docs.** `OVERVIEW.md` is what the company is. `STRATEGY.md` is marketing
doctrine. `.claude/positioning.md` wins on message hierarchy. `COMPLIANCE.md` is the legal surface.
`BLOCKERS.md` is what got abandoned after three attempts. `PROGRESS.md` and `CHANGELOG.md` are
history. **This file is the only forward-looking status doc** — if it disagrees with a stale note
elsewhere, this wins, and the disagreement gets logged in §7.

---

## 0 — How to read a step

- `- [ ]` unchecked = not done. **The lowest unchecked step in §3 is the current gate.**
- A step is DONE only when every acceptance criterion under it is true end to end. Code that
  compiles but is not wired is not done.
- State markers describe **what exists in the code today**, not what is planned:
  `SHIPPED` · `PARTIAL` (data layer or near-miss exists) · `SPEC` (designed, unbuilt) ·
  `NONE` · `BLOCKED` (stopped by something outside the code).
- `⚡SCALE` marks a capability that breaks at a twenty-facility account.

> **Provenance.** The states in §2 and §3 were derived on 2026-08-30 by reading
> `prisma/schema.prisma` (101 models), the route tree, and the PostcardRobot mail system —
> **not by running the app.** Anything marked PARTIAL is an inference from the schema and should be
> confirmed the first time someone opens it. Correct this file rather than working around it.

---

## 1 — The goal

Six modules — **RESPOND · REACH · MAIL · CONVERT · RETAIN · PROVE** — sold as one platform to
self-storage owners, at $497 / $1,497 / $2,497 per facility per month. Storage first, to cut teeth
and learn the pain points. Other verticals later, off the same spine.

**The one number underneath all of it: cost per move-in, by channel.** Every module exists to move
it or to prove it.

**The load target: a twenty-facility portfolio account.** Some owners have 20+ facilities, and the
platform must absorb one without degrading every other customer. That constraint, not feature
count, sets the build order below.

---

## 2 — Where the code actually is

Modules v2 reads like a greenfield plan. It is not. **101 Prisma models already exist**, and roughly
half of REACH, CONVERT, RETAIN and PROVE has a data layer today.

| Already substantial | Tables |
|---|---|
| PMS ingestion | `facility_pms_units · rent_roll · aging · length_of_stay · rate_history · revenue_history · snapshots · specials · tenant_rates` |
| Google Business Profile | `gbp_connections · posts · insights · profile_sync_log · questions · reviews` |
| Call tracking | `call_tracking_numbers · call_logs` (tracking, **not** answering) |
| Paid media | `client_campaigns · campaign_spend · ad_variations · creative_briefs · platform_connections · assets` |
| Landing pages | `landing_pages · landing_page_sections` |
| Lifecycle | `drip_sequences · drip_sequence_templates · delinquency_escalations · moveout_remarketing · churn_predictions` |
| Referral | `referral_codes · referral_credits` |
| Reporting | `client_reports · pms_reports · marketing_plans · facility_market_intel · places_data` |
| Tenancy & partners | `organizations · org_users · sessions · api_keys · audit_log` |

**MAIL is not a module to build — it is a working system to connect.** PostcardRobot
(`~/Desktop/robopostcards`) already has guarded ingest, an append-only money ledger with replay
protection, debit-before-submit ordering, fail-closed vendor gates, a global do-not-mail registry,
signed approval links, idempotent sends, a production render pipeline and Stripe billing.

### The six findings that set the build order

1. **There is no job queue.** Zero of 101 models is a work queue. Everything runs on cron inside
   serverless functions capped at **300 seconds**. A portfolio mail drop, a twenty-facility PMS sync
   or a review sweep across 12,000 units cannot finish in one invocation. *Largest single scale risk.*
2. **`facilities.organization_id` is nullable** (`prisma/schema.prisma:444`). 64 tables scope by
   `facility_id`, but a facility can exist with no owner — so every portfolio roll-up and org authz
   check has a null path through it.
3. **`organizations.facility_limit` defaults to 10.** A twenty-facility owner trips the plan ceiling
   on signing day.
4. **Mail throughput is capped at 50 pieces/min company-wide, and the obvious fix has a price.**
   Thanks.io takes a `recipients[]` array, but **every creative field — front, message, QR — is
   order-level**, so batching means one QR across the whole batch and the loss of per-card
   attribution. ⚠️ *Corrected 2026-09-02; the original entry called this a free ~100×.* Four
   options, none of them free except possibly `sub_account` sharding. See `s-mail-batch` and §4.
5. **Four of the ten MAIL triggers do not exist**, and the distress ones that do are gated. See §5.
6. **White-label is already half-modelled** — `organizations.white_label`, `rev_share_enabled`,
   `rev_share_pct`, `rev_share_tier`, `lifetime_earnings`, `payout_method`, `custom_domain`.
   Finish it; do not design it again.

---

## 3 — The gated build sequence

### Phase A — the spine  ⟵ **CURRENT GATE**

Nothing above this line ships to a portfolio account. These are the pieces every module leans on.

- [x] `s1` **Durable job queue with resumable workers** — **DONE** — ⚡SCALE
  Shipped 2026-09-02: `jobs` table + `src/lib/jobs/{types,queue,runner,handlers}.ts` +
  `GET /api/cron/jobs` (every minute, `maxDuration = 300`). Postgres-backed — `FOR UPDATE SKIP
  LOCKED` — rather than a broker, so no new service to operate.
  *Acceptance, item by item:*
  - [x] survives a 300s boundary — the runner stops claiming inside a 30s headroom and a handler
        returns `{ kind: "more", cursor }` to be resumed next minute
  - [x] a crash mid-run resumes without repeating work — lease expiry reclaims the row and the
        cursor survives; **proven against production**, 14 checks
  - [x] at-least-once with idempotent handlers — `dedupe_key` unique per queue; re-enqueue is a no-op
  - [x] outcome-unknown **freezes and is never retried** (`OutcomeUnknown`) — the PostcardRobot
        lesson, ported rather than relearned
  - [x] fair-share ordering by per-tenant in-flight count, so one portfolio drop cannot starve
        every other customer (the `s2` seam, already load-bearing)
  - [x] **per-job progress inspectable in `/admin`** — shipped 2026-09-04: `/admin/jobs` (System →
        Job Queue) over `/api/admin-jobs`. Queue depth by status, anything frozen or failed with its
        error, expired-lease count, and a **Release** action — deliberately manual, because freezing
        exists so a person decides whether an unknown outcome is safe to retry.
  - [x] **retention** — added after watching production: the detectors complete ~800×/day and each
        left a `done` row (~290k rows a year). `jobs.prune` keeps 7 days, deletes in bounded batches
        and yields between them, so the tidy-up cannot lock the table the worker claims from.
- [ ] `s2` **Per-tenant fair-share budgets on every shared resource** — **HALF DONE** — ⚡SCALE
  - [x] **Job scheduling is already fair-shared** — shipped with `s1`. The claim orders by
        per-tenant in-flight count, not FIFO, so one portfolio account cannot occupy every worker
        until its drop drains. Proven against production: a busy tenant yields to an idle one
        despite being ten minutes older.
  - [ ] **Vendor budgets** — mail throughput, SMS TPS and voice lines each need a per-tenant floor.
        ⚠️ **Deliberately not built yet: none of those vendors is connected.** Thanks.io is behind
        the `s-mail-batch` decision, and there is no SMS or voice provider at all (`s5`). A rate
        limiter for a vendor that does not exist is a guess about its shape. Build each one with
        its integration, not before.
- [ ] `s3` **Stop prospect facilities leaking into org-scoped views** — RE-SPECCED — ⚡SCALE
  ⚠️ **Corrected 2026-09-02. The original task — "make `organization_id` NOT NULL" — was wrong and
  must not be run.** Measured against production:

  | | |
  |---|---|
  | `facilities` | **29** |
  | with `organization_id` NULL | **29 — all of them** |
  | `organizations` | **0** |
  | `org_users` | **0** |
  | pipeline | `lost` 19 · `submitted` 6 · `audit_sent` 3 · `diagnostic_submitted` 1 |

  **`facilities` is the audit-tool lead table, not a customer's facility roster.** Every row is a
  prospect from the free funnel at `/audit-tool` — including obvious test rows (Test Facility, QA
  Test Facility, ACME SELF STORAGE ×4). Nineteen of 29 are `lost`. **The nullable column is correct
  by design:** somebody who runs the free audit has no organization, and a NOT NULL constraint would
  break the entire top of funnel. Every row violates it today, so the migration cannot even apply.

  *The underlying concern is still real, but it is a query-discipline problem, not a migration.*
  **Acceptance:** no org-scoped query can return a facility whose `organization_id` is null or
  belongs to another org; `boundaries.test.ts` covers both cases; if an "owned" state is ever
  distinguishable from a prospect state, enforce it with a CHECK on that state, never on the column.
- [ ] `s4` **Portfolio plan tier — raise `facility_limit` past 10** — PREMATURE — ⚡SCALE
  ⚠️ **Corrected 2026-09-02.** There are **zero `organizations` and zero `org_users` in production** —
  the org/partner system has never been used. Raising a default nobody has hit yet is not the work;
  the work is that the first portfolio org can be created at all. Keep the item, drop it out of
  Phase A, and revisit when org #1 exists.
  *Acceptance (unchanged):* a 20+ facility org can be created and billed; the tier has a price in
  `src/app/pricing/page.tsx`; limit enforcement has a test.
- [ ] `s-mail-batch` **Batch `recipients[]` on the mail provider** — BLOCKED ON A PRODUCT DECISION — ⚡SCALE
  ⚠️ **Corrected 2026-09-02. The original framing of this task was wrong** — it is not a contained
  engineering change. Verified against `THANKS.IO openapi.json`:

  | Order-level (shared by every piece) | Per-recipient (all that can vary) |
  |---|---|
  | `front_image_url` · `image_template_id` · `message` · `message_template_id` · **`qrcode_url`** · `custom_background_image` · `handwriting_*` · `sub_account` · return address | `name` · `company` · `address` · `address2` · `city` · `province` · `postal_code` · `country` · `dob` · `anniversary` · `email` · `phone` · `custom1`–`custom4` |

  **Every creative field is order-level.** Batching N cards into one order gives all N the same
  front, the same message and **the same QR code** — which destroys per-card attribution, the thing
  `CONTEXT.md` calls the differentiator. The only merge variable that appears anywhere in the spec
  is `%FIRST_NAME%` (examples only); the captured vendor docs document none at all.

  **Resolve one of these before writing code — see the open decision in §7:**
  - **(A) Batch and move attribution from card → order.** Full throughput multiplier. You learn
    which *batch* booked the job, not which household. Changes the final `/r/[code]` shape.
  - **(B) Do not batch.** Preserves per-card attribution. 50 pieces/min stands, so `s2` fair-share
    becomes mandatory and a large drop is spread over days — which a 5-touch/24-day cadence
    tolerates naturally.
  - **(C) Batch, carry the per-piece code in `message` via a merge variable.** QR goes batch-level,
    promo code stays per piece. **Depends on `%CUSTOM1%`-style substitution that is undocumented.**
    One `preview: true` call settles it and creates no order.
  - **(D) Shard across `sub_account`s.** `sub_account` is a documented order field. If the 60/min
    limit is per sub-account rather than account-wide, throughput multiplies **with no attribution
    tradeoff at all.** One email to the vendor settles it. **Cheapest possible win — ask first.**
- [x] `s7` **Event bus / outbox for lifecycle events** — **DONE** — ⚡SCALE
  Shipped 2026-09-03: `domain_events` + `src/lib/events/{types,bus,subscribers,detect}.ts`,
  delivered through the `s1` queue as one job per subscriber. Detection diffs two
  `facility_pms_rent_roll` snapshots — the only history this product actually keeps.
  *Acceptance, item by item:*
  - [x] **move-in · move-out · delinquent · rate-change** emitted from real PMS diffs
  - [x] **emitted once, durably** — `source_key` is the identity of the *fact*, not of the
        detection run, so re-uploading the same CSV emits nothing new. **Proven against
        production:** a second full run wrote 0 events and 0 duplicate jobs
  - [x] **consumable by more than one subscriber** — one `jobs` row each, so a failing subscriber
        cannot hold up the others; 6 events fanned out to 12 jobs across 8 queues
  - [x] delivery inherits retry, backoff, freeze-on-unknown and fair-share from `s1`
  - [x] **recurring work actually runs** — `src/lib/jobs/schedule.ts` seeds detection from the
        worker itself, idempotent per time bucket. Without it the handlers existed and nothing
        ever enqueued them. One cron entry drives everything rather than a 24th `vercel.json` row.
  - [x] **`inventory.available` (unit vacated)** — unblocked 2026-09-03 by
        `facility_pms_unit_history`. `facility_pms_units` is read by 25 files and written by 4, so
        it was left alone entirely: the detector copies the mix into history whenever the source
        timestamp moves, and diffs the last two captures. **Proven against production** (13 checks)
        — fires on the zero-to-something edge only, ignores a size that already had vacancy, and
        re-detection emits nothing. RESPOND `r9` / CONVERT `c6` now have their X.

  **Visible since 2026-09-04:** `/admin/events` (System → Events) shows the stream, what each event
  fanned out to, and the queues holding work with no handler yet.

  > **The subscriber map is now the wiring diagram.** `mail.welcome-kit`, `retain.autopay-push`,
  > `retain.delinquency-notice`, `mail.rate-increase-letter`, `mail.winback-schedule` and the rest
  > are registered with no handlers yet — an unregistered queue *freezes* rather than fails, so the
  > work accumulates visibly and is re-deliverable the day each handler ships.
- [x] `s8` **Portfolio attribution without the N+1** — **DONE** — ⚡SCALE
  ⚠️ **Corrected 2026-09-03. "Compute nightly roll-up tables" was the wrong fix.** I benchmarked
  the shipped query in `/api/attribution` against a seeded portfolio — 20 facilities, 30,000 leads,
  3,600 spend rows, a realistic year — instead of assuming:

  | | |
  |---|---|
  | one facility (the shipped query) | **38 ms** |
  | 20 facilities **looped** — what a portfolio dashboard does today | **1,553 ms** |
  | 20 facilities in **one grouped query** | **100 ms** |
  | full cube: facility × month × campaign × source | **552 ms** |

  **Live aggregation is not the problem. The N+1 loop is.** One grouped query is **15× faster**
  than looping the per-facility one, and 100 ms needs no precomputation, no nightly job, no
  staleness and no cache invalidation. Roll-up tables would have been real machinery bought to
  solve a problem the numbers say does not exist yet.

  *Acceptance, item by item:*
  - [x] **one grouped query, not one per facility** — shipped 2026-09-04 as
        `src/lib/attribution/portfolio.ts` + `GET /api/attribution/portfolio`. **Two queries for
        the whole portfolio regardless of size**, not two per facility.
  - [x] **measured, not assumed** — re-benchmarked against the real implementation on a seeded
        20-facility portfolio: **1,507 ms looped → 56 ms grouped, 27× faster**, and the grouped
        totals match the loop exactly on spend, leads, move-ins and revenue. A faster query that
        disagreed would be worthless, so equality is asserted, not hoped for.
  - [x] the single-facility route is **untouched** — its campaign-cohort join carries a "must not
        change" note and belongs to the ad-platform integration, so portfolio sits beside it
  - [x] **an admin UI consuming it** — shipped 2026-09-04: `/admin/attribution` (Intelligence →
        Cost per Move-in). Correction to the earlier note: `/admin/portfolio` does **not** loop — it
        reads the pre-aggregated, client-scoped `client_campaigns` table. The facility-level
        portfolio view simply did not exist, so this adds it rather than replacing anything.

  **Revisit precomputation only when a measurement justifies it** — on these numbers that is
  somewhere well north of 300k leads, and it is a decision to make with real data.
  ✅ **Unblocked 2026-09-04** — the `campaign_spend` write bug is fixed, so spend can land and the
  read path is worth optimising. And note the dimensions in the original wording were fiction:
  there is no ZIP on leads, no creative column on spend, and no card dimension at all until
  PostcardRobot is connected. Channel and campaign are what exist.

- [ ] `s9` **Idempotency discipline on anything that spends or sends** — NONE — ⚡SCALE
  *Acceptance:* intent row written before the call; unique index on the provider id; outcome-unknown
  freezes rather than retries. **Port the PostcardRobot pattern — do not reinvent it.**
- [x] `s5` **Messaging layer — SMS + voice behind one interface** — **DONE** — ⚡SCALE
  Shipped 2026-09-04: `src/lib/messaging/{types,sim,twilio,index,send}.ts` + `message_log`,
  `message_optout`. Twilio when keyed, sim otherwise, and it says which out loud — a silent
  fallback to sim looks like success while nobody receives anything.
  - [x] one seam; **only `twilio.ts` imports the vendor** (the `PrintProvider` rule)
  - [x] **live is double-gated** — credentials AND `MESSAGING_LIVE=true`, an operator attestation
        that the 10DLC brand and campaign are registered. Credentials alone are not consent to text
        real people; an unregistered campaign gets filtered or fined rather than delivered.
  - [x] **intent row written before the vendor is called** — a crash between send and record would
        otherwise let a retry text a real person twice. Ported from the mail system.
  - [x] **outcome-unknown freezes, never retries**; a 4xx is definitive and fails cleanly
  - [x] **one opt-out registry, forever, everywhere** — global by phone, checked before every send,
        recorded as `suppressed` rather than silently dropped
  - [x] **quiet hours** — 8am–9pm recipient-local, skipped rather than assumed when the timezone is
        unknown, because assuming UTC is how you text somebody at 3am
  - [x] **inbound handled** — `POST /api/sms-webhook`, Twilio-signature verified. STOP writes the
        opt-out registry *and* cancels the person's waitlist entries; START resubscribes; HELP
        identifies the sender and mentions rates as carriers expect; YES takes a hold. **Until this
        existed our own copy was a lie** — every message said "Reply STOP" and nothing honoured it.
  - [ ] per-brand 10DLC registration state modelled and visible — deferred with white-label; there
        are no partners yet, so its shape would be a guess.
- [ ] `s6` **PMS adapter interface — storEDGE / SiteLink / Storable** — PARTIAL — ⚡SCALE
  *Acceptance:* one contract, one adapter per vendor; webhooks preferred over polling; a shared
  scheduler with per-facility cursors and vendor-aware backoff. Today's `facility_pms_*` tables are
  upload-driven.
- [x] `s10` **Unit-level hold / reservation lock** — **DONE**
  Shipped 2026-09-04: `unit_hold` + `src/lib/respond/hold.ts`. Real availability is PMS vacancy
  minus the holds we carry — the PMS is updated by upload, minutes to hours behind, so it cannot
  arbitrate a race happening on two phone calls right now.
  - [x] **two concurrent callers cannot book the same unit** — the insert is gated on availability
        inside one statement, so there is no check-then-insert window. **Proven against production:
        8 simultaneous attempts for the last unit, exactly 1 won.**
  - [x] **holds expire** — and availability ignores a lapsed hold *immediately* rather than waiting
        for a sweep, because a free unit that looks taken until a cron runs is a lost rental.
        `holds.expire` runs every 5 minutes purely to keep the operator view honest.
  - [x] one person cannot accumulate holds on the same size by replying twice
- [ ] `s11` **Decide: absorb PostcardRobot, or keep it behind an API** — SPEC
  *Recommendation:* keep it separate behind an API. It already has a public-API task on its roadmap
  and it is the only part of the stack that spends real money on every call. **Log the decision in §7.**

- [ ] `s12` **Visitor, Touch and move-in write-back** — PARTIAL — ⚡SCALE
  Added 2026-10-04 ahead of the gate, by Angelo's decision (§7). Attribution is a chain of links —
  click → visit → lead → call → move-in — and until now the first link was a localStorage blob that
  overwrote itself on every new click and that Safari erased after seven days without a visit.
  **Built:** `visitors` · `touches` · `conversion_reports` (migration `20261004_visitors_touches`,
  **not yet applied to production**); the server-set `sa_vid` cookie on `/api/tracking/visit`; a
  touch per arrival that carries a source, plus one per inbound call; visitor → lead linking on all
  three lead routes; `lead.moved_in` on the event bus from a confident match; `prove.meta-conversion`
  (CAPI Purchase, `physical_store`) and `prove.google-conversion` (a real offline click-conversion
  upload — `/api/google-conversion` only pings the browser pixel from the server, and nothing calls
  it) on the job queue.
  *Acceptance, item by item:*
  - [x] first and latest touch are queries over append-only rows, never overwritten fields —
        `src/lib/attribution/touch.ts`, tested
  - [x] gbraid / wbraid / msclkid captured; referrer and full landing URL kept per touch
  - [x] a bare direct revisit writes no row — one write per sourced arrival, not per pageview
  - [x] every write-back attempt leaves a `conversion_reports` row: sent, skipped with a reason, or failed
  - [x] retries cannot double-count — Meta's event_id and Google's order_id are `movein:<tenant id>`
        on every attempt, and both platforms drop the duplicate
  - [ ] migrations `20261004_visitors_touches` + `20261004_rent_roll_contact` applied to
        production — needs explicit approval (CLAUDE.md)
  - [x] write-back settings in the admin: Publisher → connection card → "Move-in reporting" (Meta
        pixel; Google move-in conversion action and manager account), validated, merged into
        connection `metadata` (`PATCH /api/platform-connections`)
  - [ ] those settings filled in for each live facility — a Google conversion action is required
        before any Google report can go
  - [x] **the CSV PMS upload matches leads** — `unit.moved_in` → `prove.match-move-in` finds or creates
        the tenant and runs the same matching as the V1 API. Needs phone or email in the export
        (new optional rent-roll columns); without them nothing changes and no tenant row is created
  - [x] a matched move-in writes `monthly_revenue` and `move_in_date` onto the lead — before this,
        every matched move-in counted as $0 in cost per move-in
  - [x] operator surfaces: lead journey (`/admin/consumer-leads/[id]`), Move-in Reports
        (`/admin/conversions`) with grouped fixes and retry, and the same groups in the Console's
        Needs-attention feed
  - [ ] proven end to end on one facility: a real ad click → move-in → a `sent` row on both platforms

### Phase B — RESPOND

The new revenue and the actual differentiator. Inventory already lands from the PMS, which is the
hard half. Gate: Phase A complete.

- [ ] `r1` AI voice agent quoting live sizes and prices — NONE — reads `facility_pms_units`
- [ ] `r2` Reservation + payment link by text mid-call — NONE — ⚡SCALE — needs `s10`
- [x] `r3` Missed-call text-back in 5 seconds — **DONE** — sent **inline from the Twilio status
      callback**, not from the queue: the worker runs once a minute, and a text a minute late reaches
      somebody who has already called a competitor. The queue is the durable fallback when the inline
      send fails, not the path. Counts `no-answer`/`busy`/`failed`/`canceled` **and a `completed`
      call under 15s** — Twilio reports `completed` for voicemail-then-hangup, which the caller
      experienced as a missed call. One text per caller per hour however many times they redial.
- [ ] `r4` AI chat trained on the facility — SPEC — `facility_context` is the knowledge source
- [x] `r5` Speed-to-lead under 60 seconds on every form — **done 2026-09-05** —
      `src/lib/respond/speed-to-lead.ts`. Two messages, inline on the submit request: an
      acknowledgement to the lead, and an alert with their phone number to the operator, because the
      thing that actually rents a unit is a human calling back. Wired into `/api/consumer-lead`,
      `/api/lead-capture` and `POST /api/v1/leads`. Latency is stamped on `partial_leads.first_response_at`
      and measured against `converted_at`, so PROVE has a real speed-to-lead number.
- [x] `r6` Tour booking with 24h and 1h reminders — **done 2026-09-05** — `facility_tours` +
      `src/lib/respond/tour.ts` + `POST /api/tour`. Booking confirms by text immediately; reminders are
      SWEPT from the tour row (not pre-scheduled jobs) so a reschedule cannot leave a stale reminder
      pointing at the old time. Quiet hours are gated in the facility's own zone.
- [x] `r7` No-show recovery same day — **done 2026-09-05** — `sweepNoShows` marks the tour and offers to
      rebook, only while it is still the same calendar day where the customer is.
- [x] `r8` Abandoned online rental rescued within 10 minutes — **DONE** — ⚠️ **and it did not
      replace anything.** `/api/cron/process-recovery` is already 361 lines of multi-step EMAIL
      recovery running daily; that system is untouched. This adds the leg it cannot cover — a text
      inside a 10-to-120-minute window, checked every 5 minutes. After two hours the email sequence
      owns the lead. **No new column:** `message_log` already records what we sent, so the dedupe key
      is both the idempotency guard and the "have we rescued this" answer, and cannot drift from it.
- [~] `r9` Sold-out waitlist, auto-notify, payment link — **CAPTURE → NOTIFY → HOLD DONE** — `unit_waitlist`
      + `respond.waitlist-notify`. **The first capability that runs end to end with no human in it:**
      a PMS upload changes the mix → `inventory.available` → job → text. Proven against the real
      database with the real modules (6 checks): baseline emits nothing, only the zero-to-something
      edge fires, the list is texted oldest-first, a replay sends nothing, and an opted-out number is
      never texted even when it is the only match.
      **Capture shipped 2026-09-04:** `POST /api/waitlist` — public, deduped per number+size, and
      it refuses to add somebody who has opted out of the texts the list exists to send. It also
      tells a joiner if the size is actually free right now rather than making them wait for a text.
      **Confirm shipped:** replying YES takes a real hold (`s10`) and converts the entry.
      **Still missing:** the payment link, which needs Stripe.
- [x] `r10` Spanish flows throughout — **done 2026-09-05** — `src/lib/messaging/copy.ts` holds every
      template as a `Templates` interface implemented once per language, so a template added in English
      and forgotten in Spanish is a compile error. `contact_language` (keyed by phone, like the opt-out
      registry) stores the preference; a Spanish reply teaches it, a form statement outranks a reply, an
      operator outranks both. Spanish opt-out keywords (PARAR/ALTO/CANCELAR/SALIR/BAJA) are honoured —
      they had to be, because our own Spanish copy tells people to send them.
- [ ] `r11` Overflow routing to a human — NONE — ⚡SCALE — **the pressure valve that makes voice
      concurrency caps safe. Build it with the agent, not after.**

### Phase C — MAIL

Connect a working system; unblock the triggers. Gate: `s11` decided, `s-mail-batch` shipped.

- [ ] `m1` Prospecting triggers, 5 touches ~24 days apart, First Class — BLOCKED — ⚡SCALE — see §5
- [ ] `m2` Welcome kit with gate code and map on move-in day — NONE — needs `s7`
- [ ] `m3` Referral card in month two — NONE — `referral_codes` exists
- [ ] `m4` Winback at 6, 12 and 24 months after move-out — PARTIAL — `moveout_remarketing`
- [ ] `m5` Rate-increase letter softened with a referral offer — NONE — `facility_pms_rate_history`
      gives the trigger. **Turns the most churn-inducing letter in storage into a referral ask.**
- [ ] `m6` Lien and auction notices — NONE — ⚠ statutory, state-specific. **Counsel before it sends.**
- [ ] `m7` Handwritten-style notecards for commercial and RV — NONE — `handwriting_style_id` is
      **already a parameter on the Thanks.io send call**. Close to free, premium price.

### Phase D — finish the bones

Highest value per hour in the plan: these have data layers already. Mostly configuration and UI.

- [ ] `t4` Autopay enrolment push in month one — NONE — **biggest churn reducer in storage, unbuilt**
- [ ] `t1` Review engine, 3 days post-move-in — PARTIAL — ⚠ **fix the routing first, see §5**
- [ ] `t3` Delinquency at 5/10/15 days with payment link — PARTIAL — easiest ROI story in the platform
- [ ] `t2` AI drafts review responses — NONE — owner approves, never auto-post
- [ ] `t5` Insurance and lock upsell at move-in — NONE
- [ ] `t6` Referral program, both sides free month — PARTIAL
- [ ] `t7` Exit survey with counter-offer — NONE — `churn_predictions` targets it
- [ ] `t8` Anniversary touches — NONE
- [ ] `c3` storEDGE rental embed — reserve and pay in page — NONE — the one hard CONVERT integration
- [ ] `c6` Price-drop and back-in-stock alerts — NONE — shares waitlist machinery with `r9`
- [ ] `c7` Exit-intent offer — NONE
- [ ] `c8` QR yard signs on fence line and gate — NONE — free drive-by traffic; needs per-sign codes
- [ ] `c1` Branded site scoring 90+ on mobile — PARTIAL — measurement task
- [ ] `c2` One landing page per ad — PARTIAL
- [ ] `c4` Size calculator ending in "reserve this unit" — PARTIAL — `/calculator` exists
- [ ] `c5` Live unit availability with price — PARTIAL — ⚠ freshness depends on `s6`
- [x] `c9` Google Business Profile built and posting weekly — SHIPPED — six GBP tables
- [ ] `p1` One dashboard, cost per move-in — PARTIAL — ⚡SCALE — needs `s8`
- [ ] `p6` Revenue attributed, not leads counted — SPEC — ⚡SCALE — data layer is `s12`
- [ ] `p8` Portfolio roll-up for multi-facility owners — PARTIAL — ⚡SCALE — needs `s8`
- [ ] `p2` Tracked number and QR on every asset — PARTIAL
- [ ] `p3` Call recordings — PARTIAL — ⚠ two-party consent states need an announcement
- [ ] `p4` Occupancy trend against their market — PARTIAL
- [ ] `p5` Competitor rate tracking, monthly — PARTIAL — ⚠ ToS exposure depends on collection method
- [ ] `p7` Monthly branded "State of Your Market" report — PARTIAL — retention + referral in one PDF

### Phase E — widen

Gate: one facility fully attributed end to end.

- [ ] `h2` Competitor conquesting inside 1 mile — NONE — `places_data` already finds them
- [ ] `h3` Geofenced audiences — U-Haul, apartments, dorms, permits — NONE
- [ ] `h4` Just-sold retargeting synced to the ZIPs the mail hits — NONE — ⚠ see PII note in §5
- [ ] `h5` Seasonal autopilot — May move-out, October snowbirds, pre-winter RV — NONE
- [ ] `h6` Lease-up mode for new builds — NONE
- [ ] `h1` Meta and Google management — PARTIAL
- [ ] `h7` Past-tenant reactivation audiences — PARTIAL — `moveout_remarketing`
- [ ] `h8` Creative engine — UGC, drone, before/after — PARTIAL
- [ ] `v1` **Vertical seam** — domain layer speaking `Location` / `InventoryItem` — NONE — see §6
- [ ] `v2` White-label GA + per-partner 10DLC pipeline — PARTIAL

---

## 4 — Scale: the numbers

**The thesis: capacity is not the problem, fairness is.** You hit *vendor* limits long before
hardware, and each one is a single shared budget spent across all customers at once. The failure
mode is not slowness — it is **one portfolio customer's Tuesday making fifty other customers'
Wednesday late.**

### What scales with what

| Resource | Scales with | A 20-facility account |
|---|---|---|
| Mail throughput | prospect universe × touches | **The big one.** |
| Dashboard aggregation | facilities × attribution dimensions | **Worst case — combinatorial.** |
| SMS volume | unit count × lifecycle events | Proportional, predictable |
| PMS API calls | facility count | Exactly 20× — and multiplied again per customer |
| Database rows | unit count × event rate | Large but boring; `facility_id` is well indexed (72 index entries across 64 tables) |
| Voice concurrency | **customer count, not facility count** | **Barely moves.** Calls spread across the day |

> **Do not fear the voice bill from a big account.** Fear the mail window and the dashboard query.

### Chokepoint register

| Chokepoint | Limit today | Breaks when | Fix |
|---|---|---|---|
| **Mail API** (Thanks.io) | 60 req/min **account-wide**, throttled to 50. One recipient per call. ≈2.16M cards/month company-wide | **Immediately.** A 50,000-piece run is 50,000 calls = **16.7 hours** of the company's entire mail capacity, everyone else queued behind it | ⚠️ **Not simply "batch it"** — see `s-mail-batch`. Batching costs per-card attribution because every creative field is order-level. Probe `sub_account` sharding (D) first: it is the only option with no product tradeoff |
| **Job runtime** | Vercel functions cap at 300s. **No queue.** | Any run over 300s | `s1` — prerequisite for most of this table |
| **PROVE roll-ups** | Live joins across `facility_id IN (…)` × 5 dimensions | 20 facilities × cost-per-move-in by channel/card/ad/creative/ZIP | `s8` nightly roll-ups |
| **PMS APIs** | Per-connection vendor limits | 100 customers × 20 facilities = **2,000 connections**; 5-min polling = 24,000 calls/hour | `s6` webhooks first, then shared scheduler with cursors and backoff |
| **SMS** | A2P 10DLC per-campaign TPS, per-brand registration | **The first white-label partner** | Registration as an onboarding gate with visible status |
| **Voice** | Concurrency priced per line | Simultaneous conversations across all customers exceed provisioned lines | Per-tenant caps + `r11` overflow-to-human |
| **Tenancy** | `organization_id` nullable | Any portfolio authz check or roll-up | `s3` |
| **Plan ceiling** | `facility_limit` = 10 | Day one of the first 20-facility deal | `s4` |

### Load tiers

| Tier | Facilities | What must be true |
|---|---|---|
| Single | 1 | Today's architecture is fine |
| Small | 2–5 | Facility switcher, per-facility numbers and pages — mostly shipped |
| Mid | 6–19 | Roll-ups start to hurt; **`facility_limit` trips at 10** |
| **Portfolio** | **20+** | **All of Phase A is mandatory** |
| White-label | partner × many orgs | Adds a tenancy level above org, per-partner 10DLC brands, per-partner billing |

> **Before signing a portfolio account:** ship `s1` (queue) and `s2` (fair-share), and resolve
> `s-mail-batch` one way or the other. Fair-share matters *more* if the answer is (B) do-not-batch,
> because then 50 pieces/min is a hard company-wide ceiling and the only defence a small customer
> has against a portfolio drop is a guaranteed floor.

---

## 5 — Compliance and data reality

Four things in Modules v2 **cannot ship as written.** See also `COMPLIANCE.md`.

### The trigger gap

The signal set is fixed in code — 9 events, 6 conditions, 5 scores
(`robopostcards/src/lib/feeds/types.ts`). Six of ten promised triggers map; four do not exist.

| Promised | Reality |
|---|---|
| Movers | ✓ `just_sold` |
| Pre-foreclosure · Probate · Tax delinquent | ✓ exist — **but gated, below** |
| Absentee owner · Expired listings | ✓ `absentee_owner` · `expired_listing` |
| **Divorce** | ✗ Not in the set. Court records; no vendor supplies it |
| **Evictions** | ✗ Not in the set. Same problem |
| **Downsizers** | ✗ Not a signal. Derivable at best, unproven |
| **Business closings** | ✗ Not in the set. Commercial data, different vendor |

**Do not sell what does not exist.**

### The distress gate

Probate, pre-foreclosure, foreclosure, tax delinquent, tax lien, quit claim and expired listing are
**refused by the code** pending a live filter-bite proof. The decision to mail them was made and
logged; the proof has not run. **Until it does, MAIL prospecting ships on three usable triggers —
movers, absentee owner, expired listing — not ten.** Say that in the sales conversation.

### RESPOND is inbound-safe by design — hold that line

Every RESPOND capability is inbound or consented: missed-call text-back (they called), form
speed-to-lead (they submitted), abandoned-rental rescue (they started checkout), waitlist notify
(they opted in), tour reminders (they booked). That is genuinely well-constructed and keeps the
module clear of the worst of TCPA.

**Outbound AI voice to prospects is a different legal universe.** The FCC ruled in February 2024
that AI-generated voices in robocalls are "artificial" under the TCPA — prior express written
consent for anything marketing. **Answering is fine. Dialling is not.**

### Review routing as written is review gating

"Happy tenants to Google, unhappy ones to a private form" is the textbook definition. Google's
policies forbid soliciting reviews selectively by sentiment, and enforcement is real.

**The compliant version keeps almost all the value:** ask every tenant the same question, show both
paths to everyone, never branch the public-review invitation on the score. You still catch unhappy
tenants first — you just do not suppress them. Fix `t1` before it ships, not after a policy strike
on the map pack you are trying to protect.

### Also needing a decision, not a surprise

- **A2P 10DLC per white-label brand** — each partner needs its own registered brand before sending
  one text; registration takes days. Make it an onboarding gate with visible status.
- **Call recording consent** — two-party states need an announcement. The agent is the place to say it.
- **Address-matched custom audiences** (`h4`) — uploads prospect addresses to Meta. Processor
  relationship and a DPA question, sitting next to a deliberate posture in the mail system that
  owner PII never reaches customers. Decide it explicitly.
- **Lien and auction mail** (`m6`) — statutory and state-specific; getting format or timing wrong is
  a legal consequence, not a refund.

---

## 6 — The vertical seam

Storage first is right. The risk is not starting narrow — it is **storage vocabulary leaking into
the spine** so vertical two becomes a rewrite.

**Do not migrate the schema.** Renaming `facilities` and `facility_pms_units` across 64 tables is
expensive, risky and low-reward. **Quarantine the vocabulary instead:** define the generic contract
in a domain layer — `Location`, `InventoryItem` (size, price, availability), `LifecycleEvent`,
`Metric` — map storage onto it, and never let a second vertical touch the physical table names.
Same discipline the mail system uses for vendor wire formats: the fix stays in one file.

**A vertical is a config pack, not a codebase:** inventory schema · lifecycle event map (start, end,
at-risk, price change, availability change) · trigger catalog · copy catalog · integration adapter ·
metric definitions + compliance profile.

**Stays storage-only:** PMS adapters · lien and auction statutory mail · occupancy and economic-
occupancy metrics · unit-size taxonomy and the size calculator.

> **Define the seam. Do not build the framework.** An abstraction with one implementation is a
> guess. Storage is where you learn what the abstraction should have been.

---

## 7 — Decision log

Append-only. Date, decider, decision. Newest entry wins over prose above.

- **2026-08-30 · Claude** — MISSION.md created to fill the gate slot that `next.md` and
  `continue.md` have referenced since they were written. States derived from schema reading, not
  from running the app; see the provenance note in §0.

- **2026-09-02 · Claude** — `s-mail-batch` corrected from "contained ~100× change" to "blocked on a
  product decision." Verified against the vendor's OpenAPI spec that `front_image_url`, `message`
  and `qrcode_url` are order-level, so batching trades per-card attribution for throughput. The
  original entry would have sent a builder at a change that silently degrades the differentiator.
  This is the sixth pinned fact about this vendor to survive first contact badly — **read the spec
  before pinning anything about Thanks.io.**

- **2026-09-02 · Angelo** — `s-mail-batch`: **option D chosen for now** — shard across
  `sub_account` rather than batching recipients. Per-card attribution is preserved and no creative
  field moves to order level. **Blocked on one question to the vendor:** is the 60 req/min limit
  per sub-account or account-wide? If account-wide, D buys nothing and the choice reopens between
  A, B and C. **Nothing should be built against D until that answer exists.**
- **2026-10-04 · Angelo + Claude** — `s12` built out: operator screens, write-back settings, CSV
  matching. One judgement call worth knowing: a CSV move-in becomes a `tenants` row **only when the
  export carries a phone or email**, because that row is what matching links to. NOI, ECRI and churn
  scoring all read `tenants`, so creating rows for move-ins that can never be matched would change
  those features for no attribution gain; with contact columns, the new rows are real, recent move-ins
  (marked `metadata.source = "pms_csv"`). Screens follow the repo's own admin design system, not the
  mockup direction.

- **2026-10-04 · Angelo + Claude** — `s12` (Visitor, Touch, move-in write-back) added to Phase A
  **ahead of the gate, by Angelo's decision.** Cost per move-in by channel is "the one number
  underneath all of it" (§1), and `p1`, `p6` and `p8` all read from this layer, so it is spine, not
  feature. Write-back sends **automatically** on a single confident match — the existing `matched`
  status, one candidate at ≥0.85; an ambiguous match reports nothing until a person resolves it.
  Found on the way, not fixed here: the Google Ads publisher (`/api/publish-ad`, OAuth callback)
  still calls API **v17**, which Google has sunset; the new upload uses v25 behind
  `GOOGLE_ADS_API_VERSION`. The OAuth callbacks now *merge* connection metadata instead of replacing
  it, so operator settings survive a reconnect.

- **2026-09-05 · Claude** — `r3` and `r8` done. Both are "inbound signal → fast text", both ride on
  machinery that already existed. **`r8` nearly became a duplicate system:** a 361-line email
  recovery cron was already running, and the honest fix was to add the SMS leg beside it rather than
  rebuild recovery. Checked before building, per the lesson this file keeps re-learning.
- **2026-09-04 · Claude** — Phase B continued: `s10` done (reservation lock, concurrency proven),
  inbound SMS handled, waitlist capture shipped. **The chain is now closed both ways** — a customer
  joins, a unit frees, they are texted, they reply YES, a unit is really held for them, and STOP
  really stops it. The em-dash bug appeared a *second* time in the inbound replies and the segment
  test caught it again; that test has now paid for itself twice.
- **2026-09-04 · Claude** — **Phase B begun.** `s5` messaging seam complete and `r9`'s notify chain
  working end to end — the first automation in this platform with no human step. Two bugs my own
  tests caught before they shipped: `segmentCount`'s non-GSM check was written as `/[^ -]/`, which
  matches nearly every character, so every message was being costed as 70-char UCS-2; and the
  waitlist copy contained an em-dash, which really does force UCS-2 and would have doubled the bill
  on every send. Both fixed, both now tested. Integration tests live behind
  `vitest.integration.config.ts` so `npm run test` stays hermetic.
- **2026-09-04 · Claude** — Three admin surfaces shipped, closing the last acceptance item on `s1`
  and `s8`: `/admin/jobs`, `/admin/events`, `/admin/attribution`. **Phase A is complete.** Watching
  the queue in production also revealed it had no retention — 802 `done` rows in 24h — so
  `jobs.prune` was added. Correction on the record: `/admin/portfolio` never looped per facility;
  it reads `client_campaigns`. The facility-level portfolio view did not exist at all.
- **2026-09-04 · Claude** — `s8` shipped as a grouped query rather than the roll-up tables the
  original task asked for. Re-benchmarked against the real implementation: **27× faster than the
  loop with identical totals.** No nightly job, no staleness, no invalidation. The org-session
  caller is deliberately not wired — there are zero organizations in production, so its shape
  would be a guess.
- **2026-09-04 · Angelo + Claude** — ✅ **FIXED, and it was four sites, not one.** The sweep found
  **7 tables** with a `NOT NULL updated_at` and no database default, and **4 hand-written INSERTs
  across 3 of them** omitted the column — so those writes had never once succeeded:
  `campaign_spend` (Meta spend sync), `call_logs` (**Twilio call logging, failing fire-and-forget
  behind a `console.error`, so every tracked call was silently dropped**), and `churn_predictions`
  (two sites). Fixed in three layers: a database default on all 7 tables so the class cannot recur,
  `@default(now())` in Prisma so the schema agrees, and `updated_at` added to all 4 INSERTs *and*
  their `ON CONFLICT DO UPDATE SET` — without which the column would have gone stale on every
  upsert. **Verified against production:** every previously-failing statement now writes, the
  upsert path bumps the timestamp, an INSERT omitting the column is rescued by the default, and
  zero at-risk tables remain. `s8` is unblocked.
- **2026-09-03 · Claude** — 🔴 PRODUCTION BUG FOUND (original entry, kept for the record).
  `campaign_spend.updated_at` is `NOT NULL` with **no database default**, and the only writer —
  the Meta spend sync at `src/app/api/campaign-spend/route.ts:178` — omits it. Every insert fails
  with SQLSTATE 23502. **Proven against production**: the exact statement fails; the same statement
  with `updated_at` succeeds. That is why `campaign_spend` has 0 rows, and it means **cost per
  move-in — the number `OVERVIEW.md` calls "the whole company" — is structurally always zero.**
  Two one-line fixes, either works: add `updated_at` to the INSERT and the `DO UPDATE SET`, or
  `ALTER TABLE campaign_spend ALTER COLUMN updated_at SET DEFAULT now()`. Left for Angelo per
  CLAUDE.md's rule that ad-platform integrations are his and are not modified without coordination.
- **2026-09-03 · Claude** — `s8` re-specced on a benchmark rather than an assumption (numbers in
  Phase A). Live aggregation is fine; the N+1 loop is the problem. `s2` marked half done: its
  scheduling half shipped with `s1`, and its vendor half is deliberately deferred until there are
  vendors to budget.
- **2026-09-03 · Claude** — `s7` COMPLETE. Unit-mix history added additively
  (`facility_pms_unit_history`) rather than putting a snapshot column on `facility_pms_units`,
  which 25 files read and 4 write. Waitlist trigger proven end to end. Also found: that table's
  `vacant_count` is a STORED generated column — correctly modelled, but a hand-written INSERT
  naming it fails with 428C9, so it is now documented at the field.
- **2026-09-03 · Claude** — `s7` built and proven against production (10 integration checks: real
  rent-roll diff → 6 events → 12 subscriber jobs across 8 queues, re-run idempotent, temp data
  cleaned up). Delivery rides on the `s1` queue rather than its own machinery. **New follow-on:**
  `facility_pms_units` keeps no history, so the waitlist trigger cannot be produced yet.
- **2026-09-02 · Claude** — `s1` built and proven against production (14 integration checks:
  claim/skip-locked, dedupe, resume-with-cursor, crash reclaim, fair-share ordering). Two bugs the
  verification caught before they shipped: the worker was written as `POST` when **every** Vercel
  cron in this repo triggers on `GET` (it would simply never have run), and `ON CONFLICT ON
  CONSTRAINT` referenced a constraint that did not exist because the DDL created a bare unique
  index — every enqueue would have thrown. The index was promoted to a real constraint so the
  database matches Prisma's `@@unique`.
- **2026-09-02 · Claude** — `s3` and `s4` corrected against production data; the migration was not
  run. Two of five Phase A items were misdiagnosed from schema shape alone. **Lesson, and it now
  governs this file: a schema tells you what CAN be null, not what the column MEANS.** Read the data
  and the funnel that writes it before pinning a task. §0's provenance caveat was too narrow — it
  warned about PARTIAL states when the errors were in the tasks themselves.

### Open decisions

- **`s-mail-batch` D — the vendor question.** *Ask Thanks.io: "Is the 60 requests/minute API rate
  limit applied per sub-account, or across the parent account? If we create one sub-account per
  customer, does each get its own limit?"* One email. Everything else here waits on it.
- **`s11`** — absorb PostcardRobot or keep the API boundary? *Recommendation: keep it separate.*
- **Voice vendor** — concurrency pricing and latency decide it; the one dependency with no fallback.
- **Which PMS first** — storEDGE is named in CONVERT; SiteLink and Storable are the rest of the market.
- **Portfolio price** — $2,497 is the current top tier; a 20-facility owner is a different animal.
- **Does the distress filter-bite proof pass?** Seven of ten triggers depend on it.
- **Who operates this at 50 accounts?** The console is good; it is not a support team.

### 2026-09-05 — `r10` built before `r5`-`r7`, on purpose

The doc said Spanish was "cheaper built in than retrofitted", so it went first, while there were eight
templates in four files rather than fifteen in ten. Three things fell out of doing it that only show up
once you actually write the second language:

1. **Accent folding is load-bearing, not cosmetic.** `isStopReply` stripped `[^a-z-]`, which reduces
   `sí` to `s` and `PARÁ` to `par` — so every accented Spanish reply matched nothing. `foldKeyword`
   NFD-normalises and drops the combining marks before matching. `classifyInbound` had its own copy of
   the old strip and needed the same fix; it now shares the one function.

2. **The copy and the keyword sets are one system.** Sending "Responde PARAR para salir" while nothing
   listens for PARAR is worse than sending no Spanish at all — it is an opt-out instruction that does
   nothing. There is now a test asserting that every keyword the copy names is a keyword we honour, in
   both languages.

3. **"No signal" is not "English".** `detectLanguage` returns `null` for `STOP`, `ok` and `no`, because
   those say nothing about language, and reading them as English would silently reset somebody who had
   already written to us in Spanish. Detection only ever flips a contact *to* Spanish.

Also caught while wiring the capture form: recording an unstated `en` as source `form` would have
permanently blocked reply-detection for every waitlist signup, since a form outranks a reply. The route
now writes a preference only when the form actually states one.

Cost accepted deliberately: Spanish needs á/í/ó/ú, which GSM-03.38 lacks, so Spanish messages bill as
70-character UCS-2 — about three segments instead of one, two extra cents against a rental worth $150 a
month. Stripping the accents to save that is the wrong trade and the tests cap Spanish at three segments
rather than pushing it back to ASCII.

### 2026-09-05 — `r5`, and the "you didn't finish" text sent to people who finished

Recon before writing, and it paid for itself twice.

**1. The obvious hook was the wrong one.** `POST /api/partial-lead` looked like the form endpoint. It is
not — it is a progressive beacon that fires repeatedly while somebody is still typing, upserting on
`session_id`, and it is how `r8` knows about abandonment at all. Hooking speed-to-lead to it would have
texted people in the middle of filling the form in. The real submit paths are `/api/consumer-lead` and
`/api/lead-capture`, and my first grep missed both because it searched for `INSERT INTO partial_leads`
while those two use Prisma client methods.

**2. A live bug, and it was mine to inherit.** `/api/lead-capture`'s **create** branch set neither
`converted` nor `lead_status`, while its **update** branch set both. So a lead who submitted a full
name/email/phone on a funnel landing page with no prior beacon row landed as
`lead_status = 'partial', converted = false` — which is precisely what `r8`'s abandoned-rescue sweep
looks for. That lead was queued a "you were part-way through, reply and we'll finish it" text ten
minutes after they had in fact finished. Fixed at the source (the create branch now matches the update
branch), and `r8` hardened with a third guard on `recovery_status <> 'converted'` so no single path's
drift can produce that message again.

**3. `converted_at` already existed and nothing set it.** `/api/consumer-lead` set `converted = true`
without a timestamp, so there was no submit moment to measure speed against. Reused that column rather
than adding `submitted_at`; the only new column is `first_response_at`.

Measuring from `converted_at` and not `created_at` is the whole point: `created_at` is when the beacon
first saw them, which can be an hour before they submit, and measuring from it would report an
hour-long response to a lead answered in two seconds. `COALESCE(first_response_at, now())` keeps the
first response, so a retry cannot rewrite history into looking faster than it was.

Two design calls worth keeping:

- **The two sends have separate dedupe keys**, so one failing does not suppress the other. A lead who
  has opted out of texts has not opted the operator out of being told they exist — there is a test for
  exactly that.
- **The operator alert carries no opt-out line.** It is an internal message to a business contact, not
  marketing, and a test asserts it stays that way.

Inline, not queued, for the same reason as `r3`: the worker ticks once a minute and the entire value is
being inside the first one. The queued `respond.speed-to-lead` job is the safety net for the one case
inline cannot cover — a submit request that died between writing the lead and answering it — and it
sweeps for leads with no response at all, so on a healthy system it finds nothing.

### 2026-09-05 — `r6`/`r7`, and two things the data refused to support

`lead_status` already had a `'toured'` value and the schema carried a `tour_booked` comment, but nothing
ever booked a tour. `facility_tours` is that missing table.

**Slot availability is deliberately not built.** The plan was to generate bookable slots from
`facilities.hours`. Zero of the 29 facilities have `hours` populated, so any slot list would have been
invented. A requested time is instead checked for the things that are certainly mistakes — in the past,
past a 60-day horizon, or outside 7am-8pm *in the facility's own zone* — and otherwise trusted.
`withinBookableHours` is the single place to tighten when real hours exist.

**Timezone had to become a column.** Facilities span Michigan to Colorado — Eastern through Mountain —
and `location` is freeform text ("Newark", "417 South Lake Road", "mattawan mi") that cannot be parsed
into a zone. So `facilities.timezone` is a nullable IANA string. It is survivable that it is currently
unset everywhere because tours are stored in absolute time: an unset zone changes how a time is printed
and whether the quiet-hours gate thinks it is evening, never when a reminder actually fires.

Three design calls:

1. **Reminders are swept, not pre-scheduled.** Enqueueing two jobs at booking time with a future
   `run_after` is the obvious design and it is wrong: the moment somebody reschedules, those jobs still
   point at the old time, and cancelling them means storing job ids on the tour. Sweeping means the tour
   row is the only truth about when the tour is, and `message_log` is the only truth about what was
   sent — the same reasoning as `r8`, and no third copy of either fact to drift.

2. **A second booking is a reschedule.** Enforced by a partial unique index on
   (facility_id, contact_phone) WHERE status IN ('booked','confirmed'), which `bookTour` infers as its
   ON CONFLICT target — so two concurrent submits cannot both win and produce two sets of reminders.
   Prisma cannot express an index predicate, so it lives in the migration SQL with a note in the schema
   telling a future reader not to "clean up" the apparent absence of a unique constraint.

3. **No-show recovery is same-day or not at all.** "Sorry we missed you today" stops being true
   tomorrow, so `sweepNoShows` marks the status regardless but only texts while it is still the same
   calendar day *where the customer is*. A tour missed at 6pm and noticed at 1am gets the status and no
   message.

Caught in verification rather than in production: the tour integration test leaked three `partial_leads`
rows across runs, because `partial_leads.facility_id` is ON DELETE SET NULL — deleting the test facility
orphaned the lead instead of removing it, so cleaning up "by facility" could never find it. The teardown
now deletes by `session_id` prefix.
