import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/* ── Pull every useful data point about a facility ── */
async function gatherFacilityIntel(facilityId: string) {
  const facility = await db.facilities.findUnique({
    where: { id: facilityId },
    include: {
      organizations: { select: { name: true, slug: true } },
    },
  });
  if (!facility) return null;

  const [placesRow, assets, pmsUnits, pmsSpecials, snapshot, reviews, context] =
    await Promise.all([
      db.places_data
        .findFirst({ where: { facility_id: facilityId } })
        .catch(() => null),
      db.assets
        .findMany({
          where: { facility_id: facilityId, type: "photo" },
          orderBy: { created_at: "desc" },
          take: 20,
        })
        .catch(() => []),
      db.facility_pms_units
        .findMany({ where: { facility_id: facilityId } })
        .catch(() => []),
      db.facility_pms_specials
        .findMany({
          where: { facility_id: facilityId, active: true },
        })
        .catch(() => []),
      db.facility_pms_snapshots
        .findFirst({
          where: { facility_id: facilityId },
          orderBy: { snapshot_date: "desc" },
        })
        .catch(() => null),
      db.gbp_reviews
        .findMany({
          where: { facility_id: facilityId, rating: { gte: 4 } },
          orderBy: { review_time: "desc" },
          take: 10,
        })
        .catch(() => []),
      db.facility_context
        .findMany({
          where: { facility_id: facilityId },
          take: 5,
        })
        .catch(() => []),
    ]);

  const photos: { url: string; alt: string }[] = [];

  if (assets.length > 0) {
    for (const a of assets) {
      if (a.url) photos.push({ url: a.url, alt: facility.name || "" });
    }
  }

  const placesPhotos = (placesRow?.photos as { url?: string }[] | null) ?? [];
  for (const p of placesPhotos) {
    if (p.url && !photos.some((ph) => ph.url === p.url)) {
      photos.push({ url: p.url, alt: facility.name || "" });
    }
  }

  const placesReviews =
    (placesRow?.reviews as {
      author?: string;
      rating?: number;
      text?: string;
    }[] | null) ?? [];

  const allReviews = [
    ...reviews.map((r) => ({
      author: r.author_name || "",
      rating: r.rating,
      text: r.review_text || "",
    })),
    ...placesReviews
      .filter((r) => (r.rating ?? 0) >= 4 && r.text)
      .map((r) => ({
        author: r.author || "",
        rating: r.rating ?? 5,
        text: r.text || "",
      })),
  ].slice(0, 8);

  const units = pmsUnits.map((u) => ({
    type: u.unit_type,
    size: u.size_label,
    sqft: u.sqft,
    features: u.features ?? [],
    streetRate: u.street_rate ? Number(u.street_rate) : null,
    webRate: u.web_rate ? Number(u.web_rate) : null,
    vacant: u.vacant_count,
    total: u.total_count,
  }));

  const specials = pmsSpecials.map((s) => ({
    name: s.name,
    description: s.description,
    discountType: s.discount_type,
    discountValue: s.discount_value ? Number(s.discount_value) : null,
  }));

  return {
    name: facility.name || "",
    address: facility.google_address || facility.location || "",
    phone: facility.google_phone || facility.contact_phone || "",
    website: facility.website || "",
    rating: facility.google_rating ? Number(facility.google_rating) : null,
    reviewCount: facility.review_count || 0,
    hours: facility.hours as string[] | null,
    totalUnits: facility.total_units,
    occupancyRange: facility.occupancy_range,
    notes: facility.notes || "",
    orgName: facility.organizations?.name || "",
    photos,
    reviews: allReviews,
    units,
    specials,
    snapshot: snapshot
      ? {
          occupancyPct: snapshot.occupancy_pct
            ? Number(snapshot.occupancy_pct)
            : null,
          totalUnits: snapshot.total_units,
          occupiedUnits: snapshot.occupied_units,
          moveInsMtd: snapshot.move_ins_mtd,
        }
      : null,
    contextNotes: context.map((c) => c.content).filter(Boolean),
    storedgeWidgetUrl:
      (facility as Record<string, unknown>).storedge_widget_url as
        | string
        | undefined,
  };
}

/* ── Build the generation prompt ── */
function buildPrompt(
  intel: NonNullable<Awaited<ReturnType<typeof gatherFacilityIntel>>>,
  funnelStage: string,
  archetypeKey: string | null,
  adCopy: string | null
) {
  const hasUnits = intel.units.length > 0;
  const hasReviews = intel.reviews.length > 0;
  const hasPhotos = intel.photos.length > 0;
  const hasSpecials = intel.specials.length > 0;

  const unitBlock = hasUnits
    ? `REAL UNIT DATA (use exact sizes and prices — never invent pricing):
${intel.units
  .map(
    (u) =>
      `  ${u.type || "Unit"} — ${u.size || "?"}, street rate $${u.streetRate ?? "?"}/mo, web rate $${u.webRate ?? "?"}/mo, ${u.vacant ?? "?"} vacant of ${u.total ?? "?"}, features: ${(u.features as string[]).join(", ") || "none listed"}`
  )
  .join("\n")}`
    : "NO UNIT DATA AVAILABLE — skip the unit_types section entirely.";

  const specialsBlock = hasSpecials
    ? `ACTIVE SPECIALS (use in hero or CTA copy):
${intel.specials.map((s) => `  ${s.name}: ${s.description} (${s.discountType} ${s.discountValue})`).join("\n")}`
    : "";

  const reviewBlock = hasReviews
    ? `REAL REVIEWS (use the best 2-3 verbatim as testimonials, with real author names):
${intel.reviews.map((r) => `  ${r.author} (${r.rating}★): "${r.text}"`).join("\n")}`
    : "NO REVIEWS — generate 2 realistic testimonials with first name + last initial. Mark role as 'Tenant'. Never fabricate star ratings or review counts.";

  const photoBlock = hasPhotos
    ? `FACILITY PHOTOS (${intel.photos.length} available):
  Hero background: ${intel.photos[0].url}
  Gallery: ${intel.photos
      .slice(1, 8)
      .map((p) => p.url)
      .join(", ")}`
    : "NO PHOTOS — leave backgroundImage empty and skip the gallery section.";

  const archetypeContext = archetypeKey
    ? `TARGET ARCHETYPE: ${archetypeKey}
Tailor all copy to this customer persona:
  - downsizer: empathetic, life-transition language, emphasize care and preservation
  - business: ROI-focused, professional, emphasize workspace efficiency and accessibility
  - student: budget-friendly, convenience, summer storage, month-to-month flexibility
  - military: flexibility, no long-term commitment, gratitude, relocation support
  - renovator: temporary, timeline-focused, proximity, easy access during construction
  - life_event: sensitive, understanding, non-pushy, emphasize security and privacy`
    : "No specific archetype — write for a general self-storage customer.";

  const funnelContext = `FUNNEL STAGE: ${funnelStage}
${
  funnelStage === "awareness"
    ? "Lead with the PROBLEM the customer has (running out of space, life transition). Gentle. Hero should be aspirational. Shorter page — hero + features + CTA. Skip FAQ and testimonials."
    : funnelStage === "consideration"
      ? "Lead with WHY THIS FACILITY beats alternatives. Show unit options, social proof, features. Medium-length page — all sections. Compare implicitly through specifics."
      : funnelStage === "decision"
        ? "Lead with the OFFER. If there's a special, it's the headline. Urgency is real (based on vacancy data if available). Show pricing, phone number, trust signals. Every section pushes toward reservation."
        : "RETARGETING — the visitor has seen this facility before. Remind them. Lead with what makes this place memorable. Short and direct — hero + trust bar + CTA."
}`;

  const adMatchBlock = adCopy
    ? `AD MESSAGE TO MATCH: "${adCopy}"
The hero headline MUST closely mirror this ad copy for message-match. This is the #1 conversion lever.`
    : "";

  return `You are the best landing page copywriter in self-storage advertising. You write like Ogilvy — every word earns its place. You understand conversion rate optimization at the level of top performance marketing agencies.

Generate a complete landing page for this self-storage facility as a JSON object.

FACILITY: ${intel.name}
ADDRESS: ${intel.address}
PHONE: ${intel.phone}
${intel.rating ? `GOOGLE RATING: ${intel.rating} stars (${intel.reviewCount} reviews)` : ""}
${intel.hours ? `HOURS: ${(intel.hours as string[]).join(", ")}` : ""}
${intel.notes ? `OPERATOR NOTES: ${intel.notes}` : ""}
${intel.snapshot ? `OCCUPANCY: ${intel.snapshot.occupancyPct}% (${intel.snapshot.occupiedUnits}/${intel.snapshot.totalUnits} units)` : ""}

${unitBlock}

${specialsBlock}

${reviewBlock}

${photoBlock}

${funnelContext}

${archetypeContext}

${adMatchBlock}

RULES — READ CAREFULLY:
1. NEVER invent unit sizes, prices, or availability numbers. Only use REAL UNIT DATA above. If no unit data exists, omit the unit_types section.
2. NEVER fabricate a Google rating or review count. If rating exists above, you may reference it. Otherwise don't mention it.
3. DO generate compelling features, trust items, FAQ answers, and CTA copy even without real data — these are persuasive framing, not factual claims.
4. Every headline should work as a standalone statement someone would stop scrolling for.
5. Subheadlines should add one specific, concrete detail.
6. Trust bar items: max 4, each under 4 words. Think "24/7 Access", "Month-to-Month", "Drive-Up Units", "On-Site Manager".
7. Features: frame as BENEFITS not features. "Peace of mind with gated access" not "Gated facility". 3-5 items.
8. FAQ: answer real questions a storage customer would ask. 3-5 items. Be specific and helpful, not vague.
9. CTA section: this is the closing argument. Create urgency from real data if available (vacancy, specials). If no real urgency data, focus on convenience and ease of move-in.
10. The hero backgroundImage MUST be the first photo URL provided above (if any).
11. All copy should be natural, confident, and warm. Never corporate-stiff. Never salesy. The best advertising doesn't feel like advertising.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "title": "Page title for admin reference",
  "slug": "url-slug",
  "meta_title": "SEO title under 60 chars",
  "meta_description": "SEO description under 155 chars",
  "sections": [
    {
      "section_type": "hero",
      "sort_order": 0,
      "config": {
        "headline": "...",
        "subheadline": "...",
        "ctaText": "...",
        "ctaUrl": "#cta",
        "badgeText": "...",
        "backgroundImage": "first photo URL or empty string",
        "facilityName": "${intel.name}",
        "style": "dark"
      }
    },
    {
      "section_type": "trust_bar",
      "sort_order": 1,
      "config": { "items": [{ "icon": "check|star|shield|clock|truck|building", "text": "..." }] }
    },
    {
      "section_type": "features",
      "sort_order": 2,
      "config": { "headline": "...", "items": [{ "icon": "check|star|shield|clock|truck|building", "title": "...", "desc": "..." }] }
    },
    ${hasUnits ? `{
      "section_type": "unit_types",
      "sort_order": 3,
      "config": { "headline": "...", "units": [{ "name": "...", "size": "...", "price": "$XX", "features": ["..."] }] }
    },` : ""}
    {
      "section_type": "gallery",
      "sort_order": ${hasUnits ? 4 : 3},
      "config": { "headline": "...", "images": [{ "url": "photo URL", "alt": "..." }] }
    },
    {
      "section_type": "testimonials",
      "sort_order": ${hasUnits ? 5 : 4},
      "config": { "headline": "...", "items": [{ "name": "...", "text": "...", "role": "...", "metric": "" }] }
    },
    {
      "section_type": "faq",
      "sort_order": ${hasUnits ? 6 : 5},
      "config": { "headline": "...", "items": [{ "q": "...", "a": "..." }] }
    },
    {
      "section_type": "location_map",
      "sort_order": ${hasUnits ? 7 : 6},
      "config": { "headline": "...", "address": "${intel.address}", "directions": "..." }
    },
    {
      "section_type": "cta",
      "sort_order": ${hasUnits ? 8 : 7},
      "config": {
        "headline": "...",
        "subheadline": "...",
        "ctaText": "...",
        "ctaUrl": "#",
        "phone": "${intel.phone}",
        "style": "simple"
      }
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(
    req,
    RATE_LIMIT_TIERS.AUTHENTICATED,
    "landing-pages-generate"
  );
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      facilityId,
      funnelStage = "consideration",
      archetypeKey = null,
      adVariationId = null,
    } = body;

    if (!facilityId)
      return errorResponse("facilityId is required", 400, origin);

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    const intel = await gatherFacilityIntel(facilityId);
    if (!intel) return errorResponse("Facility not found", 404, origin);

    let adCopy: string | null = null;
    if (adVariationId) {
      // Scoped to this facility: an owner may only message-match its own ads.
      const variation = await db.ad_variations.findFirst({
        where: { id: adVariationId, facility_id: facilityId },
        select: { content_json: true },
      });
      if (variation?.content_json) {
        const content = variation.content_json as Record<string, unknown>;
        adCopy = [
          content.headline,
          content.primary_text,
          content.body,
        ]
          .filter(Boolean)
          .join(" — ");
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      return errorResponse("ANTHROPIC_API_KEY not configured", 500, origin);

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(intel, funnelStage, archetypeKey, adCopy);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return errorResponse("Failed to parse generation result", 500, origin);

    const generated = JSON.parse(jsonMatch[0]);

    if (!generated.sections || !Array.isArray(generated.sections)) {
      return errorResponse("Invalid generation structure", 500, origin);
    }

    const slug =
      generated.slug ||
      intel.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
        `-${Date.now().toString(36)}`;

    const existingSlug = await db.landing_pages.findFirst({
      where: { slug },
    });
    const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

    const page = await db.$transaction(async (tx) => {
      const newPage = await tx.landing_pages.create({
        data: {
          facility_id: facilityId,
          title: generated.title || `${intel.name} Landing Page`,
          slug: finalSlug,
          status: "draft",
          meta_title: generated.meta_title || null,
          meta_description: generated.meta_description || null,
          theme: {},
          storedge_widget_url: intel.storedgeWidgetUrl || null,
        },
      });

      for (const section of generated.sections) {
        await tx.landing_page_sections.create({
          data: {
            landing_page_id: newPage.id,
            section_type: section.section_type,
            sort_order: section.sort_order ?? 0,
            config: section.config ?? {},
          },
        });
      }

      const sections = await tx.landing_page_sections.findMany({
        where: { landing_page_id: newPage.id },
        orderBy: { sort_order: "asc" },
      });

      return { ...newPage, sections };
    });

    return jsonResponse(
      { page, facilityIntel: { photoCount: intel.photos.length, unitCount: intel.units.length, reviewCount: intel.reviews.length } },
      200,
      origin
    );
  } catch (err) {
    console.error("Landing page generation error:", err);
    return errorResponse("Failed to generate landing page", 500, origin);
  }
}
