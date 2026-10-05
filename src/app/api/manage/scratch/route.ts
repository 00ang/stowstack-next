import { NextRequest } from "next/server";
import crypto from "crypto";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  verifyCsrfOrigin,
  safeCompare,
} from "@/lib/api-helpers";
import { setManageCookie } from "@/lib/manage-session";
import { provisionPortalAccess } from "@/lib/portal-provisioning";
import { db } from "@/lib/db";
import { applyRateLimitStrict } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

/**
 * POST /api/manage/scratch
 *
 * Owner entry — "Start with an invite". Gated behind a shared invite code
 * (MANAGE_INVITE_CODE) so the paid generation tools aren't wide open. Creates
 * a fresh facility AND a client-portal login for it, so the owner has one
 * account like every other client: the response carries the portal session
 * (email + access code) for the page to save, plus the tools cookie, and they
 * land in /portal/tools. Coming back later is the normal portal login.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateAccessCode(): string {
  // 16 hex-ish chars, uppercase, matches access_code VarChar(16)
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  const csrf = verifyCsrfOrigin(req);
  if (csrf) return csrf;

  // Fail-closed per-IP limit: the invite code is the only gate here (and it
  // can fall back to ADMIN_SECRET), so guessing must be slow even if Upstash
  // is down.
  const limited = await applyRateLimitStrict(req, RATE_LIMIT_TIERS.PUBLIC_WRITE_HOURLY, "manage-scratch");
  if (limited) return limited;

  // Preferred gate is MANAGE_INVITE_CODE. TEMPORARY: fall back to ADMIN_SECRET
  // when it isn't set, so the flow works on environments where MANAGE_INVITE_CODE
  // hasn't propagated yet. Restore MANAGE_INVITE_CODE-only before launch.
  const inviteSecret =
    process.env.MANAGE_INVITE_CODE || process.env.ADMIN_SECRET || null;
  if (!inviteSecret) {
    return errorResponse(
      "Start-from-scratch is not enabled (set MANAGE_INVITE_CODE or ADMIN_SECRET)",
      503,
      origin
    );
  }

  let body: {
    inviteCode?: unknown;
    name?: unknown;
    location?: unknown;
    contact_email?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode || !safeCompare(inviteCode, inviteSecret)) {
    return errorResponse("Invalid invite code", 403, origin);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const contactEmail =
    typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : "";

  if (!name || !location) {
    return errorResponse("Facility name and location are required", 400, origin);
  }
  // The email is the login: the portal sends sign-in codes to it.
  if (!EMAIL_RE.test(contactEmail)) {
    return errorResponse("A valid email is required. It's how you'll sign in.", 400, origin);
  }

  // Generate a unique access_code so the owner can return to this facility.
  let accessCode = generateAccessCode();
  for (let i = 0; i < 5; i++) {
    const clash = await db.facilities.findUnique({
      where: { access_code: accessCode },
      select: { id: true },
    });
    if (!clash) break;
    accessCode = generateAccessCode();
  }

  const facility = await db.facilities.create({
    data: {
      name,
      location,
      contact_email: contactEmail,
      access_code: accessCode,
      status: "self_serve",
      pipeline_status: "self_serve",
    },
    select: {
      id: true,
      name: true,
      contact_email: true,
      occupancy_range: true,
      total_units: true,
      access_code: true,
    },
  });

  const portal = await provisionPortalAccess(facility.id, { sendWelcomeEmail: true });
  if (!portal.ok) return errorResponse(portal.error, 500, origin);

  const res = jsonResponse(
    {
      facility: { id: facility.id, name: facility.name },
      portal: { email: portal.email, accessCode: portal.code },
    },
    200,
    origin
  );
  setManageCookie(res, [facility.id], "scratch");
  return res;
}
