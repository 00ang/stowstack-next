import { db } from "@/lib/db";
import { summarize, type TouchRecord } from "./touch";
import { agrees, heardFromWalkin, heardLabel, readHeard } from "./heard";
import { summarise, wayOf, type LedgerRow, type LedgerSummary, type Verdict } from "./ledger-rows";

export * from "./ledger-rows";

/**
 * The move-in ledger: one row per move-in, with every piece of evidence we
 * hold about where it came from, and nothing modelled. When we don't know,
 * the row says so.
 *
 *   visit  the last non-direct visit before the move-in (else the first), from
 *          the lead's own touches, or the UTMs it arrived with
 *   lead   when they asked and how fast they were answered
 *   match  how the lead was tied to the tenant, or the candidates when unsure
 *   said   what they told us: the one-tap answer, or the office's walk-in form
 *
 * The cost per move-in a report shows is the sum of these rows, so the owner
 * can check it line by line.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;

function dateOnly(d: Date | string | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
}

function normUnit(u: string | null | undefined): string {
  return (u ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function lastName(n: string | null | undefined): string {
  const parts = (n ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export async function buildLedger(facilityId: string, days: number): Promise<{ rows: LedgerRow[]; summary: LedgerSummary }> {
  const since = new Date(Date.now() - days * DAY);
  const tenants = await db.tenants.findMany({
    where: { facility_id: facilityId, deleted_at: null, move_in_date: { gte: since } },
    select: { id: true, name: true, unit_number: true, unit_size: true, move_in_date: true, metadata: true },
    orderBy: { move_in_date: "desc" },
    take: 500,
  });
  const tenantIds = tenants.map((t) => t.id);
  if (!tenantIds.length) return { rows: [], summary: summarise([]) };

  const [leads, attempts, walkins] = await Promise.all([
    db.partial_leads.findMany({
      where: { matched_tenant_id: { in: tenantIds }, deleted_at: null },
      select: {
        id: true,
        matched_tenant_id: true,
        created_at: true,
        first_response_at: true,
        funnel_id: true,
        utm_source: true,
        utm_medium: true,
        utm_campaign: true,
      },
    }),
    db.lead_match_attempts.findMany({
      where: { tenant_id: { in: tenantIds } },
      select: { id: true, tenant_id: true, status: true, match_method: true, confidence: true, candidates: true, attempted_at: true },
      orderBy: { attempted_at: "desc" },
    }),
    db.activity_log.findMany({
      where: { facility_id: facilityId, type: "walkin_attribution", created_at: { gte: new Date(since.getTime() - 14 * DAY) } },
      select: { created_at: true, meta: true },
      take: 1000,
    }),
  ]);

  const leadIds = leads.map((l) => l.id);
  const touches = leadIds.length
    ? await db.touches.findMany({
        where: { partial_lead_id: { in: leadIds } },
        select: { partial_lead_id: true, channel: true, source: true, utm_campaign: true, occurred_at: true, kind: true },
        orderBy: { occurred_at: "asc" },
      })
    : [];

  const funnelIds = new Set<string>();
  for (const l of leads) {
    if (l.funnel_id) funnelIds.add(l.funnel_id);
    if (l.utm_campaign && UUID.test(l.utm_campaign)) funnelIds.add(l.utm_campaign);
  }
  for (const t of touches) if (t.utm_campaign && UUID.test(t.utm_campaign)) funnelIds.add(t.utm_campaign);
  const funnels = funnelIds.size
    ? await db.funnels.findMany({ where: { id: { in: [...funnelIds] }, facility_id: facilityId }, select: { id: true, name: true } })
    : [];
  const funnelName = new Map(funnels.map((f) => [f.id, f.name]));

  const leadOf = new Map(leads.map((l) => [l.matched_tenant_id!, l]));
  const attemptOf = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!attemptOf.has(a.tenant_id)) attemptOf.set(a.tenant_id, a);
  const touchesOf = new Map<string, TouchRecord[]>();
  for (const t of touches) {
    const list = touchesOf.get(t.partial_lead_id!) ?? [];
    list.push(t as unknown as TouchRecord);
    touchesOf.set(t.partial_lead_id!, list);
  }

  const rows: LedgerRow[] = tenants.map((t) => {
    const moveIn = new Date(t.move_in_date);
    const lead = leadOf.get(t.id) ?? null;

    // The visit: the lead's own trail, else the UTMs it came in with.
    let visit: LedgerRow["visit"] = null;
    if (lead) {
      const sum = summarize(touchesOf.get(lead.id) ?? [], moveIn);
      const pick = sum.latestNonDirect ?? sum.first;
      if (pick) {
        const campaignKey = pick.utm_campaign ?? lead.utm_campaign ?? lead.funnel_id;
        visit = {
          way: wayOf(pick.channel, pick.source ?? null),
          channel: pick.channel,
          source: pick.source ?? null,
          campaign: campaignKey ? funnelName.get(campaignKey) ?? null : null,
          at: pick.occurred_at.toISOString(),
        };
      } else if (lead.utm_source) {
        const src = lead.utm_source.toLowerCase();
        const medium = (lead.utm_medium ?? "").toLowerCase();
        const channel =
          src === "facebook" || src === "instagram" || src === "meta"
            ? "paid_social"
            : src === "google"
              ? medium === "organic"
                ? "organic_search"
                : "paid_search"
              : medium === "email"
                ? "email"
                : "referral";
        visit = {
          way: wayOf(channel, src === "facebook" || src === "instagram" ? "meta" : src),
          channel,
          source: src,
          campaign: funnelName.get(lead.utm_campaign ?? "") ?? (lead.funnel_id ? funnelName.get(lead.funnel_id) ?? null : null),
          at: lead.created_at.toISOString(),
        };
      }
    }

    const attempt = attemptOf.get(t.id) ?? null;
    const candidates = (Array.isArray(attempt?.candidates) ? attempt!.candidates : []) as {
      partial_lead_id?: string;
      name?: string | null;
      created_at?: string | null;
      match_method?: string;
    }[];
    const status: LedgerRow["match"]["status"] = lead
      ? "matched"
      : ((attempt?.status as LedgerRow["match"]["status"]) ?? "none");

    // What they said: the one-tap answer, else the office's walk-in form for this unit or name.
    let said: LedgerRow["said"] = null;
    const heard = readHeard(t.metadata);
    if (heard) said = { ...heard, label: heardLabel(heard.answer) };
    else {
      const unit = normUnit(t.unit_number);
      const last = lastName(t.name);
      const walkin = walkins.find((w) => {
        const m = (w.meta ?? {}) as { unitRented?: string | null; tenantName?: string | null };
        const near = Math.abs(new Date(w.created_at ?? 0).getTime() - moveIn.getTime()) <= 14 * DAY;
        const sameUnit = unit && normUnit(m.unitRented) === unit;
        const sameName = last && lastName(m.tenantName) === last;
        return near && (sameUnit || sameName);
      });
      const source = (walkin?.meta as { source?: string } | null)?.source;
      if (source) {
        const answer = heardFromWalkin(source);
        said = { answer, at: (walkin!.created_at ?? new Date()).toISOString(), via: "counter", label: heardLabel(answer) };
      }
    }

    const traced = status === "matched" && !!visit;
    const verdict: Verdict =
      traced && said ? "both" : traced ? "traced" : status === "ambiguous" ? "unsure" : said ? "said" : "unknown";
    const way = traced ? visit!.way : said ? said.label : status === "ambiguous" ? "Unsure: confirm the lead" : "Not known yet";

    return {
      tenantId: t.id,
      name: t.name,
      unit: t.unit_number || null,
      size: t.unit_size,
      moveInDate: dateOnly(t.move_in_date),
      visit,
      lead: lead
        ? {
            id: lead.id,
            askedAt: lead.created_at.toISOString(),
            answeredInSeconds: lead.first_response_at
              ? Math.max(0, Math.round((lead.first_response_at.getTime() - lead.created_at.getTime()) / 1000))
              : null,
          }
        : null,
      match: {
        status,
        method: lead ? attempt?.match_method ?? null : attempt?.match_method ?? null,
        confidence: attempt?.confidence ?? null,
        attemptId: attempt?.id ?? null,
        candidates:
          status === "ambiguous"
            ? candidates
                .filter((c) => c.partial_lead_id)
                .map((c) => ({ leadId: c.partial_lead_id!, name: c.name ?? null, askedAt: c.created_at ?? null, method: c.match_method ?? "" }))
            : [],
      },
      said,
      agrees: said && visit ? agrees(said.answer, visit.channel, visit.source) : null,
      verdict,
      way,
    };
  });

  return { rows, summary: summarise(rows) };
}
