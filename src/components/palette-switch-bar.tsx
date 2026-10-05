"use client";

import { usePathname } from "next/navigation";
import PaletteSwitch from "@/components/palette-switch";

const HIDDEN_PREFIXES = ["/admin", "/portal", "/partner", "/manage"];

/**
 * In-flow theme row for public pages that do not render the marketing nav.
 * The homepage carries the same control in the nav and footer instead.
 */
export default function PaletteSwitchBar() {
  const path = usePathname() || "/";
  if (path === "/" || HIDDEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--bg)",
        padding:
          "16px 20px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          Theme
        </span>
        <PaletteSwitch />
      </div>
    </div>
  );
}
