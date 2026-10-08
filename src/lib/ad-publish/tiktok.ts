import { db } from "@/lib/db";
import type { AdVariation, PlatformConnection, PublishResult, PublishTarget } from "./types";

/** TikTok: a photo post to the connected profile. Posts publicly; there is no paused state. */

async function refreshTikTokToken(connection: PlatformConnection) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  const res = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey || "",
        client_secret: clientSecret || "",
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token || "",
      }),
    }
  );
  const data = await res.json();

  if (data.access_token) {
    await db.platform_connections.update({
      where: { id: connection.id },
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token || undefined,
        token_expires_at: new Date(
          Date.now() + (data.expires_in || 86400) * 1000
        ),
        updated_at: new Date(),
      },
    });
    return data.access_token as string;
  }
  return null;
}

export async function publishToTikTok(
  variation: AdVariation,
  connection: PlatformConnection,
  target: PublishTarget = {}
): Promise<PublishResult> {
  const imageUrl = target.imageUrl;
  const content = variation.content_json as Record<string, string>;

  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at) < new Date()
  ) {
    const newToken = await refreshTikTokToken(connection);
    if (newToken) connection.access_token = newToken;
  }

  const caption = [
    content.primaryText || content.headline || "",
    "",
    content.description || "",
    "",
    "#selfstorage #storage #moving #storageunit #declutter #organization",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2200);

  if (!imageUrl) {
    throw new Error(
      "TikTok requires an image or video. Select an image before publishing."
    );
  }

  const initRes = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/content/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        post_info: {
          title: caption,
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: [imageUrl],
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    }
  );
  const initData = await initRes.json();

  if (initData.error?.code && initData.error.code !== "ok") {
    throw new Error(
      `TikTok post failed: ${initData.error.message || initData.error.code}`
    );
  }

  const connMeta = connection.metadata || {};
  return {
    externalId: (initData.data?.publish_id as string) || null,
    externalUrl: (connMeta.username as string)
      ? `https://www.tiktok.com/@${connMeta.username}`
      : "https://www.tiktok.com",
    response: {
      publishId: initData.data?.publish_id,
      status: "posted",
      note: "Photo posted to TikTok. It may take a few minutes to appear on the profile.",
    },
  };
}
