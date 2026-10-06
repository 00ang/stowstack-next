import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  isAdminCredential,
  jsonResponse,
  requireAdminKey,
  requireManageOrAdmin,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { adapterCoverage } from "@/lib/proven-ads/adapters";
import { draftFromManual } from "@/lib/proven-ads/adapters/manual";
import { daysRunning, isProven } from "@/lib/proven-ads/days-running";
import { scheduleInsights } from "@/lib/proven-ads/insights-job";
import { libraryPatterns } from "@/lib/proven-ads/patterns";
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
  insight: true,
  insight_at: true,
  family_size: true,
  audience: true,
  advertiser_scale: true,
  study_value: true,
} satisfies Prisma.proven_adsSelect;

/** Just enough of every candidate row to decide proven-ness, order and patterns. */
const WINDOW = {
  id: true,
  source: true,
  started_at: true,
  last_seen_at: true,
  ended_at: true,
  active: true,
  family_size: true,
  offer_type: true,
  unit_type: true,
  angle: true,
  format: true,
  audience: true,
  advertiser_scale: true,
  state: true,
  study_value: true,
} satisfies Prisma.proven_adsSelect;

/**
 * Rows that are for renters, or not read yet. The insights job marks vendor
 * pitches, job posts and investor ads; the library keeps their rows but
 * never shows them to an operator.
 */
const FOR_RENTERS: Prisma.proven_adsWhereInput = {
  OR: [
    { insight: { equals: Prisma.DbNull } },
    { insight: { path: ["relevance"], equals: "renter" } },
  ],
};

const SORTS = ["study", "longest", "reach", "recent"] as const;
type Sort = (typeof SORTS)[number];

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads");
  if (limited) return limited;

  const origin = getOrigin(req);
  const denied = await requireManageOrAdmin(req);
  if (denied) return denied;
  // An owner's manage cookie passes the gate above; only a real admin
  // credential sees admin notes, the source panel and off-topic rows.
  const forOwner = !(await isAdminCredential(req));

  const url = new URL(req.url);
  const param = (k: string) => url.searchParams.get(k)?.trim() || null;
  const platform = param("platform");
  const state = param("state");
  const country = param("country");
  const format = param("format");
  const offerType = param("offer_type");
  const unitType = param("unit_type");
  const angle = param("angle");
  const audience = param("audience");
  const scale = param("scale");
  const source = param("source");
  const active = param("active");
  const provenOnly = param("proven") === "1" || param("proven") === "true";
  const q = param("q");
  const minDays = Number(param("min_days") || 0);
  const sort: Sort = (SORTS as readonly string[]).includes(param("sort") ?? "") ? (param("sort") as Sort) : "study";
  const limit = Math.min(60, Math.max(1, Number(param("limit") || 24)));
  const offset = Math.max(0, Number(param("offset") || 0));
  const wantPatterns = param("patterns") === "1";
  const includeOffTopic = !forOwner && param("off_topic") === "1";

  const where: Prisma.proven_adsWhereInput = { AND: includeOffTopic ? [] : [FOR_RENTERS] };
  const and = where.AND as Prisma.proven_adsWhereInput[];
  if (platform) and.push({ platform });
  if (state) and.push({ state: state.toUpperCase() });
  if (country) and.push({ country: country.toUpperCase() });
  if (format) and.push({ format });
  if (offerType) and.push({ offer_type: offerType });
  if (unitType) and.push({ unit_type: unitType });
  if (angle) and.push({ angle });
  if (audience) and.push({ audience });
  if (scale) and.push({ advertiser_scale: scale });
  if (source && !forOwner) and.push({ source });
  if (active === "true" || active === "1") and.push({ active: true });
  if (active === "false" || active === "0") and.push({ active: false });
  if (q) {
    and.push({
      OR: [
        { advertiser_name: { contains: q, mode: "insensitive" } },
        { headline: { contains: q, mode: "insensitive" } },
        { primary_text: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  try {
    const now = new Date();
    // Two steps: rank every candidate on its run window (cheap columns only),
    // then load full rows for the one page being shown.
    const candidates = await db.proven_ads.findMany({ where, select: WINDOW, take: 5000 });
    const ranked = candidates
      .map((r) => ({ row: r, days: daysRunning(r, now) }))
      .filter((r) => r.days >= (Number.isFinite(minDays) ? minDays : 0))
      .filter((r) => (provenOnly ? isProven(r.row, now) : true))
      .sort((a, b) => {
        // "Most to learn from": our read first (unread rows sit with the
        // solid middle), then the longer run.
        if (sort === "study") return (b.row.study_value ?? 2) - (a.row.study_value ?? 2) || b.days - a.days;
        if (sort === "reach") return b.row.family_size - a.row.family_size || b.days - a.days;
        if (sort === "recent") return a.days - b.days;
        return b.days - a.days;
      });

    const pageIds = ranked.slice(offset, offset + limit).map((r) => r.row.id);
    const rows = pageIds.length
      ? await db.proven_ads.findMany({ where: { id: { in: pageIds } }, select: SELECT })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ads = pageIds
      .map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => presentProvenAd(r as ProvenAdRow, now, forOwner));

    // Patterns read the whole renter library, not the filtered slice: they
    // answer "what is working", and the filters are how you act on it.
    let patterns = null;
    let states: string[] = [];
    if (wantPatterns) {
      const all = await db.proven_ads.findMany({ where: FOR_RENTERS, select: WINDOW, take: 5000 });
      patterns = libraryPatterns(all, now);
      states = Array.from(
        new Set(all.filter((r) => r.state && isProven(r, now)).map((r) => r.state as string))
      ).sort();
    }

    return jsonResponse(
      {
        ads,
        total: ranked.length,
        offset,
        limit,
        sort,
        patterns,
        states,
        sources: forOwner ? [] : adapterCoverage(),
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
    if (result.created) await scheduleInsights("manual").catch(() => null);
    const row = await db.proven_ads.findUnique({ where: { id: result.id }, select: SELECT });
    if (!row) return errorResponse("Saved but could not re-read", 500, origin);
    return jsonResponse({ ad: presentProvenAd(row as ProvenAdRow), created: result.created }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return errorResponse(message, 500, origin);
  }
}
