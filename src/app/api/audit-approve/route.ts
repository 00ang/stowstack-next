import { Prisma } from "@prisma/client";
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
import { CAL_BOOKING_URL } from "@/lib/booking";
import { SEQUENCE_TEMPLATES } from "@/lib/nurture-templates";
import { SENDERS, sendEmail } from "@/lib/email";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateSlug(facilityName: string): string {
  const base = (facilityName || "facility")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

// Legacy drip enrollment, kept as the fallback when the nurture path is
// unavailable (no contact email) or fails. Idempotent per facility + sequence.
async function enrollPostAuditDrip(facilityId: string): Promise<void> {
  const existingDrip = await db.drip_sequences.findFirst({
    where: { facility_id: facilityId, sequence_id: "post_audit" },
  });
  if (!existingDrip) {
    const firstSendAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Day 2
    await db.drip_sequences.create({
      data: {
        facility_id: facilityId,
        sequence_id: "post_audit",
        current_step: 0,
        status: "active",
        next_send_at: firstSendAt,
        history: [],
      },
    });
  }
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "audit-approve");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireAdminKey(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { auditId, facilityId } = body || {};
    if (!auditId || !facilityId) {
      return errorResponse("Missing auditId or facilityId", 400, origin);
    }

    const audit = await db.audits.findUnique({ where: { id: auditId } });
    if (!audit) return errorResponse("Audit not found", 404, origin);

    const facility = await db.facilities.findUnique({
      where: { id: facilityId },
    });
    if (!facility) return errorResponse("Facility not found", 404, origin);

    // Transform AI-generated audit format to SharedAuditView format
    const aiAudit = (audit.audit_json as Record<string, unknown>) || {};
    const fs = (aiAudit.facility_summary as Record<string, unknown>) || {};
    const occupancy =
      typeof fs.occupancy_estimate === "number" ? fs.occupancy_estimate : null;
    const totalUnits =
      typeof fs.total_units_estimate === "number" ? fs.total_units_estimate : null;
    const vacantUnits =
      typeof fs.vacant_units_estimate === "number"
        ? fs.vacant_units_estimate
        : occupancy != null && totalUnits != null
          ? Math.round(totalUnits * (1 - occupancy / 100))
          : 0;
    const rl = (aiAudit.revenue_leakage as Record<string, unknown>) || {};
    const sf = (aiAudit.storageads_fit as Record<string, unknown>) || {};
    const recSpend =
      typeof sf.projected_monthly_spend === "number" ? sf.projected_monthly_spend : 0;
    const costPerMoveIn =
      typeof sf.projected_cost_per_move_in === "number" ? sf.projected_cost_per_move_in : 0;
    const moveIns =
      recSpend > 0 ? Math.round(recSpend / costPerMoveIn) : 20;

    const dp = (aiAudit.digital_presence as Record<string, unknown>) || {};
    const mp = (aiAudit.market_position as Record<string, unknown>) || {};
    const recommendedActions = (aiAudit.recommended_actions ||
      []) as Array<Record<string, unknown>>;

    const overallScore =
      typeof aiAudit.overall_score === "number" ? aiAudit.overall_score : 0;

    const viewAudit = {
      generatedAt: new Date().toISOString(),
      facility: {
        name: (fs.name as string) || facility.name,
        location: (fs.location as string) || facility.location,
        totalUnits,
        occupancy,
        vacantUnits,
        biggestIssue: facility.biggest_issue || "",
      },
      vacancyCost: {
        monthlyLoss: typeof rl.monthly_loss === "number" ? rl.monthly_loss : 0,
        annualLoss: typeof rl.annual_loss === "number" ? rl.annual_loss : 0,
        vacantUnits,
        avgUnitRate: typeof rl.per_unit_monthly === "number" ? rl.per_unit_monthly : 0,
      },
      marketOpportunity: {
        score: overallScore,
        grade:
          overallScore >= 80
            ? "Excellent"
            : overallScore >= 60
              ? "Strong"
              : overallScore >= 40
                ? "Moderate"
                : "Needs Work",
      },
      projections: {
        recommendedSpend: recSpend,
        projectedCpl: 24,
        projectedLeadsPerMonth: Math.round(recSpend / 24),
        projectedMoveInsPerMonth: moveIns,
        projectedMonthlyRevenue: moveIns * 110 * 8,
        projectedRoas:
          recSpend > 0
            ? Math.round(((moveIns * 110 * 8) / recSpend) * 10) / 10
            : 0,
        projectedMonthsToFill:
          typeof sf.projected_months_to_target === "number"
            ? sf.projected_months_to_target
            : 6,
        conversionRate: 25,
      },
      competitiveInsights: [
        dp.summary as string | undefined,
        mp.summary as string | undefined,
        ...((dp.findings as string[]) || []),
      ].filter(Boolean),
      recommendations: recommendedActions.map((a) => ({
        title: a.title as string,
        detail: a.detail as string,
        priority: (a.priority as string) || "medium",
      })),
    };

    // Create shareable audit link
    const slug = generateSlug(facility.name);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    await db.shared_audits.create({
      data: {
        slug,
        facility_name: facility.name,
        audit_json: viewAudit as unknown as Prisma.InputJsonValue,
        views: 0,
        expires_at: expiresAt,
      },
    });

    const auditUrl = `https://storageads.com/audit/${slug}?utm_source=email&utm_medium=drip&utm_campaign=audit_results&utm_content=view_audit`;

    // Email the audit to the lead
    const resendKey = process.env.RESEND_API_KEY;
    const firstName =
      (facility.contact_name || "").trim().split(" ")[0] || "there";
    const annualLoss =
      typeof rl.annual_loss === "number"
        ? rl.annual_loss
        : viewAudit.vacancyCost.annualLoss;
    const operatorSend =
      resendKey && facility.contact_email
        ? await sendEmail({
        from: SENDERS.blake,
        to: facility.contact_email,
        cc: "anna@storageads.com",
        replyTo: ["blake@storageads.com", "anna@storageads.com"],
        subject: `Your ${facility.name} facility audit is ready`,
        tags: [{ name: "type", value: "audit_ready" }],
        html: `
            <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.7; color: #1a1a1a;">
              <p>Hey ${esc(firstName)},</p>
              <p>Your facility audit for <strong>${esc(facility.name)}</strong> is done. I went through your market, competitors, digital presence, and revenue numbers.</p>
              ${annualLoss > 0 ? `<p>Quick headline: your vacancy is costing you an estimated <strong style="color: #dc2626;">$${annualLoss.toLocaleString()}/year</strong> in lost revenue. The audit breaks down exactly where that is coming from and what to do about it.</p>` : ""}
              <p style="margin: 24px 0;">
                <a href="${auditUrl}" style="display: inline-block; padding: 14px 28px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Audit Report</a>
              </p>
              <p>The report covers:</p>
              <ul style="padding-left: 20px; margin: 12px 0;">
                <li style="margin-bottom: 6px;">Market position and competitor analysis</li>
                <li style="margin-bottom: 6px;">Digital presence assessment</li>
                <li style="margin-bottom: 6px;">Revenue leakage estimate</li>
                <li style="margin-bottom: 6px;">Specific recommended actions with priorities</li>
                <li style="margin-bottom: 6px;">StorageAds fit assessment with projected ROI</li>
              </ul>
              <p>I would love to walk you through the findings on a quick call. <strong>Pick a time that works for you:</strong></p>
              <p style="margin: 20px 0;">
                <a href="${CAL_BOOKING_URL}" style="display: inline-block; padding: 12px 24px; background: #141413; color: #faf9f5; text-decoration: none; border-radius: 8px; font-weight: 600;">Book a 20-Minute Walkthrough</a>
              </p>
              <p>The report link is active for 90 days. If you have any questions before we talk, just reply to this email.</p>
              <p style="margin-top: 24px;">
                Blake Burkett<br/>
                StorageAds<br/>
                <a href="tel:2699298541" style="color: #16a34a; text-decoration: none;">269-929-8541</a>
              </p>
            </div>`,
        })
        : null;

    const delivered = Boolean(operatorSend?.ok && operatorSend.id);
    await db.facilities.update({
      where: { id: facilityId },
      data: {
        shared_audit_slug: slug,
        updated_at: new Date(),
        pipeline_status: delivered ? "audit_sent" : "audit_not_delivered",
        audit_sent_at: delivered ? new Date() : null,
        audit_email_id: delivered ? operatorSend?.id || null : null,
        audit_delivery_error: delivered
          ? null
          : !facility.contact_email
            ? "No email on file"
            : operatorSend?.error || operatorSend?.skipReason || "Email was not accepted",
      },
    });

    if (!delivered) {
      await db.activity_log
        .create({
          data: {
            type: "audit_delivery_failed",
            facility_id: facilityId,
            facility_name: facility.name,
            detail: !facility.contact_email
              ? "No email on file"
              : operatorSend?.error || operatorSend?.skipReason || "Email was not accepted",
          },
        })
        .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));
    }

    // Log activity (fire-and-forget)
    db.activity_log
      .create({
        data: {
          type: "audit_approved",
          facility_id: facilityId,
          facility_name: facility.name,
          detail: `Audit approved and sent to ${facility.contact_email}`,
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    // Enroll in the post-audit nurture sequence (day 1/3/7 follow-ups).
    // Requires a contact email to nurture; falls back to the legacy drip sequence
    // when there is no email or if nurture enrollment fails. Drip is the safety net.
    if (facility.contact_email) {
      try {
        const template = SEQUENCE_TEMPLATES.post_audit;

        // Find-or-create this facility's post_audit nurture sequence.
        const existingSeq = await db.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM nurture_sequences
          WHERE facility_id = ${facilityId}::uuid AND trigger_type = ${template.trigger_type}
          ORDER BY created_at ASC LIMIT 1
        `;
        let sequenceId = existingSeq[0]?.id;
        if (!sequenceId) {
          const createdSeq = await db.$queryRaw<Array<{ id: string }>>`
            INSERT INTO nurture_sequences (facility_id, name, trigger_type, steps, status)
            VALUES (${facilityId}, ${template.name}, ${template.trigger_type}, ${JSON.stringify(template.steps)}::jsonb, 'active')
            RETURNING id
          `;
          sequenceId = createdSeq[0]?.id;
        }
        if (!sequenceId) {
          throw new Error("Failed to resolve post_audit nurture sequence");
        }

        // Idempotency: do not double-enroll the same contact on this sequence.
        const existingEnroll = await db.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM nurture_enrollments
          WHERE facility_id = ${facilityId}::uuid AND sequence_id = ${sequenceId}::uuid
            AND contact_email = ${facility.contact_email}
          LIMIT 1
        `;
        if (existingEnroll.length === 0) {
          const firstStep = template.steps[0];
          const nextSendAt = new Date(
            Date.now() + (firstStep?.delay_minutes || 60) * 60 * 1000
          ).toISOString();
          await db.$executeRaw`
            INSERT INTO nurture_enrollments (
              sequence_id, facility_id, contact_name, contact_email,
              current_step, status, next_send_at, metadata
            ) VALUES (
              ${sequenceId}, ${facilityId},
              ${facility.contact_name || null}, ${facility.contact_email},
              0, 'active', ${nextSendAt}::timestamptz,
              ${JSON.stringify({ source: "audit_approve", audit_id: auditId })}::jsonb
            )
          `;
        }
      } catch (nurtureErr) {
        console.error(
          "[audit-approve] nurture enroll failed, falling back to drip:",
          nurtureErr instanceof Error ? nurtureErr.message : nurtureErr
        );
        await enrollPostAuditDrip(facilityId);
      }
    } else {
      // No contact email to nurture; keep the legacy drip enrollment.
      await enrollPostAuditDrip(facilityId);
    }

    return jsonResponse(
      {
        success: true,
        slug,
        auditUrl,
        sentTo: facility.contact_email,
      },
      200,
      origin
    );
  } catch {
    return errorResponse("Internal server error", 500, origin);
  }
}
