import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { classify } from "./classify";
import type { ProvenAdDraft } from "./types";

export interface UpsertResult {
  id: string;
  created: boolean;
}

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Insert or refresh one observed ad. Unique on (source, source_ad_id).
 *
 * On a hit we advance last_seen_at (or honour an explicit end) and refresh
 * the copy fields the source just gave us. first_seen_at, notes, city and
 * state stay put so a later API refresh cannot wipe a human's market tag.
 */
export async function upsertProvenAd(draft: ProvenAdDraft): Promise<UpsertResult> {
  const classified = classify(draft);
  const started = asDate(draft.started_at);
  if (!started) throw new Error("started_at is required");

  const lastSeen = asDate(draft.last_seen_at) ?? new Date();
  const ended = asDate(draft.ended_at);
  const data = {
    platform: draft.platform,
    publisher_platforms: draft.publisher_platforms ?? [],
    advertiser_name: draft.advertiser_name,
    advertiser_page_id: draft.advertiser_page_id ?? null,
    advertiser_url: draft.advertiser_url ?? null,
    format: draft.format ?? classified.format,
    headline: draft.headline ?? null,
    primary_text: draft.primary_text ?? null,
    description: draft.description ?? null,
    cta: draft.cta ?? null,
    landing_url: draft.landing_url ?? null,
    snapshot_url: draft.snapshot_url ?? null,
    media_refs: json(draft.media_refs ?? null),
    country: draft.country ?? null,
    offer_type: draft.offer_type ?? classified.offer_type,
    unit_type: draft.unit_type ?? classified.unit_type,
    angle: draft.angle ?? classified.angle,
    started_at: started,
    last_seen_at: lastSeen,
    ended_at: ended,
    active: draft.active,
    raw: json(draft.raw ?? null),
  };

  const existing = await db.proven_ads.findUnique({
    where: {
      source_source_ad_id: {
        source: draft.source,
        source_ad_id: draft.source_ad_id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await db.proven_ads.update({
      where: { id: existing.id },
      data: {
        ...data,
        // A human's market tag and notes win over a later API refresh.
        ...(draft.city ? { city: draft.city } : {}),
        ...(draft.state ? { state: draft.state } : {}),
        ...(draft.notes ? { notes: draft.notes } : {}),
      },
    });
    return { id: existing.id, created: false };
  }

  const created = await db.proven_ads.create({
    data: {
      source: draft.source,
      source_ad_id: draft.source_ad_id,
      city: draft.city ?? null,
      state: draft.state ?? null,
      notes: draft.notes ?? null,
      created_by: draft.created_by ?? null,
      first_seen_at: lastSeen,
      ...data,
    },
  });
  return { id: created.id, created: true };
}

export async function upsertMany(drafts: ProvenAdDraft[]): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const d of drafts) {
    const r = await upsertProvenAd(d);
    if (r.created) created++;
    else updated++;
  }
  return { created, updated };
}
