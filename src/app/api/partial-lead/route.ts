import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse, requireAdminKey } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { identifyFromRequest } from "@/lib/attribution/visitor";

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return crypto
    .createHash("sha256")
    .update(ip + (process.env.IP_SALT || "storageads"))
    .digest("hex")
    .slice(0, 16);
}

function calculateLeadScore({
  fieldsCompleted,
  totalFields,
  timeOnPage,
  scrollDepth,
  exitIntent,
  hasEmail,
  hasPhone,
}: {
  fieldsCompleted: number;
  totalFields: number;
  timeOnPage: number;
  scrollDepth: number;
  exitIntent: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
}): number {
  let score = 0;

  if (totalFields > 0) {
    score += Math.round((fieldsCompleted / totalFields) * 40);
  }

  if (timeOnPage > 120) score += 20;
  else if (timeOnPage > 60) score += 15;
  else if (timeOnPage > 30) score += 10;
  else if (timeOnPage > 10) score += 5;

  if (scrollDepth > 80) score += 15;
  else if (scrollDepth > 50) score += 10;
  else if (scrollDepth > 25) score += 5;

  if (hasEmail) score += 15;
  if (hasPhone) score += 10;

  if (exitIntent) score += 5;

  return Math.min(score, 100);
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

// Admin GET: list partial leads with filtering
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "partial-lead");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authError = await requireAdminKey(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const summary = url.searchParams.get("summary");
  const status = url.searchParams.get("status");

  try {
    if (summary === "true") {
      const counts = await db.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT recovery_status as status, COUNT(*) as count
        FROM partial_leads
        WHERE recovery_status IS NOT NULL
        GROUP BY recovery_status
      `;
      const stats: Record<string, number> = { pending: 0, in_recovery: 0, recovered: 0, exhausted: 0 };
      for (const row of counts) {
        stats[row.status] = Number(row.count);
      }
      return jsonResponse(stats, 200, origin);
    }

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.recovery_status = status;
    }

    const leads = await db.partial_leads.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: 200,
    });

    return jsonResponse(leads, 200, origin);
  } catch {
    return errorResponse("Failed to load partial leads", 500, origin);
  }
}

// Admin PATCH: update partial lead status
export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "partial-lead");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authError = await requireAdminKey(req);
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("id required", 400, origin);

    const body = await req.json();
    const { status: newStatus, action } = body || {};

    if (action === "recover") {
      await db.partial_leads.update({
        where: { id },
        data: {
          recovery_status: "in_recovery",
          recovery_sent_count: { increment: 1 },
          next_recovery_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          updated_at: new Date(),
        },
      });
      return jsonResponse({ success: true }, 200, origin);
    }

    if (newStatus) {
      await db.partial_leads.update({
        where: { id },
        data: {
          recovery_status: newStatus,
          updated_at: new Date(),
        },
      });
      return jsonResponse({ success: true }, 200, origin);
    }

    return errorResponse("status or action required", 400, origin);
  } catch {
    return errorResponse("Failed to update partial lead", 500, origin);
  }
}

// Public POST: capture partial lead data
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "partial-lead");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      sessionId,
      landingPageId,
      facilityId,
      email,
      phone,
      name,
      unitSize,
      fieldsCompleted,
      totalFields,
      scrollDepth,
      timeOnPage,
      exitIntent,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      fbclid,
      gclid,
      referrer,
      userAgent,
    } = body || {};

    if (!sessionId) {
      return errorResponse("sessionId is required", 400, origin);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const ipHash = hashIp(ip);

    const score = calculateLeadScore({
      fieldsCompleted: fieldsCompleted || 0,
      totalFields: totalFields || 1,
      timeOnPage: timeOnPage || 0,
      scrollDepth: scrollDepth || 0,
      exitIntent: !!exitIntent,
      hasEmail: !!email,
      hasPhone: !!phone,
    });

    const nextRecoveryAt = email ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;

    const emailVal = email || null;
    const result = await db.$queryRaw<Array<{ id: string; lead_score: number }>>`
      INSERT INTO partial_leads (
        session_id, landing_page_id, facility_id,
        email, phone, name, unit_size,
        fields_completed, total_fields,
        scroll_depth, time_on_page, exit_intent,
        utm_source, utm_medium, utm_campaign, utm_content,
        fbclid, gclid,
        referrer, user_agent, ip_hash,
        lead_score, next_recovery_at,
        recovery_status, updated_at
      ) VALUES (
        ${sessionId}, ${landingPageId || null}::uuid, ${facilityId || null}::uuid,
        ${emailVal}, ${phone || null}, ${name || null}, ${unitSize || null},
        ${fieldsCompleted || 0}, ${totalFields || 0},
        ${scrollDepth || 0}, ${timeOnPage || 0}, ${!!exitIntent},
        ${utmSource || null}, ${utmMedium || null}, ${utmCampaign || null}, ${utmContent || null},
        ${fbclid || null}, ${gclid || null},
        ${referrer || null}, ${userAgent || null}, ${ipHash},
        ${score}, ${nextRecoveryAt},
        CASE WHEN ${emailVal} IS NOT NULL THEN 'pending' ELSE 'no_email' END,
        NOW()
      )
      ON CONFLICT (session_id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, partial_leads.email),
        phone = COALESCE(EXCLUDED.phone, partial_leads.phone),
        name = COALESCE(EXCLUDED.name, partial_leads.name),
        unit_size = COALESCE(EXCLUDED.unit_size, partial_leads.unit_size),
        fields_completed = GREATEST(EXCLUDED.fields_completed, partial_leads.fields_completed),
        total_fields = COALESCE(EXCLUDED.total_fields, partial_leads.total_fields),
        scroll_depth = GREATEST(EXCLUDED.scroll_depth, partial_leads.scroll_depth),
        time_on_page = GREATEST(EXCLUDED.time_on_page, partial_leads.time_on_page),
        exit_intent = partial_leads.exit_intent OR EXCLUDED.exit_intent,
        fbclid = COALESCE(EXCLUDED.fbclid, partial_leads.fbclid),
        gclid = COALESCE(EXCLUDED.gclid, partial_leads.gclid),
        lead_score = GREATEST(EXCLUDED.lead_score, partial_leads.lead_score),
        next_recovery_at = CASE
          WHEN partial_leads.recovery_status = 'pending' AND EXCLUDED.email IS NOT NULL
          THEN COALESCE(EXCLUDED.next_recovery_at, partial_leads.next_recovery_at)
          ELSE partial_leads.next_recovery_at
        END,
        recovery_status = CASE
          WHEN partial_leads.recovery_status = 'no_email' AND EXCLUDED.email IS NOT NULL THEN 'pending'
          ELSE partial_leads.recovery_status
        END,
        updated_at = NOW()
      RETURNING id, lead_score
    `;

    const row = result[0];
    // MISSION.md s12 — link the visitor once the browser has given us a way to
    // reach them; an anonymous partial is not yet a person. Never throws.
    if (row?.id && (email || phone)) await identifyFromRequest(req, row.id);
    return jsonResponse({ success: true, id: row?.id, score: row?.lead_score }, 200, origin);
  } catch {
    return errorResponse("Failed to save partial lead", 500, origin);
  }
}
