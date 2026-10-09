import { blocksToSections } from "./blocks";
import type { Block, PageSnapshot, SectionRow, SnapshotSection } from "./types";

export interface DraftBody {
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  storedgeWidgetUrl: string | null;
  /** "blocks" when the campaign editor owns the page. */
  editor: "blocks" | "legacy";
  blocks: Block[];
}

function stable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortValue(v)]),
    );
  }
  return value;
}

export function snapshotOf(draft: DraftBody): PageSnapshot {
  return {
    editor: draft.editor,
    title: draft.title,
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    storedgeWidgetUrl: draft.storedgeWidgetUrl,
    sections: blocksToSections(draft.blocks).map((s) => ({
      section_type: s.section_type,
      sort_order: s.sort_order,
      config: s.config,
    })),
  };
}

export function sameSnapshot(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b);
}

export function readSnapshot(value: unknown): PageSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<PageSnapshot>;
  if (row.editor !== "blocks" && row.editor !== "legacy") return null;
  if (typeof row.title !== "string" || !Array.isArray(row.sections)) return null;
  return {
    editor: row.editor,
    title: row.title,
    metaTitle: typeof row.metaTitle === "string" ? row.metaTitle : null,
    metaDescription: typeof row.metaDescription === "string" ? row.metaDescription : null,
    storedgeWidgetUrl: typeof row.storedgeWidgetUrl === "string" ? row.storedgeWidgetUrl : null,
    sections: row.sections as SnapshotSection[],
  };
}

export interface PublicView {
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  storedgeWidgetUrl: string | null;
  editor: "blocks" | "legacy";
  sections: SnapshotSection[];
  /** True when visitors are seeing a published snapshot, so a newer draft is hidden. */
  fromSnapshot: boolean;
}

/**
 * What a visitor gets. A published snapshot wins. A page published before
 * versioning has no snapshot and keeps serving its sections.
 * A draft with no snapshot is not public.
 */
export function publicView(input: {
  status: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  storedgeWidgetUrl: string | null;
  themeEditor: "blocks" | "legacy";
  sections: SectionRow[];
  snapshot: unknown;
}): PublicView | null {
  if (input.status !== "published") return null;
  const snap = readSnapshot(input.snapshot);
  if (snap) {
    return {
      title: snap.title,
      metaTitle: snap.metaTitle,
      metaDescription: snap.metaDescription,
      storedgeWidgetUrl: snap.storedgeWidgetUrl,
      editor: snap.editor,
      sections: snap.sections,
      fromSnapshot: true,
    };
  }
  return {
    title: input.title,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    storedgeWidgetUrl: input.storedgeWidgetUrl,
    editor: input.themeEditor,
    sections: input.sections.map((s) => ({
      section_type: s.section_type,
      sort_order: s.sort_order,
      config: (s.config && typeof s.config === "object" && !Array.isArray(s.config) ? s.config : {}) as Record<string, unknown>,
    })),
    fromSnapshot: false,
  };
}

/**
 * Saving sections on a live page that has never been snapshotted must
 * freeze the current sections first. An explicit publish writes the new
 * draft into the snapshot instead.
 */
export function shouldFreezePrevious(input: { status: string; hasSnapshot: boolean; publishing: boolean }): boolean {
  return input.status === "published" && !input.hasSnapshot && !input.publishing;
}

export function nextVersion(input: { lastVersion: number; previous: unknown; next: PageSnapshot }): { version: number; write: boolean } {
  if (input.previous && sameSnapshot(input.previous, input.next)) {
    return { version: input.lastVersion, write: false };
  }
  return { version: input.lastVersion + 1, write: true };
}

export function sectionsNeedLiveUnits(sections: { section_type: string; config: unknown }[]): boolean {
  return sections.some((s) => {
    if (s.section_type !== "unit_types") return false;
    const config = s.config && typeof s.config === "object" ? (s.config as { live?: unknown }) : {};
    return config.live === true;
  });
}
