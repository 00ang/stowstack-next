/**
 * Write-back settings on a facility's ad-platform connection (MISSION.md s12).
 *
 * The move-in reports need three facts nobody can get from OAuth: which Meta
 * pixel a facility reports to (when it has its own), which Google conversion
 * action a move-in credits, and which manager account to act through. They live
 * in `platform_connections.metadata`, merged rather than replaced so a reconnect
 * keeps them. This file is the one place that decides what a valid value is.
 *
 * Pure. Nothing here touches the database or the network.
 */

export const WRITE_BACK_FIELDS = {
  meta: ["pixelId"],
  google_ads: ["moveInConversionActionId", "loginCustomerId"],
} as const;

export type WriteBackPlatform = keyof typeof WRITE_BACK_FIELDS;

export function isWriteBackPlatform(p: string): p is WriteBackPlatform {
  return p === "meta" || p === "google_ads";
}

export type ParsedSettings =
  | { ok: true; set: Record<string, string>; unset: string[] }
  | { ok: false; error: string };

const CONVERSION_ACTION_RESOURCE = /^customers\/\d{6,12}\/conversionActions\/\d{1,20}$/;

/** Normalise one field, or say why it is not a value we can send to the platform. */
function normalise(field: string, raw: string): { value: string } | { error: string } {
  const v = raw.trim();
  switch (field) {
    case "pixelId":
      // Meta pixel / dataset ids are long integers.
      return /^\d{6,20}$/.test(v) ? { value: v } : { error: "Meta pixel ID should be the number from Events Manager, digits only." };
    case "moveInConversionActionId": {
      if (CONVERSION_ACTION_RESOURCE.test(v)) return { value: v };
      return /^\d{1,20}$/.test(v)
        ? { value: v }
        : { error: "Conversion action should be its numeric ID or customers/…/conversionActions/… ." };
    }
    case "loginCustomerId": {
      // Shown in Google Ads as 123-456-7890; the API wants the ten digits.
      const digits = v.replace(/-/g, "");
      return /^\d{10}$/.test(digits) ? { value: digits } : { error: "Manager account ID is ten digits, e.g. 123-456-7890." };
    }
    default:
      return { error: `Unknown setting ${field}.` };
  }
}

/**
 * Validate a settings update for one connection. A field sent as "" or null
 * is cleared; a field left out is untouched; a field that is not one of this
 * platform's write-back settings is refused rather than silently stored, so
 * this cannot become a way to overwrite OAuth data in `metadata`.
 */
export function parseWriteBackSettings(platform: string, input: unknown): ParsedSettings {
  if (!isWriteBackPlatform(platform)) return { ok: false, error: "This platform has no move-in reporting settings." };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "settings must be an object." };

  const allowed: readonly string[] = WRITE_BACK_FIELDS[platform];
  const set: Record<string, string> = {};
  const unset: string[] = [];

  for (const [field, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!allowed.includes(field)) return { ok: false, error: `${field} is not a setting for ${platform}.` };
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      unset.push(field);
      continue;
    }
    if (typeof raw !== "string" && typeof raw !== "number") return { ok: false, error: `${field} must be text.` };
    const r = normalise(field, String(raw));
    if ("error" in r) return { ok: false, error: r.error };
    set[field] = r.value;
  }
  return { ok: true, set, unset };
}

/** The current write-back settings on a connection, as the settings form shows them. */
export function readWriteBackSettings(platform: string, metadata: unknown): Record<string, string> {
  if (!isWriteBackPlatform(platform)) return {};
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const f of WRITE_BACK_FIELDS[platform]) {
    const v = m[f];
    if (typeof v === "string" && v) out[f] = v;
  }
  return out;
}
