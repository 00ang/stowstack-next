# 04 · Nurture & Drip Lifecycle

> **The headline:** Two parallel automation engines coexist *by design*. **Nurture** (newer, primary) drives email + SMS off the `nurture_*` tables. **Drip** (legacy) is the fallback safety net. Both are advanced by daily crons. Templates live in a shared lib so both the API and the audit-approve handoff can import them.

---

## 1. Two engines, one purpose

```mermaid
graph TB
    subgraph Nurture["🟢 NURTURE — primary (newer)"]
        N1["src/lib/nurture-templates.ts<br/>SEQUENCE_TEMPLATES"]
        N2["nurture_sequences →<br/>nurture_enrollments →<br/>nurture_messages"]
        N3["cron: process-nurture<br/>daily 6:00 AM"]
        N4["email (Resend SDK) + SMS (Twilio)"]
    end
    subgraph Drip["🟡 DRIP — legacy fallback"]
        D1["src/lib/drip-sequences.ts<br/>SEQUENCES + drip_sequence_templates"]
        D2["drip_sequences<br/>(history JSONB on the row)"]
        D3["cron: process-drips 5:00 AM<br/>cron: process-recovery 7:00 AM"]
        D4["email (/api/send-template) + SMS (/api/sms-send)"]
    end

    FALLBACK["audit-approve:<br/>no email OR nurture insert throws<br/>⇒ fall back to drip"]
    Nurture -.-> FALLBACK
    FALLBACK -.-> Drip

    classDef nur fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef dri fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    class N1,N2,N3,N4 nur
    class D1,D2,D3,D4 dri
```

| | **Nurture** (primary) | **Drip** (legacy fallback) |
|---|---|---|
| Templates | `src/lib/nurture-templates.ts` (`SEQUENCE_TEMPLATES`) | `src/lib/drip-sequences.ts` (`SEQUENCES`) |
| DB models | `nurture_sequences → nurture_enrollments → nurture_messages` | `drip_sequences` (+ `drip_sequence_templates`) |
| Message log | one `nurture_messages` row per send | appended to `history` JSONB on the row |
| Channels | email + SMS | email + SMS |
| Cron(s) | `process-nurture` (6 AM) | `process-drips` (5 AM), `process-recovery` (7 AM) |
| Data access | raw SQL throughout | Prisma + raw SQL mix |

---

## 2. The shared template library

`src/lib/nurture-templates.ts` is the single source of truth — deliberately in `lib/` (not a route) so both `nurture-sequences` and `audit-approve` import it.

```mermaid
graph LR
    subgraph SEQ["SEQUENCE_TEMPLATES"]
        T1["landing_page_abandon · 5 steps · sms+email"]
        T2["reservation_abandon · 3 steps · sms+email"]
        T3["post_move_in · 5 steps · sms+email"]
        T4["win_back · 3 steps · sms+email"]
        T5["⭐ post_audit · 3 steps (day 1/3/7) · email only"]
        T6["⭐ recovery · 3 steps (1hr/24hr/72hr) · email only"]
    end
    classDef t fill:#faf9f5,stroke:#141413,color:#141413
    classDef star fill:#faf9f5,stroke:#788c5d,color:#141413
    class T1,T2,T3,T4 t
    class T5,T6 star
```

Each step carries `step_number`, `delay_minutes` (**incremental** — `process-nurture` schedules `next_send_at = now + delay` *after* the prior send, so cumulative diffs preserve the 1/3/7-day cadence), `channel`, `subject`, `body` (with `{merge_tags}`), and an optional `send_window`. `post_audit` and `recovery` were ported from the legacy drip `SEQUENCES`.

---

## 3. Enrollment triggers — what puts a lead into a sequence

```mermaid
flowchart TD
    subgraph Triggers["Enrollment triggers"]
        A["Audit sent<br/>/api/audit-approve"]
        M["Manual / admin tab<br/>/api/nurture-sequences POST enroll"]
        R["Abandoned form / partial lead<br/>(recovery)"]
    end

    A --> Q{"facility.contact_email<br/>exists?"}
    Q -->|yes| NE["nurture_sequences (post_audit)<br/>+ nurture_enrollments<br/>(idempotent per email)"]
    Q -->|"no, OR insert throws"| DE["enrollPostAuditDrip()<br/>drip_sequences (post_audit)<br/>next_send_at = +2 days"]

    M --> NE
    R --> RD["recovery / abandoned_form<br/>drip via process-recovery"]

    %% Cancellation
    CANCEL["pipeline_status ∈<br/>(call_scheduled, client_signed, lost)"] -->|process-drips auto-cancels| STOP["drip status = cancelled<br/>activity_log: drip_cancelled"]

    classDef nur fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef dri fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    classDef stop fill:#faf9f5,stroke:#B04A3A,color:#B04A3A
    class NE nur
    class DE,RD dri
    class STOP,CANCEL stop
```

Four ways in:
1. **Post-audit (the main handoff)** — `audit-approve` enrolls into `post_audit` nurture; drip is the catch-all safety net.
2. **Manual** — admin facility nurture tab → `nurture-sequences` route (`create_from_template`, `create_sequence`, `enroll`; `PATCH` for pause/resume/skip/convert/unsubscribe).
3. **Abandoned-form recovery** — `process-recovery` cron drives the `recovery` sequence for partial leads.
4. **Auto-cancellation** — when a facility's `pipeline_status` becomes `call_scheduled`, `client_signed`, or `lost`, `process-drips` cancels the active drip. **This is how booking a call / signing stops the emails.**

---

## 4. How `process-nurture` sends (the primary engine)

```mermaid
sequenceDiagram
    autonumber
    participant Cron as cron: process-nurture (6 AM)
    participant DB as nurture_enrollments + sequences
    participant Fac as facilities
    participant Send as Resend / Twilio
    participant Log as nurture_messages

    Cron->>DB: SELECT up to 50 due<br/>(both status='active' AND next_send_at <= NOW())
    loop each enrollment (45s budget)
        DB->>Cron: current step
        alt SMS outside send_window
            Cron->>Cron: skip this run
        else
            Cron->>Fac: load facility → build mergeData<br/>(first_name, facility_name, reserve_link, …)
            Cron->>Cron: resolveMergeTags() fills {tags}
            alt channel = SMS
                Cron->>Send: Twilio REST (+ "Reply STOP")
            else channel = email
                Cron->>Send: Resend SDK<br/>from notifications@storageads.com
            end
            Cron->>Log: nurture_messages (sent/failed, external_id)
            Cron->>DB: advanceStep() — next_send_at = now + nextStep.delay<br/>OR mark completed (all in a $transaction)
        end
    end
    Note over Cron: remainder picked up next run<br/>fatal failure → emails Blake
```

> **Why advance-step inside a transaction?** The message-send and the step advance commit together. Drip does the inverse — it **advances *before* sending** specifically to avoid double-sends on a retry. Two different safety strategies for the same hazard (duplicate messages).

---

## 5. The daily cron cascade

The lifecycle crons run back-to-back each morning so a lead flows through recovery → nurture → drips → alerts in one window:

```mermaid
gantt
    title Daily lifecycle cron cascade (server time)
    dateFormat HH:mm
    axisFormat %H:%M
    section Messaging
    process-drips legacy        :05:00, 30m
    process-nurture primary     :06:00, 30m
    process-recovery abandoned :07:00, 30m
    check-campaign-alerts       :08:00, 30m
```

All gated by `verifyCronSecret()` (`src/lib/cron-auth.ts`, fail-closed). Full cron inventory in [05 · Background Jobs](05-background-jobs.md).

---

## 6. Portal onboarding — a *separate* lifecycle (post-signup)

Don't confuse this with marketing nurture. The onboarding wizard runs for **signed clients** (portal session: email + access code), not prospects.

```mermaid
flowchart LR
    SIGNED([client_signed → access_code minted]) --> W["/portal/onboarding<br/>OnboardingWizard"]
    W --> S1[facilityDetails]
    S1 --> S2[targetDemographics]
    S2 --> S3[unitMix]
    S3 --> S4[competitorIntel]
    S4 --> S5[adPreferences]
    S5 --> S6[review]
    S6 --> DONE([client_onboarding.completedAt])

    classDef step fill:#e8e6dc,stroke:#141413,color:#141413
    class S1,S2,S3,S4,S5,S6 step
```

Persists via `GET/POST /api/client-onboarding?code=&email=` (a `steps` JSON + `completedAt`). Six steps: `facilityDetails → targetDemographics → unitMix → competitorIntel → adPreferences → review`.

---

## Key files

| Concern | File |
|---------|------|
| Shared templates | `src/lib/nurture-templates.ts` (`SEQUENCE_TEMPLATES`) |
| Legacy drip templates | `src/lib/drip-sequences.ts` (`SEQUENCES`) |
| Nurture API (admin) | `src/app/api/nurture-sequences/route.ts` |
| Audit → nurture handoff | `src/app/api/audit-approve/route.ts` (`enrollPostAuditDrip`) |
| Nurture cron | `src/app/api/cron/process-nurture/route.ts` |
| Drip cron | `src/app/api/cron/process-drips/route.ts` |
| Recovery cron | `src/app/api/cron/process-recovery/route.ts` |
| Onboarding wizard | `src/app/portal/onboarding/page.tsx`, `src/app/api/client-onboarding/route.ts` |
| Models | `nurture_sequences`, `nurture_enrollments`, `nurture_messages`, `drip_sequences`, `drip_sequence_templates` in `prisma/schema.prisma` |
