"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { usePartnerAuth } from "@/components/partner/use-partner-auth";
import { OwnerTools } from "@/components/owner-tools/owner-tools";

/**
 * Facility tools for partner orgs, across every facility in the org. The
 * partner session opens them (POST /api/org-tools-session sets the tools
 * cookie), then it's the same tools the client portal gets.
 */
export default function PartnerToolsPage() {
  const { authFetch } = usePartnerAuth();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "ready"; count: number } | { kind: "error"; message: string }>({
    kind: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/org-tools-session", { method: "POST" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setState({ kind: "ready", count: data.facilityCount ?? 0 });
        else setState({ kind: "error", message: data.error || "Couldn't open the facility tools. Refresh to try again." });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error", message: "Couldn't open the facility tools. Refresh to try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (state.kind === "loading") {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--color-body-text)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening your tools…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div role="alert" className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-lg bg-[var(--color-red-light)] p-3 text-sm text-[var(--color-red)]">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {state.message}
      </div>
    );
  }

  if (state.count === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h2 className="text-lg font-semibold text-[var(--color-dark)]">No facilities yet</h2>
        <p className="mt-2 text-sm text-[var(--color-body-text)]">Add a facility and its tools show up here.</p>
        <Link
          href="/partner/facilities"
          className="mt-6 inline-flex rounded-lg bg-[var(--color-dark)] px-4 py-2.5 text-sm font-semibold text-[var(--color-light)] hover:opacity-90"
        >
          Go to Facilities
        </Link>
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-6">
      <OwnerTools upgradeHref="/partner/settings" />
    </div>
  );
}
