import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse, isAdminRequest, requireFacilityAccess } from "@/lib/api-helpers";
import { getSession } from "@/lib/session-auth";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { publicView, sectionsNeedLiveUnits, shouldFreezePrevious } from "@/lib/page-blocks";
import { freezeCurrent, loadLiveUnits, publishPage } from "@/lib/page-blocks/persist";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "landing-pages");
  if (limited) return limited;
  const origin = getOrigin(req);
  const url = new URL(req.url);

  // Public access by slug (for rendering landing pages)
  const slug = url.searchParams.get("slug");
  if (slug) {
    const preview = url.searchParams.get("preview") === "1" && isAdminRequest(req);
    const page = await db.landing_pages.findFirst({
      where: preview ? { slug } : { slug, status: "published" },
    });
    if (!page) return errorResponse("Page not found", 404, origin);

    const sections = await db.landing_page_sections.findMany({
      where: { landing_page_id: page.id },
      orderBy: { sort_order: "asc" },
    });

    // Admin preview shows the draft. Everyone else gets the published
    // snapshot, so an edit in progress doesn't change the live page.
    if (!preview) {
      const theme = page.theme && typeof page.theme === "object" && !Array.isArray(page.theme) ? (page.theme as { editor?: string }) : {};
      const view = publicView({
        status: page.status,
        title: page.title,
        metaTitle: page.meta_title,
        metaDescription: page.meta_description,
        storedgeWidgetUrl: page.storedge_widget_url,
        themeEditor: theme.editor === "blocks" ? "blocks" : "legacy",
        sections,
        snapshot: page.published_snapshot,
      });
      if (!view) return errorResponse("Page not found", 404, origin);
      const served = view.sections.map((s, i) => ({ id: `live-${i}`, ...s }));
      const liveUnits = sectionsNeedLiveUnits(served) ? await loadLiveUnits(page.facility_id).catch(() => []) : [];
      const nextTheme = {
        ...(page.theme && typeof page.theme === "object" && !Array.isArray(page.theme) ? page.theme : {}),
        ...(view.editor === "blocks" ? { editor: "blocks" } : {}),
      };
      return jsonResponse(
        {
          page: {
            ...page,
            title: view.title,
            meta_title: view.metaTitle,
            meta_description: view.metaDescription,
            storedge_widget_url: view.storedgeWidgetUrl ?? page.storedge_widget_url,
            theme: nextTheme,
            sections: served,
            liveUnits,
          },
        },
        200,
        origin,
      );
    }

    return jsonResponse({ page: { ...page, sections } }, 200, origin);
  }

  // Admin, partner session, or the facility's own portal (manage cookie).
  const isAdmin = isAdminRequest(req);
  const session = !isAdmin ? await getSession(req) : null;
  if (!isAdmin && !session) {
    const askedFacility = url.searchParams.get("facility_id") || url.searchParams.get("facilityId");
    const askedId = url.searchParams.get("id");
    let owns: string | null = askedFacility;
    if (!owns && askedId) {
      const row = await db.landing_pages.findUnique({ where: { id: askedId }, select: { facility_id: true } });
      owns = row?.facility_id ?? null;
    }
    const denied = await requireFacilityAccess(req, owns);
    if (denied) return denied;
  }

  const facilityId = url.searchParams.get("facility_id") || url.searchParams.get("facilityId");
  const id = url.searchParams.get("id");

  if (id) {
    const page = await db.landing_pages.findFirst({
      where: {
        id,
        ...(session ? { facilities: { organization_id: session.organization.id } } : {}),
      },
      include: { landing_page_sections: { orderBy: { sort_order: "asc" } } },
    });
    if (!page) return errorResponse("Not found", 404, origin);

    const { landing_page_sections: sections, ...pageData } = page;
    return jsonResponse({ page: { ...pageData, sections } }, 200, origin);
  }

  const where: Record<string, unknown> = {};
  if (facilityId) where.facility_id = facilityId;
  if (session && !isAdmin) {
    // Scope to org's facilities
    const orgFacilities = await db.facilities.findMany({
      where: { organization_id: session.organization.id },
      select: { id: true },
    });
    where.facility_id = { in: orgFacilities.map((f) => f.id) };
  }

  const pages = await db.landing_pages.findMany({
    where,
    orderBy: { created_at: "desc" },
  });

  return jsonResponse({ pages }, 200, origin);
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "landing-pages");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      facilityId,
      name,
      title,
      slug,
      status,
      metaTitle,
      metaDescription,
      theme,
      storedgeWidgetUrl,
      ogImageUrl,
      variationIds,
      sections,
      cloneFrom,
      funnelId,
    } = body;
    const pageTitle: string | undefined = title || name;

    // For clone-only requests, generate title/slug automatically
    if (cloneFrom && (!pageTitle || !slug)) {
      const sourceP = await db.landing_pages.findUnique({ where: { id: cloneFrom } });
      if (!sourceP) return errorResponse("Source page not found", 404, origin);
      const cloneTitle = pageTitle || `${sourceP.title} (Copy)`;
      const cloneSlug = slug || `${sourceP.slug}-copy-${Date.now().toString(36)}`;
      const cloneFacility = facilityId || sourceP.facility_id;

      // Owner must own the destination facility, and the source facility too
      // when copying across facilities (don't let one facility lift another's
      // page content).
      const denied = await requireFacilityAccess(req, cloneFacility);
      if (denied) return denied;
      if (sourceP.facility_id !== cloneFacility) {
        const srcDenied = await requireFacilityAccess(req, sourceP.facility_id);
        if (srcDenied) return srcDenied;
      }

      const existing = await db.landing_pages.findFirst({ where: { slug: cloneSlug } });
      if (existing) return errorResponse("Slug already exists", 400, origin);

      const clonedPage = await db.$transaction(async (tx) => {
        const newPage = await tx.landing_pages.create({
          data: { facility_id: cloneFacility, title: cloneTitle, slug: cloneSlug, status: "draft" },
        });

        const sourceSections = await tx.landing_page_sections.findMany({
          where: { landing_page_id: cloneFrom },
          orderBy: { sort_order: "asc" },
        });
        for (const section of sourceSections) {
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: newPage.id,
              section_type: section.section_type,
              sort_order: section.sort_order,
              config: section.config as object,
            },
          });
        }

        return newPage;
      });

      return jsonResponse({ page: clonedPage }, 200, origin);
    }

    if (!facilityId || !pageTitle || !slug) {
      return errorResponse("Missing required fields: facilityId, title, slug", 400, origin);
    }

    // Owner must own the destination facility; when cloning across facilities,
    // the source facility too.
    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;
    if (cloneFrom) {
      const sourceP = await db.landing_pages.findUnique({
        where: { id: cloneFrom },
        select: { facility_id: true },
      });
      if (sourceP && sourceP.facility_id !== facilityId) {
        const srcDenied = await requireFacilityAccess(req, sourceP.facility_id);
        if (srcDenied) return srcDenied;
      }
    }

    const existing = await db.landing_pages.findFirst({ where: { slug } });
    if (existing) return errorResponse("Slug already exists", 400, origin);

    const nowPublished = status === "published";

    const page = await db.$transaction(async (tx) => {
      const newPage = await tx.landing_pages.create({
        data: {
          facility_id: facilityId,
          title: pageTitle,
          slug,
          status: status || "draft",
          meta_title: metaTitle ?? null,
          meta_description: metaDescription ?? null,
          theme: theme ?? {},
          storedge_widget_url: storedgeWidgetUrl ?? null,
          og_image_url: ogImageUrl ?? null,
          variation_ids: Array.isArray(variationIds) ? variationIds : [],
          published_at: nowPublished ? new Date() : null,
          ...(funnelId ? { funnel_id: funnelId } : {}),
        },
      });

      if (cloneFrom) {
        const sourceSections = await tx.landing_page_sections.findMany({
          where: { landing_page_id: cloneFrom },
          orderBy: { sort_order: "asc" },
        });
        for (const section of sourceSections) {
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: newPage.id,
              section_type: section.section_type,
              sort_order: section.sort_order,
              config: section.config as object,
            },
          });
        }
      } else if (Array.isArray(sections)) {
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: newPage.id,
              section_type: s.sectionType || s.section_type,
              sort_order: s.sortOrder ?? s.sort_order ?? i,
              config: s.config ?? {},
            },
          });
        }
      }

      const createdSections = await tx.landing_page_sections.findMany({
        where: { landing_page_id: newPage.id },
        orderBy: { sort_order: "asc" },
      });

      return { ...newPage, sections: createdSections };
    });

    return jsonResponse({ page }, 200, origin);
  } catch (err) {
    console.error("Landing page create error:", err);
    return errorResponse("Failed to create page", 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "landing-pages");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const url = new URL(req.url);
    const body = await req.json();
    const id = body.id || url.searchParams.get("id");
    if (!id) return errorResponse("Missing page ID", 400, origin);

    const { ...updates } = body;
    delete updates.id;
    delete updates.facilityId;
    delete updates.facility_id;

    const page = await db.landing_pages.findUnique({ where: { id } });
    if (!page) return errorResponse("Page not found", 404, origin);

    // Scope the edit to the page's facility: admins pass, owners need a manage
    // session for it.
    const denied = await requireFacilityAccess(req, page.facility_id);
    if (denied) return denied;

    const sections = updates.sections;
    delete updates.sections;
    const publishing = updates.status === "published";
    // First edit of a live page that predates snapshots: freeze what is
    // live now, then write the draft. An explicit publish skips this and
    // snapshots the new sections below.
    if (sections && shouldFreezePrevious({ status: page.status, hasSnapshot: page.published_snapshot != null, publishing })) {
      await freezeCurrent(id);
    }

    const fieldMap: Record<string, string> = {
      metaTitle: "meta_title",
      metaDescription: "meta_description",
      storedgeWidgetUrl: "storedge_widget_url",
      ogImageUrl: "og_image_url",
      ogImage: "og_image_url",
      variationIds: "variation_ids",
    };
    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (updates[camel] !== undefined && updates[snake] === undefined) {
        updates[snake] = updates[camel];
      }
      delete updates[camel];
    }

    const allowedFields = [
      "title",
      "slug",
      "status",
      "meta_title",
      "meta_description",
      "og_image_url",
      "theme",
      "storedge_widget_url",
      "variation_ids",
    ];
    const pageUpdates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) pageUpdates[key] = updates[key];
    }

    if (
      pageUpdates.status === "published" &&
      page.status !== "published" &&
      !page.published_at
    ) {
      pageUpdates.published_at = new Date();
    }

    const { updated, updatedSections } = await db.$transaction(async (tx) => {
      if (sections) {
        await tx.landing_page_sections.deleteMany({
          where: { landing_page_id: id },
        });

        for (const section of sections) {
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: id,
              section_type: section.section_type || section.sectionType,
              sort_order: section.sort_order ?? section.sortOrder ?? 0,
              config: section.config,
            },
          });
        }
      }

      if (Object.keys(pageUpdates).length > 0) {
        await tx.landing_pages.update({ where: { id }, data: pageUpdates });
      }

      // Fetch updated page
      const updated = await tx.landing_pages.findUnique({ where: { id } });
      const updatedSections = await tx.landing_page_sections.findMany({
        where: { landing_page_id: id },
        orderBy: { sort_order: "asc" },
      });

      return { updated, updatedSections };
    });

    if (publishing) {
      const live = await publishPage(id);
      const fresh = await db.landing_pages.findUnique({ where: { id } });
      return jsonResponse({ page: { ...fresh, sections: updatedSections }, published: live }, 200, origin);
    }

    return jsonResponse({ page: { ...updated, sections: updatedSections } }, 200, origin);
  } catch (err) {
    console.error("Landing page update error:", err);
    return errorResponse("Failed to update page", 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "landing-pages");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("Missing page ID", 400, origin);

    // Scope the delete to the page's facility: admins pass, owners need a manage
    // session for it.
    const page = await db.landing_pages.findUnique({
      where: { id },
      select: { facility_id: true },
    });
    if (!page) return errorResponse("Page not found", 404, origin);
    const denied = await requireFacilityAccess(req, page.facility_id);
    if (denied) return denied;

    await db.$transaction(async (tx) => {
      await tx.landing_page_sections.deleteMany({ where: { landing_page_id: id } });
      await tx.landing_pages.delete({ where: { id } });
    });

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    console.error("Landing page delete error:", err);
    return errorResponse("Failed to delete page", 500, origin);
  }
}
