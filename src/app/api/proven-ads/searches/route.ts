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
import { adapterCoverage, getAdapter } from "@/lib/proven-ads/adapters";
import { seedDefaultSearches } from "@/lib/proven-ads/refresh";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-searches");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  await seedDefaultSearches();
  const searches = await db.proven_ad_searches.findMany({ orderBy: { created_at: "asc" } });
  return jsonResponse({ searches, sources: adapterCoverage() }, 200, origin);
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-searches-write");
  if (limited) return limited;
  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  let body: { adapter?: string; label?: string; config?: Record<string, unknown>; enabled?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  if (!body.adapter || !getAdapter(body.adapter)) {
    return errorResponse("Unknown adapter", 400, origin);
  }
  if (!body.label?.trim()) return errorResponse("label is required", 400, origin);

  const search = await db.proven_ad_searches.create({
    data: {
      adapter: body.adapter,
      label: body.label.trim().slice(0, 120),
      config: (body.config ?? {}) as Prisma.InputJsonValue,
      enabled: body.enabled !== false,
    },
  });
  return jsonResponse({ search }, 200, origin);
}
