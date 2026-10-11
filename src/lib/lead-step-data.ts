/**
 * Load the rows deriveLeadStep reads. Counts and dates come from those
 * rows. A missing template length stays 0 so the label can say so.
 */

import { db } from "@/lib/db";
import { SEQUENCES } from "@/lib/drip-sequences";
import {
  deriveLeadStep,
  selectNurture,
  type LeadStep,
  type LeadStepInput,
  type NurtureInput,
} from "@/lib/lead-step";

export interface LeadStepFacility {
  id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  intake_answers: unknown;
  pipeline_status: string | null;
  shared_audit_slug: string | null;
  audit_sent_at: Date | null;
  audit_delivery_error: string | null;
  notes: string | null;
  sort_last: boolean;
  created_at: Date | null;
}

interface DripRow {
  facility_id: string;
  sequence_id: string;
  current_step: number;
  status: string;
  next_send_at: Date | null;
  enrolled_at: Date | null;
}

interface EnrollmentRow {
  facility_id: string;
  current_step: number;
  status: string;
  next_send_at: Date | null;
  enrolled_at: Date | null;
  nurture_sequences: { name: string; steps: unknown } | null;
}

function countJsonSteps(steps: unknown): number {
  if (Array.isArray(steps)) return steps.length;
  if (typeof steps === "string") {
    try {
      const parsed = JSON.parse(steps) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function earliest(current: Date | null, next: Date | null): Date | null {
  if (!next) return current;
  if (!current || next.getTime() < current.getTime()) return next;
  return current;
}

function latest(current: Date | null, next: Date | null): Date | null {
  if (!next) return current;
  if (!current || next.getTime() > current.getTime()) return next;
  return current;
}

export async function stepsForFacilities(
  facilities: LeadStepFacility[],
  now: Date = new Date()
): Promise<Map<string, LeadStep>> {
  const result = new Map<string, LeadStep>();
  if (facilities.length === 0) return result;

  const ids = facilities.map((facility) => facility.id);
  const [audits, activity, drips, enrollments] = await Promise.all([
    db.audits.findMany({
      where: { facility_id: { in: ids } },
      select: { facility_id: true, created_at: true },
      orderBy: { created_at: "asc" },
    }),
    db.activity_log.findMany({
      where: {
        facility_id: { in: ids },
        type: { in: ["call_booked", "audit_delivery_failed"] },
      },
      select: { facility_id: true, type: true, created_at: true },
      orderBy: { created_at: "asc" },
    }),
    db.drip_sequences.findMany({
      where: { facility_id: { in: ids } },
      select: {
        facility_id: true,
        sequence_id: true,
        current_step: true,
        status: true,
        next_send_at: true,
        enrolled_at: true,
      },
    }),
    db.nurture_enrollments.findMany({
      where: { facility_id: { in: ids } },
      select: {
        facility_id: true,
        current_step: true,
        status: true,
        next_send_at: true,
        enrolled_at: true,
        nurture_sequences: { select: { name: true, steps: true } },
      },
    }),
  ]);

  const auditAt = new Map<string, Date>();
  for (const row of audits) {
    if (!row.facility_id || !row.created_at) continue;
    auditAt.set(row.facility_id, earliest(auditAt.get(row.facility_id) ?? null, row.created_at) as Date);
  }

  const bookedAt = new Map<string, Date>();
  const failedAt = new Map<string, Date>();
  for (const row of activity) {
    if (!row.facility_id || !row.created_at) continue;
    if (row.type === "call_booked") {
      bookedAt.set(row.facility_id, earliest(bookedAt.get(row.facility_id) ?? null, row.created_at) as Date);
    } else if (row.type === "audit_delivery_failed") {
      failedAt.set(row.facility_id, latest(failedAt.get(row.facility_id) ?? null, row.created_at) as Date);
    }
  }

  const nurtureByFacility = new Map<string, NurtureInput[]>();
  const push = (facilityId: string, row: NurtureInput) => {
    const list = nurtureByFacility.get(facilityId) ?? [];
    list.push(row);
    nurtureByFacility.set(facilityId, list);
  };

  for (const drip of drips as DripRow[]) {
    const template = SEQUENCES[drip.sequence_id];
    push(drip.facility_id, {
      engine: "drip",
      sequenceName: template?.name || drip.sequence_id,
      currentStep: drip.current_step,
      stepCount: template?.steps.length ?? 0,
      status: drip.status,
      nextSendAt: drip.next_send_at,
      enrolledAt: drip.enrolled_at,
    });
  }

  for (const enrollment of enrollments as EnrollmentRow[]) {
    push(enrollment.facility_id, {
      engine: "nurture",
      sequenceName: enrollment.nurture_sequences?.name || "Untitled sequence",
      currentStep: enrollment.current_step,
      stepCount: countJsonSteps(enrollment.nurture_sequences?.steps),
      status: enrollment.status,
      nextSendAt: enrollment.next_send_at,
      enrolledAt: enrollment.enrolled_at,
    });
  }

  for (const facility of facilities) {
    const selected = selectNurture(nurtureByFacility.get(facility.id) ?? []);
    const input: LeadStepInput = {
      contactName: facility.contact_name,
      contactEmail: facility.contact_email,
      contactPhone: facility.contact_phone,
      intakeAnswers: facility.intake_answers,
      pipelineStatus: facility.pipeline_status,
      sharedAuditSlug: facility.shared_audit_slug,
      auditSentAt: facility.audit_sent_at,
      auditDeliveryError: facility.audit_delivery_error,
      auditCreatedAt: auditAt.get(facility.id) ?? null,
      deliveryFailedAt: failedAt.get(facility.id) ?? null,
      callBookedAt: bookedAt.get(facility.id) ?? null,
      createdAt: facility.created_at,
      notes: facility.notes,
      sortLast: facility.sort_last,
      nurture: selected.shown,
      nurtureMore: selected.more,
    };
    result.set(facility.id, deriveLeadStep(input, now));
  }

  return result;
}
