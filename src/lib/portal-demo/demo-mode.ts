import type { ClientData, PortalSession } from "@/lib/portal-helpers";
import { buildOntology } from "@/lib/ontology/build";
import { DEMO_FACILITY_ID, demoRows } from "./demo-rows";

/**
 * The sample portal: /portal?demo opens the whole client portal on an invented
 * facility, with no account, no login and no database. Every /api/ call the
 * portal makes is answered in the browser from the rows in demo-rows.ts; the
 * real API is never reached. Writes are refused politely, so nothing anyone
 * does in the sample can touch real data.
 *
 * The flag lives in sessionStorage: it lasts for the tab and never displaces a
 * real portal session sitting in localStorage.
 */

const FLAG = "storageads_portal_demo";
const DAY = 86_400_000;

export const DEMO_EMAIL = "sample@storageads.com";

export const DEMO_CLIENT: ClientData = {
  facilityId: DEMO_FACILITY_ID,
  email: DEMO_EMAIL,
  name: "Jordan Avery",
  facilityName: "Maple Street Storage",
  location: "Springfield",
  occupancyRange: "80-85%",
  totalUnits: 322,
  signedAt: new Date(Date.now() - 120 * DAY).toISOString(),
  accessCode: "demo",
  monthlyGoal: 8,
  accountManager: { name: "Sam Ellery", email: DEMO_EMAIL, phone: null, initial: "S" },
};

export function isPortalDemo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function demoSession(): PortalSession {
  return { email: DEMO_EMAIL, accessCode: "demo", loginAt: Date.now() };
}

/**
 * Call before the portal reads its session. Turns the sample on when the URL
 * asks for it (?demo), and installs the in-browser API when it is on. Safe in
 * a render: it touches only sessionStorage and window.fetch, never the router.
 */
export function bootPortalDemo(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.has("demo")) {
    try {
      sessionStorage.setItem(FLAG, "1");
    } catch {
      /* private mode: the sample still runs for this page view */
    }
    installDemoFetch();
    return true;
  }
  if (isPortalDemo()) {
    installDemoFetch();
    return true;
  }
  return false;
}

/** Drop ?demo from the address bar. Call from an effect, never during render. */
export function tidyDemoUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("demo")) return;
  url.searchParams.delete("demo");
  window.history.replaceState(null, "", url.toString());
}

export function exitPortalDemo() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* nothing to remove */
  }
}

/* ─── the in-browser API ─── */

let installed = false;

function installDemoFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/") || !isPortalDemo()) {
      return realFetch(input, init);
    }
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const { status, body } = answer(url, method);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
}

type Answer = { status: number; body: unknown };
const ok = (body: unknown): Answer => ({ status: 200, body });

function answer(url: URL, method: string): Answer {
  const path = url.pathname;
  const now = new Date();

  // Reads that change nothing, even though they arrive as POST.
  if (path === "/api/client-data" && method === "POST") return ok({ client: DEMO_CLIENT });
  if (path === "/api/manage/logout") return ok({ ok: true });

  if (method !== "GET") {
    return { status: 403, body: { error: "The sample portal doesn't save changes. Sign in to your own portal to make them." } };
  }

  switch (path) {
    case "/api/portal-ontology":
      return ok(buildOntology(demoRows(now), now));
    case "/api/attribution":
      return ok(attribution(url, now));
    case "/api/client-onboarding":
      return ok({
        onboarding: { accessCode: "demo", updatedAt: iso(now, 100), completedAt: iso(now, 100), steps: {} },
        completionPct: 100,
      });
    case "/api/client-goals":
      return ok({ current: { target: 8, actual: 4, pct: 50 } });
    case "/api/alert-history":
      return ok({
        data: [
          {
            id: "demo-alert-1",
            severity: "warning",
            title: "Climate page is getting visits, not leads",
            message: "96 visits in 30 days and no one has asked about a unit. Worth a look at the offer and the form.",
            created_at: iso(now, 1),
            acknowledged: false,
          },
        ],
      });
    case "/api/client-activity":
      return ok({ data: activity(now) });
    case "/api/client-reports":
      return ok(reports(now));
    case "/api/client-billing":
      return ok({ invoices: invoices(now) });
    case "/api/client-messages":
      return ok({ messages: messages(now) });
    case "/api/portal-gbp":
      return ok(gbp(now));
    case "/api/portal-upload":
      return ok({
        reports: [
          { id: "demo-up-2", file_name: "rent-roll-week-40.csv", file_url: null, file_size: 48211, mime_type: "text/csv", report_type: "rent_roll", status: "processed", notes: null, uploaded_at: iso(now, 3), processed_at: iso(now, 3) },
          { id: "demo-up-1", file_name: "unit-mix.csv", file_url: null, file_size: 9120, mime_type: "text/csv", report_type: "unit_mix", status: "processed", notes: null, uploaded_at: iso(now, 31), processed_at: iso(now, 31) },
        ],
      });
    case "/api/manage/session":
      return ok({
        mode: "portal",
        facilities: [
          {
            id: DEMO_FACILITY_ID,
            name: DEMO_CLIENT.facilityName,
            contact_name: DEMO_CLIENT.name,
            contact_email: DEMO_EMAIL,
            google_address: "100 Maple St, Springfield, IL 62701, USA",
            occupancy_range: DEMO_CLIENT.occupancyRange,
            total_units: String(DEMO_CLIENT.totalUnits),
            google_rating: 4.5,
            review_count: 212,
            videoEnabled: false,
          },
        ],
      });
    default:
      return { status: 404, body: { error: "Not in the sample portal. Sign in to see this with your own data." } };
  }
}

const iso = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString();

/* ─── sample payloads, all relative to now ─── */

function attribution(url: URL, now: Date) {
  const start = url.searchParams.get("startDate") ?? iso(now, 30).slice(0, 10);
  const end = url.searchParams.get("endDate") ?? now.toISOString().slice(0, 10);
  const days = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY));
  const scale = Math.min(days, 120) / 30;
  const row = (campaign: string, spend: number, impressions: number, clicks: number, leads: number, moveIns: number, revenue: number) => {
    const s = Math.round(spend * scale);
    const l = Math.round(leads * scale);
    const m = Math.round(moveIns * scale);
    const r = Math.round(revenue * scale);
    return {
      campaign,
      spend: s,
      impressions: Math.round(impressions * scale),
      clicks: Math.round(clicks * scale),
      leads: l,
      move_ins: m,
      revenue: r,
      cpl: l ? Math.round((s / l) * 100) / 100 : 0,
      cost_per_move_in: m ? Math.round((s / m) * 100) / 100 : 0,
      roas: s ? Math.round((r / s) * 10) / 10 : 0,
    };
  };
  const campaigns = [
    row("Fall Move Season", 1350, 61200, 1480, 5, 2, 3780),
    row("Big Unit Push", 600, 18400, 520, 2, 1, 2390),
    row("Google Search", 740, 9800, 610, 2, 1, 1430),
  ];
  const sum = (k: "spend" | "impressions" | "clicks" | "leads" | "move_ins" | "revenue") => campaigns.reduce((t, c) => t + c[k], 0);
  const totals = {
    spend: sum("spend"),
    impressions: sum("impressions"),
    clicks: sum("clicks"),
    leads: sum("leads"),
    move_ins: sum("move_ins"),
    move_ins_actual: sum("move_ins"),
    revenue: sum("revenue"),
    cpl: 0,
    cost_per_move_in: 0,
    roas: 0,
  };
  totals.cpl = totals.leads ? Math.round((totals.spend / totals.leads) * 100) / 100 : 0;
  totals.cost_per_move_in = totals.move_ins ? Math.round((totals.spend / totals.move_ins) * 100) / 100 : 0;
  totals.roas = totals.spend ? Math.round((totals.revenue / totals.spend) * 10) / 10 : 0;
  const monthlyTrend = [5, 4, 3, 2, 1, 0].map((back, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const spend = 1900 + i * 160;
    const leads = 6 + i;
    const moveIns = 2 + Math.round(i / 2);
    const revenue = moveIns * 1700;
    return {
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      spend,
      leads,
      move_ins: moveIns,
      revenue,
      cpl: Math.round((spend / leads) * 100) / 100,
      roas: Math.round((revenue / spend) * 10) / 10,
    };
  });
  return { campaigns, totals, monthlyTrend, dateRange: { start, end }, hasData: true };
}

function activity(now: Date) {
  return [
    { id: "a1", type: "lead_captured", label: "New lead from Google Ads", detail: "Wants a 10x10", leadName: "Chris Okafor", createdAt: iso(now, 1) },
    { id: "a2", type: "lead_captured", label: "New lead from Meta", detail: "Wants a 10x10, from the fall page", leadName: "Dana Ruiz", createdAt: iso(now, 2) },
    { id: "a3", type: "report_sent", label: "Weekly report sent", detail: "Week 40", leadName: null, createdAt: iso(now, 3) },
    { id: "a4", type: "campaign_added", label: "Campaign started", detail: "Big Unit Push", leadName: null, createdAt: iso(now, 11) },
    { id: "a5", type: "walkin_logged", label: "Walk-in logged", detail: "Asked about parking", leadName: null, createdAt: iso(now, 13) },
    { id: "a6", type: "call_received", label: "Call from a tracking number", detail: "2 min 40 s", leadName: null, createdAt: iso(now, 15) },
  ];
}

function reports(now: Date) {
  const rows = demoRows(now).units;
  const total = rows.reduce((s, u) => s + u.total, 0);
  const occupied = rows.reduce((s, u) => s + u.occupied, 0);
  return {
    occupancy: {
      total_units: total,
      occupied_units: occupied,
      occupancy_pct: Math.round((occupied / total) * 1000) / 10,
      move_ins_mtd: 4,
      move_outs_mtd: 3,
      delinquency_pct: 2.4,
    },
    unitMix: rows.map((u) => ({ type: u.unitType, size: u.sizeLabel ?? u.unitType, total: u.total, occupied: u.occupied, rate: u.webRate ?? 0 })),
    occupancyTrend: [12, 10, 8, 6, 4, 2, 0].map((weeks, i) => ({
      date: iso(now, weeks * 7).slice(0, 10),
      occupancy_pct: Math.round((80.1 + i * 0.6) * 10) / 10,
    })),
    signedAt: DEMO_CLIENT.signedAt,
  };
}

function invoices(now: Date) {
  return [0, 1, 2].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return {
      id: `demo-inv-${back}`,
      month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      amount: 2690,
      adSpend: 2200,
      managementFee: 490,
      status: back === 0 ? "pending" : "paid",
      dueDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15)).toISOString(),
      paidDate: back === 0 ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 12)).toISOString(),
      notes: "",
      createdAt: d.toISOString(),
    };
  });
}

function messages(now: Date) {
  return [
    { id: "m1", from: "admin", text: "The Big Unit Push campaign is live. First reads in a week.", timestamp: iso(now, 11) },
    { id: "m2", from: "client", text: "Great. Can we try something for the climate units too?", timestamp: iso(now, 10) },
    { id: "m3", from: "admin", text: "Yes. There's a page up for them now. We'll write the ad next.", timestamp: iso(now, 9) },
  ];
}

function gbp(now: Date) {
  const reviews = demoRows(now).reviews;
  const answered = reviews.filter((r) => r.hasResponse).length;
  return {
    connected: true,
    locationName: DEMO_CLIENT.facilityName,
    lastSyncAt: iso(now, 0),
    averageRating: 4.5,
    totalReviews: 212,
    responseRate: Math.round((answered / reviews.length) * 100),
    recentReviews: reviews.slice(0, 5).map((r) => ({
      id: r.id,
      authorName: r.author ?? "A customer",
      rating: r.rating,
      text: r.text ?? "",
      reviewTime: r.reviewTime,
      responseStatus: r.hasResponse ? "responded" : "pending",
      hasResponse: r.hasResponse,
    })),
  };
}
