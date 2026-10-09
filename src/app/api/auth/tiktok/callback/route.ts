import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { verifyOAuthState } from "@/lib/oauth-state";
import { returnUrl, safeReturnTo } from "@/lib/oauth-return";

export const maxDuration = 15;

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_ENV === "production"
      ? "https://www.storageads.com"
      : null) ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

function redirectError(message: string, returnTo: string | null = null): NextResponse {
  return NextResponse.redirect(returnUrl(getBaseUrl(), returnTo, { auth: "error", platform: "tiktok", message }));
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "auth-tiktok-callback");
  if (limited) return limited;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    // Cancelled or refused on the platform's side: back to where the owner started, if the state says.
    const early = state ? verifyOAuthState<{ returnTo?: string }>(state) : null;
    return redirectError(errorDescription || error, safeReturnTo(early?.returnTo));
  }

  if (!code || !state) {
    return redirectError("Missing authorization code");
  }

  const parsed = verifyOAuthState<{ facilityId?: string; returnTo?: string }>(state);
  if (!parsed?.facilityId) {
    return redirectError("Invalid state parameter");
  }
  const facilityId = parsed.facilityId;
  // Errors from here on go back to where the owner started, too.
  const back = safeReturnTo(parsed.returnTo);

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    return redirectError("TikTok app not configured", back);
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/tiktok/callback`;

  try {
    const tokenRes = await fetch(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      }
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error || !tokenData.access_token) {
      const errMsg =
        tokenData.error_description ||
        tokenData.error ||
        "Token exchange failed";
      return redirectError(errMsg, back);
    }

    const { access_token, refresh_token, expires_in, open_id } =
      tokenData;
    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 86400) * 1000
    ).toISOString();

    let userName: string | null = null;
    let displayName: string | null = null;
    try {
      const userRes = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );
      const userData = await userRes.json();
      if (userData.data?.user) {
        userName = userData.data.user.username;
        displayName = userData.data.user.display_name;
      }
    } catch {
      // Failed to fetch user info — continue without
    }

    const metadata = JSON.stringify({
      open_id,
      username: userName,
      displayName,
    });
    const accountId = open_id || null;
    const accountName = displayName || userName || null;

    await db.$executeRaw`
      INSERT INTO platform_connections (facility_id, platform, status, access_token, refresh_token, token_expires_at, account_id, account_name, metadata, updated_at)
      VALUES (${facilityId}::uuid, 'tiktok', 'connected', ${access_token}, ${refresh_token || null}, ${tokenExpiresAt}::timestamptz, ${accountId}, ${accountName}, ${metadata}::jsonb, NOW())
      ON CONFLICT (facility_id, platform) DO UPDATE SET
        status = 'connected',
        access_token = ${access_token},
        refresh_token = COALESCE(${refresh_token || null}, platform_connections.refresh_token),
        token_expires_at = ${tokenExpiresAt}::timestamptz,
        account_id = COALESCE(${accountId}, platform_connections.account_id),
        account_name = COALESCE(${accountName}, platform_connections.account_name),
        metadata = ${metadata}::jsonb,
        updated_at = NOW()
    `;

    return NextResponse.redirect(returnUrl(baseUrl, safeReturnTo(parsed.returnTo), { auth: "success", platform: "tiktok" }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return redirectError(message, back);
  }
}
