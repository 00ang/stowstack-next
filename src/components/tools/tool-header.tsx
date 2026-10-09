import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";
import { Logo } from "@/components/brand/logo";

/**
 * Sticky header shared across the /tools pages. No hooks, so it works in both
 * server (index page) and client (calculator) components. `backHref` controls
 * where the back arrow returns to ("/" from the index, "/tools" from a tool).
 */
export default function ToolHeader({
  backHref = "/tools",
  backLabel = "Back to tools",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b print:hidden"
      style={{
        background: "color-mix(in srgb, var(--bg) 90%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            aria-label={backLabel}
            className="p-2 -ml-2 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-tertiary)" }}
          >
            <ArrowLeft size={20} />
          </Link>
          <Link href="/" className="hover:opacity-80 transition-opacity" aria-label="StorageAds">
            <Logo mark={28} />
          </Link>
        </div>
        <a
          href={CAL_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--color-dark)", color: "var(--color-light)" }}
        >
          Book a Call
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}

/** Shared dark CTA block used at the foot of each tool. */
export function ToolCta({
  heading,
  body,
}: {
  heading: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl p-7 sm:p-8 text-center"
      style={{ background: "var(--color-dark)", color: "var(--color-light)" }}
    >
      <h3 className="text-xl font-bold mb-2">{heading}</h3>
      <p
        className="text-sm mb-6 max-w-md mx-auto leading-relaxed"
        style={{ color: "var(--color-mid-gray)" }}
      >
        {body}
      </p>
      <a
        href={CAL_BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ background: "var(--color-light)", color: "var(--color-dark)" }}
      >
        Book a Call
        <ArrowRight className="h-4 w-4" />
      </a>
    </div>
  );
}
