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
import { upsertMany } from "@/lib/proven-ads/upsert";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "proven-ads-import");
  if (limited) return limited;

  const origin = getOrigin(req);
  const denied = await requireAdminKey(req);
  if (denied) return denied;

  const contentType = req.headers.get("content-type") || "";
  let csv = "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { csv?: string };
      csv = body.csv || "";
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
    return errorResponse("Could not read CSV", 400, origin);
  }

  if (!csv.trim()) return errorResponse("csv is required", 400, origin);

  const { drafts, errors } = parseCsv(csv);
  if (!drafts.length) {
    return errorResponse(errors[0] || "No valid rows", 400, origin);
  }

  try {
    const result = await upsertMany(drafts);
    return jsonResponse({ ...result, errors, rows: drafts.length }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return errorResponse(message, 500, origin);
  }
}
