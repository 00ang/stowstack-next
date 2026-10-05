/**
 * The base URL for this app to call one of its own routes, server to server.
 *
 * Not VERCEL_URL first. That is the per-deployment `*.vercel.app` host, and the
 * project has Vercel deployment protection on everything except its custom
 * domains, so a server-side fetch to it gets Vercel's 401 login wall instead of
 * our route. That is how diagnostic audit auto-generation failed silently from
 * at least 2026-08-18: NEXT_PUBLIC_APP_URL was never set in production, and the
 * fallback was the protected deployment URL.
 *
 * Order: the configured site URL (what every other self-call already uses), the
 * production domain Vercel reports for production deployments, and only then the
 * deployment URL — right for previews, which have no custom domain.
 */
export function selfBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
