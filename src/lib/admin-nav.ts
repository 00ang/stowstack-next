import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  Film,
  FileText,
  FileUp,
  Flame,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Inbox,
  Kanban,
  Layout,
  LayoutDashboard,
  Library,
  Link2,
  Mail,
  Map as MapIcon,
  Megaphone,
  MessageSquare,
  Music2,
  Palette,
  Phone,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  TrendingDown,
  SendHorizontal,
  ListChecks,
  Radio,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * True for tools that operate on a single facility (rendered via
   * FacilityToolPage, or scope-aware in their own right). These show the active
   * facility as a breadcrumb in the header and prompt for a facility when scope
   * is "all".
   */
  scoped?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * The admin spine — the single source of truth for the sidebar, the header
 * title/breadcrumb, and (route metadata for) the command palette. Keeping one
 * definition is what stops the three from drifting apart.
 *
 * Facility tools point to scope-aware routes; clicking one at "all" scope shows
 * a "select a facility" prompt. Leads stay as separate routes (locked decision).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "OVERVIEW",
    items: [
      { label: "Console", href: "/admin/console", icon: LayoutDashboard },
    ],
  },
  {
    title: "LEADS",
    items: [
      { label: "Pipeline", href: "/admin", icon: Flame },
      { label: "Kanban", href: "/admin/kanban", icon: Kanban },
      { label: "Consumer Leads", href: "/admin/consumer-leads", icon: Inbox },
      { label: "Recovery", href: "/admin/recovery", icon: Search },
      { label: "Facility Pipeline", href: "/admin/pipeline", icon: Target },
    ],
  },
  {
    title: "STUDIO",
    items: [
      { label: "Creative Studio", href: "/admin/studio/creative", icon: Palette, scoped: true },
      { label: "Ad Generator", href: "/admin/studio/ad-generator", icon: Sparkles, scoped: true },
      { label: "Publisher", href: "/admin/studio/publisher", icon: Send, scoped: true },
      { label: "Google Ads", href: "/admin/studio/google-ads", icon: Search, scoped: true },
      { label: "TikTok", href: "/admin/studio/tiktok", icon: Music2, scoped: true },
      { label: "Video", href: "/admin/studio/video", icon: Film, scoped: true },
      { label: "Media", href: "/admin/studio/media", icon: ImageIcon, scoped: true },
      { label: "Creative Library", href: "/admin/style-references", icon: Layout },
      { label: "Proven Ads", href: "/admin/studio/proven-ads", icon: Library },
    ],
  },
  {
    title: "CHANNELS",
    items: [
      { label: "Campaigns", href: "/admin/campaigns", icon: Megaphone },
      { label: "Funnels", href: "/admin/channels/funnels", icon: GitBranch, scoped: true },
      { label: "Landing Pages", href: "/admin/channels/landing-pages", icon: FileText, scoped: true },
      { label: "Google Business", href: "/admin/channels/gbp", icon: Globe, scoped: true },
      { label: "Social", href: "/admin/channels/social", icon: Share2, scoped: true },
      { label: "Automations", href: "/admin/channels/automations", icon: Mail, scoped: true },
      { label: "Sequences", href: "/admin/sequences", icon: Mail },
      { label: "UTM Links", href: "/admin/channels/utm", icon: Link2, scoped: true },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Insights", href: "/admin/insights", icon: BarChart3 },
      { label: "Occupancy", href: "/admin/intelligence/occupancy", icon: Building2, scoped: true },
      { label: "Market", href: "/admin/intelligence/market", icon: MapIcon, scoped: true },
      { label: "Revenue", href: "/admin/intelligence/revenue", icon: BarChart3, scoped: true },
      { label: "ECRI Finder", href: "/admin/intelligence/ecri", icon: TrendingUp, scoped: true },
      { label: "Portfolio", href: "/admin/portfolio", icon: Target },
      { label: "Cost per Move-in", href: "/admin/attribution", icon: TrendingDown },
      { label: "Move-in Reports", href: "/admin/conversions", icon: SendHorizontal },
      { label: "Reports", href: "/admin/reports", icon: FileText },
    ],
  },
  {
    title: "FACILITIES",
    items: [
      // The chooser/overview hub itself: a portfolio grid at "all", a facility's
      // overview when one is picked. It reads ?facility= directly and has its own
      // in-page facility header, so it is not a header-chip "scoped" route.
      { label: "Facility Manager", href: "/admin/facilities", icon: Building2 },
      { label: "Tenants", href: "/admin/facilities/tenants", icon: Users, scoped: true },
      { label: "PMS", href: "/admin/facilities/pms", icon: FileText, scoped: true },
      { label: "Calls", href: "/admin/facilities/call-tracking", icon: Phone, scoped: true },
      { label: "PMS Queue", href: "/admin/pms-queue", icon: FileUp },
      { label: "Diagnostics", href: "/admin/audits", icon: ShieldCheck },
      { label: "Quick Diagnostic", href: "/admin/quick-audit", icon: Sparkles },
    ],
  },
  {
    title: "REVENUE",
    items: [
      { label: "Billing", href: "/admin/billing", icon: CreditCard },
      { label: "Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Partners", href: "/admin/partners", icon: Users },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Activity", href: "/admin/activity", icon: Activity },
      { label: "Job Queue", href: "/admin/jobs", icon: ListChecks },
      { label: "Events", href: "/admin/events", icon: Radio },
      { label: "Setup", href: "/admin/onboarding", icon: Sparkles },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Changelog", href: "/admin/changelog", icon: BookOpen },
      { label: "Announcements", href: "/admin/changelog/announcements", icon: Megaphone },
    ],
  },
];

export interface RouteMeta {
  /** Display title for the page (header). */
  title: string;
  /** The spine group this route belongs to, title-cased (e.g. "Intelligence"), or null. */
  group: string | null;
  /** True if the route operates on a single facility. */
  scoped: boolean;
}

/**
 * Routes that have a header title but no sidebar entry of their own (detail
 * pages, wizards, legacy aliases). Keeps the header honest without polluting the
 * nav.
 */
const SUPPLEMENTAL: Record<string, Omit<RouteMeta, "group">> = {
  "/admin/campaigns/create": { title: "New Campaign", scoped: false },
  "/admin/funnels": { title: "Funnels", scoped: false },
  "/admin/calls": { title: "Calls", scoped: false },
};

function titleCaseGroup(group: string): string {
  return group.charAt(0) + group.slice(1).toLowerCase();
}

interface RouteCandidate {
  href: string;
  title: string;
  group: string | null;
  scoped: boolean;
}

// Every titled route (spine items first, then supplemental), used for both exact
// and longest-prefix resolution. Spine items precede supplemental so a spine
// route wins any exact collision.
const ROUTE_CANDIDATES: RouteCandidate[] = [
  ...NAV_GROUPS.flatMap((g) =>
    g.items.map((item) => ({
      href: item.href,
      title: item.label,
      group: titleCaseGroup(g.title),
      scoped: Boolean(item.scoped),
    })),
  ),
  ...Object.entries(SUPPLEMENTAL).map(([href, meta]) => ({
    href,
    title: meta.title,
    group: null,
    scoped: meta.scoped,
  })),
];

/**
 * Resolve display metadata for a pathname: exact match first, then the longest
 * matching path prefix (so detail routes like /admin/funnels/[id] inherit their
 * parent's title). Falls back to "Admin".
 */
export function findRouteMeta(pathname: string): RouteMeta {
  const exact = ROUTE_CANDIDATES.find((c) => c.href === pathname);
  if (exact) {
    return { title: exact.title, group: exact.group, scoped: exact.scoped };
  }

  let best: RouteCandidate | null = null;
  for (const c of ROUTE_CANDIDATES) {
    if (c.href === "/admin") continue; // would prefix-match every admin route
    if (
      pathname.startsWith(c.href + "/") &&
      (!best || c.href.length > best.href.length)
    ) {
      best = c;
    }
  }
  if (best) {
    return { title: best.title, group: best.group, scoped: best.scoped };
  }

  return { title: "Admin", group: null, scoped: false };
}
