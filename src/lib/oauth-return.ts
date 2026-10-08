/**
 * Where an ad-platform connect flow lands afterwards. The path the owner
 * started from travels inside the signed OAuth state, so connecting Meta from
 * Publish Ads comes back to Publish Ads instead of the marketing homepage.
 * Only StorageAds' own app paths are accepted.
 */

const APP_PATH = /^\/(portal|partner|admin)(\/|\?|$)/;

/** A same-origin app path to return to, or null for anything else. */
export function safeReturnTo(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  return APP_PATH.test(raw) ? raw : null;
}

/** The redirect after a connect flow: the return path (or home) with the outcome on it. */
export function returnUrl(base: string, returnTo: string | null, params: Record<string, string>): string {
  const url = new URL(returnTo ?? "/", base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
