import crypto from "crypto";

/**
 * Server-side Meta Conversions API firer. Use for backend-initiated
 * conversion events (lead captures, status changes) where we don't have
 * a browser to fire the pixel. For browser-fired events see
 * /api/meta-capi which validates + forwards.
 */

type UserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

type CustomData = {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
};

export type FireArgs = {
  eventName: "Lead" | "InitiateCheckout" | "Purchase" | "ViewContent" | "PageView";
  eventSourceUrl?: string;
  eventId?: string;
  userData: UserData;
  customData?: CustomData;
  /** Defaults to "website". A move-in reported after the fact is "physical_store". */
  actionSource?: "website" | "physical_store" | "system_generated" | "phone_call";
  /** When the conversion happened. Defaults to now. */
  eventTime?: Date;
  /** Override the env pixel — a facility with its own pixel. */
  pixelId?: string | null;
  /** Override the env token — paired with a facility pixel override. */
  accessToken?: string | null;
};

export type MetaSendResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; reason: "not_configured" | "rejected" | "transient"; detail: string };

const META_GRAPH_VERSION = "v21.0";

function sha256Lower(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

function hashUserData(ud: UserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (ud.email) out.em = sha256Lower(ud.email);
  if (ud.phone) {
    const digits = ud.phone.replace(/\D/g, "");
    if (digits) out.ph = sha256Lower(digits);
  }
  if (ud.firstName) out.fn = sha256Lower(ud.firstName);
  if (ud.lastName) out.ln = sha256Lower(ud.lastName);
  if (ud.city) out.ct = sha256Lower(ud.city);
  if (ud.state) out.st = sha256Lower(ud.state);
  if (ud.zip) out.zp = sha256Lower(ud.zip);
  if (ud.country) out.country = sha256Lower(ud.country);
  if (ud.fbc) out.fbc = ud.fbc;
  if (ud.fbp) out.fbp = ud.fbp;
  if (ud.clientIpAddress) out.client_ip_address = ud.clientIpAddress;
  if (ud.clientUserAgent) out.client_user_agent = ud.clientUserAgent;
  return out;
}

/**
 * Fire a server-side Meta CAPI event. Returns true on success.
 * No-op when META_PIXEL_ID or META_ACCESS_TOKEN aren't configured —
 * intentional so dev environments don't fail lead capture.
 */
export async function fireMetaCapi(args: FireArgs): Promise<boolean> {
  const res = await sendMetaEvent(args);
  if (!res.ok && res.reason !== "not_configured") {
    console.error("[meta-capi] server fire failed:", res.status, res.detail);
  }
  return res.ok;
}

/** Build the single event object Meta expects in `data[]`. Pure. */
export function buildMetaEvent(args: FireArgs): Record<string, unknown> {
  const event: Record<string, unknown> = {
    event_name: args.eventName,
    event_time: Math.floor((args.eventTime ?? new Date()).getTime() / 1000),
    action_source: args.actionSource ?? "website",
    user_data: hashUserData(args.userData),
  };
  if (args.eventId) event.event_id = args.eventId;
  if (args.eventSourceUrl) event.event_source_url = args.eventSourceUrl;

  if (args.customData) {
    const cd: Record<string, unknown> = {};
    if (args.customData.value !== undefined) cd.value = args.customData.value;
    if (args.customData.currency) cd.currency = args.customData.currency;
    if (args.customData.contentName) cd.content_name = args.customData.contentName;
    if (args.customData.contentCategory) cd.content_category = args.customData.contentCategory;
    if (Object.keys(cd).length) event.custom_data = cd;
  }

  return event;
}

/**
 * Send one event and say what happened, for callers that need to know the
 * difference between "Meta refused this" (do not retry — it will refuse again)
 * and "Meta was unreachable" (retry; the event_id makes a duplicate harmless).
 */
export async function sendMetaEvent(args: FireArgs): Promise<MetaSendResult> {
  const pixelId = args.pixelId || process.env.META_PIXEL_ID;
  const accessToken = args.accessToken || process.env.META_ACCESS_TOKEN;
  if (!pixelId || !accessToken) {
    return { ok: false, status: null, reason: "not_configured", detail: "META_PIXEL_ID / META_ACCESS_TOKEN not set" };
  }

  const event = buildMetaEvent(args);
  try {
    const res = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], access_token: accessToken }),
    });
    if (res.ok) return { ok: true, status: res.status };
    const body = (await res.text().catch(() => "")).slice(0, 500);
    const transient = res.status === 429 || res.status >= 500;
    return { ok: false, status: res.status, reason: transient ? "transient" : "rejected", detail: body };
  } catch (err) {
    return { ok: false, status: null, reason: "transient", detail: err instanceof Error ? err.message : String(err) };
  }
}
