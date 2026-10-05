/**
 * Source adapter contract.
 *
 * A source is anything that can produce ProvenAdDrafts without breaking a
 * platform's terms. Official APIs first; a person pasting from a public
 * transparency page when the API cannot see the ad; never a scraper pointed
 * at a ToS-gated surface.
 *
 * Adding Google (or a future licensed third-party) is a new file that
 * implements this, plus a line in the registry. The job, the schema and the
 * UI do not change.
 */

import type { ProvenAdDraft, ProvenSource } from "../types";

export interface AdapterSearch {
  /** Adapter id this search is for. */
  adapter: ProvenSource | string;
  /** Human label, shown in admin. */
  label: string;
  /** Adapter-specific. Meta: { searchTerms, countries, pageIds }. */
  config: Record<string, unknown>;
}

export interface FetchPage {
  ads: ProvenAdDraft[];
  /** Opaque cursor for the next page. Null when the source is done. */
  nextCursor: string | null;
  /** Why this page is empty or short, if the source said so. */
  note?: string;
}

export interface SourceAdapter {
  id: ProvenSource | string;
  /** One-line honesty about coverage. Shown in the UI and the PR. */
  coverage: string;
  /** False when the adapter cannot run without a person (manual / CSV). */
  automated: boolean;
  configured(): boolean;
  /**
   * Fetch one page of ads for a configured search. Must be safe to call
   * twice with the same cursor — upsert is idempotent on (source, source_ad_id).
   */
  fetchPage(search: AdapterSearch, cursor: string | null): Promise<FetchPage>;
}
