import { demoRows } from "./demo-rows";
import { DEMO_FACILITY_ID } from "./demo-rows";

/**
 * Sample campaigns for /portal?demo. Reads and writes stay in the tab.
 * A stored graph wins; otherwise the campaign is drawn from its ad, page
 * and follow-up, the same way a real funnel with no graph is.
 */

const STORE = "sa-demo-funnels";

export interface DemoFunnel {
  id: string;
  name: string;
  status: string;
  archetype: string | null;
  facility_id: string;
  config: Record<string, unknown>;
  created_at: string;
  published_at: string | null;
  ad_variations: { id: string; platform: string; angle: string | null; status: string }[];
  landing_pages: { id: string; slug: string; status: string; title: string }[];
  drip_sequence_templates: { id: string; name: string; sequence_type: string; steps: unknown }[];
  _count: { partial_leads: number };
}

function seed(now: Date): DemoFunnel[] {
  const rows = demoRows(now);
  return rows.campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    archetype: c.archetype,
    facility_id: DEMO_FACILITY_ID,
    config: {},
    created_at: c.createdAt,
    published_at: c.publishedAt,
    ad_variations: rows.ads
      .filter((a) => a.funnelId === c.id)
      .map((a) => ({ id: a.id, platform: a.platform, angle: a.angle, status: a.status ?? "draft" })),
    landing_pages: rows.pages
      .filter((p) => p.funnelId === c.id)
      .map((p) => ({ id: p.id, slug: p.slug, status: p.status, title: p.title })),
    drip_sequence_templates: [
      {
        id: `${c.id}-follow`,
        name: `${c.name} — follow-up`,
        sequence_type: "post_conversion",
        steps: [{}, {}, {}],
      },
    ],
    _count: { partial_leads: c.name.includes("Fall") ? 5 : 2 },
  }));
}

export function readDemoFunnels(now = new Date()): DemoFunnel[] {
  if (typeof sessionStorage === "undefined") return seed(now);
  try {
    const raw = sessionStorage.getItem(STORE);
    if (raw) return JSON.parse(raw) as DemoFunnel[];
  } catch {
    /* fall through to the seed */
  }
  const rows = seed(now);
  try {
    sessionStorage.setItem(STORE, JSON.stringify(rows));
  } catch {
    /* the seed still answers this request */
  }
  return rows;
}

function write(rows: DemoFunnel[]) {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(rows));
  } catch {
    /* the response still reflects the edit for this call */
  }
}

export function demoFunnelsAnswer(
  url: URL,
  method: string,
  rawBody: string | undefined,
  now = new Date(),
): { status: number; body: unknown } {
  const rows = readDemoFunnels(now);
  const id = url.searchParams.get("id");

  if (method === "GET" && id) {
    const row = rows.find((r) => r.id === id);
    return row ? { status: 200, body: row } : { status: 404, body: { error: "Funnel not found" } };
  }

  if (method === "GET") {
    return { status: 200, body: rows };
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return { status: 400, body: { error: "Bad JSON" } };
  }

  if (method === "POST") {
    const name = typeof parsed.name === "string" ? parsed.name : "New campaign";
    const config = parsed.config && typeof parsed.config === "object" ? (parsed.config as Record<string, unknown>) : {};
    const row: DemoFunnel = {
      id: `demo-${Date.now()}`,
      name,
      status: "draft",
      archetype: "custom",
      facility_id: DEMO_FACILITY_ID,
      config,
      created_at: now.toISOString(),
      published_at: null,
      ad_variations: [],
      landing_pages: [],
      drip_sequence_templates: [],
      _count: { partial_leads: 0 },
    };
    write([row, ...rows]);
    return { status: 201, body: row };
  }

  if (method === "PATCH") {
    const patchId = typeof parsed.id === "string" ? parsed.id : "";
    const idx = rows.findIndex((r) => r.id === patchId);
    if (idx < 0) return { status: 404, body: { error: "Funnel not found" } };
    const current = rows[idx];
    const next = { ...current };
    if (parsed.graph && typeof parsed.graph === "object") {
      next.config = { ...current.config, graph: parsed.graph };
    }
    if (parsed.config && typeof parsed.config === "object") {
      next.config = parsed.config as Record<string, unknown>;
    }
    if (typeof parsed.name === "string") next.name = parsed.name;
    rows[idx] = next;
    write(rows);
    return { status: 200, body: next };
  }

  return { status: 403, body: { error: "The sample portal doesn't save changes. Sign in to your own portal to make them." } };
}
