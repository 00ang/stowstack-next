'use client'

import { useState, useEffect } from 'react'
import { useToolFocus } from '@/components/ontology/tool-focus'
import { useFlow } from '@/components/flow/flow-context'
import { ActionFill } from '@/components/ontology/action-fill'
import { actionHref } from '@/lib/ontology/href'
import {
  Loader2, Star, MapPin, ExternalLink, Users, DollarSign,
  Calendar, Save, Shield, Heart, TrendingUp, ScanSearch,
  Building2, GraduationCap, Home, Truck, Radar, X,
} from 'lucide-react'

/* ── Types ── */

interface CompetitorUnit {
  size: string
  price: string | null
  type: string | null
}

interface Competitor {
  name: string
  address: string
  rating: number | null
  reviewCount: number
  distance_miles: number | null
  mapsUrl: string | null
  website: string | null
  source: string
  units?: CompetitorUnit[]
  promotions?: Array<{ text: string }>
}

interface DemandDriver {
  name: string
  category: string
  address: string
  distance_miles: number | null
  source: string
}

interface Demographics {
  zip?: string
  population?: number
  median_income?: number
  median_age?: number
  owner_occupied?: number
  renter_occupied?: number
  renter_pct?: number
  median_home_value?: number
  source?: string
}

interface MarketIntel {
  id: string
  facility_id: string
  last_scanned: string
  competitors: Competitor[]
  demand_drivers: DemandDriver[]
  demographics: Demographics
  manual_notes: string | null
  operator_overrides: Record<string, unknown>
}

/* ── Constants ── */

const CATEGORY_LABELS: Record<string, string> = {
  apartment_complex: 'Apartment Complexes',
  university: 'Universities',
  military_base: 'Military Bases',
  real_estate: 'Real Estate Offices',
  moving_company: 'Moving Companies',
  senior_living: 'Senior Living',
}

const CATEGORY_ICONS: Record<string, typeof Building2> = {
  apartment_complex: Building2,
  university: GraduationCap,
  military_base: Shield,
  real_estate: Home,
  moving_company: Truck,
  senior_living: Heart,
}

/* ── Star Rating ── */

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-[var(--color-mid-gray)]">No rating</span>
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span className="inline-flex items-center gap-0.5 text-[var(--color-dark)] text-sm font-semibold">
      {Array.from({ length: full }, (_, i) => <Star key={i} size={12} fill="currentColor" />)}
      {half && <Star size={12} fill="currentColor" className="opacity-50" />}
      <span className="ml-0.5">{rating}</span>
    </span>
  )
}

/* ── Main Component ── */

export default function MarketIntelligence({ facilityId, adminKey }: {
  facilityId: string
  adminKey: string
}) {
  const [intel, setIntel] = useState<MarketIntel | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Opened for one competitor (portal ?focus=competitors/…). Hooks stay above
  // the early returns below.
  const focus = useToolFocus()
  const ontology = useFlow()?.ontology ?? null

  useEffect(() => {
    fetch(`/api/market-intel?facilityId=${facilityId}`, {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.intel) {
          setIntel(data.intel)
          setNotes(data.intel.manual_notes || '')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load market intelligence')
      })
      .finally(() => setLoading(false))
  }, [facilityId, adminKey])

  async function runScan() {
    setScanning(true)
    try {
      const res = await fetch('/api/market-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ facilityId, force: true }),
      })
      const data = await res.json()
      if (data.intel) {
        setIntel(data.intel)
        setNotes(data.intel.manual_notes || '')
      } else if (data.error) {
        setError(`Scan failed: ${data.error}`)
      }
    } catch (err) {
      setError(`Scan failed: ${err instanceof Error ? err.message : 'Network error'}`)
    } finally {
      setScanning(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch('/api/market-intel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ facilityId, manual_notes: notes }),
      })
      const data = await res.json()
      if (data.intel) setIntel(data.intel)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes')
    }
    setSavingNotes(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6">
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-[var(--color-gold)]" />
        </div>
      </div>
    )
  }

  // Opened for one competitor (portal ?focus=competitors/…): it leads the list,
  // marked, with what to do about it.
  const focusName = focus?.type === 'competitors' ? focus.name : null
  const competitors = [...(intel?.competitors || [])].sort((a, b) =>
    a.name === focusName ? -1 : b.name === focusName ? 1 : 0
  )
  // The answers: an ad for the size they undercut, and the running offer on Google.
  const answers = (() => {
    if (!focus || !focusName) return []
    const unit = focus.links.find((l) => l.startsWith('units/')) ?? null
    const unitName = unit ? ontology?.objects.find((o) => o.address === unit)?.name ?? null : null
    const offer = ontology?.objects.find(
      (o) => o.type === 'offers' && o.status !== 'ended' && (!unit || o.links.includes(unit))
    )
    const list: { label: string; href: string }[] = []
    list.push({
      label: unitName ? `Write an ad for your ${unitName}` : 'Write an ad that answers it',
      href: actionHref({ label: '', tool: 'creative-studio' }, unit),
    })
    if (offer) {
      list.push({ label: `Post ${offer.name} on Google`, href: actionHref({ label: '', tool: 'gbp' }, offer.address) })
    }
    return list
  })()
  const demandDrivers = intel?.demand_drivers || []
  const demographics = intel?.demographics || {}
  const hasDemographics = demographics.population || demographics.median_income

  const avgRating = competitors.length
    ? Math.round((competitors.reduce((s, c) => s + (c.rating || 0), 0) / competitors.filter(c => c.rating).length) * 10) / 10
    : 0

  const driversByCategory: Record<string, DemandDriver[]> = {}
  demandDrivers.forEach(d => {
    if (!driversByCategory[d.category]) driversByCategory[d.category] = []
    driversByCategory[d.category].push(d)
  })

  const driverSummary = Object.entries(driversByCategory)
    .map(([cat, items]) => `${items.length} ${CATEGORY_LABELS[cat]?.toLowerCase() || cat}`)
    .join(', ')

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 text-[var(--color-dark)]">
            <Radar size={14} className="text-[var(--color-gold)]" />
            Market Intelligence
          </h4>
          {intel?.last_scanned && (
            <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">
              Last scanned{' '}
              {new Date(intel.last_scanned).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold)]/80 disabled:opacity-40 transition-colors"
        >
          {scanning ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
          {scanning ? 'Scanning...' : 'Scan Market'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 mx-5 mb-4">
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!intel && !scanning && (
        <div className="px-5 pb-5 border-t border-[var(--border-subtle)]">
          <p className="text-sm text-[var(--color-body-text)] py-6 text-center">
            No market data yet. Click &quot;Scan Market&quot; to analyze competitors, demand drivers, and local demographics.
          </p>
        </div>
      )}

      {/* Scanning state */}
      {scanning && (
        <div className="px-5 pb-5 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 size={24} className="animate-spin text-[var(--color-gold)]" />
            <p className="text-sm text-[var(--color-dark)]">Scanning market environment...</p>
            <p className="text-xs text-[var(--color-mid-gray)]">Searching competitors, demand drivers, and census data</p>
          </div>
        </div>
      )}

      {/* Data loaded */}
      {intel && !scanning && (
        <div className="border-t border-[var(--border-subtle)]">
          {/* Competitors Section */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">
                Competitive Landscape
              </h5>
              {competitors.length > 0 && (
                <span className="text-xs text-[var(--color-mid-gray)]">
                  {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} within 15 miles
                  {avgRating > 0 ? `, avg rating ${avgRating}` : ''}
                  {avgRating > 0 && <Star size={10} className="inline ml-0.5 text-[var(--color-dark)]" fill="currentColor" />}
                </span>
              )}
            </div>
            {focusName && (
              <div className="mb-3 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
                <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Answer it</div>
                <div className="mt-1 text-[15px] font-bold leading-snug text-[var(--ic-ink)]">{focus?.brief}</div>
                {answers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {answers.map((a, i) => (
                      <ActionFill key={a.href} href={a.href} n={i}>
                        {a.label}
                      </ActionFill>
                    ))}
                  </div>
                )}
              </div>
            )}
            {competitors.length === 0 ? (
              <p className="text-sm text-[var(--color-body-text)]">No competitors found nearby.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {competitors.map((c, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg bg-[var(--color-light-gray)] ${c.name === focusName ? 'border-l-[3px] border-l-[var(--ic-selected)]' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-[var(--color-dark)]">{c.name}</p>
                        <p className="text-xs text-[var(--color-mid-gray)] truncate mt-0.5">{c.address}</p>
                      </div>
                      <div className="flex gap-1.5 ml-2 flex-shrink-0">
                        {c.mapsUrl && (
                          <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-gold)] hover:text-[var(--color-gold)]/80">
                            <MapPin size={12} />
                          </a>
                        )}
                        {c.website && (
                          <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-gold)] hover:text-[var(--color-gold)]/80">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <StarRating rating={c.rating} />
                      {c.reviewCount > 0 && <span className="text-xs text-[var(--color-mid-gray)]">({c.reviewCount} reviews)</span>}
                      {c.distance_miles !== null && (
                        <span className="text-xs text-[var(--color-mid-gray)] ml-auto">{c.distance_miles} mi</span>
                      )}
                    </div>
                    {c.units && c.units.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)] mb-1">
                          <DollarSign size={10} className="inline mr-0.5" />
                          Pricing ({c.units.length} unit{c.units.length !== 1 ? 's' : ''})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {c.units.slice(0, 4).map((u, ui) => (
                            <span key={ui} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-light)] text-[var(--color-body-text)]">
                              {u.size}{u.price ? ` — ${u.price}/mo` : ''}
                            </span>
                          ))}
                          {c.units.length > 4 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-[var(--color-mid-gray)]">
                              +{c.units.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {c.promotions && c.promotions.length > 0 && (
                      <div className="mt-1.5">
                        {c.promotions.slice(0, 2).map((p, pi) => (
                          <p key={pi} className="text-[10px] text-[var(--color-gold)] truncate">
                            {p.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demand Drivers Section */}
          <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-mid-gray)]">
                Local Demand Drivers
              </h5>
              {demandDrivers.length > 0 && (
                <span className="text-xs text-[var(--color-mid-gray)]">{driverSummary} within 5 miles</span>
              )}
            </div>
            {demandDrivers.length === 0 ? (
              <p className="text-sm text-[var(--color-body-text)]">No demand drivers found nearby.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(driversByCategory).map(([cat, items]) => {
                  const Icon = CATEGORY_ICONS[cat] || Building2
                  return (
                    <div key={cat}>
                      <p className="text-xs font-medium flex items-center gap-1.5 mb-1.5 text-[var(--color-dark)]">
                        <Icon size={12} className="text-[var(--color-gold)]" />
                        {CATEGORY_LABELS[cat] || cat} ({items.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-5">
                        {items.map((d, i) => (
                          <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--color-light-gray)]">
                            <span className="text-xs truncate text-[var(--color-dark)]">{d.name}</span>
                            {d.distance_miles !== null && (
                              <span className="text-xs text-[var(--color-mid-gray)] ml-2 flex-shrink-0">{d.distance_miles} mi</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Demographics Section */}
          <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
            <h5 className="text-xs font-semibold uppercase tracking-wide mb-3 text-[var(--color-mid-gray)]">
              Market Demographics {demographics.zip ? `(${demographics.zip})` : ''}
            </h5>
            {!hasDemographics ? (
              <p className="text-sm text-[var(--color-body-text)]">No demographic data available.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-3 rounded-lg text-center bg-[var(--color-light-gray)]">
                  <Users size={14} className="mx-auto mb-1 text-[var(--color-mid-gray)]" />
                  <p className="text-lg font-semibold text-[var(--color-dark)]">{demographics.population?.toLocaleString() || '\u2014'}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">Population</p>
                </div>
                <div className="p-3 rounded-lg text-center bg-[var(--color-light-gray)]">
                  <DollarSign size={14} className="mx-auto mb-1 text-[var(--color-mid-gray)]" />
                  <p className="text-lg font-semibold text-[var(--color-dark)]">
                    {demographics.median_income ? `$${(demographics.median_income / 1000).toFixed(0)}k` : '\u2014'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">Median Income</p>
                </div>
                <div className="p-3 rounded-lg text-center bg-[var(--color-light-gray)]">
                  <Calendar size={14} className="mx-auto mb-1 text-[var(--color-mid-gray)]" />
                  <p className="text-lg font-semibold text-[var(--color-dark)]">{demographics.median_age || '\u2014'}</p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">Median Age</p>
                </div>
                <div className={`p-3 rounded-lg text-center ${(demographics.renter_pct || 0) > 40 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-[var(--color-light-gray)]'}`}>
                  <TrendingUp size={14} className={`mx-auto mb-1 ${(demographics.renter_pct || 0) > 40 ? 'text-emerald-500' : 'text-[var(--color-mid-gray)]'}`} />
                  <p className={`text-lg font-semibold ${(demographics.renter_pct || 0) > 40 ? 'text-emerald-400' : 'text-[var(--color-dark)]'}`}>
                    {demographics.renter_pct != null ? `${demographics.renter_pct}%` : '\u2014'}
                  </p>
                  <p className={`text-[10px] uppercase tracking-wide ${(demographics.renter_pct || 0) > 40 ? 'text-emerald-500' : 'text-[var(--color-mid-gray)]'}`}>
                    Renter %{(demographics.renter_pct || 0) > 40 ? ' (Strong)' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-lg text-center bg-[var(--color-light-gray)]">
                  <Home size={14} className="mx-auto mb-1 text-[var(--color-mid-gray)]" />
                  <p className="text-lg font-semibold text-[var(--color-dark)]">
                    {demographics.median_home_value ? `$${(demographics.median_home_value / 1000).toFixed(0)}k` : '\u2014'}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-mid-gray)]">Home Value</p>
                </div>
              </div>
            )}
          </div>

          {/* Manual Notes Section */}
          <div className="px-5 py-4 border-t border-[var(--border-subtle)]">
            <h5 className="text-xs font-semibold uppercase tracking-wide mb-2 text-[var(--color-mid-gray)]">
              Operator Market Notes
            </h5>
            <p className="text-xs text-[var(--color-mid-gray)] mb-2">
              Add context the scan cannot find: new developments, competitor pricing changes, local trends, etc.
            </p>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
              rows={3}
              placeholder="e.g., New 200-unit apartment complex breaking ground on Oak St... Public Storage down the road has been raising prices aggressively..."
              className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)]"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold)]/80 disabled:opacity-40 transition-colors"
              >
                {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save Notes
              </button>
              {notesSaved && <span className="text-xs text-emerald-500">Saved</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
