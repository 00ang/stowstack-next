import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The Instrument Calm button pair (reference library 008): primary is an ink
 * fill with white type; secondary is an ink frame on the pane. Square,
 * Manrope 700. Both swap on the black theme (light fill, light frame).
 */
export function IcButton({
  href,
  variant = "primary",
  children,
  onClick,
  className = "",
}: {
  href?: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const look =
    variant === "primary"
      ? "bg-[var(--ic-primary)] text-[var(--ic-on-primary)] border-2 border-[var(--ic-primary)] hover:bg-[var(--ic-secondary)] hover:border-[var(--ic-secondary)]"
      : "bg-transparent text-[var(--ic-ink)] border-2 border-[var(--ic-ink)] hover:bg-[var(--ic-soft)]";
  const cls = `inline-flex min-h-10 items-center justify-center px-4 text-[14px] font-bold leading-tight transition-colors duration-[240ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ic-selected)] ${look} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
