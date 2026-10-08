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
import { typeHue } from "@/lib/ontology/registry";
import type { ObjectTypeKey } from "@/lib/ontology/types";

/**
 * An object's mark: four cells, generated from its address, drawn in its
 * type's hue. Same address, same mark, on every screen. Decorative to
 * assistive tech: the object's name always sits next to it.
 */
export function ObjectMark({
  address,
  type,
  size = 20,
  className = "",
}: {
  address: string;
  type: ObjectTypeKey;
  size?: number;
  className?: string;
}) {
  const cells = markFor(address);
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      style={{ color: typeHue(type) }}
      shapeRendering="geometricPrecision"
    >
      {cells.map((cell, i) => {
        const d = GLYPH_PATHS[cell.glyph];
        if (!d) return null;
        const x = (i % 2) * 10;
        const y = Math.floor(i / 2) * 10;
        return (
          <path
            key={i}
            d={d}
            fill="currentColor"
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
  inverted = false,
}: {
  type: ObjectTypeKey;
  className?: string;
  /** On a selected (inverted) pane the glyph takes the pane's ink. */
  inverted?: boolean;
}) {
  const Icon = TYPE_ICONS[type];
  return (
    <Icon
      aria-hidden="true"
      className={className}
      style={{ color: inverted ? "var(--onto-selected-ink)" : typeHue(type) }}
      strokeWidth={2.25}
    />
  );
}
