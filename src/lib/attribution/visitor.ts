/**
 * Visitor and Touch — the database half (MISSION.md s12).
 *
 * A visitor is one browser, identified by the first-party `sa_vid` cookie. The
 * cookie is set by the SERVER in the `/api/tracking/visit` response, not by
 * page script: Safari caps storage written by script (localStorage included,
 * which is where the old last-touch params lived) at seven days without a
 * visit, but leaves a server-set first-party cookie alone. That cap is what
 * erased first touch for anyone who took more than a week to rent.
 *
 * The cookie is HttpOnly. Nothing on the page needs to read it — every request
 * that does (the visit beacon, the lead form) is same-origin, so the browser
 * sends it along and the server reads it there.
 */

import type { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { phoneHash, type Channel, type TouchFields, type TouchKind, type TouchRecord } from "./touch";

export const VISITOR_COOKIE = "sa_vid";

/** 400 days — the most any current browser will keep a cookie for. */
export const VISITOR_MAX_AGE_S = 400 * 24 * 60 * 60;

const VISITOR_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only ids we minted. Anything else in the cookie is ignored and replaced. */
export function isVisitorId(v: unknown): v is string {
  return typeof v === "string" && VISITOR_ID_RE.test(v);
}

export function readVisitorId(req: Pick<NextRequest, "cookies">): string | null {
  const v = req.cookies.get(VISITOR_COOKIE)?.value;
  return isVisitorId(v) ? v.toLowerCase() : null;
}

export function mintVisitorId(): string {
  return crypto.randomUUID();
}

/** Set (or roll forward) the visitor cookie on a response. */
export function setVisitorCookie(res: Pick<NextResponse, "cookies">, id: string): void {
  res.cookies.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_MAX_AGE_S,
  });
}

/**
 * Record that a visitor was seen. One statement either way; `isNew` is true
 * when this call created the row — i.e. this is the browser's first visit.
 */
export async function seeVisitor(id: string): Promise<{ isNew: boolean }> {
  const rows = await db.$queryRaw<{ inserted: boolean }[]>`
    INSERT INTO visitors (id) VALUES (${id})
    ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()
    RETURNING (xmax = 0) AS inserted
  `;
  return { isNew: rows[0]?.inserted === true };
}

export interface TouchWrite extends TouchFields {
  visitor_id?: string | null;
  partial_lead_id?: string | null;
  facility_id?: string | null;
  landing_page_id?: string | null;
  source_ref?: string | null;
  phone_hash?: string | null;
  occurred_at?: Date;
}

/**
 * Append a touch. A touch with a `source_ref` (a call's CallSid) is written at
 * most once per kind — Twilio retrying a webhook does not record a second call.
 */
export async function recordTouch(t: TouchWrite): Promise<void> {
  await db.touches.createMany({
    data: [
      {
        visitor_id: t.visitor_id ?? null,
        partial_lead_id: t.partial_lead_id ?? null,
        facility_id: t.facility_id ?? null,
        landing_page_id: t.landing_page_id ?? null,
        kind: t.kind,
        channel: t.channel,
        source: t.source,
        source_ref: t.source_ref ?? null,
        occurred_at: t.occurred_at ?? new Date(),
        url: t.url,
        referrer: t.referrer,
        utm_source: t.utm_source,
        utm_medium: t.utm_medium,
        utm_campaign: t.utm_campaign,
        utm_content: t.utm_content,
        utm_term: t.utm_term,
        gclid: t.gclid,
        gbraid: t.gbraid,
        wbraid: t.wbraid,
        fbclid: t.fbclid,
        fbc: t.fbc,
        fbp: t.fbp,
        ttclid: t.ttclid,
        msclkid: t.msclkid,
        phone_hash: t.phone_hash ?? null,
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * The moment a browser gives us a phone or email: tie the visitor, and every
 * touch it has made so far, to the lead.
 *
 * First identification wins on the visitor row (a shared family laptop should
 * not reassign last month's touches to whoever filled in a form today), but the
 * lead always records which visitor it came from, so its history is complete
 * either way. Several visitors can resolve to one lead — that is the
 * cross-device case, and the history loader reads all of them.
 */
export async function identifyVisitor(visitorId: string, leadId: string): Promise<void> {
  await db.$executeRaw`
    INSERT INTO visitors (id, partial_lead_id, identified_at)
    VALUES (${visitorId}, ${leadId}::uuid, NOW())
    ON CONFLICT (id) DO UPDATE SET
      partial_lead_id = COALESCE(visitors.partial_lead_id, EXCLUDED.partial_lead_id),
      identified_at   = COALESCE(visitors.identified_at, EXCLUDED.identified_at),
      last_seen_at    = NOW(),
      updated_at      = NOW()
  `;
  await db.$executeRaw`
    UPDATE partial_leads SET visitor_id = ${visitorId}, updated_at = NOW()
    WHERE id = ${leadId}::uuid AND visitor_id IS NULL
  `;
  await db.$executeRaw`
    UPDATE touches SET partial_lead_id = ${leadId}::uuid
    WHERE visitor_id = ${visitorId} AND partial_lead_id IS NULL
  `;
}

/**
 * Best-effort wrapper for the lead routes. Never throws: a lead that fails to
 * link is still a lead, and the person submitting the form is waiting.
 */
export async function identifyFromRequest(req: Pick<NextRequest, "cookies">, leadId: string | null | undefined): Promise<void> {
  if (!leadId) return;
  const visitorId = readVisitorId(req);
  if (!visitorId) return;
  try {
    await identifyVisitor(visitorId, leadId);
  } catch (err) {
    console.error("[attribution] identifyVisitor failed:", err instanceof Error ? err.message : err);
  }
}

/** Upper bound on one lead's history. Far beyond any real lead; a guard, not a page size. */
const MAX_TOUCHES = 500;

/**
 * Everything we know about how one lead arrived, oldest first:
 *   - touches already tied to the lead,
 *   - every touch from the visitor that submitted it,
 *   - every touch from any other visitor that resolved to it (other devices),
 *   - every call to the facility from the lead's phone number.
 */
export async function loadLeadTouches(leadId: string): Promise<TouchRecord[]> {
  const lead = await db.partial_leads.findUnique({
    where: { id: leadId },
    select: { id: true, facility_id: true, visitor_id: true, phone: true },
  });
  if (!lead) return [];

  const ph = phoneHash(lead.phone);
  const rows = await db.touches.findMany({
    where: {
      OR: [
        { partial_lead_id: lead.id },
        { visitor: { partial_lead_id: lead.id } },
        ...(lead.visitor_id ? [{ visitor_id: lead.visitor_id }] : []),
        ...(ph && lead.facility_id ? [{ kind: "call", facility_id: lead.facility_id, phone_hash: ph }] : []),
      ],
    },
    orderBy: { occurred_at: "asc" },
    take: MAX_TOUCHES,
  });

  return rows.map((r) => ({
    id: r.id,
    occurred_at: r.occurred_at,
    kind: r.kind as TouchKind,
    channel: r.channel as Channel,
    source: r.source,
    url: r.url,
    referrer: r.referrer,
    utm_source: r.utm_source,
    utm_medium: r.utm_medium,
    utm_campaign: r.utm_campaign,
    utm_content: r.utm_content,
    utm_term: r.utm_term,
    gclid: r.gclid,
    gbraid: r.gbraid,
    wbraid: r.wbraid,
    fbclid: r.fbclid,
    fbc: r.fbc,
    fbp: r.fbp,
    ttclid: r.ttclid,
    msclkid: r.msclkid,
  }));
}
