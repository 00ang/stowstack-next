/**
 * Keep founder-only surfaces out of the Vercel traffic dashboard.
 * Returns true when the page view or vital should be sent.
 */
export function allowVercelInsight(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url, "https://storageads.com").pathname;
  } catch {
    return true;
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return false;
  return true;
}
