import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sectionsToBlocks } from "./blocks";
import { nextVersion, readSnapshot, snapshotOf, type DraftBody } from "./publish";
import type { LiveUnit, PageSnapshot, SectionRow } from "./types";

/**
 * Read and publish a landing page. Draft rows stay in
 * landing_page_sections. publishPage copies them into published_snapshot
 * and a landing_page_versions row, which is what the public URL serves.
 */

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function loadLiveUnits(facilityId: string): Promise<LiveUnit[]> {
  const rows = await db.facility_pms_units.findMany({
    where: { facility_id: facilityId },
    orderBy: { unit_type: "asc" },
  });
  return rows.map((u) => {
    const total = u.total_count ?? 0;
    const occupied = u.occupied_count ?? 0;
    const vacant = u.vacant_count ?? Math.max(0, total - occupied);
    const features = u.features ?? [];
    const climate = features.some((f) => /climate/i.test(f)) || /climate/i.test(u.unit_type);
    return {
      key: u.unit_type,
      name: u.unit_type,
      size: u.size_label || u.unit_type,
      rate: num(u.web_rate) ?? num(u.street_rate),
      vacant,
      total,
      features,
      climate,
    };
  });
}

export async function loadDraft(pageId: string, facilityId?: string) {
  const page = await db.landing_pages.findFirst({
    where: { id: pageId, ...(facilityId ? { facility_id: facilityId } : {}) },
    include: { landing_page_sections: { orderBy: { sort_order: "asc" } } },
  });
  if (!page) return null;
  const sections: SectionRow[] = page.landing_page_sections.map((s) => ({
    id: s.id,
    section_type: s.section_type,
    sort_order: s.sort_order,
    config: s.config,
  }));
  return { page, blocks: sectionsToBlocks(sections), sections };
}

function themeEditor(theme: unknown): "blocks" | "legacy" {
  if (theme && typeof theme === "object" && (theme as { editor?: string }).editor === "blocks") return "blocks";
  return "legacy";
}

/** Copy the current sections into the live snapshot. Safe to call again. */
export async function publishPage(pageId: string): Promise<{ slug: string; version: number; title: string }> {
  const loaded = await loadDraft(pageId);
  if (!loaded) throw new Error("Page not found");
  const { page, blocks } = loaded;
  const editor = themeEditor(page.theme);
  const draft: DraftBody = {
    title: page.title,
    metaTitle: page.meta_title,
    metaDescription: page.meta_description,
    storedgeWidgetUrl: page.storedge_widget_url,
    editor: editor === "blocks" || blocks.some((b) => b.type === "ask" || b.type === "reserve" || b.type === "offer") ? "blocks" : "legacy",
    blocks,
  };
  const snapshot = snapshotOf(draft);
  const last = await db.landing_page_versions.findFirst({
    where: { landing_page_id: pageId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const step = nextVersion({
    lastVersion: last?.version ?? 0,
    previous: readSnapshot(page.published_snapshot) ?? page.published_snapshot,
    next: snapshot,
  });
  if (step.write) {
    await db.landing_page_versions.create({
      data: {
        landing_page_id: pageId,
        version: step.version,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
  }
  const theme = page.theme && typeof page.theme === "object" && !Array.isArray(page.theme) ? (page.theme as Record<string, unknown>) : {};
  await db.landing_pages.update({
    where: { id: pageId },
    data: {
      status: "published",
      published_at: new Date(),
      published_snapshot: snapshot as unknown as Prisma.InputJsonValue,
      ...(draft.editor === "blocks" ? { theme: { ...theme, editor: "blocks" } as Prisma.InputJsonValue } : {}),
    },
  });
  return { slug: page.slug, version: step.version, title: page.title };
}

/** Freeze whatever is currently stored, before a draft overwrite. */
export async function freezeCurrent(pageId: string): Promise<PageSnapshot | null> {
  const loaded = await loadDraft(pageId);
  if (!loaded) return null;
  const { page, blocks } = loaded;
  if (page.published_snapshot) return readSnapshot(page.published_snapshot);
  const snapshot = snapshotOf({
    title: page.title,
    metaTitle: page.meta_title,
    metaDescription: page.meta_description,
    storedgeWidgetUrl: page.storedge_widget_url,
    editor: themeEditor(page.theme),
    blocks,
  });
  const last = await db.landing_page_versions.findFirst({
    where: { landing_page_id: pageId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  await db.landing_page_versions.create({
    data: {
      landing_page_id: pageId,
      version,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  await db.landing_pages.update({
    where: { id: pageId },
    data: { published_snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });
  return snapshot;
}
