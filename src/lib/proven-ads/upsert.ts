import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { classify } from "./classify";
import type { ProvenAdDraft } from "./types";
import type { ParsedInsight } from "./insight";

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
 * the copy fields the source just gave us. first_seen_at, notes, city,
 * state and country stay put so a later API refresh cannot wipe a human's market tag.
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
    offer_type: draft.offer_type ?? classified.offer_type,
    unit_type: draft.unit_type ?? classified.unit_type,
    angle: draft.angle ?? classified.angle,
    started_at: started,
    last_seen_at: lastSeen,
    ended_at: ended,
    active: draft.active,
    raw: json(draft.raw ?? null),
    family_size: Math.max(1, draft.family_size ?? 1),
  };

  const existing = await db.proven_ads.findUnique({
    where: {
      source_source_ad_id: {
        source: draft.source,
        source_ad_id: draft.source_ad_id,
      },
    },
    select: { id: true, insight_at: true },
  });

  if (existing) {
    // Once the insights job has read an ad, its classification beats the
    // regex guess; a re-import refreshes copy and dates but keeps the read.
    const { offer_type, unit_type, angle, format, ...rest } = data;
    const keepRead = existing.insight_at != null;
    await db.proven_ads.update({
      where: { id: existing.id },
      data: {
        ...rest,
        ...(keepRead ? {} : { offer_type, unit_type, angle, format }),
        // A human's market tag and notes win over a later API refresh.
        ...(draft.city ? { city: draft.city } : {}),
        ...(draft.state ? { state: draft.state } : {}),
        ...(draft.country ? { country: draft.country } : {}),
        ...(draft.notes ? { notes: draft.notes } : {}),
        ...(draft.audience ? { audience: draft.audience } : {}),
        ...(draft.advertiser_scale ? { advertiser_scale: draft.advertiser_scale } : {}),
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
      country: draft.country ?? null,
      notes: draft.notes ?? null,
      created_by: draft.created_by ?? null,
      audience: draft.audience ?? null,
      advertiser_scale: draft.advertiser_scale ?? null,
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

/**
 * Write the read on an ad and the facts it corrected. The model's market tag
 * only fills a blank: a city or state a person typed in stays.
 */
export async function applyInsight(id: string, parsed: ParsedInsight, at: Date = new Date()): Promise<void> {
  const row = await db.proven_ads.findUnique({
    where: { id },
    select: { city: true, state: true, country: true },
  });
  if (!row) return;
  await db.proven_ads.update({
    where: { id },
    data: {
      insight: parsed.insight as unknown as Prisma.InputJsonValue,
      insight_at: at,
      offer_type: parsed.facts.offer_type,
      unit_type: parsed.facts.unit_type,
      angle: parsed.facts.angle,
      format: parsed.facts.format,
      audience: parsed.facts.audience,
      advertiser_scale: parsed.facts.advertiser_scale,
      study_value: parsed.insight.study_value,
      ...(!row.city && parsed.facts.city ? { city: parsed.facts.city } : {}),
      ...(!row.state && parsed.facts.state ? { state: parsed.facts.state } : {}),
      ...(!row.country && parsed.facts.country ? { country: parsed.facts.country } : {}),
    },
  });
}
