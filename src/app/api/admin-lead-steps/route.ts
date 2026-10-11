import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { LEAD_STEP_IDS, type LeadStepId } from "@/lib/lead-step";
import { stepsForFacilities } from "@/lib/lead-step-data";

const PAGE_CAP = 500;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Every operator lead and the step deriveLeadStep can prove.
 * Used by the Lead nurture tab. Counts are of the rows returned.
 */
export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-lead-steps");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const where = { deleted_at: null };
    const [total, facilities] = await Promise.all([
      db.facilities.count({ where }),
      db.facilities.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: PAGE_CAP,
        select: {
          id: true,
          name: true,
          location: true,
          contact_name: true,
          contact_email: true,
          contact_phone: true,
          intake_answers: true,
          pipeline_status: true,
          shared_audit_slug: true,
          audit_sent_at: true,
          audit_delivery_error: true,
          notes: true,
          sort_last: true,
          created_at: true,
        },
      }),
    ]);

    const stepById = await stepsForFacilities(facilities);
    const counts = Object.fromEntries(LEAD_STEP_IDS.map((id) => [id, 0])) as Record<LeadStepId, number>;

    const leads = facilities.map((facility) => {
      const step = stepById.get(facility.id);
      if (!step) return null;
      counts[step.id] += 1;
      return {
        id: facility.id,
        name: facility.contact_name || "",
        email: facility.contact_email || "",
        phone: facility.contact_phone || "",
        facilityName: facility.name || "",
        location: facility.location || "",
        createdAt: facility.created_at ? facility.created_at.toISOString() : "",
        step,
      };
    }).filter((lead) => lead != null);

    return jsonResponse(
      {
        leads,
        counts,
        total,
        truncated: total > facilities.length,
      },
      200,
      origin
    );
  } catch (err) {
    console.error("Admin lead steps error:", err);
    return errorResponse("Failed to list lead steps", 500, origin);
  }
}
