'use client'

import {
  CheckCircle2, AlertTriangle, XCircle, Zap, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react'

/* ── Types ── */

export interface FacilityLevel {
  total_units: number
  occupied_units: number
  vacant_units: number
  physical_occ_pct: number
  economic_occ_pct: number
  occupancy_gap: number
  gross_potential: number
  actual_revenue: number
  total_sqft: number
  occupied_sqft: number
  sqft_occ_pct: number
  sqft_econ_occ_pct: number
}

export interface GapDecomposition {
  vacancy_loss: number
  vacancy_drag_pct: number
  rate_gap_loss: number
  rate_gap_drag_pct: number
  discount_drag: number
  discount_drag_pct: number
  delinquency_drag: number
  delinquency_drag_pct: number
  total_drag: number
}

export interface AgingBuckets {
  current: number
  days_31_60: number
  days_61_90: number
  days_91_120: number
  days_120_plus: number
  total: number
  count: number
}

export interface UnitOccupancy {
  unit_type: string
  size_label: string
  sqft: number
  total_count: number
  occupied_count: number
  vacant_count: number
  street_rate: number
  actual_avg_rate: number
  physical_occ_pct: number
  economic_occ_pct: number
  gap: number
  gap_signal: 'aligned' | 'mild' | 'moderate' | 'severe'
  gross_potential: number
  actual_revenue: number
  vacancy_cost_monthly: number
  rate_gap_monthly: number
  total_sqft: number
  occupied_sqft: number
  revenue_per_sqft: number
  potential_per_sqft: number
}

export interface OccupancyTrendEntry {
  year: number
  month: string
  month_short: string
  revenue: number
  move_ins: number
  move_outs: number
  net_movement: number
}

export interface DiscountedTenant {
  unit: string
  tenant: string
  unit_type: string
  standard_rate: number
  actual_rate: number
  discount: number
  discount_desc: string
  days_as_tenant: number
}

export interface DelinquentTenant {
  unit: string
  tenant: string
  size: string
  rent_rate: number
  total_due: number
  days_past_due: number
  paid_thru: string
  risk_level: 'low' | 'moderate' | 'high' | 'critical'
}

export interface BelowStreetBand {
  count: number
  loss: number
}

export interface Insight {
  type: 'success' | 'warning' | 'critical' | 'opportunity' | 'info'
  title: string
  detail: string
}

export interface OccData {
  facility_level: FacilityLevel
  gap_decomposition: GapDecomposition
  aging_buckets: AgingBuckets
  unit_occupancy: UnitOccupancy[]
  occupancy_trend: OccupancyTrendEntry[]
  snapshot_trend: unknown[]
  discounted_tenants: DiscountedTenant[]
  below_street_bands: { slight: BelowStreetBand; moderate: BelowStreetBand; severe: BelowStreetBand }
  delinquent_tenants: DelinquentTenant[]
  insights: Insight[]
}

/* ── Helpers ── */

export function money(val: number | null | undefined) {
  if (val == null) return '--'
  return '$' + Math.round(val).toLocaleString()
}

export function pct(val: number | null | undefined) {
  if (val == null) return '--'
  return val.toFixed(1) + '%'
}

export const GAP_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  aligned: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Aligned' },
  mild: { bg: 'bg-[var(--color-blue)]/10', text: 'text-[var(--color-blue)]', label: 'Mild Gap' },
  moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Moderate Gap' },
  severe: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Severe Gap' },
}

export const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-[var(--color-blue)]/10', text: 'text-[var(--color-blue)]' },
  moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

export const INSIGHT_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  critical: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/5', border: 'border-red-500/20' },
  opportunity: { icon: Zap, color: 'text-[var(--color-gold)]', bg: 'bg-[var(--color-gold)]/5', border: 'border-[var(--color-gold)]/20' },
  info: { icon: Info, color: 'text-[var(--color-body-text)]', bg: 'bg-[var(--color-light-gray)]', border: 'border-[var(--border-subtle)]' },
}

/* ── Dual Gauge SVG ── */

export function DualGauge({ physical, economic, size = 200 }: { physical: number; economic: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 12
  const innerR = size / 2 - 30
  const startAngle = -210
  const endAngle = 30
  const sweep = endAngle - startAngle

  function arcPath(r: number, pctVal: number) {
    const angle = startAngle + (sweep * Math.min(pctVal, 100) / 100)
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (angle * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const largeArc = (angle - startAngle) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const gap = physical - economic

  return (
    <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.85}`}>
      <path d={arcPath(outerR, 100)} fill="none" stroke="var(--color-light-gray)" strokeWidth="10" strokeLinecap="round" />
      <path d={arcPath(innerR, 100)} fill="none" stroke="var(--color-light-gray)" strokeWidth="10" strokeLinecap="round" />
      <path d={arcPath(outerR, physical)} fill="none" stroke="url(#physGrad)" strokeWidth="10" strokeLinecap="round" />
      <path d={arcPath(innerR, economic)} fill="none" stroke="url(#econGrad)" strokeWidth="10" strokeLinecap="round" />
      <defs>
        <linearGradient id="physGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
        <linearGradient id="econGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <text x={cx} y={cy - 16} textAnchor="middle" fill="var(--color-mid-gray)" fontSize="10" fontWeight="500">GAP</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill={gap > 5 ? '#ef4444' : gap > 2 ? '#AB5505' : '#10b981'} fontSize="28" fontWeight="700">
        {gap.toFixed(1)}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--color-mid-gray)" fontSize="10">points</text>
    </svg>
  )
}

/* ── Stacked Bar ── */

export function StackedBar({ segments, height = 28 }: { segments: { value: number; color: string; label: string }[]; height?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  return (
    <div className="w-full flex rounded-full overflow-hidden" style={{ height }}>
      {segments.filter(s => s.value > 0).map((seg, i) => (
        <div
          key={i}
          className={`${seg.color} relative group`}
          style={{ width: `${(seg.value / total) * 100}%`, minWidth: seg.value > 0 ? '2px' : 0 }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-semibold text-white drop-shadow-sm whitespace-nowrap">
              {seg.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Section Header ── */

export function SectionHeader({ icon, title, subtitle, expanded, onToggle }: {
  icon: React.ReactNode; title: string; subtitle: string
  expanded: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h3 className="font-semibold text-[var(--color-dark)]">{title}</h3>
          <p className="text-xs text-[var(--color-mid-gray)]">{subtitle}</p>
        </div>
      </div>
      {expanded ? <ChevronUp size={18} className="text-[var(--color-mid-gray)]" /> : <ChevronDown size={18} className="text-[var(--color-mid-gray)]" />}
    </button>
  )
}
