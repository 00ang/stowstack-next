import { NextRequest } from "next/server";
import {
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { parseCsv } from "@/lib/proven-ads/adapters/manual";
import {
  groupFamilies,
  mapObservation,
  type LibraryObservation,
} from "@/lib/proven-ads/adapters/meta-ad-library-web";
import { isProven } from "@/lib/proven-ads/days-running";
import { scheduleInsights } from "@/lib/proven-ads/insights-job";
import type { ProvenAdDraft } from "@/lib/proven-ads/types";
import { upsertMany } from "@/lib/proven-ads/upsert";

export const maxDuration = 60;

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * An Ad Library export: what the public Ad Library page showed, one
 * observation per ad. Near-identical ads from one advertiser collapse into a
 * family (the longest-running one is kept); only ads that have already run
 * 60 days are imported unless `include_unproven` is set.
 */
function draftsFromObservations(body: {
  observations?: unknown;
  observed_at?: unknown;
  include_unproven?: unknown;
}): { drafts: ProvenAdDraft[]; observed: number; families: number; skipped: number } {
  const list = Array.isArray(body.observations) ? (body.observations as LibraryObservation[]) : [];
  const observedAt =
    typeof body.observed_at === "string" && Number.isFinite(Date.parse(body.observed_at))
      ? new Date(body.observed_at)
      : new Date();
  const families = groupFamilies(list.filter((o) => o && typeof o.id === "string" && Number.isFinite(o.start)));
  const drafts: ProvenAdDraft[] = [];
  let skipped = 0;
  for (const f of families) {
    const draft = mapObservation(f.representative, observedAt, { size: f.size, members: f.members });
    if (!draft) {
      skipped++;
      continue;
    }
    const window = { ...draft, last_seen_at: draft.last_seen_at ?? observedAt.toISOString() };
    if (body.include_unproven !== true && !isProven(window, observedAt)) {
      skipped++;
      continue;
    }
    drafts.push(draft);
  }
  return { drafts, observed: list.length, families: families.length, skipped };
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-import");
  if (limited) return limited;

  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const contentType = req.headers.get("content-type") || "";
  let csv = "";
  let observationBody: Parameters<typeof draftsFromObservations>[0] | null = null;
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: string; observations?: unknown };
      if (Array.isArray(body.observations)) observationBody = body;
      else csv = body.csv || "";
    } else {
      const form = await req.formData();
      const file = form.get("file");
      if (file && typeof file === "object" && "text" in file) {
        csv = await (file as File).text();
      } else {
        csv = String(form.get("csv") || "");
      }
    }
  } catch {
    return errorResponse("Could not read the import", 400, origin);
  }

  try {
    if (observationBody) {
      const { drafts, observed, families, skipped } = draftsFromObservations(observationBody);
      if (!drafts.length) return errorResponse("No proven ads in that export", 400, origin);
      const result = await upsertMany(drafts);
      if (result.created) await scheduleInsights("import").catch(() => null);
      return jsonResponse({ ...result, observed, families, skipped, rows: drafts.length }, 200, origin);
    }

    if (!csv.trim()) return errorResponse("csv or observations is required", 400, origin);
    const { drafts, errors } = parseCsv(csv);
    if (!drafts.length) {
      return errorResponse(errors[0] || "No valid rows", 400, origin);
    }
    const result = await upsertMany(drafts);
    if (result.created) await scheduleInsights("import").catch(() => null);
    return jsonResponse({ ...result, errors, rows: drafts.length }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return errorResponse(message, 500, origin);
  }
}
