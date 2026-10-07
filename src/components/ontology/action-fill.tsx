import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A clickable thing in the ontology layer. No primary colour: every button
 * takes its own fill from the six, in turn, so neighbours never match
 * (pass the button's position in its row as `n`). Ink text clears 8.8:1 on
 * every fill. Frameless and square.
 */
export function ActionFill({
  href,
  n,
  children,
  onClick,
  className = "",
}: {
  href?: string;
  n: number;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const fill = String((((n % 6) + 6) % 6) + 1);
  const cls = `act-fill inline-flex min-h-10 items-center justify-center px-3.5 text-[13px] font-bold leading-tight ${className}`;
  if (href) {
    return (
      <Link href={href} data-fill={fill} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" data-fill={fill} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}
