import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  isAdminRequest,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { META_API_VERSION } from "@/lib/ad-publish/types";

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  return digits;
}

async function getMetaToken(facilityId: string) {
  return db.platform_connections.findFirst({
    where: {
      facility_id: facilityId,
      platform: "meta",
      status: "connected",
    },
    select: { id: true, access_token: true, account_id: true },
  });
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "audience-sync");
  if (limited) return limited;
  const origin = getOrigin(req);
  if (!isAdminRequest(req)) return errorResponse("Unauthorized", 401, origin);

  const facilityId = req.nextUrl.searchParams.get("facilityId");
  if (!facilityId) return errorResponse("Missing facilityId", 400, origin);

  try {
    const syncs = await db.$queryRaw<unknown[]>`
      SELECT * FROM audience_syncs WHERE facility_id = ${facilityId}::uuid ORDER BY created_at DESC
    `;
    return jsonResponse({ success: true, data: syncs }, 200, origin);
  } catch {
    return errorResponse("Internal server error", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "audience-sync");
  if (limited) return limited;
  const origin = getOrigin(req);
  if (!isAdminRequest(req)) return errorResponse("Unauthorized", 401, origin);

  try {
    const body = await req.json();
    const { facilityId, action, audienceName, sourceType, audienceSyncId } =
      body;

    if (!facilityId) return errorResponse("Missing facilityId", 400, origin);

    const metaConn = await getMetaToken(facilityId);
    if (!metaConn) {
      return errorResponse(
        "No active Meta connection for this facility. Connect Meta Business Manager first.",
        400,
        origin,
      );
    }

    const { access_token, account_id } = metaConn;

    if (action === "create") {
      if (!audienceName || !sourceType) {
        return errorResponse(
          "Missing audienceName or sourceType",
          400,
          origin,
        );
      }

      let tenants: Array<{ email: string | null; phone: string | null }>;
      if (sourceType === "active_tenants") {
        tenants = await db.tenants.findMany({
          where: {
            facility_id: facilityId,
            status: "active",
            OR: [
              { email: { not: null } },
              { phone: { not: null } },
            ],
          },
          select: { email: true, phone: true },
        });
      } else if (sourceType === "moved_out") {
        tenants = await db.tenants.findMany({
          where: {
            facility_id: facilityId,
            status: "moved_out",
            OR: [
              { email: { not: null } },
              { phone: { not: null } },
            ],
          },
          select: { email: true, phone: true },
        });
      } else if (sourceType === "leads") {
        tenants = await db.partial_leads.findMany({
          where: {
            facility_id: facilityId,
            email: { not: null },
          },
          select: { email: true, phone: true },
        });
      } else {
        return errorResponse(
          "Invalid sourceType. Use: active_tenants, moved_out, or leads",
          400,
          origin,
        );
      }

      if (tenants.length === 0) {
        return errorResponse(
          `No ${sourceType.replace(/_/g, " ")} found for this facility`,
          400,
          origin,
        );
      }

      const createRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/act_${account_id}/customaudiences`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token,
            name: audienceName,
            subtype: "CUSTOM",
            description: `StorageAds ${sourceType.replace(/_/g, " ")} audience`,
            customer_file_source: "USER_PROVIDED_ONLY",
          }),
        },
      );
      const createData = await createRes.json();

      if (createData.error) {
        return errorResponse(
          `Meta API error: ${createData.error.message}`,
          400,
          origin,
        );
      }

      const metaAudienceId = createData.id;

      const schema = ["EMAIL", "PHONE"];
      const data = tenants
        .filter((t) => t.email || t.phone)
        .map((t) => [
          t.email ? sha256(t.email) : "",
          t.phone ? sha256(normalizePhone(t.phone)) : "",
        ]);

      const uploadRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${metaAudienceId}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token,
            payload: { schema, data },
          }),
        },
      );
      const uploadData = await uploadRes.json();

      const syncRow = await db.$queryRaw<unknown[]>`
        INSERT INTO audience_syncs (facility_id, connection_id, audience_type, audience_name, meta_audience_id, source_type, record_count, status, last_synced_at)
        VALUES (
          ${facilityId}::uuid,
          (SELECT id FROM platform_connections WHERE facility_id = ${facilityId}::uuid AND platform = 'meta' LIMIT 1),
          'custom', ${audienceName}, ${metaAudienceId}, ${sourceType}, ${tenants.length}, 'ready', NOW()
        )
        RETURNING *
      `;

      db.activity_log
        .create({
          data: {
            type: "audience_created",
            facility_id: facilityId,
            detail: `Custom audience "${audienceName}" created with ${tenants.length} records`,
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

      return jsonResponse(
        {
          success: true,
          sync: (syncRow as unknown[])[0],
          metaResponse: {
            audience_id: metaAudienceId,
            num_received: uploadData.num_received,
          },
        },
        200,
        origin,
      );
    }

    if (action === "refresh") {
      if (!audienceSyncId)
        return errorResponse("Missing audienceSyncId", 400, origin);

      const syncs = await db.$queryRaw<
        Array<{
          id: string;
          source_type: string;
          meta_audience_id: string;
        }>
      >`SELECT * FROM audience_syncs WHERE id = ${audienceSyncId}::uuid`;
      if (!syncs.length)
        return errorResponse("Audience sync not found", 404, origin);
      const sync = syncs[0];

      let tenants: Array<{ email: string | null; phone: string | null }>;
      if (sync.source_type === "active_tenants") {
        tenants = await db.tenants.findMany({
          where: {
            facility_id: facilityId,
            status: "active",
            OR: [{ email: { not: null } }, { phone: { not: null } }],
          },
          select: { email: true, phone: true },
        });
      } else if (sync.source_type === "moved_out") {
        tenants = await db.tenants.findMany({
          where: {
            facility_id: facilityId,
            status: "moved_out",
            OR: [{ email: { not: null } }, { phone: { not: null } }],
          },
          select: { email: true, phone: true },
        });
      } else {
        tenants = await db.partial_leads.findMany({
          where: { facility_id: facilityId, email: { not: null } },
          select: { email: true, phone: true },
        });
      }

      const schema = ["EMAIL", "PHONE"];
      const data = tenants
        .filter((t) => t.email || t.phone)
        .map((t) => [
          t.email ? sha256(t.email) : "",
          t.phone ? sha256(normalizePhone(t.phone)) : "",
        ]);

      const refreshRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${sync.meta_audience_id}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token, payload: { schema, data } }),
        },
      );
      const refreshData = await refreshRes.json();
      if (refreshData.error) {
        return errorResponse(
          `Meta API error: ${refreshData.error.message}`,
          400,
          origin,
        );
      }

      await db.$executeRaw`
        UPDATE audience_syncs SET record_count = ${tenants.length}, last_synced_at = NOW(), updated_at = NOW()
        WHERE id = ${audienceSyncId}::uuid
      `;

      return jsonResponse(
        { success: true, recordCount: tenants.length },
        200,
        origin,
      );
    }

    if (action === "create-lookalike") {
      if (!audienceSyncId || !audienceName) {
        return errorResponse(
          "Missing audienceSyncId or audienceName",
          400,
          origin,
        );
      }

      const syncs = await db.$queryRaw<
        Array<{ id: string; meta_audience_id: string; source_type: string }>
      >`SELECT * FROM audience_syncs WHERE id = ${audienceSyncId}::uuid`;
      if (!syncs.length || !syncs[0].meta_audience_id) {
        return errorResponse("Source audience not found", 404, origin);
      }
      const sync = syncs[0];

      const lookalikeRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/act_${account_id}/customaudiences`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token,
            name: audienceName,
            subtype: "LOOKALIKE",
            origin_audience_id: sync.meta_audience_id,
            lookalike_spec: JSON.stringify({
              country: "US",
              ratio: 0.01,
              type: "similarity",
            }),
          }),
        },
      );
      const lookalikeData = await lookalikeRes.json();

      if (lookalikeData.error) {
        return errorResponse(
          `Meta API error: ${lookalikeData.error.message}`,
          400,
          origin,
        );
      }

      const syncRow = await db.$queryRaw<unknown[]>`
        INSERT INTO audience_syncs (facility_id, connection_id, audience_type, audience_name, meta_audience_id, source_type, status, last_synced_at)
        VALUES (
          ${facilityId}::uuid,
          (SELECT id FROM platform_connections WHERE facility_id = ${facilityId}::uuid AND platform = 'meta' LIMIT 1),
          'lookalike', ${audienceName}, ${lookalikeData.id}, ${`lookalike_from_${sync.source_type}`}, 'ready', NOW()
        )
        RETURNING *
      `;

      return jsonResponse(
        { success: true, sync: (syncRow as unknown[])[0] },
        200,
        origin,
      );
    }

    return errorResponse(
      "Invalid action. Use: create, refresh, or create-lookalike",
      400,
      origin,
    );
  } catch {
    return errorResponse("Internal server error", 500, origin);
  }
}
