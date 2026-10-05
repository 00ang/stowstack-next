import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { verifyOAuthState } from "@/lib/oauth-state";

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

function redirectError(message: string): NextResponse {
  return NextResponse.redirect(
    `${getBaseUrl()}/?auth=error&platform=meta&message=${encodeURIComponent(message)}`
  );
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "auth-meta-callback");
  if (limited) return limited;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return redirectError(errorDescription || error);
  }

  if (!code || !state) {
    return redirectError("Missing authorization code");
  }

  const parsed = verifyOAuthState<{ facilityId?: string }>(state);
  if (!parsed?.facilityId) {
    return redirectError("Invalid state parameter");
  }
  const facilityId = parsed.facilityId;

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return redirectError("Meta app not configured");
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/meta/callback`;

  try {
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectError(tokenData.error.message);
    }

    const longLivedRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    const accessToken =
      longLivedData.access_token || tokenData.access_token;
    const expiresIn =
      longLivedData.expires_in || tokenData.expires_in || 5184000;

    const accountsRes = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status&access_token=${accessToken}`
    );
    const accountsData = await accountsRes.json();
    const adAccounts = accountsData.data || [];

    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();
    const pages = pagesData.data || [];

    const defaultAccount = adAccounts[0];
    const defaultPage = pages[0];
    const tokenExpiresAt = new Date(
      Date.now() + expiresIn * 1000
    ).toISOString();

    const metadata = JSON.stringify({
      adAccounts: adAccounts.map(
        (a: { id: string; name: string }) => ({
          id: a.id,
          name: a.name,
        })
      ),
      pages: pages.map((p: { id: string; name: string }) => ({
        id: p.id,
        name: p.name,
      })),
      pageAccessToken: defaultPage?.access_token || null,
    });

    const accountId = defaultAccount?.id?.replace("act_", "") || null;
    const accountName = defaultAccount?.name || null;
    const pageId = defaultPage?.id || null;
    const pageName = defaultPage?.name || null;

    await db.$executeRaw`
      INSERT INTO platform_connections (facility_id, platform, status, access_token, token_expires_at, account_id, account_name, page_id, page_name, metadata, updated_at)
      VALUES (${facilityId}::uuid, 'meta', 'connected', ${accessToken}, ${tokenExpiresAt}::timestamptz, ${accountId}, ${accountName}, ${pageId}, ${pageName}, ${metadata}::jsonb, NOW())
      ON CONFLICT (facility_id, platform) DO UPDATE SET
        status = 'connected',
        access_token = ${accessToken},
        token_expires_at = ${tokenExpiresAt}::timestamptz,
        account_id = COALESCE(${accountId}, platform_connections.account_id),
        account_name = COALESCE(${accountName}, platform_connections.account_name),
        page_id = COALESCE(${pageId}, platform_connections.page_id),
        page_name = COALESCE(${pageName}, platform_connections.page_name),
        -- Merge, not replace: operator settings (pixelId — MISSION.md s12)
        -- must survive a reconnect.
        metadata = COALESCE(platform_connections.metadata, '{}'::jsonb) || ${metadata}::jsonb,
        updated_at = NOW()
    `;

    return NextResponse.redirect(`${baseUrl}/?auth=success&platform=meta`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return redirectError(message);
  }
}
