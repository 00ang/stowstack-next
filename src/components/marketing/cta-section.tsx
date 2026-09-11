"use client";

import { SectionHeader, SectionMeta } from "@/components/mono/section-header";

import { useState, useEffect, useRef } from "react";
import { ArrowRight, Check, Shield, Clock, Wrench, Zap, Calendar } from "lucide-react";
import { useInView } from "./use-in-view";
import { CAL_BOOKING_URL, CAL_EMBED_SLUG } from "@/lib/booking";
import Cite from "./cite";
import { RevealText } from "./motion";

const TRUST_SIGNALS = [
  { icon: Shield, text: "No long-term contracts" },
  { icon: Clock, text: "Live in your first week" },
  { icon: Wrench, text: "Built for storage, not adapted to it" },
  { icon: Zap, text: "storEDGE built in" },
];


export default function CTASection() {
  const { ref, isVisible } = useInView();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [calLoaded, setCalLoaded] = useState(false);
  const [calFailed, setCalFailed] = useState(false);
  const [mobileTab, setMobileTab] = useState<"audit" | "call">("audit");
  const calContainerRef = useRef<HTMLDivElement>(null);
  const calInitRef = useRef(false);

  // Initialize Cal.com embed using the official snippet pattern.
  // The snippet defines window.Cal as a queue, then loads the embed script,
  // which drains the queue. Loading embed.js directly does NOT define the
  // global — calls would no-op and the embed never mounts.
  // 8s timeout fallback for slow networks or blocked CDN.
  // calInitRef guards against React strict-mode double-mount calling
  // Cal("inline", ...) twice (which makes the SDK warn).
  useEffect(() => {
    if (calLoaded || calFailed || calInitRef.current) return;
    calInitRef.current = true;

    type CalFn = ((...args: unknown[]) => void) & {
      loaded?: boolean;
      ns?: Record<string, unknown>;
      q?: unknown[];
    };
    const w = window as unknown as { Cal?: CalFn };

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setCalFailed(true);
    }, 8000);

    try {
      // Official Cal embed snippet (lazy-loads the script on first call).
      (function (C: { Cal?: CalFn; document: Document }, A: string, L: string) {
        const p = (a: CalFn, ar: unknown[]) => {
          (a.q = a.q || []).push(ar);
        };
        const d = C.document;
        const baseFn = ((...args: unknown[]) => {
          const cal = C.Cal as CalFn;
          if (!cal.loaded) {
            cal.ns = {};
            cal.q = cal.q || [];
            const s = d.createElement("script");
            s.src = A;
            s.onerror = () => setCalFailed(true);
            d.head.appendChild(s);
            cal.loaded = true;
          }
          if (args[0] === L) {
            const api: CalFn = ((...inner: unknown[]) => {
              p(api, inner);
            }) as CalFn;
            const namespace = args[1];
            api.q = api.q || [];
            if (typeof namespace === "string") {
              cal.ns = cal.ns || {};
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace] as CalFn, args);
              p(cal, ["initNamespace", namespace]);
            } else {
              p(cal, args);
            }
            return;
          }
          p(cal, args);
        }) as CalFn;
        C.Cal = C.Cal || baseFn;
      })(w as { Cal?: CalFn; document: Document }, "https://app.cal.com/embed/embed.js", "init");

      const cal = w.Cal!;
      cal("init", { origin: "https://cal.com" });
      cal("inline", {
        calLink: CAL_EMBED_SLUG,
        elementOrSelector: "#cal-embed",
        config: { theme: "light", layout: "month_view" },
      });
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#141413" } },
        hideEventTypeDetails: false,
      });

      // Watch for the iframe getting mounted by embed.js to flip loaded state.
      const container = document.querySelector("#cal-embed");
      if (container) {
        const observer = new MutationObserver(() => {
          if (container.querySelector("iframe")) {
            clearTimeout(timeoutId);
            if (!timedOut) setCalLoaded(true);
            observer.disconnect();
          }
        });
        observer.observe(container, { childList: true, subtree: true });
      }
    } catch {
      clearTimeout(timeoutId);
      setCalFailed(true);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [calLoaded, calFailed]);

  function validateField(name: string, value: string) {
    if (name === "email" && value) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return "Please enter a valid email address.";
      }
    }
    if (["name", "email", "facilityName", "location"].includes(name) && !value.trim()) {
      return "This field is required.";
    }
    return "";
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  }

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name } = e.target;
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  }

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Idempotency: prevent double-submit (mobile double-tap, bounce, etc.)
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData) as Record<string, string>;

    // Honeypot: real users leave this hidden field empty. Bots fill every
    // input. If filled, drop the submission silently with a fake "success"
    // so bots don't get feedback to iterate.
    if (data.website_url && data.website_url.trim() !== "") {
      setIsSubmitted(true);
      setIsSubmitting(false);
      return;
    }
    delete data.website_url;

    // 20s timeout so a hung network never leaves the user stuck on "Sending..."
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/audit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (res.ok) {
        setIsSubmitted(true);
      } else if (res.status === 429) {
        setSubmitError(
          "Too many requests from your network. Please wait a minute and try again."
        );
      } else {
        const payload = await res.json().catch(() => null);
        setSubmitError(
          payload?.error ||
            "We couldn't send your audit request. Please try again or email blake@storageads.com."
        );
      }
    } catch (err) {
      const aborted =
        err instanceof DOMException && err.name === "AbortError";
      setSubmitError(
        aborted
          ? "The request took too long. Please check your connection and try again."
          : "Network error. Please check your connection and try again."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="cta"
      aria-label="Request a free facility audit"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div ref={ref} className="section-content">
        <SectionHeader number="08" kicker="FREE AUDIT" right={<SectionMeta text="STEP · FINAL" />} style={{ marginBottom: 24 }} />
        <div
          className={`text-center mb-10 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold max-w-3xl mx-auto"
            style={{ fontSize: "var(--text-section-head)" }}
          >
            <RevealText>Get your free facility audit.</RevealText>
          </h2>
          <p
            className="mt-4 max-w-2xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            Where you sit against the REITs&apos; 92.6% occupancy
            <Cite n={[1, 2]} />. Where revenue&apos;s leaking. What it takes
            to close the gap at your facility. Free, and yours to keep either
            way.
          </p>
          <p
            className="mt-2"
            style={{ color: "var(--text-tertiary)" }}
          >
            No commitment. No sales deck.
          </p>
        </div>

        {/* Mobile toggle tabs */}
        <div className="max-w-5xl mx-auto lg:hidden mb-4">
          <div className="flex rounded-xl overflow-hidden border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setMobileTab("audit")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                mobileTab === "audit"
                  ? "bg-[var(--color-dark)] text-[var(--color-light)]"
                  : "bg-[var(--color-light-gray)] text-[var(--color-muted)]"
              }`}
            >
              Get the audit
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("call")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                mobileTab === "call"
                  ? "bg-[var(--color-dark)] text-[var(--color-light)]"
                  : "bg-[var(--color-light-gray)] text-[var(--color-muted)]"
              }`}
            >
              Book a call
            </button>
          </div>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Audit Form */}
          <div
            className={`bg-[var(--color-light-gray)] border border-[var(--border-subtle)] rounded-2xl p-6 md:p-8 transition-all duration-700 delay-200 ${
              mobileTab !== "audit" ? "hidden lg:block" : ""
            } ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <h3 className="text-lg font-semibold text-[var(--color-dark)] mb-6">
              Facility information.
            </h3>

            {isSubmitted ? (
              <div
                className="text-center py-12"
                role="status"
                aria-live="polite"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-400" />
                </div>
                <h4 className="text-xl font-semibold text-[var(--color-dark)] mb-2">
                  Audit requested
                </h4>
                <p style={{ color: "var(--text-secondary)" }}>
                  You&apos;ll hear from me within 24 hours with the numbers.
                </p>
                <p
                  className="text-sm mt-4"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Don&apos;t want to wait?{" "}
                  <a
                    href={CAL_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                    style={{ color: "var(--color-dark)" }}
                  >
                    Just book a call right now
                  </a>
                  .
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleFormSubmit}
                className="space-y-5"
                aria-label="Free facility audit request"
                noValidate={false}
              >
                {/* Honeypot — visually hidden, but accessible to bots that
                    auto-fill every input. Tab-skipped and aria-hidden so it
                    never reaches real users or assistive tech. */}
                <input
                  type="text"
                  name="website_url"
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
                  <input
                    name="name"
                    placeholder="Your name"
                    required
                    autoComplete="name"
                    autoCapitalize="words"
                    aria-required="true"
                    aria-label="Your name"
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? "name-error" : undefined}
                    onBlur={handleBlur}
                    onChange={handleFieldChange}
                    className="input-field"
                  />
                  {fieldErrors.name && (
                    <p id="name-error" className="text-xs mt-1" style={{ color: "var(--accent)" }}>{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <input
                    name="email"
                    type="email"
                    inputMode="email"
                    placeholder="Email address"
                    required
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-required="true"
                    aria-label="Email address"
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    onBlur={handleBlur}
                    onChange={handleFieldChange}
                    className="input-field"
                  />
                  {fieldErrors.email && (
                    <p id="email-error" className="text-xs mt-1" style={{ color: "var(--accent)" }}>{fieldErrors.email}</p>
                  )}
                </div>
                <div>
                  <input
                    name="facilityName"
                    placeholder="Facility name"
                    required
                    autoComplete="organization"
                    autoCapitalize="words"
                    aria-required="true"
                    aria-label="Facility name"
                    aria-invalid={!!fieldErrors.facilityName}
                    aria-describedby={fieldErrors.facilityName ? "facilityName-error" : undefined}
                    onBlur={handleBlur}
                    onChange={handleFieldChange}
                    className="input-field"
                  />
                  {fieldErrors.facilityName && (
                    <p id="facilityName-error" className="text-xs mt-1" style={{ color: "var(--accent)" }}>{fieldErrors.facilityName}</p>
                  )}
                </div>
                <div>
                  <input
                    name="location"
                    placeholder="Facility location (city, state)"
                    required
                    autoComplete="address-level2"
                    autoCapitalize="words"
                    aria-required="true"
                    aria-label="Facility location (city, state)"
                    aria-invalid={!!fieldErrors.location}
                    aria-describedby={fieldErrors.location ? "location-error" : undefined}
                    onBlur={handleBlur}
                    onChange={handleFieldChange}
                    className="input-field"
                  />
                  {fieldErrors.location && (
                    <p id="location-error" className="text-xs mt-1" style={{ color: "var(--accent)" }}>{fieldErrors.location}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary w-full"
                >
                  {isSubmitting ? "Submitting..." : "Request audit"}
                </button>

                {submitError && (
                  <p
                    role="alert"
                    aria-live="assertive"
                    className="text-sm text-center"
                    style={{ color: "var(--color-red)" }}
                  >
                    {submitError}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 justify-center pt-2">
                  {["Response within 24 hours.", "Free.", "No commitment."].map(
                    (text) => (
                      <p
                        key={text}
                        className="text-xs flex items-center gap-1"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        <Check size={10} style={{ color: "var(--accent)" }} />
                        {text}
                      </p>
                    )
                  )}
                </div>

                {/* Diagnostic upsell — below the form so it doesn't compete */}
                <a
                  href="/diagnostic"
                  className="flex items-center gap-3 border p-4 transition-colors hover:bg-[var(--color-dark)] hover:text-[var(--color-light)] group"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: "var(--color-light)",
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center group-hover:bg-[var(--color-light)] group-hover:text-[var(--color-dark)]"
                    style={{ background: "var(--color-dark)", color: "var(--color-light)" }}
                  >
                    <Zap size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>
                      Want numbers right now? Run the instant diagnostic
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      Scored across 8 categories against industry benchmarks. No waiting.
                    </p>
                  </div>
                  <ArrowRight size={14} className="shrink-0" />
                </a>
              </form>
            )}
          </div>

          {/* Right — Cal.com Full Embed */}
          <div
            className={`bg-[var(--color-light-gray)] border border-[var(--border-subtle)] rounded-2xl p-6 md:p-8 transition-all duration-700 delay-400 ${
              mobileTab !== "call" ? "hidden lg:block" : ""
            } ${
              isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <Calendar size={20} style={{ color: "var(--accent)" }} />
              <h3 className="text-lg font-semibold text-[var(--color-dark)]">
                Book a 30-minute walkthrough
              </h3>
            </div>
            <p
              className="mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              Thirty minutes. Your market map, your competitors, and what the
              system would do at your facility. You talk to the founders, not
              a sales rep.
            </p>

            {/* Cal.com inline embed container */}
            <div
              ref={calContainerRef}
              id="cal-embed"
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: 550 }}
            >
              {/* Cal.com embed script injects the booking UI here */}
              {!calLoaded && !calFailed && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-[var(--color-dark)]/5 flex items-center justify-center">
                    <Calendar size={24} style={{ color: "var(--text-tertiary)" }} />
                  </div>
                  <div className="h-3 w-44 rounded bg-[var(--color-dark)]/5" />
                  <div className="h-3 w-32 rounded bg-[var(--color-dark)]/5" />
                  <div className="mt-4 grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} className="w-7 h-7 rounded bg-[var(--color-dark)]/5" />
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
                    Loading calendar...
                  </p>
                </div>
              )}
              {calFailed && !calLoaded && (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <Calendar size={32} style={{ color: "var(--text-tertiary)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>
                    Calendar couldn&apos;t load.
                  </p>
                  <a
                    href={CAL_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                    style={{ color: "var(--color-dark)" }}
                  >
                    Book directly on Cal.com <ArrowRight size={14} />
                  </a>
                </div>
              )}
            </div>

            {/* Fallback direct link */}
            <a
              href={CAL_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 text-sm font-medium transition-colors hover:text-[var(--color-dark)]"
              style={{ color: "var(--text-secondary)" }}
            >
              Open in new tab <ArrowRight size={14} />
            </a>

            {/* Trust signals */}
            <div className="mt-6 space-y-3">
              {TRUST_SIGNALS.map((signal) => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.text}
                    className="flex items-center gap-3"
                  >
                    <Icon
                      size={16}
                      aria-hidden="true"
                      style={{ color: "var(--text-tertiary)" }}
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {signal.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
