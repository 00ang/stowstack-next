import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, errorResponse, getOrigin, jsonResponse } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { HEARD_ANSWERS, isHeardAnswer, readHeard } from "@/lib/attribution/heard";
import { readHeardToken, recordHeard } from "@/lib/attribution/heard-ask";

/**
 * The one-tap "how did you find us?" behind the link in a new tenant's email.
 * Public: the signed token is the only credential, and it can only answer this
 * one question for this one tenant.
 *
 *   GET  ?t=<token>          the facility's name, the choices, and any answer given
 *   POST { t, answer }       record (or change) the answer
 *
 * Answers are recorded by POST from the page, never by opening the link, so a
 * mail scanner that follows links can't answer for anyone.
 */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

async function load(token: string | null) {
  const ids = readHeardToken(token);
  if (!ids) return null;
  const tenant = await db.tenants.findFirst({
    where: { id: ids.tenantId, facility_id: ids.facilityId, deleted_at: null },
    select: { id: true, metadata: true, facilities: { select: { name: true } } },
  });
  return tenant;
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "heard");
  if (limited) return limited;
  const origin = getOrigin(req);
  const tenant = await load(new URL(req.url).searchParams.get("t"));
  if (!tenant) return errorResponse("This link has expired.", 404, origin);
  return jsonResponse(
    {
      facilityName: tenant.facilities?.name ?? "the facility",
      answers: HEARD_ANSWERS.map(([key, label]) => ({ key, label })),
      answer: readHeard(tenant.metadata)?.answer ?? null,
    },
    200,
    origin,
  );
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "heard");
  if (limited) return limited;
  const origin = getOrigin(req);
  let body: { t?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }
  if (!isHeardAnswer(body.answer)) return errorResponse("Pick one of the answers", 400, origin);
  const tenant = await load(body.t ?? null);
  if (!tenant) return errorResponse("This link has expired.", 404, origin);
  try {
    await recordHeard(tenant.id, body.answer, "link");
    return jsonResponse({ ok: true, answer: body.answer }, 200, origin);
  } catch (e) {
    console.error("[heard POST]", e);
    return errorResponse("That didn't save. Try again.", 500, origin);
  }
}
