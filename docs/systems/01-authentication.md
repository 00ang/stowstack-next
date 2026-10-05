# 01 · Authentication & Request Lifecycle

> **The headline:** Clerk (the proxy) enforces nothing. Four independent systems each gate themselves. A CSRF gate at the edge will **silently 403 any new mutating public route** before your handler ever runs. This is the system that bites hardest in production.

---

## 1. The four auth systems at a glance

```mermaid
graph TB
    REQ([Incoming request])

    subgraph Clerk["① Clerk — proxy only"]
        C1["Activates ONLY if<br/>pk_live_ keys present"]
        C2["Marks EVERY route public<br/>→ enforces nothing"]
    end

    subgraph Admin["② Admin key"]
        A1["Header: x-admin-key<br/>== ADMIN_SECRET"]
        A2["requireAdminKey()<br/>src/lib/api-helpers.ts"]
        A3["Per-admin keys: sa_adm_*<br/>scoped via admin-keys"]
    end

    subgraph Portal["③ Client portal"]
        P1["Email + 8-char access_code"]
        P2["Code minted on<br/>status → client_signed"]
        P3["Re-sent each call:<br/>?accessCode= or Bearer code"]
    end

    subgraph Partner["④ Partner / org session"]
        T1["Email + password + org slug<br/>POST /api/organizations"]
        T2["ss_ token → sessions table<br/>(raw SQL, SHA-256 hash)"]
        T3["getSession() · 30-day expiry"]
    end

    REQ --> Clerk
    REQ --> Admin
    REQ --> Portal
    REQ --> Partner

    classDef clerk fill:#e8e6dc,stroke:#b0aea5,color:#6a6560
    classDef live fill:#faf9f5,stroke:#141413,color:#141413
    class C1,C2 clerk
    class A1,A2,A3,P1,P2,P3,T1,T2,T3 live
```

| System | Credential | Where checked | Helper | Storage |
|--------|-----------|---------------|--------|---------|
| **Clerk** | session cookie | `src/proxy.ts` (pages only) | `clerkMiddleware` | — (effectively pass-through) |
| **Admin key** | `x-admin-key` header == `ADMIN_SECRET` | per route handler | `requireAdminKey()` | env var; per-admin keys in `admin_keys` |
| **Client portal** | email + `access_code` (8 hex chars) | per route handler | `authenticatePortalRequest()` | `localStorage` key `storageads_portal_session` |
| **Partner/org** | `ss_`-prefixed bearer token | per route handler | `getSession()` | `sessions` table (hash only) |
| *(Facility tools)* | signed `sm_` token in the httpOnly `sa_manage` cookie, scoped to facility ids | per route handler | `requireFacilityAccess()` | stateless (HMAC, 14 days); minted by the portal login and the partner session — see ④½ |
| *(Cron)* | `Authorization: Bearer $CRON_SECRET` | per cron handler | `verifyCronSecret()` | env var (fail-closed) |
| *(V1 API)* | `Authorization: Bearer sk_live_…` | per V1 route | `requireApiAuth()` | `api_keys` table (hash only) |

**Why four?** They guard four different audiences: Blake/Angelo (admin), signed customers (portal), resellers & referral partners (partner), and external API consumers (V1). Clerk is wired but deliberately inert: API routes short-circuit before Clerk runs, and for page routes the finite `isPublicRoute()` matcher lists the app's known routes (marketing, `/portal`, `/partner`, `/admin`, `/api`) as public — so in practice `auth.protect()` guards nothing. (Strictly, a *page* route not in that finite list would be protected when `pk_live_` keys are set; the app doesn't rely on that.)

---

## 2. The request lifecycle (and the CSRF footgun)

Every request hits `src/proxy.ts` at the edge first. For `/api/*` this is the gauntlet:

```mermaid
flowchart TD
    START([POST /api/something]) --> SENTRY["Sentry.setTag route + method"]
    SENTRY --> ISAPI{"path starts<br/>with /api/ ?"}
    ISAPI -->|no| CLERKPAGE["Page route → Clerk block<br/>(public ⇒ pass) + seed __csrf_token cookie"]
    ISAPI -->|yes| MUT{"method mutating?<br/>POST/PUT/PATCH/DELETE"}
    MUT -->|no| PASS
    MUT -->|yes| EXEMPT{"isCsrfExempt(req) ?"}

    EXEMPT -->|"path whitelist<br/>OR credential header"| PASS["applySecurityHeaders<br/>NextResponse.next()"]
    EXEMPT -->|"no exemption"| VALIDATE{"validateCsrf():<br/>__csrf_token cookie<br/>== x-csrf-token header ?"}

    VALIDATE -->|"match"| PASS
    VALIDATE -->|"missing/mismatch<br/>⚠️ NO client sends the header"| BLOCK["403 Invalid or missing CSRF token<br/>🛑 handler NEVER runs"]

    PASS --> HANDLER["Route handler runs<br/>→ self-gates with its own auth helper"]

    classDef ok fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef bad fill:#faf9f5,stroke:#B04A3A,color:#B04A3A
    classDef neutral fill:#e8e6dc,stroke:#141413,color:#141413
    class PASS,HANDLER ok
    class BLOCK bad
    class SENTRY,ISAPI,MUT,EXEMPT,VALIDATE,CLERKPAGE neutral
```

### The footgun, stated plainly

The CSRF gate is a **double-submit check**: it needs a `__csrf_token` cookie *and* a matching `x-csrf-token` header. **No client in this app sends `x-csrf-token`.** So mutating `/api/*` requests only survive via `isCsrfExempt()`, which exempts:

- **By credential header** — any request carrying `x-admin-key`, `Authorization: Bearer …`, or `x-org-token`. This is how *every authenticated* admin/portal/partner call rides through: their credential header is itself the exemption.
- **By path whitelist** — webhooks, cron, V1, and the named pre-auth public POSTs.

```mermaid
graph LR
    subgraph Exempt["✅ isCsrfExempt() — passes the gate"]
        direction TB
        H["Header exemptions:<br/>x-admin-key<br/>Authorization: Bearer<br/>x-org-token"]
        PW["Path whitelist:<br/>/api/webhooks/*<br/>/api/stripe-webhook<br/>/api/call-webhook<br/>/api/cron/*<br/>/api/v1/*<br/>audit-form · consumer-lead<br/>diagnostic-intake · facility-lookup<br/>resend-access-code · client-data"]
    end
    subgraph Trap["🛑 NOT exempt — silent 403 in prod"]
        T["A NEW pre-auth public POST<br/>(no credential header,<br/>not on the whitelist)<br/><br/>Only signal: 403 in Vercel logs"]
    end

    classDef good fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef trap fill:#faf9f5,stroke:#B04A3A,color:#B04A3A
    class H,PW good
    class T trap
```

> **Rule when adding a public POST route:** if it runs *before* any of the three credential headers exist (e.g. a login, a lead-capture form), you **must** add its exact path to `isCsrfExempt()` in `src/proxy.ts`. Otherwise it 403s in prod with no handler log. This is the documented cause of the `/portal` login break, and why `resend-access-code` and `client-data` are explicitly whitelisted.

---

## 3. Each system in detail

### ② Admin key — `requireAdminKey(req)` returns `NextResponse | null`

`null` means authorized; a non-null response is the 401/403 to return.

```mermaid
flowchart TD
    A([requireAdminKey req]) --> EQ{"x-admin-key == ADMIN_SECRET?<br/>(safeCompare: SHA-256 + timingSafeEqual)"}
    EQ -->|yes| GOD["return null — 'god-mode'<br/>scope checks bypassed"]
    EQ -->|no| PFX{"header starts<br/>with sa_adm_ ?"}
    PFX -->|yes| VAL["validateAdminKey()<br/>from @/lib/admin-keys"]
    VAL --> SCOPE{"valid + hasScope?"}
    SCOPE -->|yes| OK2["return null"]
    SCOPE -->|no| F403["errorResponse 403"]
    PFX -->|no| F401["errorResponse 401 Unauthorized"]

    classDef ok fill:#faf9f5,stroke:#788c5d,color:#141413
    classDef bad fill:#faf9f5,stroke:#B04A3A,color:#B04A3A
    class GOD,OK2 ok
    class F403,F401 bad
```

There's also `requireAdminAuth()` — dual auth that accepts the admin key **or** a Clerk session whose `role` is `admin`/`virtual_assistant`. The shared `ADMIN_SECRET` is god-mode (Blake + Angelo); the `sa_adm_*` per-admin keys carry scopes.

### ③ Client portal — the access code *is* the credential

```mermaid
sequenceDiagram
    participant Admin as Admin
    participant Lead as admin-leads route
    participant DB as facilities / clients
    participant Cust as Customer
    participant Route as Portal API

    Admin->>Lead: status → "client_signed"
    Lead->>DB: randomBytes(4).hex.toUpperCase()<br/>→ 8-char access_code
    DB-->>Cust: welcome email w/ code
    Note over Cust: saved to localStorage<br/>storageads_portal_session
    Cust->>Route: ?accessCode=&email=<br/>OR Authorization: Bearer <code>
    Route->>DB: clients.findFirst({ access_code, email })
    DB-->>Route: client row → facilityId
    Note over Route: no server session<br/>code re-sent every call
```

Three coexisting validation patterns (all read the same `clients.access_code`): query params (`authenticatePortalRequest`), `Authorization: Bearer <code>`, and POST body `{ email, accessCode }` (the pre-auth, CSRF-exempt path).

### ④ Partner / org session — the only server-side session

```mermaid
sequenceDiagram
    participant U as Partner
    participant Login as POST /api/organizations
    participant S as sessions (raw SQL)
    participant Route as Partner API

    U->>Login: email + password + org slug
    Login->>Login: generateToken()<br/>"ss_" + 32 random bytes
    Login->>S: store SHA-256 hashToken only<br/>+ ip, user_agent, expires +30d
    Login-->>U: raw ss_ token (client keeps)
    U->>Route: Authorization: Bearer ss_…<br/>OR x-org-token: ss_…
    Route->>S: lookupSession() — $queryRaw join<br/>sessions → org_users → organizations
    Note over S: WHERE token_hash=? AND expires_at>NOW()<br/>AND ou.status='active' AND o.status IN (active,pending_deletion)
    S-->>Route: { user, organization } or null
    Note over S: fire-and-forget last_active_at = NOW()
```

This is the **only** raw-SQL island in the codebase (`src/lib/session-auth.ts`) — everything else uses Prisma client methods. Only the token *hash* is stored; the raw token lives only on the client.

### ④½ Facility tools session — riding on ③ and ④

Clients and partner orgs use the same facility tools as the admin facility manager (Creative Studio, Ad Generator, Landing Pages, Google Business, market data…), rendered by `src/components/owner-tools/owner-tools.tsx` at **`/portal/tools`** and **`/partner/tools`**. There is no separate login: the session is minted as a side effect of the logins above.

| Minted by | Scope | Mode |
|-----------|-------|------|
| Portal login / every portal load (`POST /api/client-data`) | every live facility whose live `clients` row has this email (`clientToolFacilityIds`) | `portal` |
| `/partner/tools` → `POST /api/org-tools-session` (org_admin / facility_manager only) | every live facility in the org (`orgToolFacilityIds`) | `org` |
| Invite signup `/manage` → `POST /api/manage/scratch` (also provisions a portal client) | the new facility | `scratch` |

- **Token:** `src/lib/manage-session.ts` — stateless HMAC (`MANAGE_SESSION_SECRET`, falls back to `ADMIN_SECRET`), `sm_` prefix, httpOnly + SameSite=Lax cookie `sa_manage`, 14-day TTL, refreshed on each login/visit. Sign-out in either shell calls `POST /api/manage/logout`.
- **Checked by:** `requireFacilityAccess(req, facilityId)` (admin key **or** a session scoped to that facility) and `requireManageOrAdmin` for facility-less reads. The tool components get `adminKey=""` and send nothing extra — same-origin fetches carry the cookie.
- **CSRF:** page JS can't read the cookie, so the proxy exempts requests that carry `sa_manage` **and** a same-origin `Origin` (§2). Without that, every owner mutation 403s at the edge.
- **Plan gate:** AI video (`POST /api/generate-video`) is Portfolio-only for owners (`canGenerateVideo` / `orgAllowsVideo` in `src/lib/plan-limits.ts` — plan of the facility's org; lapsed plans lose it). Admins are never gated. `GET /api/manage/session` returns `videoEnabled` per facility so the UI shows an upgrade panel instead of the tool.
- **Owner-only edits:** profile edits go through `PATCH /api/manage/facility` (no `notes`, no pipeline status), never the admin route. `/manage/dashboard` 307s to `/portal/tools`.

---

## 4. Cron & V1 — the machine-to-machine auth

```mermaid
graph TB
    subgraph Cron["Cron — verifyCronSecret() · FAIL-CLOSED"]
        CR1["Header: Authorization: Bearer $CRON_SECRET"]
        CR2["if CRON_SECRET unset → reject ALL"]
        CR3["SHA-256 + timingSafeEqual compare"]
        CR4["/api/cron/* is path-exempt from CSRF"]
    end
    subgraph V1["V1 external API — requireApiAuth()"]
        V1a["Header: Authorization: Bearer sk_live_…"]
        V1b["lookup api_keys WHERE key_hash = SHA-256"]
        V1c["reject: revoked · expired · rate-limited (429)"]
        V1d["success → last_used_at + api_usage_log"]
    end

    classDef c fill:#faf9f5,stroke:#6a9bcc,color:#141413
    class CR1,CR2,CR3,CR4,V1a,V1b,V1c,V1d c
```

**Fail-closed matters:** if `CRON_SECRET` is missing, *no* cron can run — better than every cron being world-callable. V1 keys are revocable, expirable, scoped, and rate-limited per key.

---

## 5. What the proxy also does (besides CSRF)

`src/proxy.ts` is more than the CSRF gate — it's the single edge chokepoint:

1. **Sentry route tagging** — `route` + `method` on every request (first thing it does).
2. **CSRF gate** — section 2 above.
3. **API short-circuit** — `/api/*` skips Clerk entirely ("they handle their own auth") and returns with security headers.
4. **Clerk** — runs for *page* routes only, and only with `pk_live_` keys; `pk_test_` is skipped to avoid `dev-browser-missing` errors on Vercel.
5. **CSRF cookie seeding** — non-API page responses get a `__csrf_token` cookie if missing.
6. **Security headers** on every response — note **CSP is report-only** (`Content-Security-Policy-Report-Only`), plus `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.

---

## Key files

| Concern | File |
|---------|------|
| Edge gate / CSRF / Clerk / Sentry | `src/proxy.ts` |
| CSRF mechanics | `src/lib/csrf.ts` |
| Admin key + helpers | `src/lib/api-helpers.ts` (`requireAdminKey`, `requireAdminAuth`, `safeCompare`) |
| Partner sessions (raw SQL) | `src/lib/session-auth.ts` |
| Facility tools session | `src/lib/manage-session.ts`, `src/lib/owner-tools.ts`, `src/components/owner-tools/owner-tools.tsx` |
| Portal auth | `src/lib/portal-auth.ts`, `src/lib/portal-helpers.tsx` |
| Cron auth (fail-closed) | `src/lib/cron-auth.ts` |
| V1 API auth | `src/lib/v1-auth.ts` |
| Access-code minting | `src/app/api/admin-leads/route.ts` (lines ~234-257) |
