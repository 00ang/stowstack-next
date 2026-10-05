import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Manage-session: a stateless, signed (HMAC-SHA256) session for the
 * owner-facing facility tools (/portal/tools for clients, /partner/tools for
 * partner orgs). Clients never log in to it separately: the portal login and
 * the partner session mint it (see setManageCookie).
 *
 * Unlike the admin key (shared god-mode) or the partner `ss_` DB session,
 * a manage session is scoped to a specific set of facility ids. It carries
 * no privileges beyond "you may read/write these facilities". The token is
 * stateless (no DB row) so Phase 1 ships without a Neon schema change.
 *
 * Transport: an httpOnly, Secure, SameSite=Lax cookie (COOKIE_NAME). Because
 * the tools fetch same-origin, the cookie is sent automatically — no client
 * token handling, and the value is not readable by injected JS. A header
 * (HEADER_NAME) is also accepted as a fallback for tests / non-browser callers.
 */

export const COOKIE_NAME = "sa_manage";
export const HEADER_NAME = "x-manage-token";
const TOKEN_PREFIX = "sm_";
const DEFAULT_TTL_DAYS = 14;

/**
 * How the session was minted. "portal" = client portal login, "org" = partner
 * session, "scratch" = invite-code workspace. "code" was the retired
 * access-code unlock; tokens minted by it stay valid until they expire.
 */
export type ManageMode = "code" | "scratch" | "portal" | "org";

export interface ManageScope {
  /** Facility ids this session is allowed to access. */
  facilityIds: string[];
  /** How the session was created. */
  mode: ManageMode;
  /** Issued-at (unix seconds). */
  iat: number;
  /** Expiry (unix seconds). */
  exp: number;
}

/**
 * Signing secret. Prefer a dedicated MANAGE_SESSION_SECRET; fall back to
 * ADMIN_SECRET so the feature works in existing environments. Fail closed
 * (return null / reject) when no secret is configured, mirroring cron-auth.
 */
function getSecret(): string | null {
  return process.env.MANAGE_SESSION_SECRET || process.env.ADMIN_SECRET || null;
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payloadB64: string, secret: string): string {
  return b64urlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );
}

/**
 * Create a signed manage-session token for the given facility scope.
 * Returns null only if no signing secret is configured.
 */
export function createManageToken(
  facilityIds: string[],
  mode: ManageMode,
  ttlDays: number = DEFAULT_TTL_DAYS
): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const scope: ManageScope = {
    facilityIds: [...new Set(facilityIds.filter(Boolean))],
    mode,
    iat: now,
    exp: now + ttlDays * 24 * 60 * 60,
  };

  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(scope), "utf8"));
  const sig = sign(payloadB64, secret);
  return `${TOKEN_PREFIX}${payloadB64}.${sig}`;
}

/**
 * Verify a token's signature and expiry. Returns the scope or null.
 * Constant-time signature comparison; never throws.
 */
export function verifyManageToken(token: string | null | undefined): ManageScope | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const secret = getSecret();
  if (!secret) return null;

  const body = token.slice(TOKEN_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 1) return null;

  const payloadB64 = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = sign(payloadB64, secret);

  // Constant-time compare; bail if lengths differ to avoid throw in timingSafeEqual.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let scope: ManageScope;
  try {
    scope = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as ManageScope;
  } catch {
    return null;
  }

  if (
    !scope ||
    !Array.isArray(scope.facilityIds) ||
    typeof scope.exp !== "number"
  ) {
    return null;
  }
  if (scope.exp < Math.floor(Date.now() / 1000)) return null; // expired

  return scope;
}

/**
 * Read and verify the manage scope from a request (cookie first, then header).
 * Returns null when there is no valid manage session.
 */
export function getManageScope(req: NextRequest): ManageScope | null {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const fromCookie = verifyManageToken(cookie);
  if (fromCookie) return fromCookie;

  const header = req.headers.get(HEADER_NAME);
  return verifyManageToken(header);
}

/** True if the verified manage scope grants access to a specific facility. */
export function manageScopeAllows(
  scope: ManageScope | null,
  facilityId: string | null | undefined
): boolean {
  if (!scope || !facilityId) return false;
  return scope.facilityIds.includes(facilityId);
}

/** Cookie options for setting/clearing the manage session on a NextResponse. */
export function manageCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const MANAGE_TTL_DAYS = DEFAULT_TTL_DAYS;

/**
 * Mint a manage session for these facilities and set it on the response.
 * Returns false (and sets nothing) when there are no facilities or no signing
 * secret, so callers whose main job is something else (a portal login) can
 * carry on without the tools.
 */
export function setManageCookie(
  res: NextResponse,
  facilityIds: string[],
  mode: ManageMode
): boolean {
  if (facilityIds.length === 0) return false;
  const token = createManageToken(facilityIds, mode);
  if (!token) return false;
  res.cookies.set(COOKIE_NAME, token, manageCookieOptions(MANAGE_TTL_DAYS * 24 * 60 * 60));
  return true;
}

/** Expire the manage session cookie. */
export function clearManageCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", manageCookieOptions(0));
}
