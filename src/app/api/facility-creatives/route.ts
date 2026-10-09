import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { validateCompliance } from "@/lib/compliance";
import { funnelConfigToDripSteps } from "@/lib/drip-sequences";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import {
  buildFacilityContext,
  generateEmailDrip,
  generateGoogleRSA,
  generateLandingPageCopy,
  generateMetaAds,
  getNextVersion,
  getOrCreateBrief,
  insertVariations,
} from "@/lib/creative-generation";

export const maxDuration = 60;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);
  const authErr = await requireFacilityAccess(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) return errorResponse("facilityId required", 400, origin);

  try {
    const [variations, briefs] = await Promise.all([
      db.ad_variations.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: "desc" },
      }),
      db.creative_briefs.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: "desc" },
      }),
    ]);
    return jsonResponse({ variations, briefs }, 200, origin);
  } catch {
    return errorResponse("Failed to fetch creatives", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.EXPENSIVE_API, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const facilityId = body?.facilityId;
    if (!facilityId) return errorResponse("facilityId required", 400, origin);

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return errorResponse("Missing ANTHROPIC_API_KEY", 500, origin);

    const platform = body?.platform || "meta_feed";
    const feedback = body?.feedback || null;

    const facilityData = await buildFacilityContext(facilityId);
    if (!facilityData) return errorResponse("Facility not found", 404, origin);

    const { facility, context } = facilityData;
    const resultData: {
      variations: Array<Record<string, unknown>>;
      landingPage: unknown;
      emailSequence: unknown;
    } = { variations: [], landingPage: null, emailSequence: null };

    const platforms = platform === "all"
      ? ["meta_feed", "google_search", "landing_page", "email_drip"]
      : [platform];

    const briefId = await getOrCreateBrief(facilityId, facility, context, platforms);
    const nextVersion = await getNextVersion(facilityId);

    const generators: Promise<void>[] = [];

    if (platforms.includes("meta_feed")) {
      generators.push(
        generateMetaAds(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const inserted = await insertVariations(
            parsed.variations,
            facilityId,
            briefId,
            "meta_feed",
            "static",
            nextVersion
          );
          resultData.variations.push(...inserted);
        })
      );
    }

    if (platforms.includes("google_search")) {
      generators.push(
        generateGoogleRSA(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const compliance = await validateCompliance(parsed.adGroup || parsed, "google_search").catch(() => ({ status: "passed" as const, flags: [] }));
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "google_search",
              format: "text",
              angle: "rsa",
              content_json: parsed.adGroup as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
              compliance_status: compliance.status,
              compliance_flags: compliance.flags.length > 0 ? (compliance.flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          resultData.variations.push(row);
        })
      );
    }

    if (platforms.includes("landing_page")) {
      generators.push(
        generateLandingPageCopy(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "landing_page",
              format: "sections",
              angle: "full_page",
              content_json: parsed as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
            },
          });
          resultData.variations.push(row);
          resultData.landingPage = parsed;
        })
      );
    }

    if (platforms.includes("email_drip")) {
      generators.push(
        generateEmailDrip(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const compliance = await validateCompliance(parsed, "sms").catch(() => ({ status: "passed" as const, flags: [] }));
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "email_drip",
              format: "email",
              angle: "nurture_sequence",
              content_json: parsed as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
              compliance_status: compliance.status,
              compliance_flags: compliance.flags.length > 0 ? (compliance.flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          resultData.variations.push(row);
          resultData.emailSequence = parsed;
        })
      );
    }

    await Promise.all(generators);

    await db.facilities.updateMany({
      where: { id: facilityId, status: { in: ["intake", "scraped", "briefed"] } },
      data: { status: "generating" },
    });

    return jsonResponse(
      {
        variations: resultData.variations,
        briefId,
        landingPage: resultData.landingPage,
        emailSequence: resultData.emailSequence,
        platforms,
        version: nextVersion,
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Copy generation failed: ${message}`, 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { variationId, status, feedback, content_json, funnel_config, deploy } = body || {};
    if (!variationId) return errorResponse("variationId required", 400, origin);

    const existing = await db.ad_variations.findUnique({
      where: { id: variationId },
      select: { facility_id: true },
    });
    if (!existing) return errorResponse("Not found", 404, origin);
    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    const VALID = ["draft", "review", "approved", "published", "rejected"];
    if (status && !VALID.includes(status)) return errorResponse("Invalid status", 400, origin);

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (content_json) updateData.content_json = content_json;
    if (funnel_config) updateData.funnel_config = funnel_config;

    if (!Object.keys(updateData).length && !deploy) return errorResponse("Nothing to update", 400, origin);

    let variation;
    if (Object.keys(updateData).length) {
      variation = await db.ad_variations.update({
        where: { id: variationId },
        data: updateData,
      });
      if (!variation) return errorResponse("Variation not found", 404, origin);
    } else {
      variation = await db.ad_variations.findUnique({ where: { id: variationId } });
      if (!variation) return errorResponse("Variation not found", 404, origin);
    }

    const resultData: Record<string, unknown> = { variation };

    // Sync funnel config to drip_sequence_templates for real execution
    if (funnel_config && variation.facility_id) {
      try {
        const fConfig = funnel_config as { postConversion?: { channel: 'sms' | 'email'; message: string; timing: string }[] };
        if (fConfig.postConversion?.length) {
          const dripSteps = funnelConfigToDripSteps(fConfig.postConversion);
          await db.drip_sequence_templates.upsert({
            where: {
              facility_id_variation_id: {
                facility_id: variation.facility_id,
                variation_id: variationId,
              },
            },
            create: {
              facility_id: variation.facility_id,
              variation_id: variationId,
              name: `Funnel: ${(variation.angle || 'ad')} sequence`,
              steps: dripSteps as unknown as Prisma.InputJsonValue,
            },
            update: {
              name: `Funnel: ${(variation.angle || 'ad')} sequence`,
              steps: dripSteps as unknown as Prisma.InputJsonValue,
            },
          });
        }
      } catch {
        // Non-fatal — drip template sync failure shouldn't block the save
      }
    }

    if (status === "approved" && variation.facility_id) {
      await db.$transaction(async (tx) => {
        const pending = await tx.ad_variations.count({
          where: {
            facility_id: variation.facility_id,
            status: { notIn: ["approved", "published", "rejected"] },
          },
        });
        if (pending === 0) {
          await tx.facilities.update({
            where: { id: variation.facility_id! },
            data: { status: "approved" },
          });
        } else {
          await tx.facilities.update({
            where: { id: variation.facility_id! },
            data: { status: "review" },
          });
        }
      });
    }

    if (deploy === "landing_page" && variation.platform === "landing_page") {
      const lpContent =
        typeof variation.content_json === "string"
          ? JSON.parse(variation.content_json)
          : (variation.content_json as Record<string, unknown>);
      const fac = await db.facilities.findUnique({ where: { id: variation.facility_id! } });
      if (!fac) return errorResponse("Facility not found", 404, origin);

      const baseSlug = (fac.name || "storage")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const exists = await db.landing_pages.findFirst({ where: { slug } });
        if (!exists) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const txResult = await db.$transaction(async (tx) => {
        const page = await tx.landing_pages.create({
          data: {
            facility_id: variation.facility_id!,
            slug,
            title: (lpContent.meta_title as string) || `${fac.name} - Self Storage`,
            meta_title: (lpContent.meta_title as string) || null,
            meta_description: (lpContent.meta_description as string) || null,
            variation_ids: [variation.id],
            storedge_widget_url: fac.website || null,
          },
        });

        const sections = (lpContent.sections as Array<Record<string, unknown>>) || [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: page.id,
              sort_order: (s.sort_order as number) ?? i,
              section_type: s.section_type as string,
              config: (s.config as object) || {},
            },
          });
        }

        await tx.ad_variations.update({
          where: { id: variation.id },
          data: { status: "published" },
        });

        return page;
      });

      variation.status = "published";
      resultData.landingPage = { id: txResult.id, slug: txResult.slug, url: `/lp/${slug}` };
    }

    if (deploy === "email_drip" && variation.platform === "email_drip") {
      const dripContent =
        typeof variation.content_json === "string"
          ? JSON.parse(variation.content_json)
          : (variation.content_json as Record<string, unknown>);
      const sequence = (dripContent.sequence as Array<Record<string, unknown>>) || [];
      if (sequence.length === 0) return errorResponse("No email sequence in variation", 400, origin);

      await db.$transaction(async (tx) => {
        const stepsJson = JSON.stringify(
            sequence.map((e, i) => ({
              step: i,
              delayDays: e.delayDays,
              subject: e.subject,
              preheader: e.preheader,
              body: e.body,
              ctaText: e.ctaText,
              ctaUrl: e.ctaUrl,
              label: e.label,
            }))
          );
        await tx.$executeRaw`
          INSERT INTO drip_sequence_templates (facility_id, variation_id, name, steps)
           VALUES (${variation.facility_id}::uuid, ${variation.id}::uuid, ${"AI-Generated Drip"}, ${stepsJson}::jsonb)
           ON CONFLICT (facility_id, variation_id) DO UPDATE SET steps = ${stepsJson}::jsonb, updated_at = NOW()
        `;

        await tx.ad_variations.update({
          where: { id: variation.id },
          data: { status: "published" },
        });
      });

      variation.status = "published";
      resultData.dripActivated = true;
    }

    return jsonResponse(resultData, 200, origin);
  } catch {
    return errorResponse("Failed to update variation", 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { variationId } = body || {};
    if (!variationId) return errorResponse("variationId required", 400, origin);

    const existing = await db.ad_variations.findUnique({
      where: { id: variationId },
      select: { facility_id: true },
    });
    if (!existing) return errorResponse("Not found", 404, origin);
    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    await db.ad_variations.delete({ where: { id: variationId } });
    return jsonResponse({ success: true }, 200, origin);
  } catch {
    return errorResponse("Failed to delete variation", 500, origin);
  }
}
