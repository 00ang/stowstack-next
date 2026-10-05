import { db } from "./db";
import { PLANS, type PlanKey } from "./stripe";

export type PlanLimit = {
  facilityLimit: number; // -1 = unlimited
  landingPageLimit: number;
  teamLimit: number;
};

export const DEFAULT_PLAN: PlanKey = "launch";

/**
 * Lookup the limits for a plan key. Falls back to `launch` limits when
 * the plan isn't recognized.
 */
export function getPlanLimits(plan: string | null | undefined): PlanLimit {
  const key = (plan || DEFAULT_PLAN) as PlanKey;
  const cfg = PLANS[key] ?? PLANS[DEFAULT_PLAN];
  return {
    facilityLimit: cfg.facilityLimit,
    landingPageLimit: cfg.landingPageLimit,
    teamLimit: cfg.teamLimit,
  };
}

export type OrgGate = {
  ok: boolean;
  reason?: string;
  code?: "over_limit" | "subscription_inactive" | "trial_expired" | "not_found" | "plan_required";
};

/** AI video generation is a top-plan feature. */
export const VIDEO_PLANS: readonly PlanKey[] = ["portfolio"];

/**
 * Pure: may this org (a facility's owning org) generate AI video? The plan must
 * be a video plan, and a lapsed one (canceled, past due, expired trial) loses
 * it. Portfolio is custom-priced and sales-managed, so an org that never went
 * through Stripe checkout ("incomplete") still counts — the plan is the grant.
 * A facility with no org has no plan, so no video. Admins are not gated.
 */
export function orgAllowsVideo(
  org: { plan: string | null; subscription_status: string | null; trial_ends_at: Date | null } | null | undefined
): boolean {
  if (!org?.plan || !VIDEO_PLANS.includes(org.plan as PlanKey)) return false;
  if (org.subscription_status === "canceled" || org.subscription_status === "past_due") return false;
  if (org.subscription_status === "trialing" && org.trial_ends_at && org.trial_ends_at < new Date()) return false;
  return true;
}

/** Gate for owner (non-admin) video generation on a facility. */
export async function canGenerateVideo(facilityId: string): Promise<OrgGate> {
  const facility = await db.facilities.findUnique({
    where: { id: facilityId },
    select: {
      organizations: { select: { plan: true, subscription_status: true, trial_ends_at: true } },
    },
  });
  if (orgAllowsVideo(facility?.organizations)) return { ok: true };
  return {
    ok: false,
    code: "plan_required",
    reason: `Video generation is included with the ${PLANS.portfolio.name} plan.`,
  };
}

/**
 * Check whether an org's subscription_status allows write operations.
 * Active and trialing orgs pass. Past-due, canceled, and incomplete are denied.
 */
export function isSubscriptionActive(status: string | null | undefined, trialEndsAt: Date | null | undefined): OrgGate {
  if (status === "active") return { ok: true };
  if (status === "trialing") {
    if (trialEndsAt && trialEndsAt < new Date()) {
      return { ok: false, code: "trial_expired", reason: "Trial has expired. Please add a payment method" };
    }
    return { ok: true };
  }
  if (status === "past_due") {
    return { ok: false, code: "subscription_inactive", reason: "Payment past due. Update billing to continue" };
  }
  if (status === "canceled") {
    return { ok: false, code: "subscription_inactive", reason: "Subscription canceled" };
  }
  return { ok: false, code: "subscription_inactive", reason: "Subscription not active" };
}

/**
 * Check whether the org can create another facility.
 * Returns { ok: true } when under the limit or on an unlimited plan.
 */
export async function canAddFacility(orgId: string): Promise<OrgGate> {
  const org = await db.organizations.findUnique({
    where: { id: orgId },
    select: {
      facility_limit: true,
      plan: true,
      subscription_status: true,
      trial_ends_at: true,
    },
  });
  if (!org) return { ok: false, code: "not_found", reason: "Organization not found" };

  const subGate = isSubscriptionActive(org.subscription_status, org.trial_ends_at);
  if (!subGate.ok) return subGate;

  // Prefer explicit facility_limit (set by Stripe webhook) over plan defaults.
  const limit = org.facility_limit ?? getPlanLimits(org.plan).facilityLimit;
  if (limit === -1) return { ok: true };

  const count = await db.facilities.count({ where: { organization_id: orgId } });
  if (count >= limit) {
    return {
      ok: false,
      code: "over_limit",
      reason: `Facility limit reached (${count}/${limit}). Upgrade your plan to add more.`,
    };
  }
  return { ok: true };
}

/**
 * Check whether the org can create another landing page.
 */
export async function canAddLandingPage(facilityId: string): Promise<OrgGate> {
  const facility = await db.facilities.findUnique({
    where: { id: facilityId },
    select: { organization_id: true },
  });
  if (!facility?.organization_id) return { ok: true }; // unattached facilities aren't gated

  const org = await db.organizations.findUnique({
    where: { id: facility.organization_id },
    select: { plan: true, subscription_status: true, trial_ends_at: true },
  });
  if (!org) return { ok: true };

  const subGate = isSubscriptionActive(org.subscription_status, org.trial_ends_at);
  if (!subGate.ok) return subGate;

  const limit = getPlanLimits(org.plan).landingPageLimit;
  if (limit === -1) return { ok: true };

  const count = await db.landing_pages.count({ where: { facility_id: facilityId } });
  if (count >= limit) {
    return {
      ok: false,
      code: "over_limit",
      reason: `Landing page limit reached (${count}/${limit}) for your plan`,
    };
  }
  return { ok: true };
}
