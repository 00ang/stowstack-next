/**
 * Recurring refresh for automated sources, plus the stale sweep.
 *
 * One job, resumable by search id. A page that cannot finish inside the
 * worker's budget returns `more` with the cursor it reached.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { JobHandler } from "@/lib/jobs/types";
import { getAdapter } from "./adapters";
import type { AdapterSearch } from "./adapters/types";
import { shouldMarkInactive } from "./days-running";
import { upsertMany } from "./upsert";
import { scheduleInsights } from "./insights-job";

export const DEFAULT_SEARCHES: { adapter: string; label: string; config: Record<string, unknown> }[] = [
  {
    adapter: "meta_ad_library_api",
    label: "Self storage · United Kingdom",
    config: { searchTerms: "self storage", countries: ["GB"] },
  },
  {
    adapter: "meta_ad_library_api",
    label: "Self storage · Ireland",
    config: { searchTerms: "self storage", countries: ["IE"] },
  },
  {
    adapter: "meta_ad_library_api",
    label: "Self storage · Germany",
    config: { searchTerms: "self storage", countries: ["DE"] },
  },
  {
    adapter: "meta_ad_library_api",
    label: "Self storage · Netherlands",
    config: { searchTerms: "self storage", countries: ["NL"] },
  },
];

export async function seedDefaultSearches(): Promise<number> {
  const existing = await db.proven_ad_searches.count();
  if (existing > 0) return 0;
  await db.proven_ad_searches.createMany({
    data: DEFAULT_SEARCHES.map((s) => ({
      adapter: s.adapter,
      label: s.label,
      config: s.config as Prisma.InputJsonValue,
      enabled: true,
    })),
  });
  return DEFAULT_SEARCHES.length;
}

export async function sweepStale(now: Date = new Date()): Promise<number> {
  const live = await db.proven_ads.findMany({
    where: { active: true },
    select: { id: true, source: true, last_seen_at: true, active: true },
  });
  const stale = live.filter((row) => shouldMarkInactive(row, now));
  if (!stale.length) return 0;
  await db.proven_ads.updateMany({
    where: { id: { in: stale.map((r) => r.id) } },
    data: { active: false, ended_at: now },
  });
  return stale.length;
}

interface RefreshCursor {
  afterSearchId?: string;
  searchId?: string;
  pageCursor?: string | null;
  fetched?: number;
  upserted?: number;
  swept?: boolean;
}

/**
 * Run one configured search to completion (or until the worker yields).
 */
export async function runSearch(
  search: { id: string; adapter: string; label: string; config: unknown },
  pageCursor: string | null,
  shouldYield: () => boolean
): Promise<{ pageCursor: string | null; fetched: number; upserted: number; note?: string; done: boolean }> {
  const adapter = getAdapter(search.adapter);
  if (!adapter || !adapter.automated) {
    return { pageCursor: null, fetched: 0, upserted: 0, note: "adapter is not automated", done: true };
  }

  const spec: AdapterSearch = {
    adapter: search.adapter,
    label: search.label,
    config: (search.config ?? {}) as Record<string, unknown>,
  };

  let cursor = pageCursor;
  let fetched = 0;
  let upserted = 0;
  let note: string | undefined;

  for (;;) {
    const page = await adapter.fetchPage(spec, cursor);
    fetched += page.ads.length;
    if (page.ads.length) {
      const r = await upsertMany(page.ads);
      upserted += r.created + r.updated;
    }
    note = page.note;
    cursor = page.nextCursor;
    if (!cursor) break;
    if (shouldYield()) {
      return { pageCursor: cursor, fetched, upserted, note, done: false };
    }
  }

  await db.proven_ad_searches.update({
    where: { id: search.id },
    data: {
      last_run_at: new Date(),
      last_result: { fetched, upserted, note: note ?? null } as Prisma.InputJsonValue,
    },
  });

  return { pageCursor: null, fetched, upserted, note, done: true };
}

export const refreshProvenAds: JobHandler = async (ctx) => {
  await seedDefaultSearches();

  const cursor = (ctx.cursor ?? {}) as RefreshCursor;
  let after = cursor.afterSearchId;
  let fetched = Number(cursor.fetched ?? 0);
  let upserted = Number(cursor.upserted ?? 0);

  if (cursor.searchId && !cursor.swept) {
    const mid = await db.proven_ad_searches.findUnique({ where: { id: cursor.searchId } });
    if (mid) {
      const r = await runSearch(mid, cursor.pageCursor ?? null, ctx.shouldYield);
      fetched += r.fetched;
      upserted += r.upserted;
      if (!r.done) {
        return {
          kind: "more",
          cursor: { searchId: mid.id, pageCursor: r.pageCursor, afterSearchId: after, fetched, upserted },
          progressDone: upserted,
        };
      }
      after = mid.id;
    }
  }

  for (;;) {
    const next = await db.proven_ad_searches.findFirst({
      where: {
        enabled: true,
        ...(after ? { id: { gt: after } } : {}),
      },
      orderBy: { id: "asc" },
    });
    if (!next) break;

    const r = await runSearch(next, null, ctx.shouldYield);
    fetched += r.fetched;
    upserted += r.upserted;
    if (!r.done) {
      return {
        kind: "more",
        cursor: { searchId: next.id, pageCursor: r.pageCursor, afterSearchId: after, fetched, upserted },
        progressDone: upserted,
      };
    }
    after = next.id;
    if (ctx.shouldYield()) {
      return { kind: "more", cursor: { afterSearchId: after, fetched, upserted }, progressDone: upserted };
    }
  }

  const swept = await sweepStale();
  if (upserted > 0) await scheduleInsights("refresh");
  return { kind: "done", progressDone: upserted + swept };
};
