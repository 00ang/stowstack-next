import {
  Building2,
  Tag,
  GitBranch,
  Sparkles,
  FileText,
  Link2,
  Newspaper,
  UserRound,
  CalendarCheck,
  KeyRound,
  MessageSquareQuote,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { GLYPH_PATHS, markFor } from "@/lib/ontology/mark";
import type { ObjectTypeKey } from "@/lib/ontology/types";

/**
 * An object's mark: a heavy square frame holding four line-drawn cells,
 * generated from its address, in ink. Same address, same mark, on every
 * screen. Decorative to assistive tech: the object's name always sits next to
 * it. Below 20px the strokes stop reading, so 20 is the floor.
 */
export function ObjectMark({
  address,
  size = 24,
  className = "",
}: {
  address: string;
  size?: number;
  className?: string;
}) {
  const cells = markFor(address);
  const px = Math.max(20, size);
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      style={{ color: "var(--ic-ink)" }}
    >
      <rect x="1" y="1" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {cells.map((cell, i) => {
        const d = GLYPH_PATHS[cell.glyph];
        if (!d) return null;
        const x = 2 + (i % 2) * 10;
        const y = 2 + Math.floor(i / 2) * 10;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="square"
            transform={`translate(${x} ${y}) rotate(${cell.turn * 90} 5 5)`}
          />
        );
      })}
    </svg>
  );
}

/** The lucide glyph for each kind of object. Kinds take icons; instances take marks. */
export const TYPE_ICONS: Record<ObjectTypeKey, LucideIcon> = {
  units: Building2,
  offers: Tag,
  campaigns: GitBranch,
  ads: Sparkles,
  pages: FileText,
  links: Link2,
  posts: Newspaper,
  leads: UserRound,
  tours: CalendarCheck,
  tenants: KeyRound,
  reviews: MessageSquareQuote,
  competitors: MapPin,
};

export function TypeGlyph({
  type,
  className = "h-5 w-5",
  selected = false,
}: {
  type: ObjectTypeKey;
  className?: string;
  /** On the selected pane the glyph takes the signal. */
  selected?: boolean;
}) {
  const Icon = TYPE_ICONS[type];
  return (
    <Icon
      aria-hidden="true"
      className={className}
      style={{ color: selected ? "var(--ic-selected)" : "var(--ic-ink)" }}
      strokeWidth={1.75}
    />
  );
}
