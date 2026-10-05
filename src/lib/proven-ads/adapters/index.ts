import type { SourceAdapter } from "./types";
import { csvAdapter, manualAdapter } from "./manual";
import { metaAdLibraryAdapter } from "./meta-ad-library";
import { metaAdLibraryWebAdapter } from "./meta-ad-library-web";

export { metaAdLibraryAdapter } from "./meta-ad-library";
export { metaAdLibraryWebAdapter } from "./meta-ad-library-web";
export { manualAdapter, csvAdapter } from "./manual";
export type { SourceAdapter, AdapterSearch, FetchPage } from "./types";

export const ADAPTERS: Record<string, SourceAdapter> = {
  [metaAdLibraryAdapter.id]: metaAdLibraryAdapter,
  [metaAdLibraryWebAdapter.id]: metaAdLibraryWebAdapter,
  [manualAdapter.id]: manualAdapter,
  [csvAdapter.id]: csvAdapter,
};

export function getAdapter(id: string): SourceAdapter | null {
  return ADAPTERS[id] ?? null;
}

export function adapterCoverage(): { id: string; coverage: string; automated: boolean; configured: boolean }[] {
  return Object.values(ADAPTERS).map((a) => ({
    id: a.id,
    coverage: a.coverage,
    automated: a.automated,
    configured: a.configured(),
  }));
}
