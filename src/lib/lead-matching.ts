import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { markLeadAsMatchedTenant } from "@/lib/lead-events";
import { emit } from "@/lib/events/bus";

type DbExecutor = PrismaClient | Prisma.TransactionClient;

export type MatchMethod =
  | "phone_exact"
  | "email_exact"
  | "name_last4_phone"
  | "no_match";

export type MatchStatus = "matched" | "ambiguous" | "no_match";

export interface LeadCandidate {
  partial_lead_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  created_at: Date;
  match_method: MatchMethod;
  confidence: number;
}

export interface MatchResult {
  status: MatchStatus;
  bestCandidate: LeadCandidate | null;
  allCandidates: LeadCandidate[];
  matchMethod: MatchMethod;
  confidence: number;
}

/** Reduce a phone string to its last 10 digits for cross-format matching. */
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-10);
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return String(email).trim().toLowerCase();
}

function lastName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return parts[0]?.toLowerCase() ?? null;
  return parts[parts.length - 1].toLowerCase();
}

interface TenantInput {
  id: string;
  facility_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  move_in_date?: Date | string | null;
  /** Carried onto the `lead.moved_in` event for the operator view; the write-back reloads it. */
  monthly_rate?: number | string | null;
}

/**
 * Find candidate partial_leads that could be this tenant's pre-move-in inquiry.
 * Looks back 90 days from the tenant's move_in_date (or NOW() if no date).
 *
 * Returns matches ordered by confidence. Caller decides what to do based on
 * status:
 *   - "matched" — exactly one high-confidence candidate, safe to auto-link
 *   - "ambiguous" — multiple candidates, surface to admin review
 *   - "no_match" — nothing within window
 *
 * Roadmap 10 phase 2 (revised). Schema reality check confirms partial_leads
 * already holds the leads data we need.
 */
export async function matchTenantToLeads(
  client: DbExecutor,
  tenant: TenantInput,
): Promise<MatchResult> {
  const phoneNorm = normalizePhone(tenant.phone);
  const emailNorm = normalizeEmail(tenant.email);
  const lastNameNorm = lastName(tenant.name);
  const last4Phone = phoneNorm?.slice(-4);

  const anchorDate = tenant.move_in_date
    ? new Date(String(tenant.move_in_date))
    : new Date();
  const windowStart = new Date(anchorDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - 90);

  const candidates: LeadCandidate[] = [];

  // Strategy 1: exact phone match (confidence 0.95)
  if (phoneNorm) {
    const rows = await client.$queryRaw<
      Array<{ id: string; email: string | null; phone: string | null; name: string | null; created_at: Date }>
    >`
      SELECT id, email, phone, name, created_at
      FROM partial_leads
      WHERE facility_id = ${tenant.facility_id}::uuid
        AND deleted_at IS NULL
        AND matched_tenant_id IS NULL
        AND created_at >= ${windowStart.toISOString()}::timestamptz
        AND phone IS NOT NULL
        AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ${phoneNorm}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    for (const r of rows) {
      candidates.push({
        partial_lead_id: r.id,
        email: r.email,
        phone: r.phone,
        name: r.name,
        created_at: r.created_at,
        match_method: "phone_exact",
        confidence: 0.95,
      });
    }
  }

  // Strategy 2: exact email match (confidence 0.9)
  if (emailNorm) {
    const rows = await client.$queryRaw<
      Array<{ id: string; email: string | null; phone: string | null; name: string | null; created_at: Date }>
    >`
      SELECT id, email, phone, name, created_at
      FROM partial_leads
      WHERE facility_id = ${tenant.facility_id}::uuid
        AND deleted_at IS NULL
        AND matched_tenant_id IS NULL
        AND created_at >= ${windowStart.toISOString()}::timestamptz
        AND email IS NOT NULL
        AND LOWER(email) = ${emailNorm}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    for (const r of rows) {
      if (candidates.some((c) => c.partial_lead_id === r.id)) continue;
      candidates.push({
        partial_lead_id: r.id,
        email: r.email,
        phone: r.phone,
        name: r.name,
        created_at: r.created_at,
        match_method: "email_exact",
        confidence: 0.9,
      });
    }
  }

  // Strategy 3: last name + last 4 of phone (confidence 0.7)
  if (lastNameNorm && last4Phone) {
    const rows = await client.$queryRaw<
      Array<{ id: string; email: string | null; phone: string | null; name: string | null; created_at: Date }>
    >`
      SELECT id, email, phone, name, created_at
      FROM partial_leads
      WHERE facility_id = ${tenant.facility_id}::uuid
        AND deleted_at IS NULL
        AND matched_tenant_id IS NULL
        AND created_at >= ${windowStart.toISOString()}::timestamptz
        AND name IS NOT NULL
        AND phone IS NOT NULL
        AND LOWER(name) LIKE ${"%" + lastNameNorm + "%"}
        AND RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 4) = ${last4Phone}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    for (const r of rows) {
      if (candidates.some((c) => c.partial_lead_id === r.id)) continue;
      candidates.push({
        partial_lead_id: r.id,
        email: r.email,
        phone: r.phone,
        name: r.name,
        created_at: r.created_at,
        match_method: "name_last4_phone",
        confidence: 0.7,
      });
    }
  }

  if (candidates.length === 0) {
    return {
      status: "no_match",
      bestCandidate: null,
      allCandidates: [],
      matchMethod: "no_match",
      confidence: 0,
    };
  }

  // Sort by confidence descending, then most recent
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.created_at.getTime() - a.created_at.getTime();
  });

  const best = candidates[0];
  // If multiple high-confidence (≥0.85) candidates, that's ambiguous
  const highConfidenceCount = candidates.filter((c) => c.confidence >= 0.85).length;
  const status: MatchStatus =
    highConfidenceCount > 1
      ? "ambiguous"
      : best.confidence >= 0.85
        ? "matched"
        : "ambiguous";

  return {
    status,
    bestCandidate: best,
    allCandidates: candidates,
    matchMethod: best.match_method,
    confidence: best.confidence,
  };
}

export interface AttemptMatchResult extends MatchResult {
  attemptId: string;
  linked: boolean;
}

/**
 * Run matching and persist the audit log row. If status is "matched", also
 * link the partial_lead to the tenant via markLeadAsMatchedTenant (which emits
 * a "moved_in" status event).
 */
export async function attemptAndPersistLeadMatch(
  client: DbExecutor,
  tenant: TenantInput,
  opts: { changedBy?: string } = {},
): Promise<AttemptMatchResult> {
  const result = await matchTenantToLeads(client, tenant);

  const rows = await client.$queryRaw<Array<{ id: string }>>`
    INSERT INTO lead_match_attempts
      (tenant_id, partial_lead_id, facility_id, match_method, confidence, status, candidates)
    VALUES
      (${tenant.id}::uuid,
       ${result.bestCandidate?.partial_lead_id ?? null}::uuid,
       ${tenant.facility_id}::uuid,
       ${result.matchMethod},
       ${result.confidence},
       ${result.status},
       ${JSON.stringify(result.allCandidates)}::jsonb)
    RETURNING id
  `;

  let linked = false;
  if (result.status === "matched" && result.bestCandidate) {
    try {
      await markLeadAsMatchedTenant(
        client,
        result.bestCandidate.partial_lead_id,
        tenant.id,
        { changedBy: opts.changedBy ?? "system:pms_import" },
      );
      linked = true;
    } catch {
      // Linking failure is non-fatal; the attempt is still logged.
    }
  }

  // MISSION.md s12 — a confident match is a move-in we can trace, so tell the
  // ad platforms (the subscribers to `lead.moved_in` do the reporting). Only
  // "matched" gets here: an ambiguous match reports nothing until a person
  // resolves it. Emitted after the link through the shared client; if a caller
  // ever runs this inside a transaction, move the emit to after the commit.
  if (linked && result.bestCandidate) {
    try {
      await emitLeadMovedIn(tenant, result.bestCandidate, result.matchMethod, result.confidence);
    } catch (err) {
      console.error("[lead-matching] lead.moved_in emit failed:", err instanceof Error ? err.message : err);
    }
  }

  return {
    ...result,
    attemptId: rows[0].id,
    linked,
  };
}

async function emitLeadMovedIn(
  tenant: TenantInput,
  candidate: LeadCandidate,
  matchMethod: MatchMethod,
  confidence: number,
): Promise<void> {
  const moveIn = tenant.move_in_date ? new Date(tenant.move_in_date) : null;
  const occurredAt = moveIn && !Number.isNaN(moveIn.getTime()) ? moveIn : new Date();
  await emit(
    [
      {
        type: "lead.moved_in",
        // The fact is "this tenant moved in". Re-importing the same tenant, or
        // re-running the match, emits nothing new — so nothing reports twice.
        sourceKey: `tenant:${tenant.id}`,
        occurredAt: occurredAt.toISOString(),
        payload: {
          facilityId: tenant.facility_id,
          leadId: candidate.partial_lead_id,
          tenantId: tenant.id,
          moveInDate: moveIn && !Number.isNaN(moveIn.getTime()) ? moveIn.toISOString().slice(0, 10) : null,
          monthlyRate: tenant.monthly_rate == null || tenant.monthly_rate === "" ? null : Number(tenant.monthly_rate),
          matchMethod,
          confidence,
        },
      },
    ],
    tenant.facility_id,
  );
}

