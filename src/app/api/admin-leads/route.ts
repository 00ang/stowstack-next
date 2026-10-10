import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
  requireAdminKey,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { provisionPortalAccess } from "@/lib/portal-provisioning";

function facilityToLead(
  row: Record<string, unknown>,
  notes: Array<{ text: string; at: string }>
) {
  return {
    id: row.id,
    name: row.contact_name || "",
    email: row.contact_email || "",
    phone: row.contact_phone || "",
    facilityName: row.name || "",
    location: row.location || "",
    occupancyRange: row.occupancy_range || "",
    totalUnits: row.total_units || "",
    biggestIssue: row.biggest_issue || "",
    formNotes: row.form_notes || null,
    intakeAnswers: row.intake_answers || null,
    sortLast: row.sort_last === true,
    sortLastReason: (row.sort_last_reason as string) || "",
    status: row.pipeline_status || "submitted",
    pmsUploaded: row.pms_uploaded || false,
    followUpDate: row.follow_up_date || null,
    accessCode: row.access_code || null,
    notes,
    createdAt: row.created_at
      ? new Date(row.created_at as string).toISOString()
      : "",
    updatedAt: row.updated_at
      ? new Date(row.updated_at as string).toISOString()
      : "",
  };
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-leads");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.max(
      1,
      Math.min(200, parseInt(url.searchParams.get("limit") || "50"))
    );
    const search = url.searchParams.get("search") || "";
    const statusFilter = url.searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { deleted_at: null };

    if (search) {
      where.OR = [
        { contact_name: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { contact_email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (statusFilter) {
      where.pipeline_status = statusFilter;
    }

    const sort = url.searchParams.get("sort") || "newest";
    // sort_last leads sit under the others. Nothing is hidden.
    const recency =
      sort === "oldest"
        ? { created_at: "asc" as const }
        : sort === "name"
          ? { contact_name: "asc" as const }
          : { created_at: "desc" as const };
    const orderBy = [{ sort_last: "asc" as const }, recency];

    const [total, facilities] = await Promise.all([
      db.facilities.count({ where }),
      db.facilities.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Batch-fetch notes
    const facilityIds = facilities.map((f) => f.id);
    const noteRows =
      facilityIds.length > 0
        ? await db.lead_notes.findMany({
            where: { facility_id: { in: facilityIds } },
            orderBy: { created_at: "asc" },
            select: { facility_id: true, text: true, created_at: true },
          })
        : [];

    const notesByFacility: Record<
      string,
      Array<{ text: string; at: string }>
    > = {};
    for (const n of noteRows) {
      if (!notesByFacility[n.facility_id]) notesByFacility[n.facility_id] = [];
      notesByFacility[n.facility_id].push({
        text: n.text || "",
        at: n.created_at?.toISOString() || "",
      });
    }

    const leads = facilities.map((f) =>
      facilityToLead(
        f as unknown as Record<string, unknown>,
        notesByFacility[f.id] || []
      )
    );

    const auditCount = await db.shared_audits.count();

    return jsonResponse(
      {
        leads,
        auditCount,
        pagination: { page, limit, total, totalPages },
      },
      200,
      origin
    );
  } catch (err) {
    console.error("Admin leads list error:", err);
    return errorResponse("Failed to list leads", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-leads");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { lead } = body || {};
    if (!lead?.email) return errorResponse("Missing lead data", 400, origin);

    const facility = await db.facilities.create({
      data: {
        name: lead.facilityName || "",
        location: lead.location || "",
        contact_name: lead.name || "",
        contact_email: lead.email,
        contact_phone: lead.phone || "",
        occupancy_range: lead.occupancyRange || "",
        total_units: lead.totalUnits || "",
        biggest_issue: lead.biggestIssue || "",
        notes: lead.notes || null,
        status: "intake",
        pipeline_status: "submitted",
        form_notes: lead.notes || null,
      },
    });

    // Fire-and-forget activity log
    db.activity_log
      .create({
        data: {
          type: "lead_created",
          facility_id: facility.id,
          lead_name: lead.name || "",
          facility_name: lead.facilityName || "",
          detail: `New lead from ${lead.facilityName || "unknown facility"}`.slice(0, 500),
          meta: {},
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    return jsonResponse({ id: facility.id }, 200, origin);
  } catch (err) {
    console.error("Admin lead create error:", err);
    return errorResponse("Failed to create lead", 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-leads");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id, status, note, pmsUploaded, followUpDate, grantPortalAccess, promote } =
      body || {};
    if (!id) return errorResponse("Missing lead ID", 400, origin);

    const facility = await db.facilities.findUnique({ where: { id } });
    if (!facility) return errorResponse("Lead not found", 404, origin);

    // Explicit, status-independent portal provisioning. Lets an admin grant a
    // facility a client login without dragging it to `client_signed` in the
    // CRM — portal access is decoupled from the pipeline stage.
    if (grantPortalAccess) {
      const result = await provisionPortalAccess(id, { sendWelcomeEmail: true });
      if (!result.ok) return errorResponse(result.error, 400, origin);

      db.activity_log
        .create({
          data: {
            type: "portal_access_granted",
            facility_id: id,
            lead_name: facility.contact_name || "",
            facility_name: facility.name || "",
            detail: result.created
              ? `Portal access granted for ${result.email}`
              : `Portal access confirmed for ${result.email}`,
            meta: { email: result.email },
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

      return jsonResponse(
        {
          success: true,
          portalAccess: {
            code: result.code,
            email: result.email,
            created: result.created,
          },
        },
        200,
        origin
      );
    }

    if (promote === true) {
      await db.facilities.update({
        where: { id },
        data: {
          sort_last: false,
          sort_last_reason: null,
          sort_last_cleared_at: new Date(),
        },
      });
      db.activity_log
        .create({
          data: {
            type: "lead_moved_up",
            facility_id: id,
            lead_name: facility.contact_name || "",
            facility_name: facility.name || "",
            detail: "Moved up in the pipeline",
            meta: {},
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
    }

    // Build dynamic update
    const updateData: Record<string, unknown> = {};
    if (status) updateData.pipeline_status = status;
    if (pmsUploaded !== undefined) updateData.pms_uploaded = pmsUploaded;
    if (followUpDate !== undefined)
      updateData.follow_up_date = followUpDate || null;

    if (Object.keys(updateData).length > 0) {
      await db.facilities.update({ where: { id }, data: updateData });
    }

    // Add note
    if (note) {
      await db.lead_notes.create({
        data: { facility_id: id, text: note },
      });
    }

    // Provision portal access when a lead is marked as signed. The actual
    // provisioning (access code + client row + welcome email) lives in
    // provisionPortalAccess() — idempotent and shared with the explicit grant
    // action above, so the kanban stage and portal access stay in sync.
    if (status === "client_signed") {
      await provisionPortalAccess(id, { sendWelcomeEmail: true });
    }

    // Fire-and-forget activity logging
    if (status) {
      db.activity_log
        .create({
          data: {
            type:
              status === "client_signed" ? "client_signed" : "status_change",
            facility_id: id,
            lead_name: facility.contact_name || "",
            facility_name: facility.name || "",
            detail:
              status === "client_signed"
                ? `${facility.name} signed as client`
                : `Status changed to "${status}"`,
            meta: { to: status },
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
    }

    // Fetch updated record
    const updated = await db.facilities.findUnique({ where: { id } });
    const notes = await db.lead_notes.findMany({
      where: { facility_id: id },
      orderBy: { created_at: "asc" },
      select: { text: true, created_at: true },
    });

    const record = facilityToLead(
      updated as unknown as Record<string, unknown>,
      notes.map((n) => ({
        text: n.text || "",
        at: n.created_at?.toISOString() || "",
      }))
    );

    return jsonResponse({ success: true, record }, 200, origin);
  } catch (err) {
    console.error("Admin lead update error:", err);
    return errorResponse("Failed to update lead", 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "admin-leads");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id) return errorResponse("Missing lead ID", 400, origin);

    const facility = await db.facilities.findUnique({
      where: { id },
      select: { id: true, name: true, contact_name: true, deleted_at: true },
    });
    if (!facility) return errorResponse("Lead not found", 404, origin);
    if (facility.deleted_at) return errorResponse("Lead already deleted", 400, origin);

    await db.facilities.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by: "admin" },
    });

    // Fire-and-forget activity log
    db.activity_log
      .create({
        data: {
          type: "lead_deleted",
          facility_id: id,
          lead_name: facility.contact_name || "",
          facility_name: facility.name || "",
          detail: `Lead "${facility.name || "Unknown"}" removed from pipeline`,
          meta: {},
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    console.error("Admin lead delete error:", err);
    return errorResponse("Failed to delete lead", 500, origin);
  }
}
