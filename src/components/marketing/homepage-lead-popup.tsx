"use client";

/**
 * Homepage lead popup: name + phone, first-month-free offer.
 *
 * TODO(pricing): FAQ still says "month four is free"
 * (src/components/marketing/faq.tsx). This popup offers first month free
 * as requested for go-live. Do not invent a reconciled offer. Blake needs
 * to pick one claim before launch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";

const STORAGE_KEY = "sa_homepage_lead_dismissed";
const SHOW_DELAY_MS = 8000;
const MOBILE_FALLBACK_MS = 12000;

function isUsPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith("1")) return true;
  return false;
}

export default function HomepageLeadPopup() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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
    remember("dismissed");
  }, [remember]);

  useEffect(() => {
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
    nameRef.current?.focus();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || submitted) return;
    if (!name.trim() || !isUsPhone(phone) || !consent) {
      setError(
        !consent
          ? "Check the box so we can call or text you."
          : !isUsPhone(phone)
            ? "Enter a valid US phone number."
            : "Name and phone are required."
      );
      return;
    }

    if (website.trim() !== "") {
      setSubmitted(true);
      remember("submitted");
      window.setTimeout(dismiss, 2500);
      return;
    }

    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch("/api/audit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "homepage_popup",
          name: name.trim(),
          phone: phone.trim(),
          consent: true,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        setSubmitted(true);
        remember("submitted");
        window.setTimeout(() => setShow(false), 2800);
      } else if (res.status === 429) {
        setError("Too many requests. Try again in a minute.");
      } else {
        const payload = await res.json().catch(() => null);
        setError(payload?.error || "Couldn't send. Please try again.");
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setError(
        aborted
          ? "Request timed out. Check your connection."
          : "Network error. Please try again."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "rgba(28, 26, 22, 0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="homepage-lead-title"
        className="relative w-full max-w-md rounded-t-2xl p-6 shadow-xl sm:rounded-2xl sm:p-8"
        style={{
          background: "var(--color-light)",
          border: "1px solid var(--color-light-gray)",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-2 transition-colors hover:bg-[var(--color-light-gray)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" style={{ color: "var(--color-mid-gray)" }} />
        </button>

        {submitted ? (
          <div className="py-6 text-center" role="status" aria-live="polite">
            <p
              className="text-lg font-semibold"
              style={{ color: "var(--color-dark)" }}
            >
              Got it. We&apos;ll call you.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-body-text)" }}>
              First month is free. We&apos;ll walk through your facility on the call.
            </p>
          </div>
        ) : (
          <>
            <p
              className="mb-2 text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              First month free
            </p>
            <h2
              id="homepage-lead-title"
              className="mb-2 text-xl font-semibold"
              style={{ color: "var(--color-dark)" }}
            >
              Leave your name and number.
            </h2>
            <p className="mb-5 text-sm" style={{ color: "var(--color-body-text)" }}>
              We&apos;ll call and walk through what the system would do at your facility.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <input
                type="text"
                name="website_url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-10000px",
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
              <div>
                <label htmlFor="homepage-lead-name" className="sr-only">
                  Your name
                </label>
                <input
                  ref={nameRef}
                  id="homepage-lead-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  autoCapitalize="words"
                  required
                  className="input-field w-full"
                />
              </div>
              <div>
                <label htmlFor="homepage-lead-phone" className="sr-only">
                  Phone number
                </label>
                <input
                  id="homepage-lead-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  autoComplete="tel"
                  required
                  className="input-field w-full"
                />
              </div>
              <label className="flex items-start gap-2 text-xs" style={{ color: "var(--color-mid-gray)" }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                  required
                />
                <span>
                  I agree StorageAds can call or text me about this offer. Reply STOP
                  to opt out. Message and data rates may apply.
                </span>
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                {submitting ? "Sending…" : "Claim first month free"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-center text-xs"
                  style={{ color: "var(--color-red)" }}
                >
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
