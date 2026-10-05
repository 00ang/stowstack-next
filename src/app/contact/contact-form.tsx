"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";

export default function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || submitted) return;
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form) as Record<string, string>;
    if (payload.website_url?.trim()) {
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/audit-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "contact",
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          message: payload.message,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 429) {
        setError("Too many requests. Wait a minute and try again.");
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Couldn't send. Email blake@storageads.com.");
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setError(
        aborted
          ? "The request took too long. Check your connection."
          : "Network error. Check your connection."
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
    >
      <header
        className="sticky top-0 z-[100] border-b"
        style={{
          background: "var(--color-light)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-6">
          <Link
            href="/"
            className="p-2 -ml-2 transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="Back to homepage"
          >
            <ArrowLeft size={20} />
          </Link>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}>
            <span style={{ color: "var(--color-dark)" }}>storage</span>
            <span style={{ color: "var(--brand-ads)" }}>ads</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-semibold" style={{ letterSpacing: "-0.03em" }}>
          Talk to us.
        </h1>
        <p className="mt-3 max-w-xl" style={{ color: "var(--text-secondary)" }}>
          Leave your name and how to reach you. We&apos;ll get back within a business
          day. Or{" "}
          <a href={CAL_BOOKING_URL} className="underline" target="_blank" rel="noopener noreferrer">
            book a 30-minute call
          </a>
          .
        </p>

        {submitted ? (
          <div className="mt-10 rounded-2xl border p-8 text-center" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-green)]/15">
              <Check size={22} style={{ color: "var(--color-green)" }} />
            </div>
            <p className="text-lg font-semibold">Message received.</p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              We&apos;ll follow up at the email or number you left.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-4" noValidate>
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
            <input
              name="name"
              placeholder="Your name"
              required
              autoComplete="name"
              className="input-field"
              aria-label="Your name"
            />
            <input
              name="email"
              type="email"
              inputMode="email"
              placeholder="Email"
              required
              autoComplete="email"
              className="input-field"
              aria-label="Email"
            />
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="Phone (optional)"
              autoComplete="tel"
              className="input-field"
              aria-label="Phone"
            />
            <textarea
              name="message"
              placeholder="What do you want to talk about?"
              rows={4}
              className="input-field"
              aria-label="Message"
            />
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Sending…" : "Send message"}
            </button>
            {error && (
              <p role="alert" className="text-sm" style={{ color: "var(--color-red)" }}>
                {error}
              </p>
            )}
            <p className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
              Prefer email?{" "}
              <a href="mailto:blake@storageads.com" className="underline">
                blake@storageads.com
              </a>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
