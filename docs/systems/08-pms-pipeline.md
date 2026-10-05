# 08 · PMS Data Ingestion Pipeline

> **The headline:** Facility management reports come in as **CSV** (Phase 1 — no live API). There are actually **three** ingestion paths into the `facility_pms_*` tables, not one. The hub table is `facility_pms_snapshots` (a per-facility, per-date rollup). Despite the name, `storedge-import` performs **no live storEDGE sync** — it's a manual JSON import.

---

## 1. Three ingestion paths

```mermaid
graph TB
    subgraph PathA["Path A · Admin tab (LIVE, synchronous)"]
        A1["pms-upload-tab.tsx<br/>parses CSV in browser"]
        A2["POST /api/pms-data<br/>action: import_rent_roll/aging/revenue"]
        A1 --> A2
    end
    subgraph PathB["Path B · Queue (async, portal/public)"]
        B1["POST /api/pms-upload<br/>→ pms_reports (status=uploaded)"]
        B2["job pms.process-upload<br/>(queued by the upload · 6h backstop)<br/>fetch → classify → ingest"]
        B1 --> B2
    end
    subgraph PathC["Path C · storedge-import (manual JSON)"]
        C1["POST /api/storedge-import<br/>admin-key, pre-parsed JSON<br/>NOT a live storEDGE API"]
    end

    TABLES[("facility_pms_* tables")]
    A2 --> TABLES
    B2 --> TABLES
    C1 --> TABLES

    classDef live fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef async fill:#faf9f5,stroke:#141413,color:#141413
    classDef manual fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    classDef tbl fill:#1e1d1b,stroke:#141413,color:#faf9f5
    class A1,A2 live
    class B1,B2 async
    class C1 manual
    class TABLES tbl
```

> **Watch out:** the `pms-upload-tab.tsx` UI does **not** POST to `/api/pms-upload`. It posts to `/api/pms-data` (Path A, synchronous, browser-parsed). `/api/pms-upload` is the separate queue feeder (Path B). Same destination tables, totally different mechanics.

---

## 2. Path B in full (the queue + cron)

```mermaid
sequenceDiagram
    autonumber
    participant U as Client / portal
    participant Up as POST /api/pms-upload
    participant Q as pms_reports
    participant Cron as job pms.process-upload (queued by upload)
    participant Blob as file_url
    participant T as facility_pms_*

    U->>Up: reportData (auth: admin key OR portal accessCode)
    Up->>Q: row status=uploaded (report_data JSON, file_url?)
    Up->>U: facilities.pms_uploaded=true + Resend notify
    Note over Cron: batch 10, oldest first, maxDuration 300s
    Cron->>Q: SELECT WHERE status=uploaded
    Cron->>Blob: fetch file_url → parseCSVText
    Cron->>Cron: classifyReport (headers/type sniff)
    alt classified rent_roll / aging / revenue
        Cron->>Cron: autoMapColumns vs EXPECTED_COLUMNS
        Cron->>T: deleteMany + createMany (rent_roll/aging)<br/>or upsert (revenue) · rent_roll rolls up snapshot
        Cron->>Q: status=processed
    else missing columns / unknown
        Cron->>Q: status=needs_review (+ missing list)
    else non-CSV / no file_url / empty
        Cron->>Q: status=failed
    end
```

### Classification rules (`classifyReport`)

```mermaid
flowchart TD
    CSV([CSV headers]) --> R{"'rent' OR daypastdue/paidthru/tenantname?"}
    R -->|yes| RR["rent_roll → facility_pms_rent_roll"]
    R -->|no| A{"'aging'/'receivable' OR bucket030/3160/91?"}
    A -->|yes| AG["aging → facility_pms_aging"]
    A -->|no| V{"'revenue'/'income' OR moveins/moveouts?"}
    V -->|yes| RV["revenue → facility_pms_revenue_history"]
    V -->|no| NR["needs_review (human queue)"]

    classDef t fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef nr fill:#faf9f5,stroke:#6a9bcc,color:#141413
    class RR,AG,RV t
    class NR nr
```

---

## 3. The `facility_pms_*` tables

```mermaid
erDiagram
    facilities ||--o{ facility_pms_snapshots : "per-date rollup (HUB)"
    facilities ||--o{ facility_pms_units : "per unit-type"
    facilities ||--o{ facility_pms_rent_roll : "per-unit @ date"
    facilities ||--o{ facility_pms_aging : "delinquency buckets"
    facilities ||--o{ facility_pms_revenue_history : "monthly"
    facilities ||--o{ facility_pms_rate_history : "rate history"
    facilities ||--o{ facility_pms_tenant_rates : "ECRI source"
    facilities ||--o{ facility_pms_length_of_stay : "tenure"
    facilities ||--o{ facility_pms_specials : "manual promos"
    facilities ||--o{ pms_reports : "queue / audit"
```

| Table | Holds | Write pattern |
|-------|-------|---------------|
| `facility_pms_snapshots` ⭐ | Facility rollup: occupancy %, gross potential, actual revenue, delinquency %, move-ins/outs. Unique `(facility_id, snapshot_date)` | upsert (rolled up from rent_roll) |
| `facility_pms_units` | Per unit-type inventory + pricing (street/web/push rate, `ecri_eligible`). Unique `(facility_id, unit_type)` | upsert (storedge-import) |
| `facility_pms_rent_roll` | Per-unit tenancy line items at a snapshot date | deleteMany + createMany |
| `facility_pms_aging` | Per-unit buckets 0-30…120+ | deleteMany + createMany |
| `facility_pms_revenue_history` | Monthly revenue/tax/move-ins/outs. Unique `(facility_id, year, month)` | upsert |
| `facility_pms_rate_history` | Historical street/web rates by unit-type + effective date | read by `facility-pms` (not CSV/cron-written) |
| `facility_pms_tenant_rates` | Per-tenant rate + ECRI flags. **Feeds churn/ECRI/NOI** | storedge-import only |
| `facility_pms_length_of_stay` | Per-tenant tenure | storedge-import only |
| `facility_pms_specials` | Promos/discounts | manual CRUD (not CSV) |
| `pms_reports` | Upload metadata + `report_data` + `status` | the queue/audit log |

> `tenants` and `tenant_payments` are a **separate pipeline** (via `POST /api/tenants` and `/api/v1/tenants`), not part of CSV ingestion — they model live tenant records for the [retention engine](09-retention-engine.md).

---

## 4. Downstream consumers

```mermaid
graph LR
    T[("facility_pms_*")] --> READ["Read APIs:<br/>/api/pms-data · /api/facility-pms<br/>facility-pms-queries.ts"]
    READ --> DASH["Admin PMS dashboard tabs:<br/>overview · rent-roll · aging<br/>revenue · length-of-stay · queue"]
    T --> INTEL["Intelligence:<br/>occupancy-forecast · revenue-intelligence<br/>revenue-loss · ecri-sensitivity · noi-report"]
    T --> AI["AI generation context:<br/>marketing-plan · landing-pages<br/>gbp-posts · facility-creatives · client-reports"]
    T --> V1["V1 API:<br/>facility-snapshots · facility-units<br/>facility-specials · facility-availability"]

    classDef tbl fill:#1e1d1b,stroke:#141413,color:#faf9f5
    classDef c fill:#e8e6dc,stroke:#141413,color:#141413
    class T tbl
    class READ,DASH,INTEL,AI,V1 c
```

The admin PMS dashboard (`pms-dashboard.tsx`) makes a single `/api/pms-data` fetch and fans it out to all read-only sub-tabs. The shared raw-query layer is `src/lib/facility-pms-queries.ts` (economic occupancy, rate-gap loss, etc.).

---

## 5. The human-review queue

```mermaid
flowchart LR
    NR["pms_reports status:<br/>needs_review / failed"] --> Q["/admin/pms-queue<br/>↔ /api/admin-pms-queue"]
    Q --> ACT["Filter · search · download file_url<br/>Mark Done · 'Process' → facility PMS tab"]

    classDef c fill:#e8e6dc,stroke:#141413,color:#141413
    class NR,Q,ACT c
```

Items the cron can't auto-classify land in `/admin/pms-queue` for manual handling. The same data embeds in the facility dashboard as `pms-queue-tab.tsx`.

---

## Key files

| Stage | File |
|-------|------|
| Admin tab (Path A) | `src/components/admin/facility-tabs/pms-upload-tab.tsx` → `/api/pms-data` |
| Queue feeder (Path B) | `src/app/api/pms-upload/route.ts` |
| Processing (queue job + manual cron route) | `src/lib/pms-uploads.ts` · `src/app/api/cron/process-pms-uploads/route.ts` |
| Column mapping | `src/lib/pms-column-mapper.ts` |
| Manual JSON import (Path C) | `src/app/api/storedge-import/route.ts` |
| Read APIs | `src/app/api/pms-data/route.ts`, `facility-pms/route.ts` |
| Shared queries | `src/lib/facility-pms-queries.ts` |
| Admin queue | `src/app/admin/pms-queue/page.tsx`, `/api/admin-pms-queue` |
| Tables | `facility_pms_*`, `pms_reports` in `prisma/schema.prisma` |
