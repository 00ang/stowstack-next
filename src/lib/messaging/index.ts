import { SimMessageProvider } from "./sim";
import { TwilioMessageProvider } from "./twilio";
import type { MessageProvider } from "./types";

/**
 * Provider selection (MISSION.md s5). Twilio when keyed, sim otherwise, and it
 * says which out loud — a silent fallback to sim would look like success while
 * nobody received anything.
 */
let cached: MessageProvider | null = null;

export function activeMessageProvider(): MessageProvider {
  if (cached) return cached;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  if (sid && token) {
    const live = process.env.MESSAGING_LIVE === "true";
    if (!live) {
      console.warn(
        "[messaging] Twilio is keyed but MESSAGING_LIVE is not 'true' — refusing to send. " +
          "Set it only once the A2P 10DLC brand and campaign are registered."
      );
    }
    cached = new TwilioMessageProvider(sid, token, { live, from });
  } else {
    console.warn("[messaging] No Twilio credentials — using the sim provider. Nothing will be delivered.");
    cached = new SimMessageProvider();
  }
  return cached;
}

/**
 * Whether a text sent now reaches a phone: Twilio keyed and MESSAGING_LIVE on
 * (set once the A2P 10DLC registration clears). What the product may promise.
 */
export function messagingLive(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.MESSAGING_LIVE === "true",
  );
}

/** Tests replace the provider rather than the vendor. */
export function __setMessageProvider(p: MessageProvider | null) {
  cached = p;
}

export * from "./types";
