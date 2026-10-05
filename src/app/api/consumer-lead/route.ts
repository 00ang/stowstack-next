import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidEmail, sanitizeString, escapeHtml } from "@/lib/validation";
import { sendEmail, SENDERS } from "@/lib/email";
import { respondToNewLeadSafely, scheduleSpeedCheck } from "@/lib/respond/speed-to-lead";
import { enqueue } from "@/lib/jobs/queue";
import { identifyFromRequest } from "@/lib/attribution/visitor";

/** Clamp optional string fields from untrusted input */
function clean(val: unknown, max: number): string | null {
  const s = sanitizeString(val, max);
  return s || null;
}

/**
 * Fire-and-forget admin notification for instant-audit-tool captures. The audit
 * tool has no facility record (Google Places lookup only), so these leads would
 * otherwise land silently in partial_leads with no alert. Other sources (landing
 * pages) have their own pipeline/visibility, so we only notify for the audit tool.
 */
function notifyAuditLead(fields: {
  email: string | null;
  facilityName: unknown;
  location: unknown;
  auditScore: unknown;
}) {
  if (!fields.email) return;
  const facilityName = clean(fields.facilityName, 200) || "Unknown facility";
  const location = clean(fields.location, 500) || "N/A";
  const score =
    typeof fields.auditScore === "number" ? String(fields.auditScore) : "N/A";
  // Owner notification via the canonical email layer (validate/retry/skip-on-no-key).
  void sendEmail({
    from: SENDERS.notifications,
    to: process.env.ADMIN_EMAIL || "blake@storageads.com",
    subject: `New Audit-Tool Lead: ${facilityName}`,
    html: `
      <h2>New Audit-Tool Lead</h2>
      <p><strong>Email:</strong> ${escapeHtml(fields.email)}</p>
      <p><strong>Facility:</strong> ${escapeHtml(facilityName)}</p>
      <p><strong>Location:</strong> ${escapeHtml(location)}</p>
      <p><strong>Audit score:</strong> ${escapeHtml(score)}</p>
    `,
    tags: [{ name: "type", value: "audit_tool_lead" }],
  }).catch((err) => console.error("[consumer-lead] notify failed:", err));
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.PUBLIC_WRITE, "consumer-lead");
  if (limited) return limited;
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const {
      sessionId, email, phone, name, unitSize, facilityId, landingPageId,
      fbclid, gclid, fbc: _fbc, fbp: _fbp,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term: _utm_term,
      source, facilityName, location, auditScore,
    } = body;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 200) {
      return errorResponse("Valid session ID is required", 400, origin);
    }
    if (!email && !phone) {
      return errorResponse("Email or phone is required", 400, origin);
    }
    if (email && !isValidEmail(String(email).trim())) {
      return errorResponse("Invalid email format", 400, origin);
    }

    // Sanitize all string inputs before storage
    const cleanEmail = clean(email, 254);
    const cleanPhone = clean(phone, 30);
    const cleanName = clean(name, 200);
    const cleanUnitSize = clean(unitSize, 50);
    const cleanUtmSource = clean(utm_source, 200);
    const cleanUtmMedium = clean(utm_medium, 200);
    const cleanUtmCampaign = clean(utm_campaign, 200);
    const cleanUtmContent = clean(utm_content, 200);

    // Try to update existing partial lead
    const existingPartial = await db.partial_leads.findFirst({
      where: { session_id: sessionId },
    });

    if (existingPartial) {
      const updated = await db.partial_leads.update({
        where: { id: existingPartial.id },
        data: {
          email: cleanEmail || existingPartial.email,
          phone: cleanPhone || existingPartial.phone,
          name: cleanName || existingPartial.name,
          unit_size: cleanUnitSize || existingPartial.unit_size,
          converted: true,
          converted_at: existingPartial.converted_at ?? new Date(),
          lead_status: "new",
          fbclid: fbclid || existingPartial.fbclid,
          gclid: gclid || existingPartial.gclid,
          utm_source: cleanUtmSource || existingPartial.utm_source,
          utm_medium: cleanUtmMedium || existingPartial.utm_medium,
          utm_campaign: cleanUtmCampaign || existingPartial.utm_campaign,
          utm_content: cleanUtmContent || existingPartial.utm_content,
        },
      });
      // RESPOND r5 — inline, not queued. The worker ticks once a minute and the
      // whole value of this is being inside the first one. `…Safely` swallows
      // its own failures: the customer is waiting on this response and a
      // messaging fault is ours to log, not theirs to see.
      await scheduleSpeedCheck(updated.id, updated.facility_id).catch(() => { /* best effort: the six-hourly sweep will find it */ });
      const speed = await respondToNewLeadSafely(updated.id);
      if (!speed.acked && !speed.alerted) {
        // Durable fallback for a transient vendor failure. Dedupe keys inside
        // make the retry safe even if the inline send half-succeeded.
        await enqueue({
          queue: "respond.speed-to-lead",
          payload: { leadId: updated.id },
          dedupeKey: `speed:${updated.id}`,
          tenantKey: updated.facility_id ?? undefined,
        }).catch(() => { /* best effort: the sweep will find it */ });
      }
      // MISSION.md s12 — tie this browser's touches to the lead. After speed-to-lead
      // on purpose: the first reply is the urgent part. Never throws.
      await identifyFromRequest(req, updated.id);

      if (source === "audit_tool") {
        notifyAuditLead({ email: cleanEmail, facilityName, location, auditScore });
      }
      return jsonResponse({ success: true, id: updated.id, status: "updated" }, 200, origin);
    }

    // Create new partial lead
    const lead = await db.partial_leads.create({
      data: {
        session_id: sessionId,
        facility_id: facilityId || null,
        landing_page_id: landingPageId || null,
        email: cleanEmail,
        phone: cleanPhone,
        name: cleanName,
        unit_size: cleanUnitSize,
        converted: true,
        converted_at: new Date(),
        lead_status: "new",
        fbclid: fbclid || null,
        gclid: gclid || null,
        utm_source: cleanUtmSource,
        utm_medium: cleanUtmMedium,
        utm_campaign: cleanUtmCampaign,
        utm_content: cleanUtmContent,
      },
    });

    // Fire-and-forget activity log
    if (facilityId) {
      db.activity_log.create({
        data: {
          type: "consumer_lead",
          facility_id: facilityId,
          lead_name: name || email || phone || "",
          detail: `New consumer lead from landing page`,
          meta: { sessionId, source: fbclid ? "meta" : gclid ? "google" : "direct" },
        },
      }).catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
    }

    // RESPOND r5 — inline, not queued. The worker ticks once a minute and the
    // whole value of this is being inside the first one. `…Safely` swallows
    // its own failures: the customer is waiting on this response and a
    // messaging fault is ours to log, not theirs to see.
    await scheduleSpeedCheck(lead.id, lead.facility_id).catch(() => { /* best effort: the six-hourly sweep will find it */ });
    const speed = await respondToNewLeadSafely(lead.id);
    if (!speed.acked && !speed.alerted) {
      // Durable fallback for a transient vendor failure. Dedupe keys inside
      // make the retry safe even if the inline send half-succeeded.
      await enqueue({
        queue: "respond.speed-to-lead",
        payload: { leadId: lead.id },
        dedupeKey: `speed:${lead.id}`,
        tenantKey: lead.facility_id ?? undefined,
      }).catch(() => { /* best effort: the sweep will find it */ });
    }
    // MISSION.md s12 — tie this browser's touches to the lead. After speed-to-lead
    // on purpose: the first reply is the urgent part. Never throws.
    await identifyFromRequest(req, lead.id);

    if (source === "audit_tool") {
      notifyAuditLead({ email: cleanEmail, facilityName, location, auditScore });
    }
    return jsonResponse({ success: true, id: lead.id, status: "created" }, 200, origin);
  } catch (err) {
    console.error("Consumer lead error:", err);
    return errorResponse("Failed to process lead", 500, origin);
  }
}
