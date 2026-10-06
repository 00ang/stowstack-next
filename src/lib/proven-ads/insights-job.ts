/**
 * proven-ads.insights — write the read for every library row that lacks one.
 *
 * Enqueued by whatever adds rows (an import, a manual add, the refresh job),
 * never polled. Works oldest-first, one ad per model call, and yields with
 * `more` when the worker's budget runs short; the next pass picks up the next
 * row without a read, so the cursor is the table itself.
 */

import { db } from "@/lib/db";
import { enqueue } from "@/lib/jobs/queue";
import type { JobHandler } from "@/lib/jobs/types";
import { previewUrlsFromRaw } from "./adapters/meta-ad-library-web";
import { daysRunning } from "./days-running";
import { generateInsight, type InsightSubject } from "./insight";
import { applyInsight } from "./upsert";

export const INSIGHTS_QUEUE = "proven-ads.insights";

/** Queue a pass. Deduped per hour so a burst of imports wakes the worker once. */
export async function scheduleInsights(reason: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  return enqueue({
    queue: INSIGHTS_QUEUE,
    dedupeKey: `insights:${hour}`,
    payload: { reason },
    maxAttempts: 3,
  });
}

type Row = NonNullable<Awaited<ReturnType<typeof nextRow>>>;

async function nextRow(skip: string[]) {
  return db.proven_ads.findFirst({
    where: { insight_at: null, ...(skip.length ? { id: { notIn: skip } } : {}) },
    orderBy: { started_at: "asc" },
  });
}

export function subjectFromRow(row: Row, now: Date = new Date()): InsightSubject {
  const library = (row.raw as { library?: { page_categories?: string[] } } | null)?.library;
  return {
    advertiser_name: row.advertiser_name,
    page_categories: library?.page_categories ?? [],
    started_at: row.started_at,
    days_running: daysRunning(row, now),
    family_size: row.family_size,
    format: row.format,
    publisher_platforms: row.publisher_platforms,
    headline: row.headline,
    primary_text: row.primary_text,
    description: row.description,
    cta: row.cta,
    landing_url: row.landing_url,
  };
}

export const writeProvenAdInsights: JobHandler = async (ctx) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { kind: "done" };

  const cursor = (ctx.cursor ?? {}) as { failed?: string[] };
  const failed = cursor.failed ?? [];
  let written = 0;

  for (;;) {
    const row = await nextRow(failed);
    if (!row) return { kind: "done", progressDone: written };

    let parsed = null;
    try {
      parsed = await generateInsight(subjectFromRow(row), previewUrlsFromRaw(row.raw), apiKey);
    } catch {
      // A model or network error is worth one more try on the next pass;
      // skip it for the rest of this one so one bad row can't stall the queue.
      failed.push(row.id);
    }

    if (parsed) {
      await applyInsight(row.id, parsed);
      written++;
    } else if (!failed.includes(row.id)) {
      // The model answered but the read was unusable (a refusal, or no
      // reasoning). Mark it read-without-prose so it isn't retried forever.
      await db.proven_ads.update({ where: { id: row.id }, data: { insight_at: new Date() } });
    }

    if (ctx.shouldYield()) {
      return { kind: "more", cursor: { failed: failed.slice(-200) }, progressDone: written };
    }
  }
};
