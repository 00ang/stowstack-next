import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { selfBaseUrl } from "@/lib/self-url";
import { signToken, verifyToken } from "@/lib/signed-token";
import { HEARD_TRIGGER, heardSequenceSteps, type Heard, type HeardAnswer } from "./heard";

/**
 * Asking a new tenant how they found the facility.
 *
 * It rides the nurture system: a facility that switches it on gets one
 * sequence (trigger "move_in_heard") with one email, and each new tenant with
 * an email is enrolled once. The link in it is signed per tenant, so the
 * answer needs no login. Off until the owner switches it on; the owner can see
 * and pause it like any other sequence.
 */

const PURPOSE = "heard";
/** A move-in this recent is asked; anything older is history, not a new tenant. */
const RECENT_DAYS = 30;
const LINK_DAYS = 60;

export function heardLink(tenantId: string, facilityId: string): string {
  const t = signToken(PURPOSE, { tid: tenantId, fid: facilityId }, LINK_DAYS * 86_400_000);
  return `${selfBaseUrl()}/heard?t=${encodeURIComponent(t)}`;
}

export function readHeardToken(token: string | null | undefined): { tenantId: string; facilityId: string } | null {
  const body = verifyToken<{ tid?: unknown; fid?: unknown }>(PURPOSE, token);
  if (!body || typeof body.tid !== "string" || typeof body.fid !== "string") return null;
  return { tenantId: body.tid, facilityId: body.fid };
}

export async function heardAskOn(facilityId: string): Promise<boolean> {
  const seq = await db.nurture_sequences.findFirst({
    where: { facility_id: facilityId, trigger_type: HEARD_TRIGGER },
    select: { status: true },
  });
  return seq?.status === "active";
}

/** Switch the ask on or off for a facility. */
export async function setHeardAsk(facilityId: string, on: boolean): Promise<void> {
  const existing = await db.nurture_sequences.findFirst({
    where: { facility_id: facilityId, trigger_type: HEARD_TRIGGER },
    select: { id: true },
  });
  const data = {
    name: "How did you find us?",
    steps: heardSequenceSteps() as unknown as Prisma.InputJsonValue,
    status: on ? "active" : "paused",
  };
  if (existing) await db.nurture_sequences.update({ where: { id: existing.id }, data });
  else if (on) await db.nurture_sequences.create({ data: { ...data, facility_id: facilityId, trigger_type: HEARD_TRIGGER } });
}

/**
 * Enrol a new tenant in the ask, once, when the facility has it on and the
 * tenant has an email. Never throws: a move-in import must not fail over it.
 */
export async function askHowTheyHeard(tenant: {
  id: string;
  facility_id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  move_in_date?: Date | string | null;
}): Promise<boolean> {
  try {
    if (!tenant.email) return false;
    // Only someone who just moved in. A re-import of long-standing tenants must
    // never email them a "welcome".
    const moved = tenant.move_in_date ? new Date(tenant.move_in_date).getTime() : NaN;
    if (!Number.isFinite(moved) || moved > Date.now() + 86_400_000 || Date.now() - moved > RECENT_DAYS * 86_400_000) return false;
    const seq = await db.nurture_sequences.findFirst({
      where: { facility_id: tenant.facility_id, trigger_type: HEARD_TRIGGER, status: "active" },
      select: { id: true, steps: true },
    });
    if (!seq) return false;
    const already = await db.nurture_enrollments.findFirst({
      where: { sequence_id: seq.id, tenant_id: tenant.id },
      select: { id: true },
    });
    if (already) return true;
    const first = ((seq.steps as { delay_minutes?: number }[] | null) ?? [])[0]?.delay_minutes ?? 24 * 60;
    await db.nurture_enrollments.create({
      data: {
        sequence_id: seq.id,
        facility_id: tenant.facility_id,
        tenant_id: tenant.id,
        contact_name: tenant.name,
        contact_email: tenant.email,
        contact_phone: tenant.phone ?? null,
        next_send_at: new Date(Date.now() + first * 60_000),
        metadata: { heard_link: heardLink(tenant.id, tenant.facility_id) },
      },
    });
    return true;
  } catch (err) {
    console.error("[heard-ask] enrolment failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** Record an answer on the tenant, keeping the rest of its metadata. */
export async function recordHeard(tenantId: string, answer: HeardAnswer, via: Heard["via"]): Promise<void> {
  const heard: Heard = { answer, at: new Date().toISOString(), via };
  await db.$executeRaw`
    UPDATE tenants
    SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('heardFrom', ${JSON.stringify(heard)}::jsonb),
        updated_at = now()
    WHERE id = ${tenantId}::uuid
  `;
}
