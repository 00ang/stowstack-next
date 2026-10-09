"use client";

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Lock,
  LayoutDashboard,
  Palette,
  Sparkles,
  Send,
  Search,
  Music2,
  Film,
  Image as ImageIcon,
  GitBranch,
  FileText,
  Link2,
  Globe,
  Share2,
  Mail,
  Building2,
  Map,
  BarChart3,
  Users,
  Phone,
  Library,
} from "lucide-react";
import type { FacilityProp } from "@/components/admin/facility-tabs/facility-overview/types";
import { useOntology } from "@/components/ontology/use-ontology";
import { FocusBar, ToolFocusProvider } from "@/components/ontology/tool-focus";
import { useFlow } from "@/components/flow/flow-context";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import type { ToolKey } from "@/lib/ontology/types";
import { buildTrack, ensureStation, trackChoices } from "@/lib/tools-track/build";
import { ToolsTrack } from "@/components/owner-tools/tools-track";

/**
 * The facility tools, for owners: the same components the admin facility
 * manager uses, run under the owner's manage session. Rendered inside the
 * client portal (/portal/tools) and the partner dashboard (/partner/tools);
 * both mint the session (an httpOnly cookie) at login, so this component only
 * reads it back via /api/manage/session.
 *
 * The tool components take an `adminKey` prop; passing "" puts them in owner
 * mode, where same-origin fetches carry the cookie and every API call is
 * checked against the session's facility scope (requireFacilityAccess).
 */

const FacilityOverview = lazy(() => import("@/components/admin/facility-tabs/facility-overview"));
const CreativeStudio = lazy(() => import("@/components/admin/facility-tabs/creative-studio"));
const AdStudio = lazy(() => import("@/components/admin/facility-tabs/ad-studio"));
const AdPublisher = lazy(() => import("@/components/admin/facility-tabs/ad-publisher"));
const MediaLibrary = lazy(() => import("@/components/admin/facility-tabs/media-library"));
const GoogleAdsLab = lazy(() => import("@/components/admin/facility-tabs/google-ads-lab"));
const TikTokCreator = lazy(() => import("@/components/admin/facility-tabs/tiktok-creator"));
const VideoGenerator = lazy(() => import("@/components/admin/facility-tabs/video-generator"));
const LandingPageBuilder = lazy(() => import("@/components/admin/facility-tabs/landing-page-builder"));
const UTMLinks = lazy(() => import("@/components/admin/facility-tabs/utm-links"));
const GBPFull = lazy(() => import("@/components/admin/facility-tabs/gbp-full"));
const SocialCommandCenter = lazy(() => import("@/components/admin/facility-tabs/social-command-center"));
const LeadNurtureEngine = lazy(() => import("@/components/admin/facility-tabs/lead-nurture-engine"));
const OccupancyIntelligence = lazy(() => import("@/components/admin/facility-tabs/occupancy-intelligence"));
const MarketIntelligence = lazy(() => import("@/components/admin/facility-tabs/market-intelligence"));
const RevenueAnalytics = lazy(() => import("@/components/admin/facility-tabs/revenue-analytics"));
const TenantManagement = lazy(() => import("@/components/admin/facility-tabs/tenant-management"));
const PmsDashboard = lazy(() => import("@/components/admin/facility-tabs/pms-dashboard"));
const CallTracking = lazy(() => import("@/components/admin/facility-tabs/call-tracking"));
const FacilityFunnels = lazy(() => import("@/components/admin/facility-tabs/facility-funnels"));
const ProvenAdsLibrary = lazy(() =>
  import("@/components/proven-ads/proven-ads-library").then((m) => ({ default: m.ProvenAdsLibrary }))
);

export type ToolFacility = FacilityProp & { videoEnabled: boolean };

type Tool = { key: string; label: string; icon: ComponentType<{ className?: string }> };
type ToolGroup = { title: string | null; tools: Tool[] };

export const TOOL_GROUPS: ToolGroup[] = [
  { title: null, tools: [{ key: "overview", label: "Overview", icon: LayoutDashboard }] },
  {
    title: "Ads",
    tools: [
      { key: "proven-ads", label: "Proven Ads", icon: Library },
      { key: "creative-studio", label: "Creative Studio", icon: Palette },
      { key: "ad-studio", label: "Ad Generator", icon: Sparkles },
      { key: "ad-publisher", label: "Publish Ads", icon: Send },
      { key: "google-ads", label: "Google Ads", icon: Search },
      { key: "tiktok", label: "TikTok Creator", icon: Music2 },
      { key: "video", label: "Video Ads", icon: Film },
      { key: "media-library", label: "Media Library", icon: ImageIcon },
    ],
  },
  {
    title: "Marketing",
    tools: [
      { key: "funnels", label: "Campaigns", icon: GitBranch },
      { key: "landing-pages", label: "Landing Pages", icon: FileText },
      { key: "utm-links", label: "Tracking Links", icon: Link2 },
      { key: "gbp", label: "Google Business", icon: Globe },
      { key: "social", label: "Social Media", icon: Share2 },
      { key: "lead-nurture", label: "Lead Follow-Up", icon: Mail },
    ],
  },
  {
    title: "Market",
    tools: [
      { key: "occupancy", label: "Occupancy", icon: Building2 },
      { key: "market-intel", label: "Competitors", icon: Map },
      { key: "revenue", label: "Revenue", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    tools: [
      { key: "tenants", label: "Tenants", icon: Users },
      { key: "pms", label: "PMS Data", icon: FileText },
      { key: "call-tracking", label: "Call Tracking", icon: Phone },
    ],
  },
];

const TOOL_KEYS = new Set(TOOL_GROUPS.flatMap((g) => g.tools.map((t) => t.key)));

/** "12 Main St, Columbus, OH 43215, USA" → "OH". */
export function stateOf(address: string | undefined): string | null {
  const m = address?.match(/,\s*([A-Z]{2})\s+\d{5}/);
  return m ? m[1] : null;
}

function ToolContent({
  tool,
  facility,
  onUpdate,
  upgradeHref,
  openTool,
  campaignsHref,
}: {
  tool: string;
  facility: ToolFacility;
  onUpdate: () => void;
  upgradeHref: string;
  openTool: (key: string, params?: Record<string, string>) => void;
  campaignsHref?: string;
}) {
  const adminKey = ""; // owner mode
  const props = { facilityId: facility.id, adminKey, facilityName: facility.name };

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      }
    >
      {tool === "overview" && <FacilityOverview facility={facility} adminKey={adminKey} onUpdate={onUpdate} />}
      {tool === "proven-ads" && (
        <ProvenAdsLibrary
          mode="owner"
          facility={{ id: facility.id, name: facility.name, state: stateOf(facility.google_address) }}
          onOpenDraft={(variationId) => openTool("ad-studio", { variation: variationId })}
        />
      )}
      {tool === "creative-studio" && <CreativeStudio {...props} />}
      {tool === "ad-studio" && <AdStudio {...props} />}
      {tool === "ad-publisher" && <AdPublisher {...props} />}
      {tool === "media-library" && <MediaLibrary {...props} />}
      {tool === "google-ads" && <GoogleAdsLab {...props} />}
      {tool === "tiktok" && <TikTokCreator {...props} />}
      {tool === "video" &&
        (facility.videoEnabled ? <VideoGenerator {...props} /> : <VideoUpgrade href={upgradeHref} />)}
      {tool === "funnels" &&
        (campaignsHref ? <GoToCampaigns href={campaignsHref} /> : <FacilityFunnels {...props} />)}
      {tool === "landing-pages" && <LandingPageBuilder {...props} />}
      {tool === "utm-links" && <UTMLinks {...props} />}
      {tool === "gbp" && <GBPFull {...props} />}
      {tool === "social" && <SocialCommandCenter {...props} />}
      {tool === "lead-nurture" && <LeadNurtureEngine {...props} />}
      {tool === "occupancy" && <OccupancyIntelligence {...props} />}
      {tool === "market-intel" && <MarketIntelligence {...props} />}
      {tool === "revenue" && <RevenueAnalytics {...props} />}
      {tool === "tenants" && <TenantManagement {...props} />}
      {tool === "pms" && <PmsDashboard {...props} />}
      {tool === "call-tracking" && <CallTracking {...props} />}
    </Suspense>
  );
}

/** In the portal, campaigns have a page of their own; the tool forwards there. */
function GoToCampaigns({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return (
    <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening Campaigns…
    </div>
  );
}

function VideoUpgrade({ href }: { href: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-dark)]/[0.06]">
        <Film className="h-6 w-6 text-[var(--color-dark)]" />
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-dark)]">Video ads come with Portfolio</h2>
      <p className="mt-2 text-sm text-[var(--color-body-text)]">
        Short video ads made from your own facility photos. They&apos;re part of the Portfolio plan. Everything else
        here is already yours.
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center rounded-lg bg-[var(--color-dark)] px-4 py-2.5 text-sm font-semibold text-[var(--color-light)] hover:opacity-90"
      >
        Ask us about Portfolio
      </Link>
    </div>
  );
}

type OwnerToolsProps = {
  /** Facility to open first (e.g. the portal client's own). */
  defaultFacilityId?: string;
  /** Where the video upgrade prompt sends the owner. */
  upgradeHref: string;
  /** Where campaigns live as pages of their own (the portal); the Campaigns tool forwards there. */
  campaignsBase?: string;
};

/** The tools read ?tool= and ?focus= through the router, which needs a Suspense boundary. */
export function OwnerTools(props: OwnerToolsProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your tools…
        </div>
      }
    >
      <OwnerToolsInner {...props} />
    </Suspense>
  );
}

function OwnerToolsInner({ defaultFacilityId, upgradeHref, campaignsBase }: OwnerToolsProps) {
  const [facilities, setFacilities] = useState<ToolFacility[]>([]);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  // Deep link: /portal/tools?tool=landing-pages&focus=units/10x10. Read through
  // the router, not window.location: on an in-app link the new page renders
  // before the browser's URL changes, so a one-time read saw the old page's URL
  // and dropped the tool and its focus. The focus stays across tool switches
  // until the owner clears it.
  const searchParams = useSearchParams();
  const flow = useFlow();
  const requested = searchParams.get("tool");
  const tool = requested && TOOL_KEYS.has(requested) ? requested : "overview";
  const focus = searchParams.get("focus");
  const view = searchParams.get("view");
  const drawerShut = searchParams.get("drawer") === "shut";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSample(isPortalDemo());
  }, []);

  // history.replaceState keeps the switch instant; Next syncs it into useSearchParams.
  const setParams = useCallback((changes: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === "") url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    window.history.replaceState(null, "", url);
  }, []);

  const clearFocus = useCallback(() => {
    setParams({ focus: null });
  }, [setParams]);

  const pickTool = useCallback((key: string, params?: Record<string, string>) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tool", key);
    // Tool-specific params (e.g. the Ad Generator's ?variation=) only travel
    // with the tool that asked for them.
    url.searchParams.delete("variation");
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    window.history.replaceState(null, "", url);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/manage/session", { credentials: "include" });
      if (res.status === 401) {
        setError("Your tools session ran out. Sign out and back in to reopen them.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data: { facilities?: ToolFacility[] } = await res.json();
      const list = data.facilities ?? [];
      if (list.length === 0) {
        setError("We couldn't find a facility for your account. Message us and we'll sort it out.");
        return;
      }
      setFacilities(list);
      setFacilityId((current) => {
        if (current && list.some((f) => f.id === current)) return current;
        return list.find((f) => f.id === defaultFacilityId)?.id ?? list[0].id;
      });
    } catch {
      setError("Couldn't load your tools. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [defaultFacilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const ontology = useOntology(facilityId && (campaignsBase || focus) ? { kind: "manage", facilityId } : null);
  const by = flow?.pace && flow.pace.target > 0 ? `${flow.pace.monthShort} ${flow.pace.daysInMonth}` : null;
  const built =
    ontology.data && campaignsBase
      ? buildTrack({ ontology: ontology.data, focus, by, working: flow?.working ?? null })
      : null;
  const track = built && ontology.data ? ensureStation(built, requested, ontology.data) : built;
  const requestedOnTrack = !!(requested && track?.stations.some((s) => s.tool === requested));
  // A deep link to a tool that isn't a station on this track (Video, the Ad
  // Generator, …) still opens that tool. The track stays one click away.
  const explicitOtherTool = !!(requested && TOOL_KEYS.has(requested) && requested !== "overview" && track && !requestedOnTrack);
  const listMode = !campaignsBase || view === "list" || explicitOtherTool;
  const focusAddress = focus ?? (!listMode ? track?.focus ?? null : null);
  const focused = focusAddress ? ontology.data?.objects.find((o) => o.address === focusAddress) ?? null : null;
  const openTool: ToolKey | null =
    !track || listMode ? null : requestedOnTrack ? (requested as ToolKey) : drawerShut ? null : track.now;
  // Hold the tool back for the moment it takes to read the focus, so it mounts
  // once, already knowing what it was opened for.
  const waitingForFocus = !!focusAddress && ontology.loading && !ontology.data;

  const onOpen = useCallback((key: ToolKey) => setParams({ tool: key, drawer: null, view: null, focus: track?.focus ?? focus }), [setParams, track?.focus, focus]);
  const onCloseDrawer = useCallback(() => setParams({ tool: null, drawer: "shut" }), [setParams]);
  const onSelectFocus = useCallback((address: string) => setParams({ focus: address, tool: null, drawer: null }), [setParams]);
  const onAllTools = useCallback(() => setParams({ view: "list", drawer: null, tool: openTool }), [setParams, openTool]);
  const onShowTrack = useCallback(() => setParams({ view: null, drawer: null, tool: null }), [setParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your tools…
      </div>
    );
  }

  const facility = facilities.find((f) => f.id === facilityId);
  if (error || !facility) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-[var(--color-red-light)] p-3 text-sm text-[var(--color-red)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error ?? "Couldn't load your tools. Refresh to try again."}
        </div>
      </div>
    );
  }

  const selectClass =
    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--color-dark)] outline-none focus:border-[var(--color-dark)]/50";

  if (!listMode) {
    if (!track || !ontology.data) {
      return (
        <div className="flex flex-1 items-center justify-center py-24 text-[var(--color-body-text)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Reading your facility…
        </div>
      );
    }
    const campaignsHref = campaignsBase
      ? focused?.type === "campaigns"
        ? `${campaignsBase}/${encodeURIComponent(focused.id)}`
        : campaignsBase
      : undefined;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {facilities.length > 1 && (
          <div className="shrink-0 px-4 pt-3">
            <label htmlFor="tools-facility" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
              Facility
            </label>
            <select id="tools-facility" value={facility.id} onChange={(e) => setFacilityId(e.target.value)} className={selectClass}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <ToolsTrack
          track={track}
          ontology={ontology.data}
          openTool={openTool}
          sample={sample}
          choices={trackChoices(ontology.data)}
          campaignsBase={campaignsBase}
          onSelectFocus={onSelectFocus}
          onOpen={onOpen}
          onClose={onCloseDrawer}
          onAllTools={onAllTools}
          onFullTool={onAllTools}
          toolPane={
            openTool && !waitingForFocus ? (
              <ToolFocusProvider object={focused}>
                <ToolContent
                  key={`${facility.id}:${openTool}`}
                  tool={openTool}
                  facility={facility}
                  onUpdate={load}
                  upgradeHref={upgradeHref}
                  openTool={pickTool}
                  campaignsHref={campaignsHref}
                />
              </ToolFocusProvider>
            ) : (
              <div className="flex items-center justify-center py-16 text-[var(--color-body-text)]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
              </div>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      {/* Picker: grouped list on desktop, selects on mobile */}
      <aside className="shrink-0 border-b border-[var(--border-subtle)] px-4 py-3 md:min-h-0 md:w-56 md:overflow-y-auto md:border-b-0 md:border-r md:px-3 md:py-5">
        {campaignsBase && (
          <button
            type="button"
            onClick={onShowTrack}
            className="mb-3 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2.5 py-2 text-left text-[13px] font-extrabold text-[var(--ic-ink)]"
          >
            Track
          </button>
        )}
        {facilities.length > 1 && (
          <div className="mb-3 md:mb-5 md:px-1">
            <label htmlFor="tools-facility" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
              Facility
            </label>
            <select id="tools-facility" value={facility.id} onChange={(e) => setFacilityId(e.target.value)} className={selectClass}>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <label htmlFor="tools-picker" className="sr-only">
          Tool
        </label>
        <select id="tools-picker" value={tool} onChange={(e) => pickTool(e.target.value)} className={`${selectClass} md:hidden`}>
          {TOOL_GROUPS.map((group, gi) =>
            group.title ? (
              <optgroup key={gi} label={group.title}>
                {group.tools.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              group.tools.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))
            ),
          )}
        </select>

        <nav aria-label="Tools" className="hidden md:block">
          {TOOL_GROUPS.map((group, gi) => (
            <div key={gi} className="mb-4 last:mb-0">
              {group.title && (
                <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
                  {group.title}
                </p>
              )}
              {group.tools.map((t) => {
                const Icon = t.icon;
                const active = t.key === tool;
                const locked = t.key === "video" && !facility.videoEnabled;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => pickTool(t.key)}
                    aria-current={active ? "page" : undefined}
                    className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[var(--color-dark)]/[0.08] font-medium text-[var(--color-dark)]"
                        : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{t.label}</span>
                    {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--color-mid-gray)]" aria-label="Portfolio plan" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <section className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
        {focused && (
          <FocusBar
            object={focused}
            onClear={clearFocus}
            showIndexLink={typeof window !== "undefined" && window.location.pathname.startsWith("/portal")}
          />
        )}
        {waitingForFocus ? (
          <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <ToolFocusProvider object={focused}>
            {/* key: switching facility remounts the tool so it reloads that facility's data */}
            <ToolContent
              key={facility.id}
              tool={tool}
              facility={facility}
              onUpdate={load}
              upgradeHref={upgradeHref}
              openTool={pickTool}
              campaignsHref={
                campaignsBase
                  ? focused?.type === "campaigns"
                    ? `${campaignsBase}/${encodeURIComponent(focused.id)}`
                    : campaignsBase
                  : undefined
              }
            />
          </ToolFocusProvider>
        )}
      </section>
    </div>
  );
}
