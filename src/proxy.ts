import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import {
  validateCsrf,
  requiresCsrf,
  generateCsrfToken,
  setCsrfCookie,
} from "@/lib/csrf";

// --- Security headers (Task 17) ---

// React + Turbopack dev runtimes require eval() for HMR and callstack
// reconstruction. Production never needs it. Gate 'unsafe-eval' on dev only.
const isDev = process.env.NODE_ENV !== "production";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com https://connect.facebook.net https://cdnjs.cloudflare.com https://*.clerk.accounts.dev https://cal.com https://*.cal.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.stripe.com https://*.googleapis.com https://*.gstatic.com https://img.clerk.com https://*.fal.media https://*.vercel-storage.com",
  "media-src 'self' blob: https://*.fal.media https://*.vercel-storage.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://api.stripe.com https://*.sentry.io https://*.upstash.io https://*.clerk.com https://*.clerk.accounts.dev https://*.facebook.com https://*.fal.media https://*.fal.run https://cal.com https://*.cal.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://cal.com https://*.cal.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders: Record<string, string> = {
  "Content-Security-Policy-Report-Only": cspDirectives,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Apply security headers to an existing response. */
function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/guide",
  "/demo",
  "/diagnostic",
  "/docs",
  "/blog(.*)",
  "/lp/(.*)",
  "/walkin/(.*)",
  // A new tenant's one-tap "how did you find us" (signed link, no account).
  "/heard",
  "/audit",
  "/audit/(.*)",
  "/audit-tool",
  "/signup",
  "/contact",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/(.*)",
  "/portal(.*)",
  "/partner(.*)",
  "/manage(.*)",
  "/admin(.*)",
]);

// Detect whether Clerk keys are production keys (pk_live_) vs dev/test keys (pk_test_)
const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkSecretKey = process.env.CLERK_SECRET_KEY ?? "";
const hasClerkKeys = !!clerkPubKey && !!clerkSecretKey;
const isClerkProdKeys = clerkPubKey.startsWith("pk_live_");

export function isCsrfExempt(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/webhooks/")) return true;
  if (path.startsWith("/api/stripe-webhook")) return true;
  if (path.startsWith("/api/call-webhook")) return true;
  if (path.startsWith("/api/cron/")) return true;
  if (path.startsWith("/api/v1/")) return true;
  // Public, unauthenticated lead-capture endpoints. No session to protect
  // via CSRF; abuse is bounded by per-IP rate limits at the route level.
  if (path === "/api/audit-form") return true;
  if (path === "/api/places-suggest") return true;
  if (path === "/api/consumer-lead") return true;
  if (path === "/api/diagnostic-intake") return true;
  if (path === "/api/facility-lookup") return true;
  // The landing page's own Ask form, the tour booked from its thank-you, and the
  // one-tap "how did you find us" (credential: the signed token in the body).
  // Same model as /api/consumer-lead: public, no session, per-IP rate limited.
  if (path === "/api/lead-capture") return true;
  if (path === "/api/tour" && req.method === "POST") return true;
  if (path === "/api/heard") return true;
  // Public anonymous tracking beacons fired from landing pages / embeds.
  // No session, fire-and-forget from the browser (failures are swallowed
  // client-side), abuse bounded by per-IP rate limits at the route level.
  if (path.startsWith("/api/tracking/")) return true;
  if (path === "/api/page-interactions") return true;
  // Pre-auth credential-in-body routes: they authenticate via a credential
  // carried in the request body (access code / email+password / reset token),
  // not an ambient session cookie, so the double-submit token is moot.
  if (path === "/api/walkin-attribution") return true;
  if (path === "/api/signup") return true;
  if (path === "/api/password-reset") return true;
  // Public, pre-authentication portal login endpoints (email → 4-digit code →
  // verify). These authenticate via email + code in the request body, not via
  // an ambient session cookie, so CSRF protection is moot; abuse is bounded by
  // per-IP + per-email rate limits at the route level.
  if (path === "/api/resend-access-code") return true;
  if (path === "/api/client-data") return true;
  // Portal client messaging authenticates via access code + email in the body
  // (same model as the endpoints above), so the ambient-cookie CSRF token is moot.
  if (path === "/api/client-messages") return true;
  // Portal report upload: client-authenticated by access code in the body (no
  // admin/Bearer header), so it is NOT covered by the header exemptions below and
  // would otherwise 403 here before reaching the route. Same credential-in-body
  // model as the endpoints above.
  if (path === "/api/portal-upload") return true;
  // Portal push subscription: client-authenticated by access code + email in the
  // body (same credential-in-body model as the endpoints above), so the ambient
  // CSRF token is moot. Abuse is bounded by per-IP rate limits at the route level.
  if (path === "/api/portal-push-subscribe") return true;
  // ── Adding a new client-authenticated portal mutation route (POST/PATCH/etc)? ──
  // If it authenticates via access code/email in the body or query (not the
  // x-admin-key / Bearer / x-org-token headers handled below), it MUST be added
  // here or the proxy will 403 it in prod: no portal client sends x-csrf-token,
  // so validateCsrf() always fails. Admin-key-gated routes are already covered by
  // the header checks below and do not need a line here.
  // Session/portal mutation endpoints that enforce CSRF themselves via
  // verifyCsrfOrigin() (an Origin check) rather than the double-submit token.
  // No client sends x-csrf-token, so the proxy's token gate would 403 these
  // before their own origin check ever runs. Each route below calls
  // verifyCsrfOrigin() (or, for partner login, can't carry a token it's trying
  // to obtain). Exempting here lets their in-route origin check do the work.
  if (path === "/api/client-onboarding") return true;
  if (path === "/api/organizations") return true;
  if (path === "/api/create-billing-portal") return true;
  if (path === "/api/data-deletion") return true;
  if (path === "/api/2fa") return true;
  if (path === "/api/verify-email") return true;
  // Meta CAPI is fired from the browser on public landing pages; the route
  // enforces verifyCsrfOrigin() itself. Route internals are Angelo's domain —
  // only this exemption lives on our side.
  if (path === "/api/meta-capi") return true;
  // Owner-tools manage session: scratch (invite signup) and facility (owner
  // profile edit) self-enforce verifyCsrfOrigin(); session is a read and
  // logout only clears the cookie.
  if (path.startsWith("/api/manage/")) return true;
  if (req.headers.get("x-admin-key")) return true;
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return true;
  if (req.headers.get("x-org-token")) return true;
  // Manage-session fallback header; must match HEADER_NAME in
  // src/lib/manage-session.ts (not imported here: that module pulls node
  // `crypto` into the middleware bundle).
  if (req.headers.get("x-manage-token")) return true;
  // Facility tools (/portal/tools, /partner/tools) authenticate with the
  // httpOnly manage cookie, which page JS can't read, so they can't send
  // x-manage-token or a double-submit token: without this every save /
  // generate / publish in the owner tools 403'd here. The cookie is
  // SameSite=Lax (a cross-site POST never carries it) and we also require a
  // same-origin Origin; the route still verifies the token itself
  // (requireFacilityAccess). Name must match COOKIE_NAME in manage-session.ts.
  if (req.cookies.get("sa_manage")?.value && isSameOriginRequest(req)) return true;
  return false;
}

/** The browser-set Origin names this host. Absent Origin is NOT same-origin. */
function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function proxy(request: NextRequest) {
  // Sentry route context for all requests
  Sentry.setTag("route", request.nextUrl.pathname);
  Sentry.setTag("method", request.method);

  // CSRF validation for state-changing API requests
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    requiresCsrf(request.method) &&
    !isCsrfExempt(request)
  ) {
    if (!validateCsrf(request)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Invalid or missing CSRF token" },
          { status: 403 }
        )
      );
    }
  }

  // Skip Clerk entirely for API routes — they handle their own auth
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Only use Clerk middleware if we have production keys
  // Dev/test keys cause "dev-browser-missing" errors on Vercel
  if (hasClerkKeys && isClerkProdKeys) {
    const clerkResponse = await clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })(request, {} as never);
    if (clerkResponse) {
      return applySecurityHeaders(clerkResponse as NextResponse);
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Ensure CSRF cookie exists on every response
  const response = NextResponse.next();
  if (!request.cookies.get("__csrf_token")) {
    setCsrfCookie(response, generateCsrfToken());
  }
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
