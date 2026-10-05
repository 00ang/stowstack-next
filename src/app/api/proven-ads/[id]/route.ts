import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  requireAdminKey,
  requireManageOrAdmin,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { presentProvenAd, type ProvenAdRow } from "@/lib/proven-ads/present";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

function idOf(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/");
  const id = parts[parts.length - 1];
  return id && id !== "proven-ads" ? id : null;
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-one");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireManageOrAdmin(req);
  if (denied) return denied;

  const id = idOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  const row = await db.proven_ads.findUnique({ where: { id } });
  if (!row) return errorResponse("Not found", 404, origin);
  return jsonResponse({ ad: presentProvenAd(row as ProvenAdRow) }, 200, origin);
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-patch");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const id = idOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.notes === "string") data.notes = body.notes;
  if (typeof body.state === "string") data.state = body.state.toUpperCase().slice(0, 8);
  if (typeof body.city === "string") data.city = body.city.slice(0, 120);
  if (typeof body.country === "string") data.country = body.country.toUpperCase().slice(0, 2);
  if (typeof body.offer_type === "string") data.offer_type = body.offer_type;
  if (typeof body.unit_type === "string") data.unit_type = body.unit_type;
  if (typeof body.angle === "string") data.angle = body.angle;
  if (typeof body.format === "string") data.format = body.format;
  if (body.verify === true || body.active === true) {
    data.active = true;
    data.ended_at = null;
    data.last_seen_at = new Date();
  }
  if (body.ended === true || body.active === false) {
    data.active = false;
    data.ended_at = new Date();
  }

  if (!Object.keys(data).length) return errorResponse("Nothing to update", 400, origin);

  try {
    const row = await db.proven_ads.update({ where: { id }, data });
    return jsonResponse({ ad: presentProvenAd(row as ProvenAdRow) }, 200, origin);
  } catch {
    return errorResponse("Not found", 404, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-delete");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const id = idOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  try {
    await db.proven_ads.delete({ where: { id } });
    return jsonResponse({ ok: true }, 200, origin);
  } catch {
    return errorResponse("Not found", 404, origin);
  }
}
