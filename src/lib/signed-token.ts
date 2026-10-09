import crypto from "crypto";

/**
 * Small signed tokens for links that act without a login (a one-tap answer in
 * an email). base64url(payload).base64url(hmac), bound to a purpose so a token
 * made for one job can't be replayed against another, and expiring.
 *
 * Same secret chain as the OAuth state (src/lib/oauth-state.ts), so it works in
 * every environment without new configuration, and fails closed without one.
 */

function secret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.ADMIN_SECRET ||
    process.env.CRON_SECRET ||
    ""
  );
}

function mac(purpose: string, data: string, key: string): Buffer {
  return crypto.createHmac("sha256", key).update(`${purpose}.${data}`).digest();
}

export function signToken(purpose: string, payload: Record<string, unknown>, ttlMs: number): string {
  const key = secret();
  if (!key) throw new Error("Signing secret not configured");
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString("base64url");
  return `${data}.${mac(purpose, data, key).toString("base64url")}`;
}

export function verifyToken<T extends Record<string, unknown>>(purpose: string, token: string | null | undefined): T | null {
  const key = secret();
  if (!key || !token || token.length > 2000) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  const expected = mac(purpose, data, key);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, "base64url").toString()) as T & { exp?: number };
    if (typeof body.exp !== "number" || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}
