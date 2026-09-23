import crypto from "crypto";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  v1CorsResponse,
  v1Json,
  v1Error,
  requireApiAuth,
  isErrorResponse,
  requireScope,
} from "@/lib/v1-auth";
import { dispatchWebhook } from "@/lib/webhook";
import { respondToNewLeadSafely, scheduleSpeedCheck } from "@/lib/respond/speed-to-lead";
import { scheduleRescue } from "@/lib/respond/abandoned";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidUuid } from "@/lib/validation";

export async function OPTIONS() {
  return v1CorsResponse();
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-leads");
  if (limited) return limited;

  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "leads:read");
  if (scopeErr) return scopeErr;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id && !isValidUuid(id)) return v1Error("Invalid id format", 400);

  try {
    if (id) {
      const rows = await db.$queryRaw<Record<string, unknown>[]>`
        SELECT pl.id, pl.facility_id, pl.name, pl.email, pl.phone, pl.unit_size,
               pl.lead_status, pl.utm_source, pl.utm_medium, pl.utm_campaign,
               pl.move_in_date, pl.created_at, pl.converted_at, pl.lead_notes
        FROM partial_leads pl
        JOIN facilities f ON f.id = pl.facility_id
        WHERE pl.id = ${id}::uuid AND f.organization_id = ${orgId}::uuid
      `;
      if (!rows.length) return v1Error("Lead not found", 404);
      return v1Json({ lead: rows[0] });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
    const offset = (page - 1) * limit;
    const facilityId = url.searchParams.get("facilityId");
    const status = url.searchParams.get("status");
    const since = url.searchParams.get("since");

    const conditions: Prisma.Sql[] = [Prisma.sql`f.organization_id = ${orgId}::uuid`];

    if (facilityId && !isValidUuid(facilityId)) return v1Error("Invalid facilityId format", 400);
    if (facilityId) {
      conditions.push(Prisma.sql`pl.facility_id = ${facilityId}::uuid`);
    }
    if (status) {
      conditions.push(Prisma.sql`pl.lead_status = ${status}`);
    }
    if (since) {
      conditions.push(Prisma.sql`pl.created_at >= ${since}::timestamptz`);
    }

    const whereClause = Prisma.join(conditions, " AND ");

    const [leads, countRows] = await Promise.all([
      db.$queryRaw<Record<string, unknown>[]>`
        SELECT pl.id, pl.facility_id, pl.name, pl.email, pl.phone, pl.unit_size,
               pl.lead_status, pl.utm_source, pl.utm_medium, pl.utm_campaign,
               pl.move_in_date, pl.created_at, pl.converted_at
        FROM partial_leads pl
        JOIN facilities f ON f.id = pl.facility_id
        WHERE ${whereClause}
        ORDER BY pl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      db.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM partial_leads pl
        JOIN facilities f ON f.id = pl.facility_id
        WHERE ${whereClause}
      `,
    ]);

    const total = countRows[0]?.total || 0;
    return v1Json({
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    return v1Error("Failed to fetch leads", 500);
  }
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-leads");
  if (limited) return limited;

  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "leads:write");
  if (scopeErr) return scopeErr;

  const body = await request.json().catch(() => null);
  const {
    facilityId,
    name,
    email,
    phone,
    unitSize,
    leadStatus,
    utmSource,
    utmMedium,
    utmCampaign,
  } = body || {};

  if (!facilityId) return v1Error("facilityId is required");
  if (!isValidUuid(facilityId)) return v1Error("Invalid facilityId format", 400);
  if (!name && !email && !phone) {
    return v1Error("At least one of name, email, or phone is required");
  }

  const facilityRows = await db.$queryRaw<
    { id: string; organization_id: string }[]
  >`SELECT id, organization_id FROM facilities WHERE id = ${facilityId}::uuid`;
  if (!facilityRows.length || facilityRows[0].organization_id !== orgId) {
    return v1Error("Facility not found", 404);
  }

  const sessionId = `api-${crypto.randomUUID()}`;

  try {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      INSERT INTO partial_leads (facility_id, session_id, name, email, phone, unit_size,
                                 lead_status, utm_source, utm_medium, utm_campaign)
      VALUES (${facilityId}::uuid, ${sessionId}, ${name || null}, ${email || null}, ${phone || null}, ${unitSize || null},
              ${leadStatus || "new"}, ${utmSource || "api"}, ${utmMedium || null}, ${utmCampaign || null})
      RETURNING id, facility_id, name, email, phone, unit_size, lead_status,
                utm_source, utm_medium, utm_campaign, created_at
    `;

    dispatchWebhook(orgId, "lead.created", { lead: rows[0] })
      .catch((err) => console.error("[webhook:lead.created]", err instanceof Error ? err.message : err));

    // RESPOND r5. A lead pushed in over the API is still a lead somebody is
    // waiting on, so it gets the same answer as a web form — but only when it
    // arrives as new. A caller importing historical leads passes their real
    // status, and texting those would be a mass send to old records.
    // Awaited, not fire-and-forget: a floating promise can be killed the moment
    // the serverless response returns, and this is the one part of the request
    // that has a deadline.
    if (!leadStatus || leadStatus === "new") {
      const id = rows[0]?.id;
      if (typeof id === "string") {
        await scheduleSpeedCheck(id, facilityId).catch(() => { /* best effort: the six-hourly sweep will find it */ });
        await respondToNewLeadSafely(id);
      }
    }

    // RESPOND r8. A lead pushed in as `partial` with a phone is one the
    // abandoned-rental rescue would pick up, so it is scheduled for it.
    if (leadStatus === "partial" && phone && typeof rows[0]?.id === "string") {
      await scheduleRescue({
        id: rows[0].id,
        createdAt: new Date(rows[0].created_at as string | Date),
        facilityId,
      }).catch(() => { /* best effort: rescue is a nicety, not a promise */ });
    }

    return v1Json({ lead: rows[0] });
  } catch {
    return v1Error("Failed to create lead", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.AUTHENTICATED, "v1-leads");
  if (limited) return limited;

  const auth = await requireApiAuth(request);
  if (isErrorResponse(auth)) return auth;
  const { apiKey } = auth;
  const orgId = apiKey.organization_id;

  const scopeErr = requireScope(apiKey, "leads:write");
  if (scopeErr) return scopeErr;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return v1Error("id query param is required");
  if (!isValidUuid(id)) return v1Error("Invalid id format", 400);

  const body = await request.json().catch(() => null);
  if (!body) return v1Error("No valid fields to update");

  const fieldMap: Record<string, string> = {
    leadStatus: "lead_status",
    moveInDate: "move_in_date",
    notes: "lead_notes",
    name: "name",
    email: "email",
    phone: "phone",
    unitSize: "unit_size",
  };

  const setParts: Prisma.Sql[] = [];

  for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
    if (body[bodyKey] !== undefined) {
      setParts.push(Prisma.sql`${Prisma.raw(dbCol)} = ${body[bodyKey]}`);
    }
  }

  if (!setParts.length) return v1Error("No valid fields to update");

  if (body.leadStatus) {
    setParts.push(Prisma.sql`status_updated_at = NOW()`);
  }

  const setClause = Prisma.join(setParts, ", ");

  try {
    const rows = await db.$queryRaw<Record<string, unknown>[]>`
      UPDATE partial_leads SET ${setClause}
       FROM facilities f
       WHERE partial_leads.id = ${id}::uuid
         AND partial_leads.facility_id = f.id
         AND f.organization_id = ${orgId}::uuid
       RETURNING partial_leads.id, partial_leads.facility_id, partial_leads.name,
                 partial_leads.email, partial_leads.phone, partial_leads.unit_size,
                 partial_leads.lead_status, partial_leads.move_in_date,
                 partial_leads.created_at, partial_leads.lead_notes`;
    if (!rows.length) return v1Error("Lead not found", 404);

    dispatchWebhook(orgId, "lead.updated", { lead: rows[0] })
      .catch((err) => console.error("[webhook:lead.updated]", err instanceof Error ? err.message : err));

    return v1Json({ lead: rows[0] });
  } catch {
    return v1Error("Failed to update lead", 500);
  }
}
