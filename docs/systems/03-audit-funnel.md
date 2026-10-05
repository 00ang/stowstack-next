# 03 · Audit Funnel (Top-of-Funnel)

> **The headline:** This is the primary lead wedge — how a stranger becomes a booked sales call. There are **two distinct entry paths** that share one destination (`/audit/[slug]`). The deep AI diagnostic does **not** come from `/audit-tool` (a lightweight Google scorer) — it comes from `/diagnostic`. Opening the report triggers escalating hot-lead alerts to Blake.

---

## 1. The whole funnel on one canvas

```mermaid
flowchart TD
    STRANGER([👤 Stranger arrives])

    STRANGER --> PATHA["Path A · /audit-tool<br/><i>lightweight, no AI</i>"]
    STRANGER --> PATHB["Path B · /diagnostic<br/><i>the real wedge, AI-powered</i>"]

    %% Path A
    PATHA --> LOOKUP["POST /api/facility-lookup<br/>Google Places: rating, reviews, photos"]
    LOOKUP --> SCORE["computeAuditScore() client-side<br/>marketing score from Google data"]
    SCORE --> CONSUMER["POST /api/consumer-lead<br/>→ partial_leads row<br/>(converted=true, utm/gclid/fbclid)"]

    %% Path B
    PATHB --> INTAKE["POST /api/diagnostic-intake<br/>creates facilities row<br/>pipeline_status = diagnostic_submitted"]
    INTAKE -->|"fire-and-forget<br/>X-Admin-Key"| GEN["POST /api/audit-generate-diagnostic"]
    GEN --> AI["🤖 Anthropic Claude Sonnet 4<br/>buildAuditPrompt() · 12k tokens<br/>7 scored categories + projections"]
    AI --> PERSIST["shared_audits row<br/>slug + audit_json + expires +90d<br/>(+ audits row, facility→audit_generated)"]
    PERSIST --> EMAILS["📧 Resend:<br/>operator 'diagnostic ready'<br/>Blake 'audit generated'"]

    %% Reliability net
    RETRY["⏰ job audits.retry-diagnostic<br/>queued by intake for +11 min — rescues stuck rows<br/>(diagnostic_submitted, no slug, >10min)"] -.->|re-triggers| GEN

    %% Shared destination
    EMAILS --> VIEW["👀 Operator opens /audit/[slug]"]
    CONSUMER -.->|nurtured separately| VIEW
    VIEW --> LOAD["GET /api/audit-load<br/>views++ · 90-day expiry check"]
    LOAD --> ALERTS["📧 Blake alerts:<br/>'Audit Opened' (1st view)<br/>'Hot Lead' (3rd view)"]
    LOAD --> CTA["📅 'Schedule a call' CTA<br/>+ sticky booking bar<br/>Cal.com (handle: stowstack)"]
    CTA --> BOOKED([✅ Booked sales call])

    %% Handoff to nurture
    APPROVE["/api/audit-approve (admin)<br/>→ enrolls post_audit nurture"] -.->|System 2| BOOKED

    classDef pathA fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    classDef pathB fill:#faf9f5,stroke:#141413,color:#141413
    classDef ai fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef alert fill:#faf9f5,stroke:#6a9bcc,color:#141413
    classDef goal fill:#1e1d1b,stroke:#141413,color:#faf9f5
    class PATHA,LOOKUP,SCORE,CONSUMER pathA
    class PATHB,INTAKE,GEN,PERSIST,EMAILS pathB
    class AI,PERSIST ai
    class ALERTS,RETRY alert
    class BOOKED,STRANGER goal
```

---

## 2. Path A vs Path B — don't confuse them

| | **Path A — `/audit-tool`** | **Path B — `/diagnostic`** |
|---|---|---|
| Intent | Quick self-serve hook | The real diagnostic wedge |
| Input | Facility name + location | Multi-question form (occupancy, marketing, digital, revenue, ops, competition) |
| Scoring | `computeAuditScore()` **client-side**, from Google Places | **Anthropic Claude Sonnet 4**, `max_tokens: 12000` |
| AI? | ❌ No | ✅ Yes |
| Produces | `partial_leads` row | `facilities` + `shared_audits` (+ `audits`) |
| Lead capture | `POST /api/consumer-lead` | `POST /api/diagnostic-intake` |
| Files | `audit-tool/audit-client.tsx` | `diagnostic/diagnostic-form.tsx` |

Both can end at `/audit/[slug]`, but only Path B generates the shareable AI report. Path A's `partial_leads` row is nurtured/recovered separately (see [04 · Nurture](04-nurture-lifecycle.md)).

---

## 3. Path B in sequence (the AI diagnostic)

```mermaid
sequenceDiagram
    autonumber
    participant P as Prospect
    participant Form as /diagnostic
    participant Intake as POST /api/diagnostic-intake
    participant DB as facilities / shared_audits
    participant Gen as audit-generate-diagnostic
    participant AI as Anthropic Claude Sonnet 4
    participant Mail as Resend
    participant Blake as Blake

    P->>Form: fills diagnostic questions
    Form->>Intake: submit (email + answers)
    Intake->>DB: create facilities<br/>pipeline_status=diagnostic_submitted
    Intake->>Blake: admin notification email
    Intake-)Gen: fire-and-forget POST (X-Admin-Key)
    Note over Intake,Gen: returns immediately — no await
    Gen->>AI: buildAuditPrompt() → 12k tokens
    AI-->>Gen: JSON: 7 categories, exec summary,<br/>benchmarks, cost of inaction, 90-day projection
    Gen->>DB: shared_audits.create (slug, +90d)<br/>+ audits row, facility→audit_generated
    Gen->>P: 📧 "Your diagnostic is ready" + link
    Gen->>Blake: 📧 "Audit Generated"
```

> **Why the fire-and-forget + retry cron?** `diagnostic-intake` doesn't `await` the AI generation (it'd block the form response for 10-30s). If that detached call fails, the row sits at `diagnostic_submitted` with no slug. The intake queues an `audits.retry-diagnostic` job for 11 minutes later, which retries generation if the row is still stuck (backing off and retrying on failure); a six-hourly sweep catches anything older than two hours, max 5/run — a reliability net for a deliberately unreliable pattern. (Until 2026-10 this was an hourly cron.)

---

## 4. The hot-lead engagement loop

The clever bit: the static `/audit/[slug]` page is itself a lead-scoring instrument. Every open increments `views` and can fire an alert.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Generated : shared_audits.create (views=0)
    Generated --> FirstView : operator opens link
    FirstView --> Warming : views++
    Warming --> Hot : views >= 3
    Hot --> Booked : clicks Schedule a call
    Generated --> Expired : 90 days, audit-load 404s

    note right of FirstView
      GET /api/audit-load
      views===0 → Blake "Audit Opened"
    end note
    note right of Hot
      crossing 3 views
      → Blake "Hot Lead" email
    end note
```

`/audit/[slug]` is a React Server Component (`loadAudit(slug)` wrapped in React `cache`). It special-cases `SAMPLE_AUDIT_SLUG` (static fixture, no DB), renders the diagnostic format (`audit.categories`) or falls back to `LegacyAuditPage`, and handles expired/not-found states. The sticky bottom bar reads *"You're leaving $X/mo on the table"* and routes to `CAL_BOOKING_URL` from `src/lib/booking.ts`.

---

## 5. `shared_audits` — the stateless share token

```
shared_audits
├── slug          unique varchar(60)   ← the public share token
├── facility_name
├── audit_json    Json                  ← the entire rendered report
├── views         int default 0         ← drives hot-lead alerts
├── expires_at    +90 days              ← audit-load 404s after
└── created_at
```

No FK to `facilities` — the slug *is* the link. `facilities.shared_audit_slug` points back as a soft string reference. Persists 90 days, then the report goes dark.

---

## 6. The bridge to nurture: `/api/audit-approve`

`audit-approve` (admin-key gated, from the facility manager) is the seam between **System 1 (this doc)** and **System 2 (nurture)**. It:

1. Takes an existing `audits` row + `facilityId`.
2. Creates a `shared_audits` slug, emails the lead (with `utm_campaign=audit_results` + Cal link).
3. Sets facility `pipeline_status = audit_sent`, logs `activity_log` (`audit_approved`).
4. **Enrolls the lead into the `post_audit` nurture sequence** — or falls back to a `post_audit` drip if there's no email or the nurture insert throws.

→ Continue at **[04 · Nurture & Drip Lifecycle](04-nurture-lifecycle.md)**.

---

## Key files

| Step | File / Route |
|------|--------------|
| Path A page | `src/app/audit-tool/page.tsx` → `audit-client.tsx` |
| Path A lead | `POST /api/consumer-lead` → `partial_leads` |
| Path B page | `src/app/diagnostic/page.tsx` → `diagnostic-form.tsx` |
| Path B intake | `src/app/api/diagnostic-intake/route.ts` |
| AI generation | `src/app/api/audit-generate-diagnostic/route.ts` |
| Report view | `src/app/audit/[slug]/page.tsx` |
| Load + alerts | `src/app/api/audit-load/route.ts` |
| Retry net | `src/lib/diagnostic-retry.ts` (queue) · `src/app/api/cron/retry-diagnostic-audits/route.ts` (manual) |
| Approve → nurture | `src/app/api/audit-approve/route.ts` |
| Booking URL | `src/lib/booking.ts` (Cal handle `stowstack`) |
| Sample fixture | `src/lib/sample-audit.ts` |
