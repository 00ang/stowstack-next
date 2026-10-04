import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { db } from '@/lib/db';
import { corsResponse, getOrigin, getCorsHeaders } from '@/lib/api-helpers';
import { isValidUuid } from '@/lib/validation';
import { parseVisit, shouldRecord } from '@/lib/attribution/touch';
import { mintVisitorId, readVisitorId, recordTouch, seeVisitor, setVisitorCookie } from '@/lib/attribution/visitor';

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * POST /api/tracking/visit
 * Records a landing page visit with tracking parameters.
 * Fire-and-forget from the client — failure should never block the page.
 *
 * MISSION.md s12: this is also where a browser becomes a visitor. The response
 * sets (or rolls forward) the first-party `sa_vid` cookie, and the arrival is
 * written as a touch when it is the browser's first visit or carries a source.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "tracking-visit");
  if (limited) return limited;

  const origin = getOrigin(req);
  // Decided before anything can fail, so every response below carries the cookie.
  const visitorId = readVisitorId(req) ?? mintVisitorId();
  const respond = () => {
    const res = NextResponse.json({ success: true }, { headers: getCorsHeaders(origin) });
    setVisitorCookie(res, visitorId);
    return res;
  };

  try {
    const body = await req.json();
    // Reject oversized payloads to prevent DB bloat
    const rawSize = JSON.stringify(body).length;
    if (rawSize > 100_000) {
      return respond();
    }

    const {
      tracking_params,
      landing_page_id,
      facility_id,
      url,
      referrer,
    } = body;

    const validFacilityId = facility_id && isValidUuid(facility_id) ? facility_id : null;
    const validLandingPageId = landing_page_id && isValidUuid(landing_page_id) ? landing_page_id : null;

    const visitMeta = {
      tracking_params: tracking_params || {},
      landing_page_id: landing_page_id || null,
      url: typeof url === "string" ? url.slice(0, 2000) : null,
      source: tracking_params?.utm_source || 'direct',
      timestamp: new Date().toISOString(),
    };

    await db.activity_log.create({
      data: {
        type: 'landing_page_visit',
        facility_id: validFacilityId,
        detail: `LP visit: ${url || 'unknown'}`,
        meta: visitMeta,
      },
    });

    // Visitor + touch. Isolated so a failure here never costs the visit log above.
    try {
      const { isNew } = await seeVisitor(visitorId);
      const touch = parseVisit({
        url: typeof url === "string" ? url : null,
        referrer: typeof referrer === "string" ? referrer : null,
        ownHosts: [req.nextUrl.host],
        fbc: req.cookies.get("_fbc")?.value ?? null,
        fbp: req.cookies.get("_fbp")?.value ?? null,
      });
      if (shouldRecord(touch, isNew)) {
        await recordTouch({
          ...touch,
          visitor_id: visitorId,
          facility_id: validFacilityId,
          landing_page_id: validLandingPageId,
        });
      }
    } catch (err) {
      console.error('Tracking touch error:', err);
    }

    return respond();
  } catch (err) {
    // Never fail loudly — tracking should be best-effort
    console.error('Tracking visit error:', err);
    return respond();
  }
}
