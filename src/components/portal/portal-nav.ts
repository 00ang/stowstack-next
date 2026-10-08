import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  MapPin,
  Upload,
  MessageSquare,
  CreditCard,
  Settings,
  ClipboardCheck,
  Wrench,
  Network,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the client portal navigation.
 *
 * The desktop sidebar (grouped), the mobile drawer (grouped, opened by the
 * bottom "More" tab), the mobile bottom tab bar (the primary subset), and the
 * header page title all derive from THIS module. Do not reintroduce a second
 * nav array in any component — that drift (Dashboard/Home, GBP/Reviews,
 * Billing/Onboarding missing on mobile) is exactly what this replaces.
 */

export interface PortalNavItem {
  /** Canonical label, used everywhere unless `tabLabel` overrides it. */
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional shorter label for the dense mobile bottom tab bar. */
  tabLabel?: string;
}

export interface PortalNavGroup {
  label: string;
  items: PortalNavItem[];
}

/** Grouped primary navigation: RESULTS / TOOLS / PROPERTY / ACCOUNT. */
export const PORTAL_NAV_GROUPS: PortalNavGroup[] = [
  {
    label: "Results",
    items: [
      { label: "Dashboard", href: "/portal", icon: LayoutDashboard },
      // The facility ontology: every object the tools act on, with one address each.
      { label: "Index", href: "/portal/index", icon: Network },
      { label: "Campaigns", href: "/portal/campaigns", icon: Megaphone },
      { label: "Reports", href: "/portal/reports", icon: BarChart3 },
    ],
  },
  {
    // The facility tools (ads, landing pages, Google Business, market data…),
    // opened by the same portal login. See src/components/owner-tools.
    label: "Tools",
    items: [{ label: "Facility Tools", href: "/portal/tools", icon: Wrench }],
  },
  {
    label: "Property",
    items: [
      { label: "Reviews", href: "/portal/gbp", icon: MapPin },
      { label: "Upload", href: "/portal/upload", icon: Upload },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Messages", href: "/portal/messages", icon: MessageSquare },
      { label: "Billing", href: "/portal/billing", icon: CreditCard },
      { label: "Settings", href: "/portal/settings", icon: Settings },
    ],
  },
];

/**
 * Onboarding is conditional: it only appears in the nav while setup is
 * incomplete, rendered as its own "Get Started" group so it reads as a call to
 * action rather than a permanent destination.
 */
export const PORTAL_ONBOARDING_ITEM: PortalNavItem = {
  label: "Onboarding",
  href: "/portal/onboarding",
  icon: ClipboardCheck,
};

/** Flattened list of every primary item, in nav order. */
export const PORTAL_NAV_ITEMS: PortalNavItem[] = PORTAL_NAV_GROUPS.flatMap((g) => g.items);

/**
 * Bottom-tab subset for mobile. Space caps at ~5; the highest-value
 * destinations sit on the bar and everything else lives behind the "More" tab
 * (which opens the full grouped drawer). Order matters.
 */
export const PORTAL_BOTTOM_TABS: PortalNavItem[] = [
  "/portal",
  "/portal/campaigns",
  "/portal/reports",
  "/portal/messages",
].map((href) => PORTAL_NAV_ITEMS.find((item) => item.href === href)!);

/** Active-state rule shared by every nav surface: exact for the index, prefix otherwise. */
export function isNavItemActive(href: string, pathname: string): boolean {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

/** Lookup of pathname → header title, derived from the same config. */
export const PORTAL_TITLES: Record<string, string> = Object.fromEntries(
  [...PORTAL_NAV_ITEMS, PORTAL_ONBOARDING_ITEM].map((item) => [item.href, item.label]),
);

/** Resolve the header page title for a pathname from the same config. */
export function portalNavTitle(pathname: string): string {
  const match = [...PORTAL_NAV_ITEMS, PORTAL_ONBOARDING_ITEM].find((item) =>
    isNavItemActive(item.href, pathname),
  );
  return match?.label ?? "Portal";
}

/**
 * Return the nav groups for rendering, appending the conditional Onboarding
 * group only when setup is incomplete.
 */
export function portalNavGroups(showOnboarding: boolean): PortalNavGroup[] {
  if (!showOnboarding) return PORTAL_NAV_GROUPS;
  return [...PORTAL_NAV_GROUPS, { label: "Get Started", items: [PORTAL_ONBOARDING_ITEM] }];
}
