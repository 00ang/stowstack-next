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
import { SENDERS, sendEmail } from "@/lib/email";
import { operatorAuditEmail } from "@/lib/audit-email";

/**
 * Resend the existing audit link. Does not regenerate. If there is no
 * link on the lead, this refuses rather than inventing a new audit.
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "audit-resend");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  const body = await req.json().catch(() => null);
  const id = typeof body?.facilityId === "string" ? body.facilityId : "";
  if (!id) return errorResponse("Missing lead", 400, origin);

  const facility = await db.facilities.findUnique({ where: { id } });
  if (!facility) return errorResponse("Lead not found", 404, origin);
  if (!facility.shared_audit_slug) {
    return errorResponse("No audit on file to resend", 409, origin);
  }
  if (!facility.contact_email) {
    await db.facilities.update({
      where: { id },
      data: {
        pipeline_status: "audit_not_delivered",
        audit_delivery_error: "No email on file",
      },
    });
    return errorResponse("No email on file", 409, origin);
  }

  const auditUrl = `https://storageads.com/audit/${facility.shared_audit_slug}`;
  const sent = await sendEmail({
    from: SENDERS.notifications,
    to: facility.contact_email,
    subject: `Your facility diagnostic is ready: ${facility.name}`,
    tags: [{ name: "type", value: "diagnostic_operator_resend" }],
    html: operatorAuditEmail({
      facilityName: facility.name,
      summary: "Your diagnostic is ready. The link below is the same report.",
      auditUrl,
      score: 0,
      grade: "",
      dollarsKnown: false,
    }),
  });

  if (!sent.ok || !sent.id) {
    const reason = sent.error || sent.skipReason || "Email was not accepted";
    await db.facilities.update({
      where: { id },
      data: { pipeline_status: "audit_not_delivered", audit_delivery_error: reason },
    });
    await db.activity_log
      .create({
        data: {
          type: "audit_delivery_failed",
          facility_id: id,
          facility_name: facility.name,
          detail: `Resend failed: ${reason}`,
        },
      })
      .catch(() => undefined);
    return errorResponse(reason, 502, origin);
  }

  await db.facilities.update({
    where: { id },
    data: {
      pipeline_status: "audit_sent",
      audit_sent_at: new Date(),
      audit_email_id: sent.id,
      audit_delivery_error: null,
    },
  });
  await db.activity_log
    .create({
      data: {
        type: "audit_sent",
        facility_id: id,
        facility_name: facility.name,
        detail: `Audit resent to ${facility.contact_email}`,
        meta: { emailId: sent.id, slug: facility.shared_audit_slug },
      },
    })
    .catch(() => undefined);

  return jsonResponse({ success: true, emailId: sent.id }, 200, origin);
}
