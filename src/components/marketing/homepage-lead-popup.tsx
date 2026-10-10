"use client";

/**
 * Homepage lead popup. Step 1 is name and phone, saved immediately.
 * The rest is one question per screen. Closing later still leaves the lead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { POPUP_STEPS } from "@/lib/intake/questions";

const STORAGE_KEY = "sa_homepage_lead_dismissed";
const SHOW_DELAY_MS = 8000;
const MOBILE_FALLBACK_MS = 12000;
const INK = "#16161A";

export default function HomepageLeadPopup() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const remember = useCallback((value: "dismissed" | "submitted") => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* private mode */
    }
  }, []);

  const alreadyHandled = useCallback(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }, []);

  const open = useCallback(() => {
    if (alreadyHandled()) return;
    setShow(true);
  }, [alreadyHandled]);

  const dismiss = useCallback(() => {
    setShow(false);
    remember(done ? "submitted" : "dismissed");
  }, [remember, done]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intake") === "1") {
      setShow(true);
      return;
    }
    if (alreadyHandled()) return;

    const delay = window.setTimeout(open, SHOW_DELAY_MS);
    const mobileFallback = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 767px)").matches) open();
    }, MOBILE_FALLBACK_MS);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 8) open();
    };
    document.documentElement.addEventListener("mouseleave", onMouseLeave);

    return () => {
      window.clearTimeout(delay);
      window.clearTimeout(mobileFallback);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [alreadyHandled, open]);

  useEffect(() => {
    if (!show) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [show, dismiss]);

  if (!show) return null;

  const auditHref = token ? `/diagnostic?t=${encodeURIComponent(token)}` : "/diagnostic";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(22, 22, 26, 0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="homepage-lead-title"
        className="relative max-h-[100dvh] w-full max-w-md overflow-y-auto p-5 sm:p-8"
        style={{
          background: "#FFFFFF",
          color: INK,
          border: "1px solid #E0E0E5",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 p-2"
          aria-label="Close"
        >
          <X className="h-5 w-5" style={{ color: "#525766" }} />
        </button>

        <p
          className="mb-3 pr-8 text-xs font-semibold uppercase tracking-wider"
          style={{ color: "#525766" }}
        >
          First month of StorageAds free
        </p>

        {done ? (
          <div role="status">
            <h2
              id="homepage-lead-title"
              className="text-[1.65rem] font-extrabold leading-tight tracking-tight"
              style={{ color: INK, fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
            >
              Got it. We&apos;ll call you.
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#3F4350" }}>
              Your first month of StorageAds is free once your ads go live. We&apos;ll walk
              through your facility on the call.
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#525766" }}>
              Ad spend is yours, paid to Meta or Google. At least $20 a day, about $600 for
              the month.
            </p>
            <a
              href={auditHref}
              className="btn-primary mt-6 flex w-full items-center justify-center"
              style={{ minHeight: 52 }}
            >
              Want your free audit? 2 more minutes
            </a>
          </div>
        ) : (
          <IntakeWizard
            steps={POPUP_STEPS}
            showContact
            onCreate={async (input) => {
              const controller = new AbortController();
              const timeoutId = window.setTimeout(() => controller.abort(), 15000);
              try {
                const res = await fetch("/api/audit-form", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  signal: controller.signal,
                  body: JSON.stringify({
                    source: "homepage_popup",
                    name: input.name,
                    phone: input.phone,
                    consent: input.consent,
                    website_url: input.website,
                    elapsedSeconds: input.elapsedSeconds,
                  }),
                });
                const payload = await res.json().catch(() => null);
                if (!res.ok || !payload?.facilityId || !payload?.intakeToken) {
                  if (res.status === 429) throw new Error("Too many requests. Try again in a minute.");
                  throw new Error(payload?.error || "Couldn't send. Please try again.");
                }
                setToken(payload.intakeToken);
                return { facilityId: payload.facilityId, intakeToken: payload.intakeToken };
              } catch (err) {
                const aborted = err instanceof DOMException && err.name === "AbortError";
                if (aborted) throw new Error("Request timed out. Check your connection.");
                throw err;
              } finally {
                window.clearTimeout(timeoutId);
              }
            }}
            onFinished={() => {
              setDone(true);
              remember("submitted");
            }}
          />
        )}
      </div>
    </div>
  );
}
