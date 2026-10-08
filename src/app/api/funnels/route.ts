import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { funnelConfigToDripSteps } from "@/lib/drip-sequences";
import { funnelGraphSchema } from "@/lib/funnel-graph/schema";

export const maxDuration = 60;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/* ── GET: List funnels (by facility) or get single funnel ── */
export async function GET(req: NextRequest) {
  const origin = getOrigin(req);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const facilityId = searchParams.get("facilityId");

  try {
    if (id) {
      // One campaign: the access check is against the campaign's own facility,
      // never a facilityId the caller supplies (which would let any session
      // read another facility's campaign, leads included).
      const owner = await db.funnels.findUnique({ where: { id }, select: { facility_id: true } });
      const denied = await requireFacilityAccess(req, owner?.facility_id ?? null);
      if (denied) return denied;
      if (!owner) return errorResponse("Funnel not found", 404, origin);

      const funnel = await db.funnels.findUnique({
        where: { id },
        include: {
          ad_variations: {
            select: {
              id: true,
              platform: true,
              format: true,
              angle: true,
              content_json: true,
              asset_urls: true,
              status: true,
              compliance_status: true,
              funnel_config: true,
            },
          },
          landing_pages: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              published_at: true,
            },
          },
          drip_sequence_templates: {
            select: {
              id: true,
              name: true,
              sequence_type: true,
              steps: true,
            },
          },
          funnel_stage_metrics: {
            orderBy: { period: "desc" },
            take: 30,
          },
          partial_leads: {
            select: {
              id: true,
              name: true,
              email: true,
              lead_status: true,
              converted: true,
              created_at: true,
            },
            orderBy: { created_at: "desc" },
            take: 50,
          },
        },
      });
      if (!funnel) return errorResponse("Funnel not found", 404, origin);
      return jsonResponse(funnel, 200, origin);
    }

    // The list: scoped to the ?facilityId= the caller asks for.
    const denied = await requireFacilityAccess(req);
    if (denied) return denied;

    if (!facilityId) {
      return errorResponse("facilityId is required", 400, origin);
    }

    const funnels = await db.funnels.findMany({
      where: { facility_id: facilityId },
      include: {
        ad_variations: {
          select: { id: true, status: true, platform: true, angle: true },
        },
        landing_pages: {
          select: { id: true, slug: true, status: true },
        },
        _count: {
          select: { partial_leads: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return jsonResponse(funnels, 200, origin);
  } catch (err) {
    console.error("[funnels GET]", err);
    return errorResponse("Internal server error", 500, origin);
  }
}

/* ── POST: Create a new funnel ── */
export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { facilityId, name, archetype, config, dailyBudget, targetAudience } =
      body;

    if (!facilityId || !name) {
      return errorResponse("facilityId and name are required", 400, origin);
    }

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    // Create the funnel
    const funnel = await db.funnels.create({
      data: {
        facility_id: facilityId,
        name,
        archetype: archetype || "custom",
        config: config || {},
        daily_budget: dailyBudget || null,
        target_audience: targetAudience || null,
      },
    });

    // If config has postConversion steps, create drip template
    const funnelConfig = config as {
      postConversion?: { channel: "sms" | "email"; message: string; timing: string }[];
      recovery?: { channel: "sms" | "email"; message: string; timing: string }[];
    } | null;

    if (funnelConfig?.postConversion?.length) {
      const steps = funnelConfigToDripSteps(funnelConfig.postConversion);
      await db.drip_sequence_templates.create({
        data: {
          facility_id: facilityId,
          funnel_id: funnel.id,
          name: `${name} — Post-Conversion`,
          sequence_type: "post_conversion",
          steps: steps as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    if (funnelConfig?.recovery?.length) {
      const steps = funnelConfigToDripSteps(funnelConfig.recovery);
      await db.drip_sequence_templates.create({
        data: {
          facility_id: facilityId,
          funnel_id: funnel.id,
          name: `${name} — Recovery`,
          sequence_type: "recovery",
          steps: steps as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
    }

    return jsonResponse(funnel, 201, origin);
  } catch (err) {
    console.error("[funnels POST]", err);
    return errorResponse("Internal server error", 500, origin);
  }
}

/* ── PATCH: Update funnel ── */
export async function PATCH(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { id, name, status, config, dailyBudget, targetAudience, graph } = body;

    if (!id) return errorResponse("id is required", 400, origin);

    const existing = await db.funnels.findUnique({ where: { id } });
    if (!existing) return errorResponse("Funnel not found", 404, origin);

    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (status !== undefined) {
      data.status = status;
      if (status === "live" && !existing.published_at) {
        data.published_at = new Date();
      }
      if (status === "archived") {
        data.archived_at = new Date();
      }
    }
    if (config !== undefined) data.config = config;
    if (graph !== undefined) {
      const parsed = funnelGraphSchema.safeParse(graph);
      if (!parsed.success) return errorResponse("Campaign graph is not valid", 400, origin);
      const prev =
        existing.config && typeof existing.config === "object" && !Array.isArray(existing.config)
          ? (existing.config as Record<string, unknown>)
          : {};
      data.config = { ...prev, graph: parsed.data };
    }
    if (dailyBudget !== undefined) data.daily_budget = dailyBudget;
    if (targetAudience !== undefined) data.target_audience = targetAudience;

    const funnel = await db.funnels.update({
      where: { id },
      data,
    });

    // When going live, publish all associated landing pages and approve ad variations
    if (status === "live") {
      await Promise.all([
        // Publish all draft landing pages
        db.landing_pages.updateMany({
          where: { funnel_id: id, status: "draft" },
          data: { status: "published", published_at: new Date() },
        }),
        // Approve all draft ad variations
        db.ad_variations.updateMany({
          where: { funnel_id: id, status: "draft" },
          data: { status: "approved" },
        }),
      ]);
    }

    // When pausing, unpublish landing pages
    if (status === "paused") {
      await db.landing_pages.updateMany({
        where: { funnel_id: id, status: "published" },
        data: { status: "draft" },
      });
    }

    // Sync drip templates if config changed
    if (config) {
      const funnelConfig = config as {
        postConversion?: { channel: "sms" | "email"; message: string; timing: string }[];
      } | null;

      if (funnelConfig?.postConversion?.length) {
        const steps = funnelConfigToDripSteps(funnelConfig.postConversion);
        await db.drip_sequence_templates.upsert({
          where: {
            facility_id_variation_id: {
              facility_id: funnel.facility_id,
              variation_id: null as unknown as string,
            },
          },
          create: {
            facility_id: funnel.facility_id,
            funnel_id: funnel.id,
            name: `${funnel.name} — Post-Conversion`,
            sequence_type: "post_conversion",
            steps: steps as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
          update: {
            steps: steps as unknown as import("@prisma/client").Prisma.InputJsonValue,
            name: `${funnel.name} — Post-Conversion`,
          },
        });
      }
    }

    return jsonResponse(funnel, 200, origin);
  } catch (err) {
    console.error("[funnels PATCH]", err);
    return errorResponse("Internal server error", 500, origin);
  }
}

/* ── DELETE: Delete a funnel ── */
export async function DELETE(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return errorResponse("id is required", 400, origin);

    const existing = await db.funnels.findUnique({
      where: { id },
      select: { facility_id: true },
    });
    if (!existing) return errorResponse("Funnel not found", 404, origin);

    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    // Cascade handles children (ad_variations, landing_pages, etc.)
    await db.funnels.delete({ where: { id } });

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    console.error("[funnels DELETE]", err);
    return errorResponse("Internal server error", 500, origin);
  }
}
