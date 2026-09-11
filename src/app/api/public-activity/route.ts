import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCorsHeaders, getOrigin, corsResponse } from "@/lib/api-helpers";

export const revalidate = 30;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Redacted recent publish events for the hero live-activity ticker.
 * State-only facility location. No facility or campaign names leak.
 */
export async function GET(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const rows = await db.publish_log.findMany({
      where: { status: { in: ["published", "succeeded", "completed"] } },
      orderBy: { created_at: "desc" },
      take: 8,
      select: {
        id: true,
        platform: true,
        created_at: true,
        facilities: { select: { location: true } },
      },
    });

    // Location strings are freeform (e.g. "Columbus, OH" or "123 Main St,
    // Columbus, OH 43004"). Pull the trailing state abbr if we can,
    // otherwise a city-level hint. Never surfaces facility name.
    function extractLocale(loc: string | null | undefined): string | null {
      if (!loc) return null;
      const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      const last = parts[parts.length - 1];
      const stateMatch = last.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        const city = parts.length >= 2 ? parts[parts.length - 2] : null;
        return city ? `${city}, ${stateMatch[1]}` : stateMatch[1];
      }
      return parts[parts.length - 1] || null;
    }

    const events = rows.map((r) => ({
      id: r.id,
      platform: (r.platform || "meta").toLowerCase(),
      locale: extractLocale(r.facilities?.location),
      createdAt: r.created_at.toISOString(),
    }));

    return NextResponse.json(
      { events, updatedAt: new Date().toISOString() },
      {
        headers: {
          ...getCorsHeaders(origin),
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load activity", events: [] },
      { status: 500, headers: getCorsHeaders(origin) },
    );
  }
}
