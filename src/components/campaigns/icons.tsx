import {
  BarChart3,
  Building2,
  CalendarCheck,
  FileText,
  GitBranch,
  KeyRound,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareQuote,
  Newspaper,
  PenLine,
  Phone,
  Search,
  Share2,
  Sparkles,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Building2,
  CalendarCheck,
  FileText,
  GitBranch,
  KeyRound,
  ListChecks,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareQuote,
  Newspaper,
  PenLine,
  Phone,
  Search,
  Share2,
  Sparkles,
  Tag,
  Users,
};

export function NodeIcon({ name, className, color }: { name: string; className?: string; color?: string }) {
  const Icon = ICONS[name] ?? GitBranch;
  return <Icon aria-hidden className={className} style={color ? { color } : undefined} strokeWidth={2.25} />;
}
