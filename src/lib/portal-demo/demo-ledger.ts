import { summarise, type LedgerRow } from "@/lib/attribution/ledger-rows";
import { demoRows } from "./demo-rows";

/**
 * The move-in ledger in the sample portal, from the sample's own tenants and
 * leads: one traced and confirmed by what they said, two traced, one known
 * only from the counter, and one unsure match to settle. Confirmations and
 * the ask switch stay in this tab.
 */

const STORE = "sa-demo-ledger";
type Answer = { status: number; body: unknown };

interface Kept {
  ask: boolean;
  resolved: Record<string, string | null>;
}

function read(): Kept {
  try {
    return { ask: false, resolved: {}, ...(JSON.parse(sessionStorage.getItem(STORE) ?? "{}") as Partial<Kept>) };
  } catch {
    return { ask: false, resolved: {} };
  }
}

function write(k: Kept) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(k));
  } catch {
    /* the answer still reflects it for this call */
  }
}

function rows(now: Date, kept: Kept): LedgerRow[] {
  const d = demoRows(now);
  const lead = (n: number) => d.leads[n - 1];
  const tenant = (n: number) => d.tenants[n - 1];
  const campaign = d.campaigns[0]?.name ?? "Fall Move Season";
  const at = (iso: string | null | undefined) => iso ?? now.toISOString();
  const answered = (l: (typeof d.leads)[number]) =>
    l.firstResponseAt ? Math.max(1, Math.round((Date.parse(l.firstResponseAt) - Date.parse(l.createdAt)) / 1000)) : null;
  const base = (t: (typeof d.tenants)[number]) => ({
    tenantId: t.id,
    name: t.name,
    unit: t.unitNumber,
    size: t.unitSize,
    moveInDate: t.moveInDate,
  });

  const riley = lead(6);
  const avery = lead(7);
  const devon = lead(11);
  const out: LedgerRow[] = [
    {
      ...base(tenant(4)),
      visit: null,
      lead: null,
      match: { status: "none", method: null, confidence: null, attemptId: null, candidates: [] },
      said: { answer: "drove_by", at: at(tenant(4).moveInDate), via: "counter", label: "Drove by or saw the sign" },
      agrees: null,
      verdict: "said",
      way: "Drove by or saw the sign",
    },
    {
      ...base(tenant(2)),
      visit: { way: "Google ad", channel: "paid_search", source: "google", campaign, at: avery.createdAt },
      lead: { id: avery.id, askedAt: avery.createdAt, answeredInSeconds: answered(avery) },
      match: { status: "matched", method: "phone_exact", confidence: 0.95, attemptId: "demo-attempt-2", candidates: [] },
      said: null,
      agrees: null,
      verdict: "traced",
      way: "Google ad",
    },
    {
      ...base(tenant(1)),
      visit: { way: "Meta ad", channel: "paid_social", source: "meta", campaign, at: riley.createdAt },
      lead: { id: riley.id, askedAt: riley.createdAt, answeredInSeconds: answered(riley) },
      match: { status: "matched", method: "phone_exact", confidence: 0.95, attemptId: "demo-attempt-1", candidates: [] },
      said: { answer: "social", at: at(tenant(1).moveInDate), via: "link", label: "Facebook or Instagram" },
      agrees: true,
      verdict: "both",
      way: "Meta ad",
    },
    {
      ...base(tenant(3)),
      visit: { way: "Google search or Maps", channel: "organic_search", source: "google", campaign: null, at: devon.createdAt },
      lead: { id: devon.id, askedAt: devon.createdAt, answeredInSeconds: answered(devon) },
      match: { status: "matched", method: "email_exact", confidence: 0.9, attemptId: "demo-attempt-3", candidates: [] },
      said: null,
      agrees: null,
      verdict: "traced",
      way: "Google search or Maps",
    },
  ];

  // Robin Marsh: two leads asked about a climate 10x10 that week.
  const robin = tenant(5);
  const settled = kept.resolved[robin.id];
  const candidates = [lead(4), lead(5)].filter(Boolean);
  if (settled === undefined) {
    out.push({
      ...base(robin),
      visit: null,
      lead: null,
      match: {
        status: "ambiguous",
        method: "name_last4_phone",
        confidence: 0.7,
        attemptId: "demo-attempt-5",
        // Both asked the week before the move-in.
        candidates: candidates.map((c, i) => ({
          leadId: c.id,
          name: c.name,
          askedAt: new Date(Date.parse(robin.moveInDate) - (3 + i * 2) * 86_400_000).toISOString(),
          method: "name_last4_phone",
        })),
      },
      said: null,
      agrees: null,
      verdict: "unsure",
      way: "Unsure: confirm the lead",
    });
  } else if (settled) {
    const i = Math.max(0, candidates.findIndex((x) => x.id === settled));
    const c = candidates[i];
    const asked = new Date(Date.parse(robin.moveInDate) - (3 + i * 2) * 86_400_000).toISOString();
    out.push({
      ...base(robin),
      visit: { way: "Meta ad", channel: "paid_social", source: "meta", campaign, at: asked },
      lead: { id: c.id, askedAt: asked, answeredInSeconds: 41 },
      match: { status: "matched", method: "name_last4_phone", confidence: 0.7, attemptId: "demo-attempt-5", candidates: [] },
      said: null,
      agrees: null,
      verdict: "traced",
      way: "Meta ad",
    });
  } else {
    out.push({
      ...base(robin),
      visit: null,
      lead: null,
      match: { status: "rejected", method: null, confidence: null, attemptId: "demo-attempt-5", candidates: [] },
      said: null,
      agrees: null,
      verdict: "unknown",
      way: "Not known yet",
    });
  }
  return out.sort((a, b) => (a.moveInDate < b.moveInDate ? 1 : -1));
}

export function demoLedgerAnswer(url: URL, method: string, raw: string | undefined, now: Date): Answer {
  const kept = read();
  if (method === "GET") {
    if (url.searchParams.get("format") === "csv") {
      return { status: 403, body: { error: "The sample doesn't export. Sign in to export your own move-ins." } };
    }
    const r = rows(now, kept);
    return { status: 200, body: { rows: r, summary: summarise(r), days: 90, heardAsk: kept.ask } };
  }
  let body: { action?: string; on?: boolean; attemptId?: string; leadId?: string } = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return { status: 400, body: { error: "Invalid JSON body" } };
  }
  if (body.action === "ask") {
    write({ ...kept, ask: body.on === true });
    return { status: 200, body: { heardAsk: body.on === true } };
  }
  if ((body.action === "confirm" || body.action === "reject") && body.attemptId === "demo-attempt-5") {
    const robin = demoRows(now).tenants[4];
    write({ ...kept, resolved: { ...kept.resolved, [robin.id]: body.action === "confirm" ? body.leadId ?? null : null } });
    return { status: 200, body: { ok: true } };
  }
  return { status: 409, body: { error: "That match is already settled." } };
}
