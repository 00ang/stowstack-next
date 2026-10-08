import { db } from "@/lib/db";
import type { RawCompetitor, RawFacility } from "./types";

/**
 * Reads one facility's rows for the ontology: read-only, one round of parallel
 * queries, every list capped so a large facility stays a fast page. No schema
 * change: everything here already exists.
 */

const DAY = 86_400_000;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const num = (d: unknown) => (d == null ? null : Number(d));

/** Flatten an ad's copy JSON into one searchable string. */
function copyText(content: unknown): { headline: string | null; text: string } {
  const parts: string[] = [];
  let headline: string | null = null;
  const walk = (v: unknown, key?: string) => {
    if (typeof v === "string") {
      parts.push(v);
      if (!headline && key && /headline|title/i.test(key)) headline = v;
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(content);
  return { headline, text: parts.join(" ").slice(0, 4000) };
}

function competitorsFrom(json: unknown): RawCompetitor[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string")
    .slice(0, 30)
    .map((c) => ({
      name: String(c.name),
      distanceMiles: typeof c.distance_miles === "number" ? c.distance_miles : null,
      rating: typeof c.rating === "number" ? c.rating : null,
      reviewCount: typeof c.reviewCount === "number" ? c.reviewCount : 0,
      website: typeof c.website === "string" ? c.website : null,
      units: Array.isArray(c.units)
        ? (c.units as Record<string, unknown>[]).slice(0, 40).map((u) => ({
            size: String(u?.size ?? ""),
            price: u?.price == null ? null : String(u.price),
            type: u?.type == null ? null : String(u.type),
          }))
        : [],
      promotions: Array.isArray(c.promotions)
        ? (c.promotions as Record<string, unknown>[]).map((p) => String(p?.text ?? "")).filter(Boolean).slice(0, 3)
        : [],
    }));
}

export async function loadFacilityRows(facilityId: string, now: Date): Promise<RawFacility | null> {
  const since90 = new Date(now.getTime() - 90 * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const facility = await db.facilities.findFirst({
    where: { id: facilityId, deleted_at: null },
    select: { id: true, name: true, google_rating: true, review_count: true },
  });
  if (!facility) return null;

  const [
    units,
    specials,
    campaigns,
    ads,
    pages,
    links,
    gbpPosts,
    socialPosts,
    leads,
    tours,
    tenants,
    activeTenants,
    movedIn30,
    reviews,
    intel,
  ] = await Promise.all([
    db.facility_pms_units.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true, unit_type: true, size_label: true, width_ft: true, depth_ft: true, total_count: true,
        occupied_count: true, street_rate: true, web_rate: true, features: true, last_updated: true,
      },
      take: 80,
    }),
    db.facility_pms_specials.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true, name: true, description: true, applies_to: true, discount_type: true, discount_value: true,
        start_date: true, end_date: true, active: true,
      },
      orderBy: { created_at: "desc" },
      take: 40,
    }),
    db.funnels.findMany({
      where: { facility_id: facilityId, archived_at: null },
      select: { id: true, name: true, status: true, archetype: true, daily_budget: true, created_at: true, published_at: true },
      orderBy: { created_at: "desc" },
      take: 40,
    }),
    db.ad_variations.findMany({
      where: { facility_id: facilityId, NOT: { status: "rejected" } },
      select: { id: true, platform: true, angle: true, status: true, created_at: true, funnel_id: true, content_json: true },
      orderBy: { created_at: "desc" },
      take: 120,
    }),
    db.landing_pages.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true, slug: true, title: true, status: true, funnel_id: true, variation_ids: true, created_at: true, published_at: true,
      },
      orderBy: { created_at: "desc" },
      take: 60,
    }),
    db.utm_links.findMany({
      where: { facility_id: facilityId },
      select: {
        id: true, label: true, short_code: true, landing_page_id: true, utm_source: true, utm_medium: true,
        utm_campaign: true, click_count: true, last_clicked_at: true, created_at: true,
      },
      orderBy: { created_at: "desc" },
      take: 150,
    }),
    db.gbp_posts.findMany({
      where: { facility_id: facilityId },
      select: { id: true, title: true, body: true, status: true, offer_code: true, created_at: true, published_at: true, scheduled_at: true },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    db.social_posts.findMany({
      where: { facility_id: facilityId },
      select: { id: true, platform: true, content: true, status: true, created_at: true, published_at: true, scheduled_at: true },
      orderBy: { created_at: "desc" },
      take: 50,
    }),
    db.partial_leads.findMany({
      where: { facility_id: facilityId, deleted_at: null, created_at: { gte: since90 } },
      select: {
        id: true, name: true, email: true, phone: true, unit_size: true, lead_status: true, source_channel: true,
        utm_source: true, landing_page_id: true, funnel_id: true, created_at: true, first_response_at: true,
        matched_tenant_id: true, converted: true,
      },
      orderBy: { created_at: "desc" },
      take: 200,
    }),
    db.facility_tours.findMany({
      where: { facility_id: facilityId, scheduled_at: { gte: since30 } },
      select: { id: true, lead_id: true, contact_name: true, size_label: true, scheduled_at: true, status: true },
      orderBy: { scheduled_at: "asc" },
      take: 60,
    }),
    db.tenants.findMany({
      where: { facility_id: facilityId, deleted_at: null, move_in_date: { gte: since90 } },
      select: { id: true, name: true, unit_number: true, unit_size: true, unit_type: true, monthly_rate: true, move_in_date: true, status: true },
      orderBy: { move_in_date: "desc" },
      take: 150,
    }),
    db.tenants.count({ where: { facility_id: facilityId, deleted_at: null, status: "active" } }),
    db.tenants.count({ where: { facility_id: facilityId, deleted_at: null, move_in_date: { gte: since30 } } }),
    db.gbp_reviews.findMany({
      where: { facility_id: facilityId },
      select: { id: true, author_name: true, rating: true, review_text: true, review_time: true, response_text: true, responded_at: true, response_status: true },
      orderBy: { review_time: "desc" },
      take: 150,
    }),
    db.facility_market_intel.findUnique({ where: { facility_id: facilityId }, select: { competitors: true } }),
  ]);

  // Visits per page in the last 30 days, in one grouped query.
  const pageIds = pages.map((p) => p.id);
  const visits = pageIds.length
    ? await db.touches.groupBy({
        by: ["landing_page_id"],
        where: { facility_id: facilityId, kind: "visit", landing_page_id: { in: pageIds }, occurred_at: { gte: since30 } },
        _count: { _all: true },
      })
    : [];
  const visitsByPage = new Map(visits.map((v) => [v.landing_page_id, v._count._all]));

  return {
    facility: {
      id: facility.id,
      name: facility.name,
      googleRating: num(facility.google_rating),
      reviewCount: facility.review_count ?? null,
    },
    units: units.map((u) => ({
      id: u.id,
      unitType: u.unit_type,
      sizeLabel: u.size_label,
      widthFt: num(u.width_ft),
      depthFt: num(u.depth_ft),
      total: u.total_count,
      occupied: u.occupied_count,
      streetRate: num(u.street_rate),
      webRate: num(u.web_rate),
      features: u.features ?? [],
      lastUpdated: iso(u.last_updated),
    })),
    specials: specials.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      appliesTo: s.applies_to ?? [],
      discountType: s.discount_type,
      discountValue: num(s.discount_value),
      startDate: iso(s.start_date),
      endDate: iso(s.end_date),
      active: s.active,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      archetype: c.archetype,
      dailyBudget: num(c.daily_budget),
      createdAt: c.created_at.toISOString(),
      publishedAt: iso(c.published_at),
    })),
    ads: ads.map((a) => {
      const { headline, text } = copyText(a.content_json);
      return {
        id: a.id,
        platform: a.platform,
        angle: a.angle,
        status: a.status,
        createdAt: a.created_at.toISOString(),
        funnelId: a.funnel_id,
        headline,
        text,
      };
    }),
    pages: pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      funnelId: p.funnel_id,
      variationIds: p.variation_ids ?? [],
      createdAt: p.created_at.toISOString(),
      publishedAt: iso(p.published_at),
      visits30: visitsByPage.get(p.id) ?? 0,
    })),
    links: links.map((l) => ({
      id: l.id,
      label: l.label,
      shortCode: l.short_code,
      landingPageId: l.landing_page_id,
      utmSource: l.utm_source,
      utmMedium: l.utm_medium,
      utmCampaign: l.utm_campaign,
      clickCount: l.click_count ?? 0,
      lastClickedAt: iso(l.last_clicked_at),
      createdAt: l.created_at.toISOString(),
    })),
    posts: [
      ...gbpPosts.map((p) => ({
        id: p.id,
        channel: "google",
        title: p.title,
        body: p.body,
        status: p.status,
        offerCode: p.offer_code,
        createdAt: p.created_at.toISOString(),
        publishedAt: iso(p.published_at),
        scheduledAt: iso(p.scheduled_at),
      })),
      ...socialPosts.map((p) => ({
        id: p.id,
        channel: p.platform,
        title: null,
        body: p.content,
        status: p.status,
        offerCode: null,
        createdAt: p.created_at.toISOString(),
        publishedAt: iso(p.published_at),
        scheduledAt: iso(p.scheduled_at),
      })),
    ],
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      hasContact: !!(l.email || l.phone),
      unitSize: l.unit_size,
      status: l.lead_status,
      sourceChannel: l.source_channel ?? l.utm_source,
      landingPageId: l.landing_page_id,
      funnelId: l.funnel_id,
      createdAt: l.created_at.toISOString(),
      firstResponseAt: iso(l.first_response_at),
      matchedTenantId: l.matched_tenant_id,
      converted: !!l.converted,
    })),
    tours: tours.map((t) => ({
      id: t.id,
      leadId: t.lead_id,
      contactName: t.contact_name,
      sizeLabel: t.size_label,
      scheduledAt: t.scheduled_at.toISOString(),
      status: t.status,
    })),
    tenants: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      unitNumber: t.unit_number,
      unitSize: t.unit_size,
      unitType: t.unit_type,
      monthlyRate: Number(t.monthly_rate),
      moveInDate: t.move_in_date.toISOString(),
      status: t.status,
    })),
    tenantCounts: { active: activeTenants, movedIn30 },
    reviews: reviews.map((r) => ({
      id: r.id,
      author: r.author_name,
      rating: r.rating,
      text: r.review_text,
      reviewTime: iso(r.review_time),
      hasResponse: !!(r.response_text || r.responded_at || r.response_status === "published" || r.response_status === "responded"),
    })),
    competitors: competitorsFrom(intel?.competitors),
  };
}
