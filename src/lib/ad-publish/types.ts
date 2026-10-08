/**
 * Shared shapes for creating ads on Meta, Google and TikTok.
 *
 * Used by /api/publish-ad (one ad, by hand) and the campaign publisher
 * (src/lib/campaign-publish), so both create the same thing the same way.
 */

/** Marketing API. v24+ requires is_adset_budget_sharing_enabled on campaigns without a campaign budget. */
export const META_API_VERSION = process.env.META_API_VERSION || "v25.0";

export interface PlatformConnection {
  id: string;
  facility_id: string | null;
  platform: string;
  status: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: Date | null;
  account_id: string | null;
  page_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AdVariation {
  id: string;
  facility_id: string | null;
  platform: string;
  angle: string | null;
  content_json: Record<string, unknown>;
  status: string | null;
}

export interface PublishTarget {
  /** Dollars a day. Defaults to $10. */
  dailyBudget?: number;
  /** Run within this many miles of the facility's address. Without it the old account-wide default applies. */
  radius?: { miles: number; address: string };
  /** Where the ad sends people, with its tracking parameters already on it. */
  landingUrl?: string;
  imageUrl?: string;
  cta?: string;
  /** Google Search keywords, added as phrase match. */
  keywords?: string[];
  /** The campaign's name on the platform. */
  name?: string;
  /**
   * Ids made by an earlier attempt that stopped part-way. Those steps are
   * skipped, so a retry finishes the campaign instead of making a second one.
   */
  resume?: Record<string, string>;
}

export interface PublishResult {
  externalId: string | null;
  externalUrl: string | null;
  response: Record<string, unknown>;
}

/**
 * A publish that stopped part-way. `created` holds every id the platform gave
 * back before it stopped, for `PublishTarget.resume`.
 *
 * `unknown` is the case that must not be retried blindly: the request went out
 * and no answer came back, so the step may or may not exist on the platform.
 */
export class PartialPublish extends Error {
  constructor(
    message: string,
    readonly created: Record<string, string>,
    readonly unknown: boolean,
  ) {
    super(message);
    this.name = "PartialPublish";
  }
}

/** Dollars a day, clamped to something a platform will take. */
export function budgetDollars(value: number | undefined, fallback = 10): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(10_000, Math.max(1, Math.round(n * 100) / 100));
}

/**
 * Run one platform call as a step of a publish. A step already in `created`
 * is skipped. A platform error is a definite failure; a network failure or an
 * unreadable reply is unknown, since the request may have landed.
 */
export async function step(
  created: Record<string, string>,
  key: string,
  run: () => Promise<string | undefined>,
): Promise<string> {
  if (created[key]) return created[key];
  let id: string | undefined;
  try {
    id = await run();
  } catch (e) {
    if (e instanceof PlatformRefused) throw new PartialPublish(e.message, { ...created }, false);
    const msg = e instanceof Error ? e.message : String(e);
    throw new PartialPublish(`No answer while creating the ${label(key)}: ${msg}`, { ...created }, true);
  }
  if (!id) throw new PartialPublish(`The platform did not return an id for the ${label(key)}.`, { ...created }, true);
  created[key] = id;
  return id;
}

/** The platform answered and said no. Definite: nothing was made by this call. */
export class PlatformRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlatformRefused";
  }
}

function label(key: string): string {
  return key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}
