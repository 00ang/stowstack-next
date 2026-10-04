# 10 · Attribution & Call Tracking

> **The headline:** This is how an anonymous ad click becomes a measured move-in tied to spend. The chain is: click → `partial_leads` → call/walk-in → **lead↔tenant match** (the loop-closer) → ROAS. Two caveats to internalize: the `visitor_id`/`source_channel` columns are unwired scaffold (the real key is `session_id`), and walk-ins are **not** auto-matched.

> **Update 2026-10-04 — MISSION.md `s12`.** Three things below are now out of date. (1) The visitor
> key is the server-set `sa_vid` cookie, recorded in `visitors`, and `partial_leads.visitor_id` is
> written on every lead route. (2) Every sourced arrival and every inbound call is an append-only row
> in `touches`; first and latest touch are queries over it (`src/lib/attribution/touch.ts`), so the
> localStorage params are now only a convenience for the storEDGE embed. (3) A confident lead↔tenant
> match emits `lead.moved_in`, and `prove.meta-conversion` / `prove.google-conversion` report the
> move-in to the ad platforms, logging every attempt in `conversion_reports`
> (`src/lib/attribution/write-back.ts`). The diagrams have not been redrawn yet.

---

## 1. The full attribution pipeline (anonymous → tenant)

```mermaid
flowchart TD
    CLICK([Ad click]) --> R["/api/r short link<br/>utm_links.click_count++"]
    R --> LP["/lp/[slug]?utm_*"]
    LP --> CAP["src/lib/tracking-params.ts<br/>last-touch → localStorage<br/>utm_* · fbclid · gclid · ttclid"]
    CAP --> VIS["/api/tracking/visit + /event<br/>→ activity_log"]
    CAP --> PI["/api/page-interactions<br/>→ page_interactions (scroll/click)"]

    CAP --> PL["/api/partial-lead<br/>→ partial_leads (ON CONFLICT session_id)"]
    PL --> LC["/api/lead-capture<br/>converted + fireMetaCapi('Lead')"]

    PL --> CALL["📞 inbound → /api/call-webhook<br/>→ call_logs (campaign_source)"]
    PL --> WALK["🚶 /api/walkin-attribution<br/>→ activity_log (NOT auto-matched ⚠️)"]

    LC --> TEN["PMS import → /api/v1/tenants<br/>→ tenants (real move-in)"]
    CALL --> TEN
    TEN --> MATCH["src/lib/lead-matching.ts<br/>match within 90 days"]
    MATCH --> LINK["partial_leads.matched_tenant_id<br/>+ lead_status_events 'moved_in'<br/>+ lead_match_attempts (audit)"]
    LINK --> ROAS["/api/attribution + /api/funnel-metrics<br/>spend ↔ leads ↔ move-ins = ROAS"]
    ROAS --> CAPI["Meta CAPI / Google conversion<br/>(outbound, hashed, deduped)"]

    classDef anon fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    classDef id fill:#faf9f5,stroke:#141413,color:#141413
    classDef close fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef out fill:#faf9f5,stroke:#6a9bcc,color:#141413
    class CLICK,R,LP,CAP,VIS,PI anon
    class PL,LC,CALL,WALK id
    class TEN,MATCH,LINK,ROAS close
    class CAPI out
```

---

## 2. Click & visitor attribution

```mermaid
sequenceDiagram
    autonumber
    participant Ad as Ad click
    participant Short as /api/r
    participant LP as /lp/[slug]
    participant JS as tracking-params.ts
    participant PL as /api/partial-lead

    Ad->>Short: ?c=<short_code>
    Short->>Short: UPDATE utm_links click_count++ , last_clicked_at
    Short->>LP: 302 redirect + re-appended utm_*
    LP->>JS: parse utm_*, fbclid, gclid, ttclid
    JS->>JS: last-touch → localStorage storageads_tracking<br/>+ build _fbc/_fbp cookies
    JS->>PL: ON CONFLICT (session_id) DO UPDATE<br/>COALESCE keeps first-touch utm/click-ids
    Note over PL: session_id is the de-facto visitor key
```

- `utm_links` — named per-facility links with `short_code`, full utm set, optional `landing_page_id`, click counter. Managed via `/api/utm-links`.
- `tracking-params.ts` — **last-touch** model; new URL params overwrite, persisted in localStorage.
- `partial_leads` capture — raw `INSERT ... ON CONFLICT (session_id) DO UPDATE`, COALESCE-merging utm/click-ids so first-touch survives.

> **⚠️ Scaffold gap:** `partial_leads.visitor_id`, `source_channel`, `source_subchannel`, `audit_submission_id` are declared but **written nowhere** (only `visitor_id` even has an index, `idx_partial_leads_visitor`). The real visitor key today is `session_id`. See [13 · Gaps & Seams](13-gaps-and-seams.md).

---

## 3. Call tracking (Twilio)

```mermaid
sequenceDiagram
    autonumber
    participant Caller as Caller
    participant Twilio as Twilio number
    participant WH as /api/call-webhook
    participant CTN as call_tracking_numbers
    participant CL as call_logs

    Note over CTN: provisioned via /api/call-tracking<br/>(tied to landing_page_id AND/OR utm_link_id)
    Caller->>Twilio: dials tracked number
    Twilio->>WH: voice hit (x-twilio-signature verified, fail-closed)
    WH->>CTN: lookup by dialed number
    WH->>CL: INSERT campaign_source (from utm_link.utm_campaign)<br/>status=ringing → TwiML dial to forward_to (record)
    Twilio->>WH: ?event=status callback
    WH->>CL: final status/duration · recompute CTN aggregates
    Note over CL: PATCH /api/call-logs sets call_outcome +<br/>move_in_linked → activity_log attributed_move_in
```

`campaign_source` on `call_logs` is derived from `utm_link.utm_campaign` — that's how a phone call inherits its ad campaign. `partial_leads.call_log_id` (SetNull) ties a call to an identified lead.

---

## 4. Walk-in attribution

```mermaid
flowchart LR
    DESK["/walkin/[code]<br/>front-desk kiosk form<br/>[code] = facility access_code"] --> POST["/api/walkin-attribution<br/>validate access_code"]
    POST --> LOG["activity_log type=walkin_attribution<br/>(source, sawOnlineAd, tenantName, unitRented)"]
    LOG -.->|"⚠️ NOT auto-matched<br/>to partial_leads/tenants"| MANUAL["captured 'for matching later'"]

    classDef warn fill:#faf9f5,stroke:#B04A3A,color:#B04A3A
    class MANUAL warn
```

Walk-ins land in `activity_log` only. The free-text tenant name/unit is captured "for matching to move-in data later," but **no code path joins walk-ins to leads or tenants yet**.

---

## 5. Lead → tenant matching (closing the loop)

This is the join that makes attribution real — a PMS move-in matched back to the originating click.

```mermaid
flowchart TD
    IMPORT["/api/v1/tenants — new active tenant w/ move_in_date"] --> ENGINE["matchTenantToLeads()<br/>look back 90 days, same facility<br/>partial_leads WHERE matched_tenant_id IS NULL"]
    ENGINE --> S1{"exact phone (last 10)?"}
    S1 -->|"conf 0.95"| RESULT
    ENGINE --> S2{"exact email?"}
    S2 -->|"conf 0.90"| RESULT
    ENGINE --> S3{"last name + last-4 phone?"}
    S3 -->|"conf 0.70"| RESULT
    RESULT["sort by confidence, recency"] --> DECIDE{"single ≥0.85?"}
    DECIDE -->|yes| MATCHED["status=matched →<br/>markLeadAsMatchedTenant<br/>(matched_tenant_id, converted=true,<br/>'moved_in' event)"]
    DECIDE -->|">1 at ≥0.85"| AMBIG["status=ambiguous (human review)"]
    DECIDE -->|none| NOMATCH["status=no_match"]
    MATCHED & AMBIG & NOMATCH --> AUDIT["lead_match_attempts row (always)"]

    classDef ok fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef warn fill:#faf9f5,stroke:#6a9bcc,color:#141413
    class MATCHED ok
    class AMBIG,NOMATCH warn
```

`lead_status_events` is the append-only status history (`source`/`source_ref_id` point back into `call_logs`/`tenants`). The `"LeadTenantMatch"` named relation (`partial_leads.matched_tenant_id ↔ tenants`) is the link. **Only the PMS-import path auto-matches** — calls and walk-ins do not.

---

## 6. Funnel stage metrics → ROAS

```mermaid
graph LR
    STAGES["funnel_stage_metrics<br/>impression → click → page_view<br/>→ form_start → form_submit → conversion<br/>→ drip_sent → drip_opened → move_in"]
    STAGES --> FM["/api/funnel-metrics GET<br/>merges creative_performance + partial_leads<br/>+ drip_sequences → drop-off, CPL, cost/move-in"]
    SPEND["campaign_spend (per utm_campaign)"] --> ATTR["/api/attribution<br/>leads × move-ins × revenue<br/>= CPL, cost/move-in, ROAS (rev×12/spend)"]
    PL2["partial_leads by utm_campaign"] --> ATTR

    classDef c fill:#e8e6dc,stroke:#141413,color:#141413
    class STAGES,FM,SPEND,ATTR,PL2 c
```

`funnel_stage_metrics` upserts increment a `(funnel_id, period, stage)` counter (admin-gated POST). `/api/attribution` joins `campaign_spend` against `partial_leads` grouped by `utm_campaign` to compute the operator-facing ROI table. The outbound hop (`meta-capi.ts`, `google-conversion`) sends hashed, deduped conversions back to the ad platforms — Angelo's domain.

---

## Key files

| Hop | Route / lib | Writes |
|-----|-------------|--------|
| Short-link click | `src/app/api/r/route.ts` | `utm_links` |
| Param capture | `src/lib/tracking-params.ts` | localStorage |
| Visit/events | `tracking/visit`, `/event` | `activity_log` |
| Page interactions | `page-interactions` | `page_interactions` |
| Anon → partial | `partial-lead/route.ts` | `partial_leads` |
| Converted + CAPI | `lead-capture/route.ts` | `partial_leads`, Meta CAPI |
| Call provisioning | `call-tracking/route.ts` | `call_tracking_numbers` |
| Inbound call | `call-webhook/route.ts` | `call_logs` |
| Walk-in | `walkin-attribution/route.ts` | `activity_log` |
| Match engine | `src/lib/lead-matching.ts` | `lead_match_attempts` |
| Lead linking | `src/lib/lead-events.ts` | `matched_tenant_id`, `lead_status_events` |
| Funnel stages | `funnel-metrics/route.ts` | `funnel_stage_metrics` |
| ROAS | `attribution/route.ts`, `src/lib/attribution.ts` | `creative_performance` |
