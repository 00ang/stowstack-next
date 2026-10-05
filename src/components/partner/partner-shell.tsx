"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronLeft,
  DollarSign,
  Key,
  LayoutDashboard,
  Loader2,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Settings,
  Users,
  Webhook,
  Wrench,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { NotificationBell } from "./notification-bell";
import { TwoFactorLogin } from "./two-factor-setup";

const STORAGE_KEY = "storageads_partner_session";

interface PartnerSession {
  token: string;
  user: { id: string; email: string; name: string; role: string };
  organization: { id: string; name: string; slug: string; plan: string; status?: string };
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/partner", icon: LayoutDashboard },
  { label: "Facilities", href: "/partner/facilities", icon: Building2 },
  { label: "Facility Tools", href: "/partner/tools", icon: Wrench },
  { label: "Team", href: "/partner/team", icon: Users },
  { label: "Revenue", href: "/partner/revenue", icon: DollarSign },
  { label: "API Keys", href: "/partner/api-keys", icon: Key },
  { label: "Webhooks", href: "/partner/webhooks", icon: Webhook },
  { label: "Audit Log", href: "/partner/audit-log", icon: ListChecks },
  { label: "Changelog", href: "/partner/changelog", icon: Newspaper },
  { label: "Settings", href: "/partner/settings", icon: Settings },
];

function ResetPasswordForm({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check URL for reset token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("reset");
    if (resetToken) {
      setToken(resetToken);
      setStep("reset");
      window.history.replaceState({}, "", "/partner");
      // Verify the token
      fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token: resetToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) {
            setError("This reset link has expired. Please request a new one.");
            setStep("request");
            setToken("");
          }
        })
        .catch(() => {
          setError("Failed to verify reset link.");
        });
    }
  }, []);

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !orgSlug.trim()) return;
    setLoading(true);
    setError("");
    try {
      await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email: email.trim(), orgSlug: orgSlug.trim() }),
      });
      setSuccess("If an account exists with that email, we've sent a password reset link. Check your inbox.");
    } catch {
      setError("Failed to send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reset failed");
        return;
      }
      setSuccess("Password reset successfully! You can now sign in.");
      setTimeout(() => onBack(), 2000);
    } catch {
      setError("Failed to reset password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-light)] p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-gold)]">
            <Lock className="h-6 w-6 text-[var(--color-light)]" />
          </div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--color-dark)]">
            {step === "request" ? "Reset Password" : "Set New Password"}
          </h1>
          <p className="text-sm text-[var(--color-mid-gray)]">
            {step === "request"
              ? "Enter your details to receive a reset link"
              : "Choose a new password for your account"}
          </p>
        </div>

        {success ? (
          <div className="rounded-lg bg-green-500/10 p-4 text-center text-sm text-green-400">
            {success}
          </div>
        ) : step === "request" ? (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">Organization</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="Organization slug"
                  required
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--color-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-gold-hover)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--color-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-gold-hover)] disabled:opacity-50"
            >
              {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Reset Password"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-4 w-full text-center text-xs text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-body-text)]"
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function LoginGate({ onAuthenticated }: { onAuthenticated: (session: PartnerSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [twoFAToken, setTwoFAToken] = useState<string | null>(null);

  // Check URL for reset token or invite params on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset")) setShowReset(true);
    const inviteOrg = params.get("org");
    if (inviteOrg) setOrgSlug(inviteOrg);
    const inviteEmail = params.get("email");
    if (inviteEmail) setEmail(inviteEmail);
  }, []);

  if (showReset) {
    return <ResetPasswordForm onBack={() => setShowReset(false)} />;
  }

  if (twoFAToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)]">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-light)] p-8">
          <TwoFactorLogin
            tempToken={twoFAToken}
            onSuccess={(sessionData) => {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
              onAuthenticated(sessionData as PartnerSession);
            }}
            onCancel={() => {
              setTwoFAToken(null);
              setError("");
            }}
          />
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !orgSlug.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: email.trim(),
          password: password.trim(),
          orgSlug: orgSlug.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      if (data.requires2FA && data.tempToken) {
        setTwoFAToken(data.tempToken);
        setLoading(false);
        return;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      onAuthenticated(data);
    } catch {
      setError("Connection failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--color-light)] p-8"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-gold)]">
            <Building2 className="h-6 w-6 text-[var(--color-light)]" />
          </div>
          <h1 className="mb-1 text-2xl font-semibold text-[var(--color-dark)]">Partner Portal</h1>
          <p className="text-sm text-[var(--color-mid-gray)]">Sign in to your management dashboard</p>
        </div>

        <div className="mb-4">
          <label htmlFor="org-slug" className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">
            Organization
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
            <input
              id="org-slug"
              type="text"
              value={orgSlug}
              onChange={(e) => setOrgSlug(e.target.value)}
              placeholder="Organization slug"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
            />
          </div>
        </div>

        <div className="mb-2">
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-[var(--color-body-text)]">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-gold)]"
            />
          </div>
        </div>

        <div className="mb-6 text-right">
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-gold)]"
          >
            Forgot password?
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password.trim() || !orgSlug.trim()}
          className="w-full rounded-lg bg-[var(--color-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-gold-hover)] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
}

function Sidebar({
  session,
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: {
  session: PartnerSession;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-gold)]">
          <Building2 className="h-4 w-4 text-[var(--color-light)]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--color-dark)]">
              {session.organization.name}
            </p>
            <p className="truncate text-[10px] text-[var(--color-mid-gray)]">
              {session.user.name}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/partner"
                ? pathname === "/partner"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--color-gold)]/15 font-medium text-[var(--color-dark)]"
                      : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--color-gold)]" : ""}`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hidden shrink-0 border-t border-[var(--border-subtle)] p-3 md:block">
        <button
          type="button"
          onClick={() => onCollapse(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg p-2 text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--color-light-gray)] hover:text-[var(--color-body-text)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`safe-left fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--border-subtle)] bg-[var(--color-light)] transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <aside
        className={`hidden shrink-0 border-r border-[var(--border-subtle)] bg-[var(--color-light)] transition-all duration-200 md:block ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function PartnerHeader({
  session,
  onToggleSidebar,
  onLogout,
}: {
  session: PartnerSession;
  onToggleSidebar: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  const ROUTE_TITLES: Record<string, string> = {
    "/partner": "Overview",
    "/partner/facilities": "Facilities",
    "/partner/tools": "Facility Tools",
    "/partner/team": "Team",
    "/partner/revenue": "Revenue",
    "/partner/api-keys": "API Keys",
    "/partner/webhooks": "Webhooks",
    "/partner/settings": "Settings",
  };

  return (
    <header className="safe-top sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--color-light)]/80 px-4 backdrop-blur-xl md:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="rounded-lg p-2 text-[var(--color-body-text)] transition-colors hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)] md:hidden"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-lg font-semibold text-[var(--color-dark)]">
        {ROUTE_TITLES[pathname] ?? "Partner Dashboard"}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-sm text-[var(--color-mid-gray)] sm:inline">
          {session.user.email}
        </span>
        <span className="hidden rounded-full bg-[var(--color-light-gray)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-body-text)] sm:inline">
          {session.organization.plan}
        </span>
        <NotificationBell />
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[var(--color-body-text)] transition-colors hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function PartnerShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PartnerSession | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PartnerSession;
        if (parsed.token) return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    return null;
  });
  const [checked, _setChecked] = useState(() => typeof window !== "undefined");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    // Facility tools ride an httpOnly cookie only the server can drop.
    fetch("/api/manage/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    router.replace("/partner");
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-gold)] border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <LoginGate onAuthenticated={setSession} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-light)]">
      <Sidebar
        session={session}
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PartnerHeader
          session={session}
          onToggleSidebar={() => { haptic("light"); setMobileOpen((v) => !v); }}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
