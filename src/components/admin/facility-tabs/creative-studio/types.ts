/* ── Types ───────────────────────────────────────────────────── */

export interface MetaAdContent {
  angle: string;
  angleLabel: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  targetingNote: string;
}

export interface GoogleRSAContent {
  name: string;
  headlines: { text: string; pin_position?: number | null }[];
  descriptions: { text: string }[];
  finalUrl: string;
  sitelinks: { title: string; description: string }[];
  keywords?: string[];
}

export interface LandingPageContent {
  sections: {
    section_type: string;
    sort_order: number;
    config: Record<string, unknown>;
  }[];
  meta_title: string;
  meta_description: string;
}

export interface EmailDripContent {
  sequence: {
    step: number;
    delayDays: number;
    subject: string;
    preheader: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
    label: string;
  }[];
}

export interface AdVariation {
  id: string;
  facility_id: string;
  brief_id: string | null;
  created_at: string;
  platform: string;
  format: string;
  angle: string;
  content_json:
    | MetaAdContent
    | GoogleRSAContent
    | LandingPageContent
    | EmailDripContent
    | Record<string, unknown>;
  asset_urls: Record<string, string> | null;
  status: string;
  feedback: string | null;
  version: number;
  compliance_status: string | null;
  compliance_flags: ComplianceFlag[] | null;
  source_proven_ad_id?: string | null;
}

export interface ComplianceFlag {
  severity: "warning" | "violation";
  rule: string;
  detail: string;
  field: string;
}

export type GenerationPlatform =
  | "meta_feed"
  | "google_search"
  | "landing_page"
  | "email_drip"
  | "all";

/* ── Constants ───────────────────────────────────────────────── */

export const VARIATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--color-light-gray)] text-[var(--color-body-text)]",
  review: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-emerald-500/10 text-emerald-400",
  published: "bg-green-500/10 text-green-400",
  rejected: "bg-red-500/10 text-red-400",
};

export const ANGLE_ICONS: Record<string, string> = {
  social_proof: "⭐",
  convenience: "📍",
  urgency: "⏰",
  lifestyle: "🏡",
  rsa: "🔍",
  full_page: "📄",
  nurture_sequence: "📧",
};

export const PLATFORM_LABELS: Record<string, string> = {
  meta_feed: "Meta Ads",
  google_search: "Google RSA",
  landing_page: "Landing Page",
  email_drip: "Email Drip",
};

export const PLATFORM_ICONS: Record<string, string> = {
  meta_feed: "📱",
  google_search: "🔍",
  landing_page: "📄",
  email_drip: "📧",
};

export const GENERATION_OPTIONS: {
  id: GenerationPlatform;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    id: "meta_feed",
    label: "Meta Ads",
    icon: "📱",
    desc: "4 ad variations with distinct angles",
  },
  {
    id: "google_search",
    label: "Google RSA",
    icon: "🔍",
    desc: "15 headlines + 4 descriptions + sitelinks",
  },
  {
    id: "landing_page",
    label: "Landing Page",
    icon: "📄",
    desc: "Full page copy — hero, features, FAQ, CTA",
  },
  {
    id: "email_drip",
    label: "Email Drip",
    icon: "📧",
    desc: "4-email nurture sequence",
  },
  {
    id: "all",
    label: "Generate All",
    icon: "✨",
    desc: "All platforms in one shot",
  },
];

export const CTA_OPTIONS = ["Learn More", "Get Quote", "Book Now", "Contact Us", "Sign Up"];
