import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  corsResponse,
  getOrigin,
  requireFacilityAccess,
} from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { SEQUENCE_TEMPLATES } from "@/lib/nurture-templates";


export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "nurture-sequences");
  if (limited) return limited;
  const origin = getOrigin(req);
  const authErr = await requireFacilityAccess(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) {
    return errorResponse("facilityId required", 400, origin);
  }

  try {
    const [sequences, enrollments, messages] = await Promise.all([
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM nurture_sequences WHERE facility_id = ${facilityId}::uuid ORDER BY created_at DESC
      `,
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM nurture_enrollments WHERE facility_id = ${facilityId}::uuid ORDER BY enrolled_at DESC LIMIT 200
      `,
      db.$queryRaw<Array<Record<string, unknown>>>`
        SELECT nm.* FROM nurture_messages nm
        JOIN nurture_enrollments ne ON ne.id = nm.enrollment_id
        WHERE ne.facility_id = ${facilityId}::uuid
        ORDER BY nm.created_at DESC LIMIT 500
      `,
    ]);

    const stats = {
      totalSequences: sequences.length,
      activeEnrollments: enrollments.filter((e) => e.status === "active").length,
      converted: enrollments.filter((e) => e.status === "converted").length,
      totalMessages: messages.length,
      smsSent: messages.filter(
        (m) => m.channel === "sms" && m.status !== "pending"
      ).length,
      emailSent: messages.filter(
        (m) => m.channel === "email" && m.status !== "pending"
      ).length,
      deliveryRate:
        messages.length > 0
          ? Math.round(
              (messages.filter((m) =>
                ["sent", "delivered", "opened", "clicked"].includes(
                  m.status as string
                )
              ).length /
                messages.filter((m) => m.status !== "pending").length) *
                100
            )
          : 0,
    };

    return jsonResponse(
      {
        templates: Object.entries(SEQUENCE_TEMPLATES).map(([key, t]) => ({
          key,
          name: t.name,
          trigger_type: t.trigger_type,
          stepCount: t.steps.length,
        })),
        sequences,
        enrollments,
        recentMessages: messages.slice(0, 50),
        stats,
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "nurture-sequences");
  if (limited) return limited;
  const origin = getOrigin(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const { action } = body;

  try {
    if (action === "create_from_template") {
      const { facilityId, templateKey } = body as {
        facilityId?: string;
        templateKey?: string;
      };
      const denied = await requireFacilityAccess(req, facilityId);
      if (denied) return denied;
      const template = templateKey ? SEQUENCE_TEMPLATES[templateKey] : null;
      if (!template) {
        return errorResponse(`Unknown template: ${templateKey}`, 400, origin);
      }

      const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
        INSERT INTO nurture_sequences (facility_id, name, trigger_type, steps, status)
        VALUES (${facilityId}, ${template.name}, ${template.trigger_type}, ${JSON.stringify(template.steps)}::jsonb, 'active')
        RETURNING *
      `;
      return jsonResponse({ sequence: rows[0] }, 201, origin);
    }

    if (action === "create_sequence") {
      const { facilityId, name, triggerType, steps } = body as {
        facilityId?: string;
        name?: string;
        triggerType?: string;
        steps?: unknown[];
      };
      if (!facilityId || !name || !triggerType) {
        return errorResponse(
          "facilityId, name, triggerType required",
          400,
          origin
        );
      }
      const denied = await requireFacilityAccess(req, facilityId);
      if (denied) return denied;

      const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
        INSERT INTO nurture_sequences (facility_id, name, trigger_type, steps, status)
        VALUES (${facilityId}, ${name}, ${triggerType}, ${JSON.stringify(steps || [])}::jsonb, 'active')
        RETURNING *
      `;
      return jsonResponse({ sequence: rows[0] }, 201, origin);
    }

    if (action === "enroll") {
      const {
        sequenceId,
        facilityId,
        contactName,
        contactEmail,
        contactPhone,
        leadId,
        tenantId,
        metadata,
      } = body as {
        sequenceId?: string;
        facilityId?: string;
        contactName?: string;
        contactEmail?: string;
        contactPhone?: string;
        leadId?: string;
        tenantId?: string;
        metadata?: Record<string, unknown>;
      };

      if (!sequenceId || !facilityId) {
        return errorResponse(
          "sequenceId and facilityId required",
          400,
          origin
        );
      }
      const denied = await requireFacilityAccess(req, facilityId);
      if (denied) return denied;

      // Enrolling a known lead: its contact details come from its own record,
      // so the owner never retypes what StorageAds already holds. The lead must
      // be this facility's.
      let name = contactName;
      let email = contactEmail;
      let phone = contactPhone;
      if (leadId) {
        const lead = await db.partial_leads.findFirst({
          where: { id: leadId, facility_id: facilityId },
          select: { name: true, email: true, phone: true },
        });
        if (!lead) return errorResponse("Lead not found", 404, origin);
        name = name || lead.name || undefined;
        email = email || lead.email || undefined;
        phone = phone || lead.phone || undefined;
      }
      if (!email && !phone) {
        return errorResponse(
          leadId
            ? "This lead has no email or phone on file. Add one to enroll them."
            : "At least contactEmail or contactPhone required",
          400,
          origin
        );
      }

      // The sequence must be this facility's too.
      const seqRows = await db.$queryRaw<
        Array<{ id: string; steps: unknown }>
      >`SELECT * FROM nurture_sequences WHERE id = ${sequenceId}::uuid AND facility_id = ${facilityId}::uuid`;
      const seq = seqRows[0];
      if (!seq) {
        return errorResponse("Sequence not found", 404, origin);
      }

      const steps =
        typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps;
      const firstStep = (steps as Array<{ delay_minutes?: number }>)[0];
      const nextSendAt = firstStep
        ? new Date(
            Date.now() + (firstStep.delay_minutes || 60) * 60 * 1000
          ).toISOString()
        : null;

      const rows = await db.$queryRaw<Array<Record<string, unknown>>>`
        INSERT INTO nurture_enrollments (
          sequence_id, facility_id, lead_id, tenant_id,
          contact_name, contact_email, contact_phone,
          current_step, status, next_send_at, metadata
        ) VALUES (
          ${sequenceId}, ${facilityId},
          ${leadId || null}, ${tenantId || null},
          ${name || null}, ${email || null}, ${phone || null},
          0, 'active', ${nextSendAt}::timestamptz,
          ${JSON.stringify(metadata || {})}::jsonb
        )
        RETURNING *
      `;

      return jsonResponse({ enrollment: rows[0] }, 201, origin);
    }

    return errorResponse(
      "Invalid action. Use: create_from_template, create_sequence, enroll",
      400,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "nurture-sequences");
  if (limited) return limited;
  const origin = getOrigin(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const { enrollmentId, action: patchAction } = body as {
    enrollmentId?: string;
    action?: string;
  };

  if (!enrollmentId || !patchAction) {
    return errorResponse("enrollmentId and action required", 400, origin);
  }

  try {
    if (patchAction === "update_sequence") {
      const { sequenceId } = body as { sequenceId?: string };
      const targetSeqId = sequenceId || enrollmentId;
      const existingSeq = await db.nurture_sequences.findUnique({
        where: { id: targetSeqId },
        select: { facility_id: true },
      });
      if (!existingSeq) return errorResponse("Not found", 404, origin);
      const denied = await requireFacilityAccess(req, existingSeq.facility_id);
      if (denied) return denied;
    } else {
      const existing = await db.nurture_enrollments.findUnique({
        where: { id: enrollmentId },
        select: { facility_id: true },
      });
      if (!existing) return errorResponse("Not found", 404, origin);
      const denied = await requireFacilityAccess(req, existing.facility_id);
      if (denied) return denied;
    }

    if (patchAction === "pause") {
      await db.$executeRaw`
        UPDATE nurture_enrollments SET status = 'paused', next_send_at = NULL WHERE id = ${enrollmentId}::uuid
      `;
    } else if (patchAction === "resume") {
      const enrollmentRows = await db.$queryRaw<
        Array<{ id: string; sequence_id: string; current_step: number }>
      >`SELECT * FROM nurture_enrollments WHERE id = ${enrollmentId}::uuid`;
      const enrollment = enrollmentRows[0];
      if (!enrollment) {
        return errorResponse("Enrollment not found", 404, origin);
      }

      const seqRows = await db.$queryRaw<
        Array<{ id: string; steps: unknown }>
      >`SELECT * FROM nurture_sequences WHERE id = ${enrollment.sequence_id}::uuid`;
      const seq = seqRows[0];
      const steps =
        typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps;
      const currentStep = (steps as Array<{ delay_minutes?: number }>)[
        enrollment.current_step
      ];
      const nextSendAt = currentStep
        ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        : null;

      await db.$executeRaw`
        UPDATE nurture_enrollments SET status = 'active', next_send_at = ${nextSendAt}::timestamptz WHERE id = ${enrollmentId}::uuid
      `;
    } else if (patchAction === "skip") {
      const enrollmentRows = await db.$queryRaw<
        Array<{ id: string; sequence_id: string; current_step: number }>
      >`SELECT * FROM nurture_enrollments WHERE id = ${enrollmentId}::uuid`;
      const enrollment = enrollmentRows[0];
      if (!enrollment) {
        return errorResponse("Enrollment not found", 404, origin);
      }

      const seqRows = await db.$queryRaw<
        Array<{ id: string; steps: unknown }>
      >`SELECT * FROM nurture_sequences WHERE id = ${enrollment.sequence_id}::uuid`;
      const seq = seqRows[0];
      const steps =
        typeof seq.steps === "string" ? JSON.parse(seq.steps) : seq.steps;
      const nextStepIdx = enrollment.current_step + 1;

      if (nextStepIdx >= (steps as unknown[]).length) {
        await db.$executeRaw`
          UPDATE nurture_enrollments SET status = 'completed', completed_at = NOW(), current_step = ${nextStepIdx}, next_send_at = NULL WHERE id = ${enrollmentId}::uuid
        `;
      } else {
        const nextStep = (steps as Array<{ delay_minutes?: number }>)[
          nextStepIdx
        ];
        const nextSendAt = new Date(
          Date.now() + (nextStep.delay_minutes || 60) * 60 * 1000
        ).toISOString();
        await db.$executeRaw`
          UPDATE nurture_enrollments SET current_step = ${nextStepIdx}, next_send_at = ${nextSendAt}::timestamptz WHERE id = ${enrollmentId}::uuid
        `;
      }
    } else if (patchAction === "convert") {
      await db.$executeRaw`
        UPDATE nurture_enrollments SET status = 'converted', exit_reason = 'manual_convert', completed_at = NOW(), next_send_at = NULL WHERE id = ${enrollmentId}::uuid
      `;
    } else if (patchAction === "unsubscribe") {
      await db.$executeRaw`
        UPDATE nurture_enrollments SET status = 'unsubscribed', exit_reason = 'manual_unsubscribe', completed_at = NOW(), next_send_at = NULL WHERE id = ${enrollmentId}::uuid
      `;
    } else if (patchAction === "update_sequence") {
      const {
        sequenceId,
        name,
        steps,
        status: seqStatus,
      } = body as {
        sequenceId?: string;
        name?: string;
        steps?: unknown[];
        status?: string;
      };
      const targetId = sequenceId || enrollmentId;

      const setClauses: Prisma.Sql[] = [];

      if (name) {
        setClauses.push(Prisma.sql`name = ${name}`);
      }
      if (steps) {
        setClauses.push(Prisma.sql`steps = ${JSON.stringify(steps)}::jsonb`);
      }
      if (seqStatus) {
        setClauses.push(Prisma.sql`status = ${seqStatus}`);
      }
      setClauses.push(Prisma.sql`updated_at = NOW()`);

      const setFragment = Prisma.join(setClauses, ", ");

      await db.$executeRaw`
        UPDATE nurture_sequences SET ${setFragment} WHERE id = ${targetId}::uuid
      `;
    }

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const origin = getOrigin(req);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const type = url.searchParams.get("type");

  if (!id) {
    return errorResponse("id required", 400, origin);
  }

  try {
    if (type === "enrollment") {
      const existing = await db.nurture_enrollments.findUnique({
        where: { id },
        select: { facility_id: true },
      });
      if (!existing) return errorResponse("Not found", 404, origin);
      const denied = await requireFacilityAccess(req, existing.facility_id);
      if (denied) return denied;
      await db.$executeRaw`DELETE FROM nurture_enrollments WHERE id = ${id}::uuid`;
    } else {
      const existing = await db.nurture_sequences.findUnique({
        where: { id },
        select: { facility_id: true },
      });
      if (!existing) return errorResponse("Not found", 404, origin);
      const denied = await requireFacilityAccess(req, existing.facility_id);
      if (denied) return denied;
      await db.$executeRaw`DELETE FROM nurture_sequences WHERE id = ${id}::uuid`;
    }

    return jsonResponse({ deleted: true }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(message, 500, origin);
  }
}
