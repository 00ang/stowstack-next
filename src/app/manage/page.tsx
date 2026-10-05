"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { savePortalSession } from "@/lib/portal-helpers";

/**
 * Invite entry for the facility tools. Clients don't come through here: their
 * portal login opens the tools. This page is for owners we've handed an
 * invite code: it creates their facility and a portal login, signs them in,
 * and drops them in /portal/tools. Coming back is the normal portal login.
 */
export default function ManageInvitePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/manage/scratch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: inviteCode.trim(),
          name: name.trim(),
          location: location.trim(),
          contact_email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.portal) {
        setError(data?.error || "Couldn't set up your account. Check your invite code.");
        return;
      }
      // Signed in to the portal (and, via cookie, the tools) in one step.
      savePortalSession(data.portal.email, data.portal.accessCode);
      router.push("/portal/tools");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none focus:border-[var(--color-dark)]/50";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-light)] px-4 py-16 text-[var(--color-dark)]">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <div className="text-2xl font-semibold lowercase tracking-tight">storageads</div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Set up your facility</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-body-text)]">
            Got an invite code from us? Add your facility and you&apos;re in.
          </p>
        </header>

        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--color-red-light)] p-3 text-sm text-[var(--color-red)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="invite-code" className="mb-1 block text-sm font-medium">Invite code</label>
            <input id="invite-code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} autoComplete="off" className={inputClass} />
          </div>
          <div>
            <label htmlFor="invite-name" className="mb-1 block text-sm font-medium">Facility name</label>
            <input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Downtown Self Storage" className={inputClass} />
          </div>
          <div>
            <label htmlFor="invite-location" className="mb-1 block text-sm font-medium">Location</label>
            <input id="invite-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" className={inputClass} />
          </div>
          <div>
            <label htmlFor="invite-email" className="mb-1 block text-sm font-medium">Email</label>
            <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@facility.com" className={inputClass} />
            <p className="mt-1.5 text-xs text-[var(--color-mid-gray)]">You&apos;ll sign in with this. We email you a code, no password.</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !inviteCode.trim() || !name.trim() || !location.trim() || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] hover:opacity-90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Setting up…" : "Set up my facility"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[var(--color-body-text)]">
          Already a client?{" "}
          <Link href="/portal/tools" className="font-semibold text-[var(--color-dark)] underline underline-offset-2">
            Sign in to your portal
          </Link>
        </p>
      </div>
    </main>
  );
}
