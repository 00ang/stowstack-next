import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { isValidUuid } from "@/lib/validation";

const VALID_EVENT_TYPES = ["click", "scroll", "section_view", "form_focus", "cta_hover", "page_load"];

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

function insertRow(
  landingPageId: string,
  facilityId: string,
  sessionId: string,
  eventType: string,
  elementId: string | null,
  elementText: string | null,
  sectionIndex: number | null,
  xPct: number | null,
  yPct: number | null,
  scrollDepth: number | null,
  viewportWidth: number | null,
  viewportHeight: number | null,
  timeOnPage: number,
  utmSource: string | null,
) {
  // ::uuid casts: Prisma binds strings as text, and Postgres will not put text
  // into a uuid column without one (42804) — every beacon failed without them.
  return Prisma.sql`(${landingPageId}::uuid, ${facilityId}::uuid, ${sessionId}, ${eventType}, ${elementId}, ${elementText}, ${sectionIndex}, ${xPct}, ${yPct}, ${scrollDepth}, ${viewportWidth}, ${viewportHeight}, ${timeOnPage}, ${utmSource})`;
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await checkRateLimit(`page_interactions:${ip}`, 30, 60);
  if (!rl.allowed) {
    return errorResponse("Too many requests", 429, origin);
  }

  try {
    const body = await req.json();
    const { landingPageId, facilityId, sessionId, utmSource, events } = body;

    if (!landingPageId || !facilityId) {
      return errorResponse("Missing required fields", 400, origin);
    }
    if (!isValidUuid(landingPageId) || !isValidUuid(facilityId)) {
      return errorResponse("Invalid landingPageId or facilityId", 400, origin);
    }

    // Accept heartbeat summary format: { scrollDepth, timeOnPage }
    const scrollDepth = body.scrollDepth;
    const timeOnPage = body.timeOnPage;

    if ((!Array.isArray(events) || events.length === 0) && (scrollDepth !== undefined || timeOnPage !== undefined)) {
      await db.$executeRaw`
        INSERT INTO page_interactions (landing_page_id, facility_id, session_id, event_type, element_id, element_text, section_index, x_pct, y_pct, scroll_depth, viewport_width, viewport_height, time_on_page, utm_source)
        VALUES (${landingPageId}::uuid, ${facilityId}::uuid, ${sessionId || "anonymous"}, ${"scroll"}, ${null}, ${null}, ${null}, ${null}, ${null}, ${scrollDepth ?? 0}, ${body.viewportWidth ?? null}, ${body.viewportHeight ?? null}, ${timeOnPage ?? 0}, ${body.utmSource || null})
      `;

      return jsonResponse({ success: true, recorded: 1, format: "heartbeat" }, 200, origin);
    }

    if (!Array.isArray(events) || events.length === 0) {
      return errorResponse("No events provided", 400, origin);
    }

    const batch = events.slice(0, 50);

    const rows: Prisma.Sql[] = [];
    for (const evt of batch) {
      if (!VALID_EVENT_TYPES.includes(evt.event_type)) continue;

      rows.push(insertRow(
        landingPageId,
        facilityId,
        sessionId,
        evt.event_type,
        evt.element_id || null,
        evt.element_text?.slice(0, 100) || null,
        evt.section_index ?? null,
        evt.x_pct ?? null,
        evt.y_pct ?? null,
        evt.scroll_depth ?? null,
        evt.viewport_width ?? null,
        evt.viewport_height ?? null,
        evt.time_on_page ?? 0,
        utmSource || null,
      ));
    }

    if (rows.length > 0) {
      await db.$executeRaw`
        INSERT INTO page_interactions (landing_page_id, facility_id, session_id, event_type, element_id, element_text, section_index, x_pct, y_pct, scroll_depth, viewport_width, viewport_height, time_on_page, utm_source)
        VALUES ${Prisma.join(rows)}
      `;
    }

    return jsonResponse({ success: true, recorded: rows.length }, 200, origin);
  } catch {
    return errorResponse("Internal server error", 500, origin);
  }
}
