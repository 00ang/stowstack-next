/**
 * Activity-log presentation layer.
 *
 * The `activity_log` table stores raw event types (`lead_created`,
 * `cron_completed`, `org_created`, …). Admin UIs historically assumed a
 * different shape (`timestamp`, `description`, `actor`, category buckets)
 * and never mapped it, so `/admin/activity` and the insights feed rendered
 * blank descriptions and Invalid Date. This module is the single contract
 * between writers and those screens.
 */

export const ACTIVITY_CATEGORIES = ["leads", "campaigns", "billing", "system"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface ActivityLogRow {
  id: string;
  type: string;
  facility_id?: string | null;
  lead_name?: string | null;
  facility_name?: string | null;
  detail?: string | null;
  meta?: unknown;
  created_at: Date | string | null;
}

export interface PresentedActivity {
  id: string;
  timestamp: string;
  /** Raw DB type — insights icons key off this. */
  type: string;
  /** Filter / icon bucket used by /admin/activity. */
  category: ActivityCategory;
  description: string;
  actor: string;
  detail: string;
  lead_name: string;
  facility: string;
}

const CATEGORY_BY_TYPE: Record<string, ActivityCategory> = {
  lead_created: "leads",
  lead_captured: "leads",
  lead_deleted: "leads",
  consumer_lead: "leads",
  consumer_lead_status_change: "leads",
  status_change: "leads",
  client_signed: "leads",
  note_added: "leads",
  diagnostic_submitted: "leads",
  audit_approved: "leads",
  audit_generated: "leads",
  audit_requested: "leads",
  call_booked: "leads",
  call_received: "leads",
  walkin_attribution: "leads",
  walkin_logged: "leads",
  attributed_move_in: "leads",
  drip_sent: "leads",
  drip_cancelled: "leads",
  drip_send_failed: "leads",
  recovery_sent: "leads",
  review_request: "leads",
  review_solicitation_sent: "leads",
  signup: "leads",
  partner_signup: "leads",

  audience_created: "campaigns",
  campaign_added: "campaigns",
  landing_page_visit: "campaigns",

  org_created: "billing",
  subscription_canceled: "billing",
  invoice_sent: "billing",
  report_sent: "billing",

  cron_completed: "system",
  gbp_connected: "system",
  onboarding_step: "system",
  portal_access_granted: "system",
  storedge_webhook: "system",
};

const PREFIX_CATEGORY: Array<[string, ActivityCategory]> = [
  ["lead_", "leads"],
  ["consumer_", "leads"],
  ["audit_", "leads"],
  ["call_", "leads"],
  ["drip_", "leads"],
  ["recovery_", "leads"],
  ["review_", "leads"],
  ["tour_", "leads"],
  ["walkin_", "leads"],
  ["campaign_", "campaigns"],
  ["audience_", "campaigns"],
  ["ad_", "campaigns"],
  ["invoice_", "billing"],
  ["subscription_", "billing"],
  ["org_", "billing"],
  ["cron_", "system"],
  ["storedge_", "system"],
  ["gbp_", "system"],
];

export function isCronNoise(type: string): boolean {
  return type === "cron_completed" || type.startsWith("cron_");
}

export function categoryForType(type: string): ActivityCategory {
  if (CATEGORY_BY_TYPE[type]) return CATEGORY_BY_TYPE[type];
  for (const [prefix, category] of PREFIX_CATEGORY) {
    if (type.startsWith(prefix)) return category;
  }
  return "system";
}

export function isActivityCategory(value: string | null): value is ActivityCategory {
  return !!value && (ACTIVITY_CATEGORIES as readonly string[]).includes(value);
}

function humanizeType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toIso(value: Date | string | null): string {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function presentActivityLog(row: ActivityLogRow): PresentedActivity {
  const description = (row.detail && row.detail.trim()) || humanizeType(row.type);
  const actor = (row.lead_name && row.lead_name.trim()) || "System";
  const facility = (row.facility_name && row.facility_name.trim()) || "";
  return {
    id: row.id,
    timestamp: toIso(row.created_at),
    type: row.type,
    category: categoryForType(row.type),
    description,
    actor,
    detail: facility,
    lead_name: row.lead_name?.trim() || "",
    facility,
  };
}

/** Prisma `where` fragment for a category filter. Cron rows are excluded unless category is system. */
export function activityLogWhere(opts: {
  facilityId?: string | null;
  category?: ActivityCategory | null;
  includeCron?: boolean;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (opts.facilityId) where.facility_id = opts.facilityId;

  const knownForCategory = Object.entries(CATEGORY_BY_TYPE)
    .filter(([, cat]) => !opts.category || cat === opts.category)
    .map(([type]) => type);

  if (opts.category) {
    const prefixes = PREFIX_CATEGORY.filter(([, cat]) => cat === opts.category).map(
      ([prefix]) => prefix
    );
    where.OR = [
      ...(knownForCategory.length ? [{ type: { in: knownForCategory } }] : []),
      ...prefixes.map((prefix) => ({ type: { startsWith: prefix } })),
    ];
  } else if (!opts.includeCron) {
    where.NOT = { type: { startsWith: "cron_" } };
  }

  return where;
}
