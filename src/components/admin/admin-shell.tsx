"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Lock, Search, ShieldCheck } from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { AdminProvider, STORAGE_KEY } from "@/lib/admin-context";
import { AdminHeader } from "./admin-header";
import { CommandPalette } from "./command-palette";
import { FacilitySwitcher } from "./facility-switcher";
import { useClerkRole } from "@/hooks/use-clerk-role";
import { VA_RESTRICTED_PATHS } from "@/lib/clerk-roles";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import { FacilityProvider, useFacility } from "@/lib/facility-context";
import { NAV_GROUPS } from "@/lib/admin-nav";
import type { Facility } from "@/types/facility";

interface AdminFacility {
  id: string;
  name: string;
  location?: string;
  status?: string;
  organization?: { id?: string } | null;
}

/**
 * Fetches the admin's facilities (client-side; the API needs the X-Admin-Key
 * header) and provides them through the shared FacilityProvider so the whole
 * admin shares one scope. `key` remounts the provider once the list loads.
 * Must sit under a <Suspense> boundary: FacilityProvider calls useSearchParams.
 */
function FacilityScope({ children }: { children: React.ReactNode }) {
  const { data } = useAdminFetch<{ facilities: AdminFacility[] }>(
    "/api/admin-facilities",
  );
  const facilities = useMemo<Facility[]>(
    () =>
      (data?.facilities ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        location: f.location ?? "",
        status: f.status ?? "",
        organizationId: f.organization?.id,
      })),
    [data],
  );
  return (
    <FacilityProvider key={facilities.map((f) => f.id).join(",")} facilities={facilities}>
      {children}
    </FacilityProvider>
  );
}

function ShellFallback() {
  return (
    <div
      className="admin-theme flex min-h-screen items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="h-4 w-4 animate-spin rounded-full"
        style={{ border: "1.5px solid #1A1A1A", borderTopColor: "transparent" }}
      />
    </div>
  );
}

function LoginGate({ onAuthenticated }: { onAuthenticated: (key: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"clerk" | "key">("clerk");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin-settings", {
        headers: { "X-Admin-Key": password },
      });

      if (res.ok) {
        localStorage.setItem(STORAGE_KEY, password);
        onAuthenticated(password);
      } else if (res.status === 401) {
        setError("Invalid admin key");
      } else {
        setError("Invalid admin key");
      }
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const mono = "var(--font-manrope), 'Manrope', system-ui, -apple-system, sans-serif";

  return (
    <div className="admin-theme flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)', fontFamily: mono }}>
      <div className="w-full max-w-[340px] p-8" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px' }}>
        <div className="mb-8 text-center">
          <h1 className="mb-1" style={{ fontFamily: mono, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            storage<span style={{ color: 'var(--brand-ads)' }}>ads</span>
          </h1>
          <p style={{ fontFamily: mono, fontSize: '12px', fontWeight: 300, color: '#A3A3A3', letterSpacing: '0.02em' }}>admin</p>
        </div>

        {mode === "clerk" ? (
          <>
            <SignInButton mode="modal">
              <button
                type="button"
                className="mb-4 w-full"
                style={{
                  fontFamily: mono, fontSize: '13px', fontWeight: 500,
                  background: '#1A1A1A', color: '#FFFFFF', border: 'none',
                  borderRadius: '4px', padding: '8px 16px', cursor: 'pointer',
                }}
              >
                Sign In with Clerk
              </button>
            </SignInButton>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />
              </div>
              <div className="relative flex justify-center">
                <span style={{ fontFamily: mono, fontSize: '11px', color: '#A3A3A3', background: 'var(--bg)', padding: '0 12px', letterSpacing: '0.06em' }}>or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode("key")}
              className="w-full"
              style={{
                fontFamily: mono, fontSize: '13px', fontWeight: 400,
                background: 'transparent', color: '#737373',
                border: '1px solid rgba(0,0,0,0.15)', borderRadius: '4px',
                padding: '8px 16px', cursor: 'pointer',
              }}
            >
              Use Admin Key
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="admin-key" className="mb-2 block" style={{ fontFamily: mono, fontSize: '11px', fontWeight: 400, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#A3A3A3' }}>
                Admin Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: '#A3A3A3' }} />
                <input
                  id="admin-key"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="enter key"
                  autoFocus
                  className="w-full"
                  style={{
                    fontFamily: mono, fontSize: '13px', fontWeight: 400,
                    background: 'var(--card)', border: '1px solid rgba(0,0,0,0.15)',
                    borderRadius: '4px', color: '#1A1A1A', padding: '8px 12px 8px 36px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {error && (
              <p className="mb-4" style={{ fontFamily: mono, fontSize: '12px', color: '#B04A3A' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="mb-3 w-full"
              style={{
                fontFamily: mono, fontSize: '13px', fontWeight: 500,
                background: '#1A1A1A', color: '#FFFFFF', border: 'none',
                borderRadius: '4px', padding: '8px 16px', cursor: 'pointer',
                opacity: loading || !password.trim() ? 0.4 : 1,
              }}
            >
              {loading ? "verifying..." : "sign in"}
            </button>

            <button
              type="button"
              onClick={() => setMode("clerk")}
              className="w-full text-center"
              style={{ fontFamily: mono, fontSize: '11px', color: '#A3A3A3', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Sidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
  isVA,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isVA: boolean;
}) {
  const pathname = usePathname();
  const { facilities } = useFacility();

  // Ambient nav signals: real counts from existing endpoints, keyed by href.
  // Degrades gracefully — a missing/non-number value simply shows no badge.
  const { data: analytics } = useAdminFetch<{ totalLeads?: number }>(
    "/api/lead-analytics",
  );
  const navCounts: Record<string, number> = {};
  if (typeof analytics?.totalLeads === "number") {
    navCounts["/admin"] = analytics.totalLeads;
  }

  const filteredGroups = isVA
    ? NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !VA_RESTRICTED_PATHS.includes(item.href)
        ),
      })).filter((group) => group.items.length > 0)
    : NAV_GROUPS;

  const sidebarContent = (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)' }}>
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Link
          href="/"
          className={`transition-opacity ${collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"}`}
          style={{ fontFamily: 'var(--font)', fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', textDecoration: 'none' }}
        >
          storage<span style={{ color: 'var(--brand-ads)' }}>ads</span>
        </Link>
        {collapsed && (
          <Link
            href="/"
            className="mx-auto flex h-7 w-7 items-center justify-center"
            style={{ color: 'var(--ink)', textDecoration: 'none', fontFamily: 'var(--font)', fontSize: '14px', fontWeight: 500 }}
          >
            ~
          </Link>
        )}
      </div>

      {/* Facility scope switcher — the primary scope control. Sits in its own
          shrink-0 row (outside the scrollable nav) so its dropdown is not
          clipped by the nav's overflow. Hidden until facilities load so there
          is no empty bordered bar. */}
      {facilities.length > 0 && (
        <div
          className={`shrink-0 ${collapsed ? "px-2" : "px-3"} py-3`}
          style={{ borderBottom: "1px solid var(--bdr)" }}
        >
          <FacilitySwitcher variant="sidebar" collapsed={collapsed} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed ? (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("admin:open-palette"))}
            className="mb-4 flex w-full items-center gap-2.5"
            style={{ fontFamily: 'var(--font)', fontSize: '12.5px', fontWeight: 500, color: 'var(--sidebar-muted)', background: 'var(--card)', border: '1px solid var(--bdr)', borderRadius: '7px', padding: '6px 10px', cursor: 'pointer' }}
          >
            <Search className="h-3.5 w-3.5" />
            <span style={{ flex: 1, textAlign: 'left' }}>Quick find</span>
            <span style={{ fontSize: '10px', fontWeight: 600, border: '1px solid var(--bdr-strong)', borderRadius: '4px', padding: '0 5px', color: 'var(--ink3)' }}>⌘K</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("admin:open-palette"))}
            className="mb-4 flex w-full items-center justify-center"
            style={{ color: 'var(--sidebar-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px' }}
            aria-label="Quick find"
            title="Quick find (⌘K)"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
        {filteredGroups.map((group, gi) => (
          <div key={group.title} className="mb-5">
            {!collapsed && (
              <p className="mb-2 flex items-center gap-1.5 px-2.5" style={{ fontFamily: 'var(--font)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: 'var(--sidebar-muted)' }}>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>§ {String(gi).padStart(2, "0")}</span>
                <span>{group.title}</span>
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onMobileClose}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}
                      style={{
                        fontFamily: 'var(--font)',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        borderLeft: isActive ? '2px solid var(--sidebar-text-active)' : '2px solid transparent',
                        marginLeft: '-1px',
                        textDecoration: 'none',
                        transition: 'color 120ms ease',
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                      {!collapsed && navCounts[item.href] != null && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--ink3)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {navCounts[item.href]}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="hidden shrink-0 p-3 md:block" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <button
          type="button"
          onClick={() => onCollapse(!collapsed)}
          className="flex w-full items-center justify-center p-2"
          style={{ color: 'var(--sidebar-muted)', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0, 0, 0, 0.2)' }}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 transition-transform duration-150 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid rgba(0,0,0,0.08)' }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 transition-all duration-150 md:block ${
          collapsed ? "w-14" : "w-56"
        }`}
        style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid rgba(0,0,0,0.08)' }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [adminKey, setAdminKey] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [checked] = useState(() => typeof window !== "undefined");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { user, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { isVA, canAccessAdmin } = useClerkRole();

  const _handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
  }, []);

  if (!checked || !clerkLoaded) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="h-4 w-4 animate-spin rounded-full" style={{ border: '1.5px solid #1A1A1A', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const isAuthenticated = adminKey !== null || (isSignedIn && canAccessAdmin);

  if (isSignedIn && !canAccessAdmin && !adminKey) {
    return (
      <div className="admin-theme flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-sm p-8 text-center" style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '6px' }}>
          <ShieldCheck className="mx-auto mb-4 h-8 w-8" style={{ color: '#A3A3A3' }} />
          <h2 className="mb-2" style={{ fontSize: '14px', fontWeight: 500 }}>access denied</h2>
          <p className="mb-6" style={{ fontSize: '12px', color: '#A3A3A3', fontWeight: 300, maxWidth: 'none' }}>
            {user?.primaryEmailAddress?.emailAddress} does not have admin access.
          </p>
          <UserButton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginGate onAuthenticated={setAdminKey} />;
  }

  return (
    <AdminProvider initialKey={adminKey}>
      <Suspense fallback={<ShellFallback />}>
        <FacilityScope>
          <div className="admin-theme flex h-screen overflow-hidden" style={{ background: 'var(--bg)', fontFamily: 'var(--font)' }}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onCollapse={setSidebarCollapsed}
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
              isVA={isVA}
            />
            <div className="flex flex-1 flex-col overflow-hidden min-w-0">
              <AdminHeader onToggleSidebar={() => setMobileOpen((v) => !v)} />
              <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 min-w-0">
                {children}
              </main>
            </div>
            <CommandPalette />
          </div>
        </FacilityScope>
      </Suspense>
    </AdminProvider>
  );
}
