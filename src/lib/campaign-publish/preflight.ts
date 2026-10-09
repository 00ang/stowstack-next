import { db } from "@/lib/db";
import type { FunnelGraph, NodeType } from "@/lib/funnel-graph";
import { messagingLive } from "@/lib/messaging";

/**
 * Before a publish: what each function will need that isn't there yet, read
 * without changing anything. The dialog shows these first, so the owner can
 * connect an account before pressing Publish instead of after.
 */

export interface Preflight {
  state: "ready" | "needs" | "waiting";
  line?: string;
  fix?: { tool: string; label: string };
}

export interface PreflightFacts {
  address: boolean;
  meta: boolean;
  googleAds: boolean;
  gbp: boolean;
  storedge: boolean;
  googleAccess: boolean;
  texting: boolean;
}

export async function preflightFacts(facilityId: string): Promise<PreflightFacts> {
  const [facility, conns, gbp, storedge] = await Promise.all([
    db.facilities.findUnique({ where: { id: facilityId }, select: { google_address: true } }),
    db.platform_connections.findMany({
      where: { facility_id: facilityId, status: "connected" },
      select: { platform: true },
    }),
    db.gbp_connections.findFirst({ where: { facility_id: facilityId, status: "connected" }, select: { id: true } }),
    db.landing_pages.findFirst({
      where: { facility_id: facilityId, storedge_widget_url: { not: null } },
      select: { id: true },
    }),
  ]);
  return {
    address: !!facility?.google_address?.trim(),
    meta: conns.some((c) => c.platform === "meta"),
    googleAds: conns.some((c) => c.platform === "google_ads"),
    gbp: !!gbp,
    storedge: !!storedge,
    googleAccess: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    texting: messagingLive(),
  };
}

const CONNECT_ADS = { tool: "ad-publisher", label: "Connect in Publish Ads" };
const ADDRESS = { tool: "settings", label: "Add the address" };

/** Pure, so the rules are testable: graph + facts in, one answer per function out. */
export function preflight(graph: FunnelGraph, f: PreflightFacts): Record<string, Preflight> {
  const out: Record<string, Preflight> = {};
  const rule: Partial<Record<NodeType, (src: string) => Preflight>> = {
    audience: () => (f.address ? ready() : needs("Needs the facility's street address so ads run near it.", ADDRESS)),
    meta: () =>
      !f.meta
        ? needs("Connect Meta first. The ad is made paused.", CONNECT_ADS)
        : !f.address
          ? needs("Needs the facility's street address.", ADDRESS)
          : ready(),
    google: () =>
      !f.googleAds
        ? needs("Connect Google Ads first. The ad is made paused.", CONNECT_ADS)
        : !f.address
          ? needs("Needs the facility's street address.", ADDRESS)
          : !f.googleAccess
            ? waiting("The search ad is written now; making it in Google Ads switches on once StorageAds' access is approved.")
            : ready(),
    gbp: () => (f.gbp ? ready() : needs("Connect your Google Business Profile first.", { tool: "gbp", label: "Connect Google" })),
    reserve: (src) =>
      src === "hold"
        ? waiting("Holding from the page isn't built yet; leads still come in.")
        : f.storedge
          ? ready()
          : needs("The page needs your storEDGE reservation link.", { tool: "landing-pages", label: "Add the link" }),
    textback: () => (f.texting ? ready() : waiting("Texts start once your texting number is registered; leads come by email until then.")),
    follow: () => (f.texting ? ready() : waiting("Emails go out now; texts start once your texting number is registered.")),
    missed: () => waiting("Needs a call-tracking number, which StorageAds sets up."),
    waitlist: () => waiting("The waitlist form isn't on landing pages yet."),
  };
  for (const n of graph.nodes) {
    const r = rule[n.type];
    const src = typeof n.params.src === "string" ? n.params.src : "";
    out[n.id] = r ? r(src) : ready();
  }
  return out;
}

function ready(): Preflight {
  return { state: "ready" };
}
function needs(line: string, fix?: Preflight["fix"]): Preflight {
  return { state: "needs", line, fix };
}
function waiting(line: string): Preflight {
  return { state: "waiting", line };
}
