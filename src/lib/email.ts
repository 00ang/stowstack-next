/**
 * Centralized email layer for StorageAds.
 *
 * Every outbound email should flow through `sendEmail()` (or `sendBatchEmails()`)
 * rather than calling the Resend SDK / `fetch("https://api.resend.com/emails")`
 * directly. This module is the single source of truth for:
 *
 *   - Sender identities (the `SENDERS` registry + `facilitySender()`), so the
 *     `from` string is never hand-typed and stays on the `@storageads.com` domain
 *     that CLAUDE.md mandates.
 *   - Input validation (recipients, subject, body, sender domain) so a malformed
 *     payload fails fast and loudly instead of silently 4xx-ing at Resend.
 *   - Resilient delivery: per-attempt timeout, retry with exponential backoff +
 *     jitter on transient failures (network errors, 429, 5xx), and `Retry-After`
 *     honoring for rate limits — important on the free tier (100/day).
 *   - Safety rails for non-production: `EMAIL_DRY_RUN` to no-op, and
 *     `EMAIL_REDIRECT_TO` to funnel all mail to a test inbox so a stray send in
 *     dev/preview can never reach a real customer.
 *   - Idempotency (Resend `Idempotency-Key`) so a retried request — by us or by
 *     the platform — never double-sends.
 *
 * The transport is raw `fetch` (no SDK coupling), which keeps the module trivial
 * to unit test by mocking `global.fetch`.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_BATCH_ENDPOINT = "https://api.resend.com/emails/batch";

/** The only domain StorageAds is allowed to send from (CLAUDE.md: all emails from *@storageads.com). */
export const SENDING_DOMAIN = "storageads.com";

/** Resend caps a single batch request at 100 messages. */
export const RESEND_BATCH_LIMIT = 100;

/** Defensive cap on recipients for a single message. */
const MAX_RECIPIENTS = 50;

// Defaults — overridable per call via SendEmailParams.
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2; // total attempts = retries + 1
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;

/* -------------------------------------------------------------------------- */
/* Sender registry                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Canonical sender identities. Keyed by intent so call sites read clearly
 * (`SENDERS.billing`) and the underlying address/display-name lives in exactly
 * one place. Every value is validated by the test suite to be on SENDING_DOMAIN.
 */
export const SENDERS = {
  /** General transactional default. */
  noreply: "StorageAds <noreply@storageads.com>",
  /** System/internal automated notices (e.g. data-deletion admin alerts, cron failures). */
  system: "StorageAds System <noreply@storageads.com>",
  /** Spend/performance/campaign alerts. */
  alerts: "StorageAds Alerts <alerts@storageads.com>",
  /** Lifecycle/nurture/owner notifications. */
  notifications: "StorageAds <notifications@storageads.com>",
  /** Monthly/weekly reports and digests. */
  reports: "StorageAds <reports@storageads.com>",
  /** Invoices and billing. */
  billing: "StorageAds Billing <billing@storageads.com>",
  /** Partner program. */
  partners: "StorageAds Partners <partners@storageads.com>",
  /** Org/client onboarding from the "team" mailbox (non white-label org-email). */
  team: "StorageAds <team@storageads.com>",
  /** Founder-voiced outreach / recovery / personal-touch sends. */
  blake: "Blake at StorageAds <noreply@storageads.com>",
  /** Onboarding-reminder persona used by send-template. */
  anna: "Anna at StorageAds <noreply@storageads.com>",
} as const;

export type SenderKey = keyof typeof SENDERS;

const BLAKE_EMAIL = "blake@storageads.com";
const ANGELO_EMAIL = "angelo@storageads.com";

/**
 * Internal alerts for a form submission or an audit request.
 * Blake stays on the list. Angelo is copied. ADMIN_EMAIL is included when set.
 */
export function submissionNotifyRecipients(
  extra: Array<string | null | undefined> = []
): string[] {
  const primary = process.env.ADMIN_EMAIL?.trim() || BLAKE_EMAIL;
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const value of [primary, BLAKE_EMAIL, ANGELO_EMAIL, ...extra]) {
    const email = value?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(email);
  }
  return recipients;
}

/** Mailboxes a facility-scoped sender may speak from. */
export type FacilityChannel = "notifications" | "reviews";

/**
 * Build a facility-scoped sender like `"Sunset Storage <reviews@storageads.com>"`.
 * Used by review-solicitation and per-facility nurture where the display name is
 * the facility, not "StorageAds". Falls back to "StorageAds" when no name.
 */
export function facilitySender(
  facilityName: string | null | undefined,
  channel: FacilityChannel = "notifications"
): string {
  const name = sanitizeDisplayName(facilityName) || "StorageAds";
  return `${name} <${channel}@${SENDING_DOMAIN}>`;
}

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface EmailTag {
  name: string;
  value: string;
}

export interface EmailAttachment {
  /** Filename shown to the recipient, e.g. "report-2026-06.pdf". */
  filename: string;
  /** Base64-encoded file content. Mutually exclusive with `path`. */
  content?: string;
  /** Hosted URL Resend will fetch the attachment from. Mutually exclusive with `content`. */
  path?: string;
  /** Optional explicit MIME type (Resend infers from the filename otherwise). */
  contentType?: string;
}

export interface SendEmailParams {
  /** Sender identity. Prefer a SENDERS value or facilitySender(); must be on the sending domain. */
  from: string;
  /** One or more recipient addresses. */
  to: string | string[];
  subject: string;
  /** At least one of html/text is required. */
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  /** Custom SMTP-ish headers passed through to Resend. */
  headers?: Record<string, string>;
  /** Resend tags for analytics/segmentation. */
  tags?: EmailTag[];
  /** File attachments (base64 content or a hosted path). */
  attachments?: EmailAttachment[];
  /** ISO-8601 timestamp or natural language (e.g. "in 1 hour") for Resend scheduled send. */
  scheduledAt?: string;
  /**
   * Idempotency key. If two requests carry the same key within Resend's window,
   * only one email is sent. Strongly recommended for anything triggered by a
   * retriable job (crons, webhooks).
   */
  idempotencyKey?: string;
  /** Escape hatch to allow a from-address outside SENDING_DOMAIN (white-label, etc.). */
  allowExternalDomain?: boolean;
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number;
  /** Retry attempts after the first try. Default 2 (=> 3 total attempts). */
  retries?: number;
  /** Base backoff delay. Default 500ms. Set 0 in tests to avoid real waits. */
  retryBaseDelayMs?: number;
}

export interface SendEmailResult {
  /** True only when Resend accepted the message. */
  ok: boolean;
  /** Resend message id when ok. */
  id?: string;
  /** Human-readable error when !ok and not skipped. */
  error?: string;
  /** HTTP status from the final Resend attempt, when applicable. */
  status?: number;
  /** Number of network attempts made. */
  attempts?: number;
  /** True when the send was intentionally not attempted (no key / dry run). */
  skipped?: boolean;
  /** Why it was skipped. */
  skipReason?: string;
}

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

// Pragmatic RFC-5322-ish address check. Intentionally not exhaustive — the goal
// is to catch obvious mistakes (missing @, spaces, empty) before hitting Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(address: string): boolean {
  return typeof address === "string" && EMAIL_RE.test(address.trim());
}

/**
 * Extract the bare email from a `"Display Name <email@host>"` or plain `email@host`
 * string. Returns null if no address can be found.
 */
export function extractEmailAddress(from: string): string | null {
  if (typeof from !== "string") return null;
  const angle = from.match(/<([^<>]+)>/);
  const candidate = (angle ? angle[1] : from).trim();
  return isValidEmail(candidate) ? candidate : null;
}

/** Strip characters that would break the `Name <addr>` display-name slot. */
function sanitizeDisplayName(name: string | null | undefined): string {
  if (!name) return "";
  // Drop angle brackets, quotes, and control/newline chars; collapse whitespace.
  return name
    .replace(/[<>"\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toArray(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Validate a fully-formed email payload. Returns an error string, or null if valid.
 * Exported so routes/tests can pre-flight a payload without sending.
 */
export function validateEmailParams(params: SendEmailParams): string | null {
  const { from, subject, html, text, allowExternalDomain } = params;

  // from
  if (!from || typeof from !== "string" || !from.trim()) {
    return "Missing 'from' address";
  }
  const fromAddress = extractEmailAddress(from);
  if (!fromAddress) {
    return `Invalid 'from' address: ${from}`;
  }
  if (!allowExternalDomain) {
    const domain = fromAddress.split("@")[1]?.toLowerCase();
    if (domain !== SENDING_DOMAIN) {
      return `'from' must be on @${SENDING_DOMAIN} (got @${domain}). Pass allowExternalDomain to override.`;
    }
  }

  // recipients
  const to = toArray(params.to).map((r) => r.trim()).filter(Boolean);
  if (to.length === 0) {
    return "At least one 'to' recipient is required";
  }
  const everyRecipient = [...to, ...toArray(params.cc), ...toArray(params.bcc)].map((r) =>
    r.trim()
  );
  if (everyRecipient.length > MAX_RECIPIENTS) {
    return `Too many recipients (${everyRecipient.length} > ${MAX_RECIPIENTS})`;
  }
  for (const recipient of everyRecipient) {
    if (!isValidEmail(recipient)) {
      return `Invalid recipient address: ${recipient}`;
    }
  }
  for (const r of toArray(params.replyTo)) {
    if (!isValidEmail(r.trim())) {
      return `Invalid reply-to address: ${r}`;
    }
  }

  // subject + body
  if (!subject || !subject.trim()) {
    return "Missing 'subject'";
  }
  const hasHtml = typeof html === "string" && html.trim().length > 0;
  const hasText = typeof text === "string" && text.trim().length > 0;
  if (!hasHtml && !hasText) {
    return "Email must include 'html' or 'text' content";
  }

  // attachments — each must carry exactly one of content/path and a filename,
  // otherwise Resend silently drops it (or the whole send).
  if (params.attachments) {
    for (let i = 0; i < params.attachments.length; i++) {
      const a = params.attachments[i];
      if (!a.filename || !a.filename.trim()) {
        return `Attachment ${i} is missing a filename`;
      }
      const hasContent = typeof a.content === "string" && a.content.length > 0;
      const hasPath = typeof a.path === "string" && a.path.length > 0;
      if (hasContent === hasPath) {
        return `Attachment "${a.filename}" must have exactly one of 'content' or 'path'`;
      }
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Environment / behavior resolution                                          */
/* -------------------------------------------------------------------------- */

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Resolve the public site origin used to build links inside emails. */
export function resolveSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://storageads.com")
  );
}

interface ResolvedRecipients {
  to: string[];
  cc: string[];
  bcc: string[];
  /** Set when EMAIL_REDIRECT_TO rerouted the mail; carries the original recipients for the subject tag. */
  redirectedFrom?: string[];
}

/**
 * Apply the non-production redirect guard. In production this is a pass-through.
 * Outside production, if EMAIL_REDIRECT_TO is set, ALL recipients are replaced by
 * that single inbox so test/preview sends can never reach a customer.
 */
function resolveRecipients(params: SendEmailParams): ResolvedRecipients {
  const to = toArray(params.to).map((r) => r.trim()).filter(Boolean);
  const cc = toArray(params.cc).map((r) => r.trim()).filter(Boolean);
  const bcc = toArray(params.bcc).map((r) => r.trim()).filter(Boolean);

  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();
  const isProd = process.env.NODE_ENV === "production";
  if (redirect && !isProd && isValidEmail(redirect)) {
    return {
      to: [redirect],
      cc: [],
      bcc: [],
      redirectedFrom: [...to, ...cc, ...bcc],
    };
  }
  return { to, cc, bcc };
}

/* -------------------------------------------------------------------------- */
/* Core send                                                                  */
/* -------------------------------------------------------------------------- */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function computeBackoff(attemptIndex: number, baseDelayMs: number): number {
  if (baseDelayMs <= 0) return 0;
  const exponential = baseDelayMs * Math.pow(2, attemptIndex);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status >= 500;
}

/** Parse a `Retry-After` header (seconds form) into ms, capped. Returns null if absent/unparseable. */
function parseRetryAfter(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  }
  return null;
}

/**
 * Build the JSON body Resend expects from our camelCase params.
 * Recipients are passed in already-resolved (post redirect guard).
 */
function buildResendBody(
  params: SendEmailParams,
  recipients: ResolvedRecipients
): Record<string, unknown> {
  let subject = params.subject;
  if (recipients.redirectedFrom && recipients.redirectedFrom.length > 0) {
    subject = `[DEV→${recipients.redirectedFrom.join(", ")}] ${subject}`;
  }

  const body: Record<string, unknown> = {
    from: params.from,
    to: recipients.to,
    subject,
  };
  if (params.html) body.html = params.html;
  if (params.text) body.text = params.text;
  if (recipients.cc.length) body.cc = recipients.cc;
  if (recipients.bcc.length) body.bcc = recipients.bcc;
  const replyTo = toArray(params.replyTo);
  if (replyTo.length) body.reply_to = replyTo;
  if (params.headers && Object.keys(params.headers).length) body.headers = params.headers;
  if (params.tags && params.tags.length) body.tags = params.tags;
  if (params.attachments && params.attachments.length) {
    body.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      ...(a.content != null ? { content: a.content } : {}),
      ...(a.path != null ? { path: a.path } : {}),
      ...(a.contentType != null ? { content_type: a.contentType } : {}),
    }));
  }
  if (params.scheduledAt) body.scheduled_at = params.scheduledAt;
  return body;
}

/**
 * Send a single transactional email through Resend.
 *
 * Never throws — always resolves to a `SendEmailResult`. Email delivery is
 * treated as non-critical to the calling request, so callers can fire-and-check
 * without try/catch. Use `sendEmailOrThrow` if you want failures to surface.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // 1) Validate before doing anything else.
  const validationError = validateEmailParams(params);
  if (validationError) {
    console.error(`[email] validation failed: ${validationError}`);
    return { ok: false, error: validationError, attempts: 0 };
  }

  // 2) Dry-run guard — never touches the network.
  if (isTruthyEnv(process.env.EMAIL_DRY_RUN)) {
    console.warn(
      `[email] DRY RUN — not sending "${params.subject}" to ${toArray(params.to).join(", ")}`
    );
    return { ok: false, skipped: true, skipReason: "EMAIL_DRY_RUN", attempts: 0 };
  }

  // 3) Missing key — skip (matches prior fail-soft behavior; visible in logs).
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${params.subject}"`);
    return { ok: false, skipped: true, skipReason: "RESEND_API_KEY missing", attempts: 0 };
  }

  // 4) Resolve recipients (applies non-prod redirect guard).
  const recipients = resolveRecipients(params);
  const requestBody = buildResendBody(params, recipients);

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = params.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = params.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey;
  }

  let lastError = "Unknown error";
  let lastStatus: number | undefined;

  const totalAttempts = retries + 1;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const isLastAttempt = attempt === totalAttempts - 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timer);
      lastStatus = res.status;

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: data.id, status: res.status, attempts: attempt + 1 };
      }

      // Non-2xx. Capture body for diagnostics.
      const detail = await res.text().catch(() => "");
      lastError = `Resend ${res.status}: ${detail || res.statusText}`;

      if (!isRetryableStatus(res.status) || isLastAttempt) {
        console.error(`[email] send failed (final): ${lastError}`);
        return {
          ok: false,
          error: lastError,
          status: res.status,
          attempts: attempt + 1,
        };
      }

      const retryAfter = parseRetryAfter(res.headers);
      const delay = retryAfter ?? computeBackoff(attempt, baseDelayMs);
      console.warn(
        `[email] transient failure (${res.status}), retry ${attempt + 1}/${retries} in ${delay}ms`
      );
      await sleep(delay);
      continue;
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = aborted
        ? `Request timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);

      if (isLastAttempt) {
        console.error(`[email] send failed (final, network): ${lastError}`);
        return { ok: false, error: lastError, status: lastStatus, attempts: attempt + 1 };
      }

      const delay = computeBackoff(attempt, baseDelayMs);
      console.warn(
        `[email] network error "${lastError}", retry ${attempt + 1}/${retries} in ${delay}ms`
      );
      await sleep(delay);
      continue;
    }
  }

  // Unreachable in practice (loop always returns), but satisfies the type checker.
  return { ok: false, error: lastError, status: lastStatus, attempts: totalAttempts };
}

/**
 * Like `sendEmail` but throws on failure (and on intentional skips). Use only
 * where the email IS the operation and the caller wants the error to propagate.
 */
export async function sendEmailOrThrow(params: SendEmailParams): Promise<{ id?: string }> {
  const result = await sendEmail(params);
  if (!result.ok) {
    throw new Error(
      result.skipped
        ? `Email skipped: ${result.skipReason}`
        : `Email send failed: ${result.error}`
    );
  }
  return { id: result.id };
}

/* -------------------------------------------------------------------------- */
/* Batch send                                                                 */
/* -------------------------------------------------------------------------- */

export interface SendBatchResult {
  ok: boolean;
  /** Resend message ids, in input order, for the messages it accepted. */
  ids: string[];
  error?: string;
  status?: number;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Send up to RESEND_BATCH_LIMIT (100) emails in one request via Resend's batch
 * endpoint. Each item is validated; an invalid item fails the whole call before
 * any network I/O (the batch endpoint is all-or-nothing on our side).
 *
 * Note: the batch endpoint does not support per-message attachments/scheduling
 * the same way single sends do; this wrapper passes through the common fields.
 */
export async function sendBatchEmails(
  messages: SendEmailParams[]
): Promise<SendBatchResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, ids: [], error: "No messages provided" };
  }
  if (messages.length > RESEND_BATCH_LIMIT) {
    return {
      ok: false,
      ids: [],
      error: `Batch too large (${messages.length} > ${RESEND_BATCH_LIMIT})`,
    };
  }

  for (let i = 0; i < messages.length; i++) {
    const err = validateEmailParams(messages[i]);
    if (err) {
      return { ok: false, ids: [], error: `Message ${i}: ${err}` };
    }
  }

  if (isTruthyEnv(process.env.EMAIL_DRY_RUN)) {
    console.warn(`[email] DRY RUN — not sending batch of ${messages.length}`);
    return { ok: false, ids: [], skipped: true, skipReason: "EMAIL_DRY_RUN" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping batch of ${messages.length}`);
    return { ok: false, ids: [], skipped: true, skipReason: "RESEND_API_KEY missing" };
  }

  const payload = messages.map((m) => {
    const recipients = resolveRecipients(m);
    return buildResendBody(m, recipients);
  });

  try {
    const res = await fetch(RESEND_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `Resend batch ${res.status}: ${detail || res.statusText}`;
      console.error(`[email] batch send failed: ${error}`);
      return { ok: false, ids: [], error, status: res.status };
    }

    const data = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? []).map((d) => d.id).filter((id): id is string => Boolean(id));
    return { ok: true, ids, status: res.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] batch send error: ${error}`);
    return { ok: false, ids: [], error };
  }
}
