import {
  ImageIcon, Package, Star, Sunrise, Type, Pencil, RefreshCw, Sparkles,
} from 'lucide-react'
import { createElement } from 'react'

/* ── Types ── */

export interface ImageTemplate {
  id: string
  name: string
  description: string
  aspect: string
}

export interface GenerationJob {
  id: string
  templateId: string
  templateName: string
  status: 'generating' | 'succeeded' | 'failed'
  imageUrl: string | null
  prompt: string
  error: string | null
  aspect: string
}

export interface MetaAdContent {
  angle: string
  angleLabel: string
  primaryText: string
  headline: string
  description: string
  cta: string
  targetingNote: string
}

export interface FunnelConfig {
  landingHero: string
  landingFeatures: string[]
  postConversion: { channel: 'sms' | 'email'; message: string; timing: string }[]
  retargeting: string
}

export interface AdVariation {
  id: string
  facility_id: string
  brief_id: string | null
  created_at: string
  platform: string
  format: string
  angle: string
  content_json: MetaAdContent | Record<string, unknown>
  asset_urls: Record<string, string> | null
  status: string
  feedback: string | null
  version: number
  funnel_config?: FunnelConfig | null
  funnel_metrics?: Record<string, unknown> | null
  source_proven_ad_id?: string | null
}

export interface Asset {
  id: string
  facility_id: string
  created_at: string
  type: string
  source: string
  url: string
  metadata: Record<string, unknown> | null
}

export type AdFormat = 'instagram_post' | 'instagram_story' | 'facebook_feed' | 'google_display'
export type StudioStep = 'copy' | 'image' | 'preview'

export const AD_FORMATS: { id: AdFormat; label: string; width: number; height: number }[] = [
  { id: 'instagram_post', label: 'Instagram Post', width: 1080, height: 1080 },
  { id: 'instagram_story', label: 'Instagram Story', width: 1080, height: 1920 },
  { id: 'facebook_feed', label: 'Facebook Feed', width: 1200, height: 628 },
  { id: 'google_display', label: 'Google Display', width: 300, height: 250 },
]

export const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  ad_hero: createElement(ImageIcon, { size: 14 }),
  ad_hero_wide: createElement(Sunrise, { size: 14 }),
  lifestyle_moving: createElement(Package, { size: 14 }),
  lifestyle_organized: createElement(Sparkles, { size: 14 }),
  lifestyle_packing: createElement(Package, { size: 14 }),
  social_promo: createElement(Type, { size: 14 }),
  social_seasonal: createElement(Star, { size: 14 }),
  before_after: createElement(RefreshCw, { size: 14 }),
  text_ad: createElement(Pencil, { size: 14 }),
  story_bg: createElement(ImageIcon, { size: 14 }),
}

export const ASPECT_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Wide',
  '4:5': 'Portrait',
  '9:16': 'Story',
}

export const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-[var(--color-light-gray)] text-[var(--color-body-text)]',
  approved: 'bg-emerald-500/10 text-emerald-400',
  published: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
}

export interface ArchetypeFunnel {
  name: string
  landingHero: string
  landingFeatures: string[]
  postConversion: { channel: 'sms' | 'email'; message: string; timing: string }[]
  retargeting: string | null
  principle: string
}

export const ARCHETYPE_FUNNELS: Record<string, ArchetypeFunnel> = {
  social_proof: {
    name: 'The Trusted Choice',
    landingHero: 'Join [count] families who trust [Facility]. [Rating]\u2605 rated.',
    landingFeatures: ['Review highlights', 'Move-in count this month', 'Years in business', 'storEDGE reservation embed'],
    postConversion: [
      { channel: 'sms', message: 'Your unit is reserved! Here\'s your access info.', timing: 'Immediate' },
      { channel: 'email', message: 'Welcome to [Facility] \u2014 here\'s what your neighbors say about us.', timing: 'Day 1' },
    ],
    retargeting: '"Still looking? [Rating]\u2605 from [count] reviews. Your unit is waiting."',
    principle: 'Trust builds conversion. Lead with proof, reinforce with community.',
  },
  convenience: {
    name: 'The Easy Move',
    landingHero: '[Facility] on [Street] \u2014 5 min from you. Reserve in 60 seconds.',
    landingFeatures: ['Map/proximity emphasis', 'No lease required', 'Online reservation', 'storEDGE embed with all sizes'],
    postConversion: [
      { channel: 'sms', message: 'Reserved! Your unit is at [Address]. Access code: [code].', timing: 'Immediate' },
      { channel: 'sms', message: 'Moving tip: here\'s what fits in your [size] unit.', timing: 'Day 2' },
    ],
    retargeting: '"[Facility] is 5 minutes away. $X/mo, no lease. Reserve now."',
    principle: 'Remove every friction point. Speed and proximity are the value.',
  },
  urgency: {
    name: 'The Last Chance',
    landingHero: '[X] units left at $X/mo. This rate won\'t last.',
    landingFeatures: ['Live availability count', 'Rate lock messaging', 'Countdown or scarcity indicator', 'storEDGE embed filtered to available'],
    postConversion: [
      { channel: 'sms', message: 'Locked in! Your $X/mo rate is secured.', timing: 'Immediate' },
      { channel: 'email', message: 'Smart move \u2014 rates are going up next month. You\'re set.', timing: 'Day 1' },
    ],
    retargeting: '"The [size] at $X/mo you looked at is still available \u2014 for now."',
    principle: 'Real urgency only. Inventory-backed scarcity, not manufactured fear.',
  },
  lifestyle: {
    name: 'The Fresh Start',
    landingHero: 'Finally, room to breathe. Climate-controlled from $X/mo.',
    landingFeatures: ['Emotional imagery \u2014 clean spaces, organized life', 'Climate-controlled emphasis', 'Before/after visualization', 'storEDGE embed with small/medium units'],
    postConversion: [
      { channel: 'email', message: 'What to store and what to let go \u2014 a simple guide.', timing: 'Day 2' },
      { channel: 'email', message: 'How [Facility] keeps your belongings safe.', timing: 'Day 5' },
      { channel: 'email', message: 'Your neighbors trust us \u2014 [Rating]\u2605 from [count] reviews.', timing: 'Day 9' },
      { channel: 'email', message: 'Your space is waiting. Lock in $X/mo.', timing: 'Day 14' },
    ],
    retargeting: '"Still thinking about it? Your [size] at $X/mo is waiting."',
    principle: 'Sell the feeling, not the feature. Nurture over 2 weeks \u2014 no pressure.',
  },
}
