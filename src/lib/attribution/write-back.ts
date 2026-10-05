/**
 * Write-back — tell the ad platforms a click became a move-in (MISSION.md s12).
 *
 * Until this existed, Meta heard about leads and Google heard nothing, so both
 * optimised for form fills. A move-in is the event a storage operator is paying
 * for; reporting it lets the platforms bid on it.
 *
 * Flow: a confident lead↔tenant match emits `lead.moved_in` on the event bus;
 * the bus fans out one job per platform (`prove.meta-conversion`,
 * `prove.google-conversion`); each job loads the lead's touches, decides what
 * it can honestly report, sends it, and writes one `conversion_reports` row
 * saying what happened. That row is the audit trail and the source for
 * "failed conversion reporting" in the operator queue.
 *
 * Retries are safe by construction. Every report carries the same id on every
 * attempt — Meta's event_id, Google's order_id — and both platforms drop a
 * duplicate of it. So a vendor timeout is retried (not frozen, unlike a
 * postcard, which would really print twice).
 *
 * The top half of this file is pure and tested; the bottom half is the I/O.
 */

import { db } from "@/lib/db";
import { getValidGoogleToken } from "@/lib/platform-auth";
import { sendMetaEvent } from "@/lib/meta-capi";
import type { JobHandler } from "@/lib/jobs/types";
import { DAY_MS, pickGoogleClick, pickMetaClick, type GoogleClick, type TouchRecord } from "./touch";
import { loadLeadTouches } from "./visitor";

// ── Pure ───────────────────────────────────────────────────────────────────

/** Meta accepts a physical_store event up to 62 days after it happened. */
export const META_MAX_AGE_DAYS = 62;

/**
 * Google Ads API version for the upload. The ad publisher in this repo still
 * calls v17, which Google has sunset; this does not inherit that. Override with
 * GOOGLE_ADS_API_VERSION when Google moves on.
 */
export const GOOGLE_ADS_API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v25";

/** The identity of the fact — this tenant moved in — sent as Meta event_id and Google order_id. */
export function moveInEventId(tenantId: string): string {
  return `movein:${tenantId}`;
}

function parseDateOnly(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const iso = typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const t = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/**
 * The latest moment a click can count toward this move-in: the end of the
 * move-in day, or now if that is still ahead.
 */
export function clickCutoff(moveInDate: string | Date | null | undefined, now: Date): Date {
  const day = parseDateOnly(moveInDate);
  if (!day) return now;
  const endOfDay = new Date(day.getTime() + DAY_MS - 1000);
  return endOfDay < now ? endOfDay : now;
}

/**
 * When we tell the platform the conversion happened.
 *
 * The PMS gives a date, not a time, so the move-in is placed at 17:00 UTC
 * (midday across US time zones). Two corrections keep the platforms from
 * rejecting it: never before the click it is credited to (Google refuses a
 * conversion that precedes its click), and never in the future.
 */
export function conversionTime(
  moveInDate: string | Date | null | undefined,
  lastClickAt: Date | null,
  now: Date,
): Date {
  const day = parseDateOnly(moveInDate);
  let at = day ? new Date(day.getTime() + 17 * 60 * 60 * 1000) : new Date(now);
  if (lastClickAt && at.getTime() <= lastClickAt.getTime()) at = new Date(lastClickAt.getTime() + 60_000);
  if (at.getTime() > now.getTime()) at = new Date(now);
  return at;
}

/** Google's required "yyyy-mm-dd hh:mm:ss+00:00", in UTC. */
export function googleDateTime(d: Date): string {
  return `${d.toISOString().slice(0, 19).replace("T", " ")}+00:00`;
}

export interface MoveInFacts {
  now: Date;
  moveInDate: string | Date | null;
  monthlyRate: number | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  touches: TouchRecord[];
}

export type Skip = { send: false; reason: string; detail?: string };

export type MetaPlan =
  | Skip
  | {
      send: true;
      eventTime: Date;
      value: number | null;
      clickIdType: "fbc" | "none";
      userData: {
        email: string | null;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        fbc: string | null;
        fbp: string | null;
      };
    };

function splitName(name: string | null): { firstName: string | null; lastName: string | null } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return { firstName: parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : null };
}

const positive = (n: number | null) => (n != null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null);

/**
 * What can honestly be reported to Meta. Meta matches an offline conversion on
 * hashed email/phone and, when the person clicked a Meta ad, on fbc — with
 * none of those there is nobody to match, so it is skipped rather than sent
 * as noise.
 */
export function planMeta(f: MoveInFacts): MetaPlan {
  const click = pickMetaClick(f.touches, clickCutoff(f.moveInDate, f.now));
  const eventTime = conversionTime(f.moveInDate, click.clickedAt, f.now);
  if (f.now.getTime() - eventTime.getTime() > META_MAX_AGE_DAYS * DAY_MS) {
    return { send: false, reason: "too_old", detail: `move-in is more than ${META_MAX_AGE_DAYS} days ago` };
  }
  if (!f.email && !f.phone && !click.fbc) {
    return { send: false, reason: "no_identifiers", detail: "no email, phone or Meta click to match on" };
  }
  return {
    send: true,
    eventTime,
    value: positive(f.monthlyRate),
    clickIdType: click.fbc ? "fbc" : "none",
    userData: { email: f.email, phone: f.phone, ...splitName(f.name), fbc: click.fbc, fbp: click.fbp },
  };
}

export type GooglePlan = Skip | { send: true; click: GoogleClick; conversionAt: Date; value: number | null };

/**
 * What can honestly be reported to Google. A click conversion needs the click:
 * no gclid/gbraid/wbraid within 90 days means this move-in did not come from a
 * Google ad we can prove, and it is skipped.
 */
export function planGoogle(f: MoveInFacts): GooglePlan {
  const click = pickGoogleClick(f.touches, clickCutoff(f.moveInDate, f.now));
  if (!click) return { send: false, reason: "no_click_id", detail: "no Google click id within 90 days of the move-in" };
  const conversionAt = conversionTime(f.moveInDate, click.clickedAt, f.now);
  return { send: true, click, conversionAt, value: positive(f.monthlyRate) };
}

/** Accept a bare id or a full resource name for the conversion action. */
export function conversionActionResource(customerId: string, action: string): string {
  const a = action.trim();
  if (a.startsWith("customers/")) return a;
  return `customers/${customerId.replace(/-/g, "")}/conversionActions/${a.replace(/\D/g, "")}`;
}

export function googleUploadBody(p: {
  customerId: string;
  conversionAction: string;
  click: GoogleClick;
  conversionAt: Date;
  value: number | null;
  orderId: string;
}): Record<string, unknown> {
  const conversion: Record<string, unknown> = {
    [p.click.type]: p.click.value,
    conversionAction: conversionActionResource(p.customerId, p.conversionAction),
    conversionDateTime: googleDateTime(p.conversionAt),
    orderId: p.orderId,
    currencyCode: "USD",
  };
  if (p.value != null) conversion.conversionValue = p.value;
  // partialFailure: one bad row is reported back instead of failing the call —
  // which is also how Google tells us a row was a duplicate.
  return { conversions: [conversion], partialFailure: true };
}

/** Errors that mean "you already told us" — the report landed on an earlier attempt. */
const ALREADY_REPORTED = ["CLICK_CONVERSION_ALREADY_EXISTS", "ORDER_ID_ALREADY_IN_USE", "DUPLICATE_ORDER_ID"];

export type GoogleOutcome =
  | { ok: true; alreadyReported: boolean }
  | { ok: false; transient: boolean; detail: string };

/** Classify Google's answer. Pure, so the retry decision is tested rather than hoped for. */
export function readGoogleResponse(status: number, body: unknown): GoogleOutcome {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
  if (status === 429 || status >= 500) return { ok: false, transient: true, detail: text.slice(0, 500) };
  if (status < 200 || status >= 300) return { ok: false, transient: false, detail: text.slice(0, 500) };

  const pfe = (body as { partialFailureError?: { code?: number; message?: string } } | null)?.partialFailureError;
  if (pfe && (pfe.code || pfe.message)) {
    if (ALREADY_REPORTED.some((code) => text.includes(code))) return { ok: true, alreadyReported: true };
    return { ok: false, transient: false, detail: (pfe.message || text).slice(0, 500) };
  }
  return { ok: true, alreadyReported: false };
}

// ── I/O ────────────────────────────────────────────────────────────────────

interface MoveInPayload {
  leadId?: string;
  tenantId?: string;
  facilityId?: string;
  moveInDate?: string | null;
}

interface LoadedMoveIn {
  facts: MoveInFacts;
  facilityId: string;
  leadId: string;
  tenantId: string;
}

async function loadMoveIn(p: Required<Pick<MoveInPayload, "leadId" | "tenantId">> & MoveInPayload): Promise<LoadedMoveIn | null> {
  const [lead, tenant] = await Promise.all([
    db.partial_leads.findUnique({ where: { id: p.leadId }, select: { id: true, email: true, phone: true, name: true, facility_id: true } }),
    db.tenants.findUnique({
      where: { id: p.tenantId },
      select: { id: true, facility_id: true, email: true, phone: true, name: true, monthly_rate: true, move_in_date: true },
    }),
  ]);
  if (!lead || !tenant) return null;

  return {
    facilityId: tenant.facility_id,
    leadId: lead.id,
    tenantId: tenant.id,
    facts: {
      now: new Date(),
      moveInDate: tenant.move_in_date ?? p.moveInDate ?? null,
      monthlyRate: tenant.monthly_rate == null ? null : Number(tenant.monthly_rate),
      // The PMS record is who actually rented; the lead is who inquired. Prefer the renter.
      email: tenant.email || lead.email || null,
      phone: tenant.phone || lead.phone || null,
      name: tenant.name || lead.name || null,
      touches: await loadLeadTouches(lead.id),
    },
  };
}

interface ReportRow {
  platform: "meta" | "google";
  eventId: string;
  status: "sent" | "skipped" | "failed";
  reason?: string | null;
  detail?: string | null;
  facilityId?: string | null;
  leadId?: string | null;
  tenantId?: string | null;
  clickIdType?: string | null;
  value?: number | null;
  conversionAt?: Date | null;
}

/** One row per (platform, event); every attempt updates it and counts itself. */
async function writeReport(r: ReportRow): Promise<void> {
  const data = {
    status: r.status,
    reason: r.reason ?? null,
    detail: r.detail ? r.detail.slice(0, 2000) : null,
    facility_id: r.facilityId ?? null,
    partial_lead_id: r.leadId ?? null,
    tenant_id: r.tenantId ?? null,
    click_id_type: r.clickIdType ?? null,
    value: r.value ?? null,
    conversion_at: r.conversionAt ?? null,
    sent_at: r.status === "sent" ? new Date() : null,
  };
  await db.conversion_reports.upsert({
    where: { platform_event_id: { platform: r.platform, event_id: r.eventId } },
    create: { platform: r.platform, event_id: r.eventId, attempts: 1, ...data },
    update: { ...data, attempts: { increment: 1 } },
  });
}

async function alreadySent(platform: "meta" | "google", eventId: string): Promise<boolean> {
  const row = await db.conversion_reports.findUnique({
    where: { platform_event_id: { platform, event_id: eventId } },
    select: { status: true },
  });
  return row?.status === "sent";
}

function readPayload(payload: unknown): (Required<Pick<MoveInPayload, "leadId" | "tenantId">> & MoveInPayload) | null {
  const p = (payload ?? {}) as MoveInPayload;
  if (!p.leadId || !p.tenantId) return null;
  return { ...p, leadId: p.leadId, tenantId: p.tenantId };
}

type Meta = Record<string, unknown>;
const metaOf = (m: unknown): Meta => (m && typeof m === "object" && !Array.isArray(m) ? (m as Meta) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Thrown to make the queue retry. Only for "the platform was unreachable", never for "it said no". */
class TransientReportError extends Error {
  constructor(platform: string, detail: string) {
    super(`${platform} write-back transient failure: ${detail.slice(0, 300)}`);
    this.name = "TransientReportError";
  }
}

/**
 * `prove.meta-conversion` — report a move-in to Meta as a Purchase.
 *
 * Sent as action_source "physical_store": it happened at the facility, days
 * after any click, and Meta accepts those up to 62 days late. Uses the
 * facility's own pixel when its Meta connection names one (`metadata.pixelId`),
 * otherwise the platform pixel from META_PIXEL_ID.
 */
export const reportMoveInToMeta: JobHandler = async (ctx) => {
  const p = readPayload(ctx.payload);
  if (!p) return { kind: "unknown", reason: "prove.meta-conversion job missing leadId or tenantId" };
  const eventId = moveInEventId(p.tenantId);
  if (await alreadySent("meta", eventId)) return { kind: "done" };

  const loaded = await loadMoveIn(p);
  const base = { platform: "meta" as const, eventId, leadId: p.leadId, tenantId: p.tenantId, facilityId: p.facilityId ?? null };
  if (!loaded) {
    await writeReport({ ...base, status: "skipped", reason: "lead_or_tenant_missing" });
    return { kind: "done" };
  }

  const plan = planMeta(loaded.facts);
  if (!plan.send) {
    await writeReport({ ...base, facilityId: loaded.facilityId, status: "skipped", reason: plan.reason, detail: plan.detail });
    return { kind: "done" };
  }

  const conn = await db.platform_connections.findUnique({
    where: { facility_id_platform: { facility_id: loaded.facilityId, platform: "meta" } },
    select: { access_token: true, metadata: true },
  });
  const facilityPixel = str(metaOf(conn?.metadata).pixelId);

  const res = await sendMetaEvent({
    eventName: "Purchase",
    actionSource: "physical_store",
    eventTime: plan.eventTime,
    eventId,
    userData: plan.userData,
    customData: {
      value: plan.value ?? undefined,
      currency: plan.value != null ? "USD" : undefined,
      contentName: "Storage move-in",
      contentCategory: "self_storage",
    },
    pixelId: facilityPixel,
    accessToken: facilityPixel ? conn?.access_token ?? null : null,
  });

  const row = {
    ...base,
    facilityId: loaded.facilityId,
    clickIdType: plan.clickIdType,
    value: plan.value,
    conversionAt: plan.eventTime,
  };
  if (res.ok) {
    await writeReport({ ...row, status: "sent" });
    return { kind: "done", progressDone: 1 };
  }
  if (res.reason === "not_configured") {
    await writeReport({ ...row, status: "skipped", reason: "not_configured", detail: res.detail });
    return { kind: "done" };
  }
  await writeReport({ ...row, status: "failed", reason: res.reason, detail: `${res.status ?? "network"}: ${res.detail}` });
  if (res.reason === "transient") throw new TransientReportError("meta", res.detail);
  return { kind: "done" };
};

/**
 * `prove.google-conversion` — upload the move-in as an offline click conversion.
 *
 * Needs the facility's Google Ads connection (`platform_connections`,
 * platform "google_ads"), a conversion action to credit — the connection's
 * `metadata.moveInConversionActionId`, or GOOGLE_ADS_MOVE_IN_CONVERSION_ACTION_ID
 * for a single-account setup — and GOOGLE_ADS_DEVELOPER_TOKEN. A manager
 * account goes in `metadata.loginCustomerId` or GOOGLE_ADS_LOGIN_CUSTOMER_ID.
 */
export const reportMoveInToGoogle: JobHandler = async (ctx) => {
  const p = readPayload(ctx.payload);
  if (!p) return { kind: "unknown", reason: "prove.google-conversion job missing leadId or tenantId" };
  const eventId = moveInEventId(p.tenantId);
  if (await alreadySent("google", eventId)) return { kind: "done" };

  const loaded = await loadMoveIn(p);
  const base = { platform: "google" as const, eventId, leadId: p.leadId, tenantId: p.tenantId, facilityId: p.facilityId ?? null };
  if (!loaded) {
    await writeReport({ ...base, status: "skipped", reason: "lead_or_tenant_missing" });
    return { kind: "done" };
  }
  const withFacility = { ...base, facilityId: loaded.facilityId };

  // Cheapest check first: with no Google click there is nothing to configure for.
  const plan = planGoogle(loaded.facts);
  if (!plan.send) {
    await writeReport({ ...withFacility, status: "skipped", reason: plan.reason, detail: plan.detail });
    return { kind: "done" };
  }
  const row = { ...withFacility, clickIdType: plan.click.type, value: plan.value, conversionAt: plan.conversionAt };

  const conn = await db.platform_connections.findUnique({
    where: { facility_id_platform: { facility_id: loaded.facilityId, platform: "google_ads" } },
    select: { id: true, access_token: true, refresh_token: true, token_expires_at: true, account_id: true, metadata: true },
  });
  const meta = metaOf(conn?.metadata);
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const conversionAction = str(meta.moveInConversionActionId) ?? str(process.env.GOOGLE_ADS_MOVE_IN_CONVERSION_ACTION_ID);

  if (!conn?.account_id || !developerToken || !clientId || !clientSecret) {
    await writeReport({ ...row, status: "skipped", reason: "not_configured", detail: "no Google Ads connection or credentials for this facility" });
    return { kind: "done" };
  }
  if (!conversionAction) {
    await writeReport({ ...row, status: "skipped", reason: "no_conversion_action", detail: "set metadata.moveInConversionActionId on the google_ads connection" });
    return { kind: "done" };
  }

  const token = await getValidGoogleToken(conn, { clientId, clientSecret, table: "platform_connections" });
  if (!token) {
    // A refresh that fails means the operator must reconnect; retrying cannot fix it.
    await writeReport({ ...row, status: "failed", reason: "token_unavailable", detail: "Google token refresh failed — reconnect Google Ads" });
    return { kind: "done" };
  }

  const customerId = conn.account_id.replace(/-/g, "");
  const loginCustomerId = (str(meta.loginCustomerId) ?? str(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID))?.replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  let outcome: GoogleOutcome;
  try {
    const res = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(
          googleUploadBody({ customerId, conversionAction, click: plan.click, conversionAt: plan.conversionAt, value: plan.value, orderId: eventId }),
        ),
      },
    );
    const text = await res.text().catch(() => "");
    let body: unknown = text;
    try { body = JSON.parse(text); } catch { /* keep the text */ }
    outcome = readGoogleResponse(res.status, body);
  } catch (err) {
    outcome = { ok: false, transient: true, detail: err instanceof Error ? err.message : String(err) };
  }

  if (outcome.ok) {
    await writeReport({ ...row, status: "sent", reason: outcome.alreadyReported ? "already_reported" : null });
    return { kind: "done", progressDone: 1 };
  }
  await writeReport({ ...row, status: "failed", reason: outcome.transient ? "transient" : "rejected", detail: outcome.detail });
  if (outcome.transient) throw new TransientReportError("google", outcome.detail);
  return { kind: "done" };
};
