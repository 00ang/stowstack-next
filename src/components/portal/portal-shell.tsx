"use client";

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Mail,
  Send,
  Loader2,
  AlertCircle,
  Menu,
} from "lucide-react";
import {
  type PortalSession,
  type ClientData,
  getPortalSession,
  savePortalSession,
  clearPortalSession,
  firstName,
} from "@/lib/portal-helpers";
import { PortalBottomTabs } from "./portal-bottom-tabs";
import { portalNavGroups, portalNavTitle, isNavItemActive } from "./portal-nav";
import { haptic } from "@/lib/haptics";
import { bootPortalDemo, isPortalDemo, tidyDemoUrl } from "@/lib/portal-demo/demo-mode";
import { clearOntologyCache } from "@/components/ontology/use-ontology";
import { FlowProvider, clearFlowSession } from "@/components/flow/flow-context";
import { FlowBar, whereFrom } from "@/components/flow/flow-bar";
import { surfaceOf } from "@/lib/flow";

/* ─── context ─── */

interface PortalContext {
  session: PortalSession;
  client: ClientData;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const PortalCtx = createContext<PortalContext | null>(null);

export function usePortal() {
  const ctx = useContext(PortalCtx);
  if (!ctx) throw new Error("usePortal must be used within PortalShell");
  return ctx;
}

/* ─── login form ─── */

function LoginForm({ onSuccess }: { onSuccess: (client: ClientData) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoSubmitRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");
    const urlEmail = params.get("email");
    if (urlEmail && urlCode && /^\d{4}$/.test(urlCode)) {
      setEmail(urlEmail);
      setCode(urlCode.split(""));
      setStep("code");
      autoSubmitRef.current = true;
      window.history.replaceState({}, "", "/portal");
    }
  }, []);

  useEffect(() => {
    if (autoSubmitRef.current && email && code.every((d) => d)) {
      autoSubmitRef.current = false;
      attemptLogin(email, code.join(""));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, code]);

  async function attemptLogin(loginEmail: string, loginCode: string) {
    setLoading(true);
    setError("");
    haptic("medium");
    try {
      const res = await fetch("/api/client-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), accessCode: loginCode }),
      });
      const json = await res.json();
      if (!res.ok) {
        haptic("error");
        setError(json.error || "Invalid or expired code. Request a new one.");
        return;
      }
      haptic("success");
      // Persist the client's PERMANENT access code (not the one-time login
      // code, which is now marked used + expires in 10 min). Session restore
      // on reload and every sub-page data fetch authenticate against this.
      const persistentCode = json.client?.accessCode || loginCode;
      savePortalSession(loginEmail.trim(), persistentCode);
      onSuccess(json.client);
    } catch {
      haptic("error");
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setResending(true);
    setError("");
    try {
      await fetch("/api/resend-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      setError("Failed to send code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  function handleCodeInput(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 3) codeRefs.current[index + 1]?.focus();
    if (digit && index === 3 && newCode.every((d) => d)) {
      attemptLogin(email, newCode.join(""));
    }
  }

  function handleCodeKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setCode(pasted.split(""));
      codeRefs.current[3]?.focus();
      attemptLogin(email, pasted);
    }
  }

  async function handleResendCode() {
    setResending(true);
    setError("");
    try {
      await fetch("/api/resend-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setResent(true);
      setCode(["", "", "", ""]);
      setTimeout(() => {
        setResent(false);
        codeRefs.current[0]?.focus();
      }, 3000);
    } catch {
      setError("Failed to resend code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-dark)]/[0.06]">
            <Building2 className="h-7 w-7 text-[var(--color-dark)]" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-dark)]">Client Portal</h1>
          <p className="mt-2 text-sm text-[var(--color-mid-gray)]">
            {step === "email"
              ? "Enter your email to receive a login code"
              : `Enter the 4-digit code sent to ${email}`}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="portal-login-email" className="mb-1.5 block text-xs font-medium text-[var(--color-body-text)]">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
                <input
                  id="portal-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@facility.com"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-3 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
                />
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--color-red-light)] p-3 text-sm text-[var(--color-red)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={resending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {resending ? "Sending Code..." : "Send Login Code"}
            </button>
            <p className="pt-2 text-center text-xs font-semibold text-[var(--color-body-text)]">
              No account yet?{" "}
              <a href="/portal?demo" className="font-bold text-[var(--color-dark)] underline underline-offset-4">
                Look around a sample portal
              </a>
            </p>
          </form>
        ) : (
          <div className="space-y-4">
            <div role="group" aria-label="4-digit login code" className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  ref={(el) => { codeRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Login code digit ${i + 1} of 4`}
                  value={code[i]}
                  onChange={(e) => handleCodeInput(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKeyDown(i, e)}
                  onPaste={handleCodePaste}
                  autoFocus={i === 0}
                  className="h-14 w-14 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-center text-2xl font-semibold text-[var(--color-dark)] outline-none transition-all focus:border-[var(--color-dark)] focus:ring-2 focus:ring-[var(--color-dark)]/25"
                />
              ))}
            </div>
            {loading && (
              <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-body-text)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--color-red-light)] p-3 text-sm text-[var(--color-red)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex flex-col items-center gap-2 pt-2">
              <button type="button" onClick={handleResendCode} disabled={resending || resent} className="text-xs text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)]">
                {resending ? "Sending..." : resent ? "New code sent!" : "Didn't get a code? Resend"}
              </button>
              <button type="button" onClick={() => { setStep("email"); setCode(["","","",""]); setError(""); }} className="text-xs text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)]">
                Use a different email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── sidebar ─── */

/** Short names for the narrow rail, so every item keeps a word under its icon. */
const RAIL_LABELS: Record<string, string> = { "/portal/tools": "Tools" };

function Sidebar({ client, mobileOpen, onClose, showOnboarding, rail }: { client: ClientData; mobileOpen: boolean; onClose: () => void; showOnboarding: boolean; rail: boolean }) {
  const pathname = usePathname();
  const groups = portalNavGroups(showOnboarding);

  // Escape closes the mobile drawer (it renders as a modal dialog on < md).
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-dark)]/[0.06] text-sm font-semibold text-[var(--color-dark)]">
          {firstName(client.name).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-dark)]">{client.facilityName}</p>
          <p className="truncate text-[10px] text-[var(--color-mid-gray)]">{client.location}</p>
        </div>
      </div>
      <nav aria-label="Portal" className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-[var(--color-dark)]/[0.08] font-medium text-[var(--color-dark)]"
                          : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--color-dark)]" : ""}`} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  // The builder takes the window: the desktop nav narrows to a rail of icons with their names.
  const railContent = (
    <div className="flex h-full flex-col items-stretch">
      <div className="flex h-16 shrink-0 items-center justify-center border-b border-[var(--border-subtle)]" title={client.facilityName}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-dark)]/[0.06] text-sm font-semibold text-[var(--color-dark)]">
          {firstName(client.name).charAt(0).toUpperCase()}
        </div>
      </div>
      <nav aria-label="Portal" className="flex-1 overflow-y-auto px-1.5 py-3">
        {groups.map((group, gi) => (
          <ul key={group.label} className={`space-y-0.5 ${gi > 0 ? "mt-2 border-t border-[var(--border-subtle)] pt-2" : ""}`}>
            {group.items.map((item) => {
              const isActive = isNavItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors ${
                      isActive
                        ? "bg-[var(--color-dark)]/[0.08] text-[var(--color-dark)]"
                        : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{RAIL_LABELS[item.href] ?? item.tabLabel ?? item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[var(--color-dark)]/60 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        id="portal-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!mobileOpen}
        className={`safe-left fixed inset-y-0 left-0 z-50 w-64 border-r border-[var(--border-subtle)] bg-[var(--color-light)] transition-transform duration-200 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {content}
      </aside>
      <aside className={`hidden shrink-0 border-r border-[var(--border-subtle)] bg-[var(--color-light)] md:block ${rail ? "w-[84px]" : "w-64"}`}>
        {rail ? railContent : content}
      </aside>
    </>
  );
}

/* ─── header ─── */

function PortalHeader({ client, onToggle, onLogout, expanded, toggleRef }: { client: ClientData; onToggle: () => void; onLogout: () => void; expanded: boolean; toggleRef: React.RefObject<HTMLButtonElement | null> }) {
  const pathname = usePathname();

  return (
    <header className="safe-top sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--color-light)]/80 px-4 backdrop-blur-xl md:px-6">
      <button ref={toggleRef} type="button" onClick={onToggle} aria-label="Open navigation menu" aria-expanded={expanded} aria-controls="portal-mobile-nav" className="rounded-lg p-2 text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] md:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-base font-semibold text-[var(--color-dark)]">{portalNavTitle(pathname)}</h1>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-xs text-[var(--color-mid-gray)] sm:inline">{client.email}</span>
        <button type="button" onClick={onLogout} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--color-body-text)] hover:text-[var(--color-dark)]">
          Sign Out
        </button>
      </div>
    </header>
  );
}

/* ─── sample portal banner ─── */

function SampleBanner({ onLeave }: { onLeave: () => void }) {
  // Instrument Calm (library entry 008): sample data is labeled, not shouted.
  return (
    <div className="border-b-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-2 text-[var(--ic-ink)] md:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="ic-label text-[10.5px]">
          Sample portal <span aria-hidden="true">·</span> a made-up facility <span aria-hidden="true">·</span> nothing is saved
        </span>
        <span className="flex items-center gap-4">
          <Link href="/portal/onboarding" className="text-[13px] font-bold underline underline-offset-4">
            Try setup
          </Link>
          <button type="button" onClick={onLeave} className="text-[13px] font-bold underline underline-offset-4">
            Leave the sample
          </button>
        </span>
      </div>
    </div>
  );
}

/* ─── main shell ─── */

export function PortalShell({ children }: { children: React.ReactNode }) {
  // Onboarding runs its own steps; the next-move bar waits until it is done.
  const pathname = usePathname();
  const onboarding = pathname.startsWith("/portal/onboarding");
  // A campaign's builder takes the whole window: no page scroll, the nav as a rail.
  const builder = surfaceOf(pathname) === "campaign";
  // Boot the sample portal first (/portal?demo) so the session it reads is the sample's.
  const [session, setSession] = useState<PortalSession | null>(() => {
    bootPortalDemo();
    return getPortalSession();
  });
  const [demo, setDemo] = useState(() => isPortalDemo());
  useEffect(() => {
    if (demo) tidyDemoUrl();
  }, [demo]);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prevMobileOpen = useRef(false);

  // Return focus to the hamburger when the drawer closes, so keyboard users
  // land back on the control that opened it (WCAG 2.4.3). Skip the initial
  // mount (false -> false) and only act on a true -> false transition.
  useEffect(() => {
    if (prevMobileOpen.current && !mobileOpen) toggleRef.current?.focus();
    prevMobileOpen.current = mobileOpen;
  }, [mobileOpen]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetch("/api/client-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: session.email, accessCode: session.accessCode }),
    })
      .then((r) => { if (!r.ok) throw new Error("auth"); return r.json(); })
      .then((json) => setClient(json.client))
      .catch(() => { clearPortalSession(); setSession(null); setAuthError(true); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback((clientData: ClientData) => {
    setClient(clientData);
    setSession(getPortalSession());
    setAuthError(false);
  }, []);

  const handleLogout = useCallback(() => {
    clearPortalSession();
    clearOntologyCache();
    clearFlowSession();
    setDemo(false);
    // The portal login also opened the facility tools (httpOnly cookie, so
    // only the server can drop it). Best-effort: sign-out proceeds regardless.
    fetch("/api/manage/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    setClient(null);
  }, []);

  // Surface the Onboarding nav item only while setup is incomplete.
  useEffect(() => {
    if (!client) return;
    const s = getPortalSession();
    if (!s) return;
    const code = encodeURIComponent(s.accessCode);
    const email = encodeURIComponent(s.email);
    fetch(`/api/client-onboarding?code=${code}&email=${email}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setShowOnboarding(!j.onboarding?.completedAt); })
      .catch(() => {});
  }, [client]);

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const s = getPortalSession();
    if (!s) throw new Error("Not authenticated");
    const separator = url.includes("?") ? "&" : "?";
    // Portal routes are inconsistent about the auth param name: some read
    // `code` (onboarding), some `accessCode` (attribution). Send both (same
    // value) plus `email` so any portal endpoint authenticates regardless.
    const code = encodeURIComponent(s.accessCode);
    const email = encodeURIComponent(s.email);
    return fetch(`${url}${separator}code=${code}&accessCode=${code}&email=${email}`, init);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-light)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-dark)]" />
      </div>
    );
  }

  if (!session || !client) {
    return (
      <div className="min-h-screen bg-[var(--color-light)]">
        {authError && (
          <div className="mx-auto max-w-sm px-4 pt-6">
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-[var(--color-blue)]/[0.08] p-3 text-sm text-[var(--color-blue)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Session expired. Please sign in again.
            </div>
          </div>
        )}
        <LoginForm onSuccess={handleLogin} />
      </div>
    );
  }

  return (
    <PortalCtx.Provider value={{ session, client, authFetch }}>
      <FlowProvider facilityId={client.facilityId} authFetch={authFetch} initialWhere={whereFrom(typeof window === "undefined" ? "/portal" : window.location.pathname, typeof window === "undefined" ? null : new URLSearchParams(window.location.search))}>
      <a href="#portal-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-dark)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-light)]">
        Skip to content
      </a>
      <div className="flex h-screen overflow-hidden bg-[var(--color-light)]">
        <Sidebar client={client} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} showOnboarding={showOnboarding} rail={builder} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <PortalHeader client={client} onToggle={() => { haptic("light"); setMobileOpen((v) => !v); }} onLogout={handleLogout} expanded={mobileOpen} toggleRef={toggleRef} />
          <main id="portal-main" tabIndex={-1} className={builder ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>
            {demo && <SampleBanner onLeave={handleLogout} />}
            {children}
          </main>
          {/* The next move: every page, every tool. Sits above the phone's tab bar. */}
          <div className={`${onboarding ? "hidden" : ""} shrink-0 pb-[calc(3.6rem+env(safe-area-inset-bottom))] md:pb-0`}>
            <FlowBar />
          </div>
        </div>
        <PortalBottomTabs onMore={() => { haptic("light"); setMobileOpen(true); }} />
      </div>
      </FlowProvider>
    </PortalCtx.Provider>
  );
}
