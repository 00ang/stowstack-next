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

function redirectError(platform: string, message: string, returnTo: string | null = null): NextResponse {
  return NextResponse.redirect(returnUrl(getBaseUrl(), returnTo, { auth: "error", platform, message }));
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "auth-google-callback");
  if (limited) return limited;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    // Cancelled or refused on Google's side: back to where the owner started, if the state says.
    const early = state ? verifyOAuthState<{ returnTo?: string }>(state) : null;
    return redirectError("google_ads", error, safeReturnTo(early?.returnTo));
  }

  if (!code || !state) {
    return redirectError("google_ads", "Missing authorization code");
  }

  const parsed = verifyOAuthState<{ facilityId?: string; returnTo?: string }>(state);
  if (!parsed?.facilityId) {
    return redirectError("google_ads", "Invalid state parameter");
  }
  const facilityId = parsed.facilityId;
  // Errors from here on go back to where the owner started, too.
  const back = safeReturnTo(parsed.returnTo);

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectError("google_ads", "Google Ads not configured", back);
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return redirectError(
        "google_ads",
        tokenData.error_description || tokenData.error
      , back);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiresAt = new Date(
      Date.now() + (expires_in || 3600) * 1000
    ).toISOString();

    let customers: string[] = [];
    try {
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
      if (developerToken) {
        const customersRes = await fetch(
          "https://googleads.googleapis.com/v17/customers:listAccessibleCustomers",
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "developer-token": developerToken,
            },
          }
        );
        const customersData = await customersRes.json();
        customers = (customersData.resourceNames || []).map(
          (rn: string) => rn.replace("customers/", "")
        );
      }
    } catch {
      // Failed to list customers — continue without
    }

    const defaultCustomer = customers[0] || null;

    await db.$executeRaw`
      INSERT INTO platform_connections (facility_id, platform, status, access_token, refresh_token, token_expires_at, account_id, account_name, metadata, updated_at)
      VALUES (${facilityId}::uuid, 'google_ads', 'connected', ${access_token}, ${refresh_token || null}, ${tokenExpiresAt}::timestamptz, ${defaultCustomer}, ${defaultCustomer ? `Account ${defaultCustomer}` : null}, ${JSON.stringify({ customers })}::jsonb, NOW())
      ON CONFLICT (facility_id, platform) DO UPDATE SET
        status = 'connected',
        access_token = ${access_token},
        refresh_token = COALESCE(${refresh_token || null}, platform_connections.refresh_token),
        token_expires_at = ${tokenExpiresAt}::timestamptz,
        account_id = COALESCE(${defaultCustomer}, platform_connections.account_id),
        account_name = COALESCE(${defaultCustomer ? `Account ${defaultCustomer}` : null}, platform_connections.account_name),
        -- Merge, not replace: operator settings (moveInConversionActionId,
        -- loginCustomerId — MISSION.md s12) must survive a reconnect.
        metadata = COALESCE(platform_connections.metadata, '{}'::jsonb) || ${JSON.stringify({ customers })}::jsonb,
        updated_at = NOW()
    `;

    return NextResponse.redirect(returnUrl(baseUrl, safeReturnTo(parsed.returnTo), { auth: "success", platform: "google_ads" }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return redirectError("google_ads", message, back);
  }
}
