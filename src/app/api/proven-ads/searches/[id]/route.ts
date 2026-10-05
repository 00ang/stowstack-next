import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

function idOf(req: NextRequest): string | null {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-search-patch");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const id = idOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  let body: { label?: string; enabled?: boolean; config?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const data: Record<string, unknown> = {};
  if (typeof body.label === "string") data.label = body.label.trim().slice(0, 120);
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.config && typeof body.config === "object") data.config = body.config as Prisma.InputJsonValue;
  if (!Object.keys(data).length) return errorResponse("Nothing to update", 400, origin);

  try {
    const search = await db.proven_ad_searches.update({ where: { id }, data });
    return jsonResponse({ search }, 200, origin);
  } catch {
    return errorResponse("Not found", 404, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-search-delete");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const id = idOf(req);
  if (!id) return errorResponse("id required", 400, origin);

  try {
    await db.proven_ad_searches.delete({ where: { id } });
    return jsonResponse({ ok: true }, 200, origin);
  } catch {
    return errorResponse("Not found", 404, origin);
  }
}
