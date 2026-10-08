'use client'

import {
  TrendingUp, Activity, Users, Target, ShieldAlert, Droplets,
} from 'lucide-react'
import { money, SectionHeader } from './shared'
import type { RevenueMonth, HealthBreakdown, Waterfall } from './types'

/* ── Revenue Trend ── */

function RevenueTrend({ revenueHistory, expanded, onToggle }: {
  revenueHistory: RevenueMonth[]
  expanded: boolean
  onToggle: () => void
}) {
  if (revenueHistory.length === 0) return null
  const maxRevenue = Math.max(...revenueHistory.map(r => r.revenue || 0), 1)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <SectionHeader
        icon={<TrendingUp size={18} className="text-indigo-500" />}
        title="Revenue Trend"
        subtitle={`${revenueHistory.length} months of history`}
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <div className="flex items-end gap-1 h-40 mb-3">
            {revenueHistory.map((m, i) => {
              const h = maxRevenue > 0 ? (m.revenue / maxRevenue * 100) : 0
              const isLatest = i === revenueHistory.length - 1
              return (
                <div key={i} className="flex-1 flex flex-col items-center group relative">
                  <div className="w-full relative">
                    <div
                      className={`w-full rounded-t transition-colors ${isLatest ? 'bg-emerald-500' : 'bg-indigo-500/40 group-hover:bg-indigo-500'}`}
                      style={{ height: `${Math.max(h, 2)}%`, minHeight: '2px' }}
                    />
                  </div>
                  <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 px-2 py-1 rounded text-xs whitespace-nowrap bg-[var(--color-light-gray)] text-[var(--color-dark)] border border-[var(--border-subtle)]">
                    {m.month.slice(0, 3)} {m.year}: {money(m.revenue)}<br />{'\u2191'}{m.move_ins} {'\u2193'}{m.move_outs}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-1">
            {revenueHistory.map((m, i) => (
              <div key={i} className="flex-1 text-center">
                {i % 3 === 0 && <span className="text-[9px] text-[var(--color-mid-gray)]">{m.month.slice(0, 3)} ’{String(m.year).slice(2)}</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg p-3 bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-xs font-medium text-[var(--color-mid-gray)]">Total Move-Ins (shown period)</p>
              <p className="text-lg font-semibold text-emerald-500">{revenueHistory.reduce((sum, m) => sum + (m.move_ins || 0), 0)}</p>
            </div>
            <div className="rounded-lg p-3 bg-red-500/5 border border-red-500/20">
              <p className="text-xs font-medium text-[var(--color-mid-gray)]">Total Move-Outs (shown period)</p>
              <p className="text-lg font-semibold text-red-500">{revenueHistory.reduce((sum, m) => sum + (m.move_outs || 0), 0)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Health Score ── */

function HealthScore({ health, expanded, onToggle }: {
  health: HealthBreakdown
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <SectionHeader
        icon={<Activity size={18} className={health.overall >= 75 ? 'text-emerald-500' : health.overall >= 50 ? 'text-amber-500' : 'text-red-500'} />}
        title="Facility Health Score"
        subtitle="Composite score across 5 key dimensions"
        expanded={expanded}
        onToggle={onToggle}
        rightContent={
          <div className={`text-2xl font-semibold ${health.overall >= 75 ? 'text-emerald-500' : health.overall >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
            {health.overall}
          </div>
        }
      />
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4 space-y-5">
          {/* Big gauge */}
          <div className="flex justify-center">
            <div className="relative w-48 h-24 overflow-hidden">
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke="var(--color-light-gray)" strokeWidth="12" strokeLinecap="round" />
                <path
                  d="M 20 95 A 80 80 0 0 1 180 95"
                  fill="none"
                  stroke={health.overall >= 75 ? '#10b981' : health.overall >= 50 ? '#AB5505' : '#ef4444'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${health.overall * 2.51} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex items-end justify-center pb-1">
                <span className={`text-4xl font-semibold ${health.overall >= 75 ? 'text-emerald-500' : health.overall >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                  {health.overall}
                </span>
                <span className="text-sm ml-1 mb-1 text-[var(--color-mid-gray)]">/100</span>
              </div>
            </div>
          </div>

          {/* Component breakdowns */}
          <div className="space-y-3">
            {[
              { label: 'Physical Occupancy', data: health.occupancy, detail: `${health.occupancy.value.toFixed(1)}% occupied`, icon: <Users size={14} /> },
              { label: 'Rate Capture', data: health.rate_capture, detail: `${health.rate_capture.value.toFixed(1)}% of potential`, icon: <Target size={14} /> },
              { label: 'Rate Optimization', data: health.rate_optimization, detail: `${health.rate_optimization.value} ECRI eligible`, icon: <TrendingUp size={14} /> },
              { label: 'Collections Health', data: health.delinquency, detail: money(health.delinquency.value) + ' outstanding', icon: <ShieldAlert size={14} /> },
              { label: 'Revenue Trend', data: health.trend, detail: health.trend.value != null ? `${health.trend.value > 0 ? '+' : ''}${health.trend.value}% MoM` : 'No history', icon: <TrendingUp size={14} /> },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={item.data.score >= 75 ? 'text-emerald-500' : item.data.score >= 50 ? 'text-amber-500' : 'text-red-500'}>{item.icon}</span>
                    <span className="text-sm font-medium text-[var(--color-dark)]">{item.label}</span>
                    <span className="text-xs text-[var(--color-mid-gray)]">({item.data.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-mid-gray)]">{item.detail}</span>
                    <span className={`text-sm font-semibold ${item.data.score >= 75 ? 'text-emerald-500' : item.data.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {item.data.score}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-light-gray)]">
                  <div
                    className={`h-2 rounded-full transition-all ${item.data.score >= 75 ? 'bg-emerald-500' : item.data.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${item.data.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Revenue Waterfall ── */

function RevenueWaterfall({ waterfall, expanded, onToggle }: {
  waterfall: Waterfall
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <SectionHeader
        icon={<Droplets size={18} className="text-cyan-500" />}
        title="Revenue Waterfall"
        subtitle="Where your potential revenue goes"
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          {(() => {
            const maxVal = waterfall.gross_potential || 1
            const steps = [
              { label: 'Gross Potential', value: waterfall.gross_potential, color: 'bg-[var(--color-gold)]', type: 'total' as const },
              { label: 'Vacancy Loss', value: -waterfall.vacancy_loss, color: 'bg-red-400', type: 'loss' as const },
              { label: 'Rate Gap (Below Street)', value: -waterfall.rate_gap_loss, color: 'bg-amber-400', type: 'loss' as const },
              { label: 'Delinquency', value: -waterfall.delinquency_loss, color: 'bg-orange-400', type: 'loss' as const },
              { label: 'Actual Collected', value: waterfall.actual_collected, color: 'bg-emerald-500', type: 'total' as const },
            ]
            let running = waterfall.gross_potential
            return (
              <div className="space-y-3">
                {steps.map((step, i) => {
                  const barWidth = Math.abs(step.value) / maxVal * 100
                  const isLoss = step.type === 'loss'
                  const offset = isLoss ? ((running + step.value) / maxVal * 100) : 0
                  if (isLoss) running += step.value
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--color-dark)]">{step.label}</span>
                        <span className={`text-sm font-semibold ${isLoss ? 'text-red-500' : i === steps.length - 1 ? 'text-emerald-500' : 'text-[var(--color-dark)]'}`}>
                          {isLoss ? '-' : ''}{money(Math.abs(step.value))}
                        </span>
                      </div>
                      <div className="w-full h-6 rounded bg-[var(--color-light-gray)] relative">
                        <div
                          className={`h-6 rounded ${step.color} transition-all`}
                          style={{ width: `${barWidth}%`, marginLeft: isLoss ? `${offset}%` : '0' }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-lg p-3 mt-2 bg-[var(--color-light-gray)] border border-[var(--border-subtle)]">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[var(--color-mid-gray)]">Total Leakage</p>
                      <p className="text-lg font-semibold text-red-500">
                        {money(waterfall.vacancy_loss + waterfall.rate_gap_loss + waterfall.delinquency_loss)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-mid-gray)]">Leakage Rate</p>
                      <p className="text-lg font-semibold text-[var(--color-dark)]">
                        {waterfall.gross_potential > 0
                          ? ((waterfall.vacancy_loss + waterfall.rate_gap_loss + waterfall.delinquency_loss) / waterfall.gross_potential * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-mid-gray)]">Collection Rate</p>
                      <p className="text-lg font-semibold text-emerald-500">
                        {waterfall.gross_potential > 0 ? (waterfall.actual_collected / waterfall.gross_potential * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

/* ── Composite Export ── */

export default function HealthAndTrends({ revenueHistory, health, waterfall, expandedSection, toggle }: {
  revenueHistory: RevenueMonth[]
  health: HealthBreakdown | null
  waterfall: Waterfall | null
  expandedSection: string | null
  toggle: (section: string) => void
}) {
  return (
    <>
      <RevenueTrend
        revenueHistory={revenueHistory}
        expanded={expandedSection === 'trend'}
        onToggle={() => toggle('trend')}
      />
      {health && (
        <HealthScore
          health={health}
          expanded={expandedSection === 'health'}
          onToggle={() => toggle('health')}
        />
      )}
      {waterfall && (
        <RevenueWaterfall
          waterfall={waterfall}
          expanded={expandedSection === 'waterfall'}
          onToggle={() => toggle('waterfall')}
        />
      )}
    </>
  )
}
