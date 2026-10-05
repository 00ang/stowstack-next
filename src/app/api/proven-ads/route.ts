import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
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
import { adapterCoverage } from "@/lib/proven-ads/adapters";
import { draftFromManual } from "@/lib/proven-ads/adapters/manual";
import { presentProvenAd, type ProvenAdRow } from "@/lib/proven-ads/present";
import { upsertProvenAd } from "@/lib/proven-ads/upsert";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

const SELECT = {
  id: true,
  source: true,
  source_ad_id: true,
  platform: true,
  publisher_platforms: true,
  advertiser_name: true,
  advertiser_page_id: true,
  advertiser_url: true,
  format: true,
  headline: true,
  primary_text: true,
  description: true,
  cta: true,
  landing_url: true,
  snapshot_url: true,
  media_refs: true,
  country: true,
  state: true,
  city: true,
  offer_type: true,
  unit_type: true,
  angle: true,
  started_at: true,
  first_seen_at: true,
  last_seen_at: true,
  ended_at: true,
  active: true,
  notes: true,
  created_by: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.proven_adsSelect;

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads");
  if (limited) return limited;

  const origin = getOrigin(req);
  const denied = await requireManageOrAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const platform = url.searchParams.get("platform");
  const state = url.searchParams.get("state");
  const country = url.searchParams.get("country");
  const format = url.searchParams.get("format");
  const offerType = url.searchParams.get("offer_type");
  const unitType = url.searchParams.get("unit_type");
  const angle = url.searchParams.get("angle");
  const source = url.searchParams.get("source");
  const active = url.searchParams.get("active");
  const provenOnly = url.searchParams.get("proven") === "1" || url.searchParams.get("proven") === "true";
  const q = url.searchParams.get("q")?.trim();
  const minDays = Number(url.searchParams.get("min_days") || 0);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 80)));

  const where: Prisma.proven_adsWhereInput = {};
  if (platform) where.platform = platform;
  if (state) where.state = state.toUpperCase();
  if (country) where.country = country.toUpperCase();
  if (format) where.format = format;
  if (offerType) where.offer_type = offerType;
  if (unitType) where.unit_type = unitType;
  if (angle) where.angle = angle;
  if (source) where.source = source;
  if (active === "true" || active === "1") where.active = true;
  if (active === "false" || active === "0") where.active = false;
  if (q) {
    where.OR = [
      { advertiser_name: { contains: q, mode: "insensitive" } },
      { headline: { contains: q, mode: "insensitive" } },
      { primary_text: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const rows = await db.proven_ads.findMany({
      where,
      select: SELECT,
      orderBy: { started_at: "asc" },
      take: 500,
    });
    const now = new Date();
    const presented = (rows as ProvenAdRow[])
      .map((r) => presentProvenAd(r, now))
      .filter((r) => r.days_running >= (Number.isFinite(minDays) ? minDays : 0))
      .filter((r) => (provenOnly ? r.proven : true))
      .sort((a, b) => b.days_running - a.days_running)
      .slice(0, limit);

    return jsonResponse(
      {
        ads: presented,
        total: presented.length,
        sources: adapterCoverage(),
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load proven ads";
    return errorResponse(message, 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-write");
  if (limited) return limited;

  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const parsed = draftFromManual(body, "manual", "admin");
  if ("error" in parsed) return errorResponse(parsed.error, 400, origin);

  try {
    const result = await upsertProvenAd(parsed.draft);
    const row = await db.proven_ads.findUnique({ where: { id: result.id }, select: SELECT });
    if (!row) return errorResponse("Saved but could not re-read", 500, origin);
    return jsonResponse({ ad: presentProvenAd(row as ProvenAdRow), created: result.created }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return errorResponse(message, 500, origin);
  }
}
