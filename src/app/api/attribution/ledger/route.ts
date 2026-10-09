import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, errorResponse, getOrigin, jsonResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { buildLedger, ledgerCsv } from "@/lib/attribution/ledger";
import { heardAskOn, setHeardAsk } from "@/lib/attribution/heard-ask";
import { resolveMatchAttempt } from "@/lib/lead-matching";

/**
 * The move-in ledger (src/lib/attribution/ledger.ts).
 *
 *   GET  ?facilityId=&days=90            rows, summary, and whether the ask is on
 *   GET  ?facilityId=&days=90&format=csv the same as a spreadsheet
 *   POST { facilityId, action: "confirm", attemptId, leadId }   this lead is the tenant
 *   POST { facilityId, action: "reject",  attemptId }           none of these leads
 *   POST { facilityId, action: "ask",     on }                  ask new tenants how they found us
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "attribution-ledger");
  if (limited) return limited;
  const origin = getOrigin(req);
  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) return errorResponse("facilityId is required", 400, origin);
  const denied = await requireFacilityAccess(req, facilityId);
  if (denied) return denied;
  const days = Math.min(365, Math.max(7, Math.round(Number(url.searchParams.get("days")) || 90)));

  try {
    const { rows, summary } = await buildLedger(facilityId, days);
    if (url.searchParams.get("format") === "csv") {
      return new NextResponse(ledgerCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="move-ins-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    return jsonResponse({ rows, summary, days, heardAsk: await heardAskOn(facilityId) }, 200, origin);
  } catch (e) {
    console.error("[attribution/ledger GET]", e);
    return errorResponse("Couldn't read the move-ins", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "attribution-ledger");
  if (limited) return limited;
  const origin = getOrigin(req);
  let body: { facilityId?: string; action?: string; attemptId?: string; leadId?: string; on?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }
  const facilityId = body.facilityId ?? null;
  if (!facilityId) return errorResponse("facilityId is required", 400, origin);
  const denied = await requireFacilityAccess(req, facilityId);
  if (denied) return denied;

  try {
    if (body.action === "ask") {
      await setHeardAsk(facilityId, body.on === true);
      return jsonResponse({ heardAsk: body.on === true }, 200, origin);
    }
    if (body.action === "confirm" || body.action === "reject") {
      if (!body.attemptId) return errorResponse("attemptId is required", 400, origin);
      // The attempt must belong to the facility this caller may act for.
      const attempt = await db.lead_match_attempts.findUnique({
        where: { id: body.attemptId },
        select: { facility_id: true },
      });
      if (!attempt || attempt.facility_id !== facilityId) return errorResponse("Match not found", 404, origin);
      const ok = await resolveMatchAttempt(
        db,
        body.attemptId,
        body.action === "confirm" ? body.leadId ?? null : null,
        "owner:ledger",
      );
      if (!ok) return errorResponse("That match is already settled, or that lead isn't one of its candidates", 409, origin);
      return jsonResponse({ ok: true }, 200, origin);
    }
    return errorResponse("Unknown action", 400, origin);
  } catch (e) {
    console.error("[attribution/ledger POST]", e);
    return errorResponse("Couldn't save that", 500, origin);
  }
}
