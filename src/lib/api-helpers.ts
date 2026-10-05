import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

const ALLOWED_ORIGINS = [
  "https://storageads.com",
  "https://www.storageads.com",
  // Localhost dev origins are allowed only outside production.
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "http://localhost:3000"]),
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Org-Token",
  };
  // Only set Allow-Origin for recognized origins — omit for unknown to block cross-origin access
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/**
 * Verify that the request Origin matches an allowed origin.
 * Returns null if valid, or an error response if the origin is unrecognized.
 * Skip for requests with no Origin header (server-to-server, cron, webhook).
 */
export function verifyCsrfOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  // No origin header = non-browser request (cron, webhook, server-to-server) — allow
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return null;
  // Same-origin requests are always safe for CSRF: the browser only sets an
  // Origin matching the host it sent the request to. Comparing the Origin's
  // host to the request Host covers Vercel preview domains and any custom
  // domain without hardcoding each deployment URL. Cross-site requests have a
  // different Origin host and are still rejected below.
  try {
    const originHost = new URL(origin).host;
    const reqHost =
      req.headers.get("x-forwarded-host") || req.headers.get("host");
    if (reqHost && originHost === reqHost) return null;
  } catch {
    /* malformed Origin — fall through to reject */
  }
  return errorResponse("Forbidden: invalid origin", 403, origin);
}

export function corsResponse(origin: string | null) {
  return NextResponse.json(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

export function jsonResponse(
  data: unknown,
  status = 200,
  origin: string | null = null
) {
  return NextResponse.json(data, {
    status,
    headers: getCorsHeaders(origin),
  });
}

export function errorResponse(
  message: string,
  status = 400,
  origin: string | null = null
) {
  return NextResponse.json(
    { error: message },
    { status, headers: getCorsHeaders(origin) }
  );
}

/**
 * Report a caught server error to Sentry, tagged with the route name.
 *
 * Route handlers that catch their own errors and return a 500 never reach the
 * `onRequestError` instrumentation hook (that fires only for *unhandled*
 * errors), so without an explicit capture the failure is invisible in
 * production. Call this in the catch block before returning the error
 * response. Sensitive headers are scrubbed in sentry.server.config's beforeSend.
 */
export function captureRouteError(
  error: unknown,
  route: string,
  context?: Record<string, unknown>
): void {
  Sentry.captureException(error, {
    tags: { route },
    ...(context ? { extra: context } : {}),
  });
}

export function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  // Hash both values to normalize length before comparison,
  // preventing timing leaks from the length check
  const hashA = crypto.createHash("sha256").update(String(a)).digest();
  const hashB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function isAdminRequest(req: NextRequest): boolean {
  const providedKey = req.headers.get("x-admin-key");
  if (!providedKey) return false;
  const adminKey = process.env.ADMIN_SECRET;
  if (adminKey && safeCompare(providedKey, adminKey)) return true;
  return false;
}

/**
 * True for any admin credential: the shared ADMIN_SECRET or a valid per-admin
 * `sa_adm_` key. Use it to exempt admins from owner-only gates (plan limits)
 * on routes that also admit owners via requireFacilityAccess.
 */
export async function isAdminCredential(req: NextRequest): Promise<boolean> {
  if (isAdminRequest(req)) return true;
  if (!req.headers.get("x-admin-key")?.startsWith("sa_adm_")) return false;
  return (await requireAdminKey(req)) === null;
}

export async function requireAdminKey(
  req: NextRequest,
  requiredScope?: string
): Promise<NextResponse | null> {
  // Fast path: shared ADMIN_SECRET (still supported during migration).
  // Shared key is god-mode — scope checks are bypassed for founders.
  if (isAdminRequest(req)) {
    Sentry.addBreadcrumb({ category: "auth", message: "Admin key authenticated (shared)", level: "info" });
    return null;
  }

  // Per-admin key path: check x-admin-key header for sa_adm_ prefixed keys
  const providedKey = req.headers.get("x-admin-key");
  if (providedKey?.startsWith("sa_adm_")) {
    const { validateAdminKey, hasScope } = await import("@/lib/admin-keys");
    const { valid, adminEmail, scopes } = await validateAdminKey(providedKey);
    if (valid) {
      if (requiredScope && !hasScope(scopes, requiredScope)) {
        Sentry.addBreadcrumb({
          category: "auth",
          message: `Scope denied: ${adminEmail} lacks ${requiredScope}`,
          level: "warning",
        });
        return errorResponse(`Missing required scope: ${requiredScope}`, 403, req.headers.get("origin"));
      }
      Sentry.setTag("admin_email", adminEmail);
      Sentry.addBreadcrumb({ category: "auth", message: `Admin key authenticated: ${adminEmail}`, level: "info" });
      return null;
    }
  }

  return errorResponse("Unauthorized", 401, req.headers.get("origin"));
}

export function getOrigin(req: NextRequest): string | null {
  return req.headers.get("origin");
}

/**
 * Facility-scoped authorization for the owner-facing facility tools (/portal/tools, /partner/tools).
 *
 * Returns null (authorized) when EITHER:
 *  - the request carries a valid admin key (founders/VAs — full access), OR
 *  - the request carries a valid manage session whose scope includes the
 *    specific `facilityId` being accessed.
 *
 * Otherwise returns an error response. This is the single guard that lets the
 * existing facility components be reused by owners without leaking one
 * facility's data to another: an owner can only ever touch facilities their
 * signed session was issued for.
 *
 * Usage in a route:
 *   const denied = await requireFacilityAccess(req, facilityId);
 *   if (denied) return denied;
 */
export async function requireFacilityAccess(
  req: NextRequest,
  facilityId?: string | null
): Promise<NextResponse | null> {
  // Admin fast path (shared ADMIN_SECRET).
  if (isAdminRequest(req)) return null;

  // When facilityId isn't passed explicitly (e.g. GET handlers), fall back to
  // the ?facilityId= query param so the guard can be a 1:1 swap. Body-based
  // handlers (POST/PATCH/DELETE) must still pass it explicitly after parsing.
  const targetFacilityId =
    facilityId ?? req.nextUrl.searchParams.get("facilityId") ?? undefined;

  // Manage session must be present, valid, and scoped to THIS facility.
  const { getManageScope, manageScopeAllows } = await import("@/lib/manage-session");
  const scope = getManageScope(req);
  if (manageScopeAllows(scope, targetFacilityId)) {
    Sentry.addBreadcrumb({
      category: "auth",
      message: `Manage session authorized for facility ${facilityId}`,
      level: "info",
    });
    return null;
  }

  // Fall back to per-admin key validation (async) before refusing.
  const providedKey = req.headers.get("x-admin-key");
  if (providedKey?.startsWith("sa_adm_")) {
    const adminCheck = await requireAdminKey(req);
    if (adminCheck === null) return null;
  }

  return errorResponse("Unauthorized", 401, req.headers.get("origin"));
}

/**
 * Dual auth: accepts admin key header OR valid Clerk session with admin/VA role.
 * Returns null if authorized, or an error response if not.
 * Use this as a drop-in replacement for requireAdminKey() when you want
 * to support both auth methods.
 */
export async function requireAdminAuth(
  req: NextRequest
): Promise<NextResponse | null> {
  // First check admin key — fast path, no async needed
  if (isAdminRequest(req)) {
    Sentry.setTag("auth_method", "admin_key");
    return null;
  }

  // Fall back to Clerk session check
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return errorResponse("Unauthorized", 401, req.headers.get("origin"));
    }

    const claims = sessionClaims as Record<string, unknown> | undefined;
    const metadataRole = (claims?.metadata as Record<string, unknown>)?.role;
    const pubMetadata = claims?.publicMetadata as Record<string, unknown> | undefined;
    const role = metadataRole ?? pubMetadata?.role;

    if (role === "admin" || role === "virtual_assistant") {
      Sentry.setUser({ id: userId });
      Sentry.setTag("auth_method", "clerk");
      Sentry.setTag("user_role", String(role));
      return null;
    }

    return errorResponse("Insufficient permissions", 403, req.headers.get("origin"));
  } catch {
    return errorResponse("Unauthorized", 401, req.headers.get("origin"));
  }
}

/**
 * Guard for resources that are NOT facility-scoped but should still be
 * available to signed-in owners — e.g. global template lists, the shared
 * style-reference library, stock imagery. Authorizes when the request carries
 * a valid admin key OR any valid manage session (no specific facility match
 * required). Use requireFacilityAccess instead whenever the data belongs to a
 * particular facility.
 */
export async function requireManageOrAdmin(
  req: NextRequest
): Promise<NextResponse | null> {
  if (isAdminRequest(req)) return null;

  const { getManageScope } = await import("@/lib/manage-session");
  const scope = getManageScope(req);
  if (scope && scope.facilityIds.length > 0) return null;

  const providedKey = req.headers.get("x-admin-key");
  if (providedKey?.startsWith("sa_adm_")) {
    const adminCheck = await requireAdminKey(req);
    if (adminCheck === null) return null;
  }

  return errorResponse("Unauthorized", 401, req.headers.get("origin"));
}
