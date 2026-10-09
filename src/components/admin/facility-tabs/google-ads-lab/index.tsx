'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToolFocus } from '@/components/ontology/tool-focus'
import { useHandoff } from '@/components/flow/use-handoff'
import { PMSContextBar, CampaignScoreCard, RevenueProjections } from './campaign-intelligence'
import { CampaignSettingsPanel, KeywordsPanel } from './campaign-config-panel'

/* ── Types ── */

interface KeywordIdea {
  keyword: string
  intent: 'high' | 'medium' | 'low'
  competition: 'high' | 'medium' | 'low'
  estimatedCPC: number
  estimatedVolume: number
  relevanceScore: number
  rationale: string
  group: string
}

interface CampaignConfig {
  name: string
  dailyBudget: number
  bidStrategy: 'maximize_clicks' | 'maximize_conversions' | 'target_cpa' | 'target_roas'
  targetCPA: number | null
  geoRadius: number
  adSchedule: string[]
  keywords: KeywordIdea[]
  negativeKeywords: string[]
}

interface CampaignScore {
  overall: number
  breakdown: {
    keywordRelevance: number
    budgetEfficiency: number
    intentBalance: number
    competitivePosition: number
    geoFocus: number
  }
  warnings: string[]
  suggestions: string[]
}

interface PMSUnit {
  unit_type: string
  total_count: number
  occupied_count: number
  street_rate: number | null
  web_rate: number | null
}

interface PMSData {
  units: PMSUnit[]
  occupancyPct: number
  vacantUnits: number
}

const DEFAULT_NEGATIVES = [
  'free', 'diy', 'how to build', 'jobs', 'career', 'salary',
  'ikea', 'walmart', 'amazon', 'home depot',
  'closet', 'shed plans', 'garage plans',
]

const BID_STRATEGIES = [
  { id: 'maximize_clicks', label: 'Maximize Clicks' },
  { id: 'maximize_conversions', label: 'Maximize Conversions' },
  { id: 'target_cpa', label: 'Target CPA' },
  { id: 'target_roas', label: 'Target ROAS' },
]

/* ── Scoring Logic ── */

function scoreCampaign(config: CampaignConfig): CampaignScore {
  const warnings: string[] = []
  const suggestions: string[] = []

  const storageTerms = /storage|unit|moving|store|rent|locker|climate|secure|self.?storage/i
  const relevantCount = config.keywords.filter(k => storageTerms.test(k.keyword)).length
  const keywordRelevance = config.keywords.length > 0 ? Math.round((relevantCount / config.keywords.length) * 100) : 0
  if (keywordRelevance < 60) warnings.push("Many keywords aren't storage-specific -- you may attract irrelevant clicks")

  const avgCPC = config.keywords.length > 0
    ? config.keywords.reduce((s, k) => s + k.estimatedCPC, 0) / config.keywords.length
    : 3
  const estimatedDailyClicks = config.dailyBudget / avgCPC
  let budgetEfficiency = 0
  if (estimatedDailyClicks >= 10) budgetEfficiency = 90
  else if (estimatedDailyClicks >= 5) budgetEfficiency = 75
  else if (estimatedDailyClicks >= 3) budgetEfficiency = 60
  else { budgetEfficiency = 40; warnings.push(`Budget only supports ~${Math.round(estimatedDailyClicks)} clicks/day -- consider increasing to $${Math.round(avgCPC * 5)}/day minimum`) }

  const highIntent = config.keywords.filter(k => k.intent === 'high').length
  const intentBalance = config.keywords.length > 0 ? Math.round((highIntent / config.keywords.length) * 100) : 50
  if (intentBalance < 40) suggestions.push('Add more high-intent keywords like "storage units near me" or "rent storage unit"')
  if (intentBalance > 90) suggestions.push('Consider adding a few medium-intent keywords for awareness at lower CPCs')

  const highComp = config.keywords.filter(k => k.competition === 'high').length
  const competitivePosition = config.keywords.length > 0 ? Math.round(100 - (highComp / config.keywords.length) * 60) : 50
  if (highComp > config.keywords.length * 0.7) warnings.push('Mostly high-competition keywords -- CPCs will be expensive. Mix in long-tail variations.')

  let geoFocus = 70
  if (config.geoRadius <= 10) { geoFocus = 95; suggestions.push('Tight geo-targeting -- great for local dominance') }
  else if (config.geoRadius <= 20) geoFocus = 80
  else if (config.geoRadius <= 30) geoFocus = 60
  else { geoFocus = 40; warnings.push('Radius over 30 miles is too wide for self-storage -- most customers drive <15 minutes') }

  if (config.negativeKeywords.length < 5) suggestions.push('Add more negative keywords to avoid wasted spend on irrelevant searches')
  if (config.bidStrategy === 'target_cpa' && !config.targetCPA) warnings.push('Target CPA strategy selected but no CPA value set')

  const overall = Math.round(
    keywordRelevance * 0.3 +
    budgetEfficiency * 0.25 +
    intentBalance * 0.2 +
    competitivePosition * 0.15 +
    geoFocus * 0.1
  )

  return {
    overall,
    breakdown: { keywordRelevance, budgetEfficiency, intentBalance, competitivePosition, geoFocus },
    warnings,
    suggestions,
  }
}

/* ── Component ── */

export default function GoogleAdsLab({ facilityId, adminKey }: {
  facilityId: string
  adminKey: string
}) {
  const [keywords, setKeywords] = useState<KeywordIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [pmsData, setPmsData] = useState<PMSData | null>(null)
  const [pmsLoading, setPmsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const suggestedBudget = pmsData?.vacantUnits ? Math.max(20, Math.round(pmsData.vacantUnits * 2)) : 30

  // Opened for a unit (portal ?focus=units/…): the campaign is named for it,
  // and the ad written next is about it.
  const focus = useToolFocus()
  const handoff = useHandoff()
  const [config, setConfig] = useState<CampaignConfig>({
    name: focus?.type === 'units' ? `Search · ${focus.name}` : 'Search Campaign',
    dailyBudget: 30,
    bidStrategy: 'maximize_clicks',
    targetCPA: null,
    geoRadius: 15,
    adSchedule: ['Mon-Fri 6am-10pm', 'Sat-Sun 8am-8pm'],
    keywords: [],
    negativeKeywords: [...DEFAULT_NEGATIVES],
  })
  const [score, setScore] = useState<CampaignScore | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // Load PMS data
  useEffect(() => {
    fetch(`/api/facility-pms?facilityId=${facilityId}`, {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then(r => r.json())
      .then(data => {
        if (data.units && data.units.length > 0) {
          const totalUnits = data.units.reduce((s: number, u: PMSUnit) => s + u.total_count, 0)
          const occupiedUnits = data.units.reduce((s: number, u: PMSUnit) => s + u.occupied_count, 0)
          const vacantUnits = totalUnits - occupiedUnits
          const occupancyPct = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0
          setPmsData({ units: data.units, occupancyPct, vacantUnits })
        }
      })
      .catch(() => {})
      .finally(() => setPmsLoading(false))
  }, [facilityId, adminKey])

  // Update budget from PMS data
  useEffect(() => {
    if (pmsData) {
      const suggested = Math.max(20, Math.round(pmsData.vacantUnits * 2))
      setConfig(prev => ({ ...prev, dailyBudget: suggested }))
    }
  }, [pmsData])

  // Score whenever config changes
  useEffect(() => {
    if (config.keywords.length > 0) {
      setScore(scoreCampaign(config))
    }
  }, [config])

  const generateKeywords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google-ads-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey },
        body: JSON.stringify({ facilityId }),
      })
      const data = await res.json()
      if (data.keywords) {
        setKeywords(data.keywords)
        setConfig(prev => ({ ...prev, keywords: data.keywords }))
        // The keywords are a plan; the search ad that uses them is written in
        // Creative Studio and published from Publish Ads (created paused).
        handoff({
          sentence: `${data.keywords.length} keywords are ready.`,
          reason: 'Write the search ad that uses them, then publish it. Google campaigns are created paused.',
          label: 'Write the Google ad',
          href: `/portal/tools?tool=creative-studio${focus?.type === 'units' ? `&focus=${focus.address}` : ''}`,
        })
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      console.error('Keyword generation failed:', err)
      setError('Failed to generate keywords. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [facilityId, adminKey, focus, handoff])

  function toggleKeyword(keyword: KeywordIdea) {
    setConfig(prev => {
      const exists = prev.keywords.some(k => k.keyword === keyword.keyword)
      return {
        ...prev,
        keywords: exists
          ? prev.keywords.filter(k => k.keyword !== keyword.keyword)
          : [...prev.keywords, keyword],
      }
    })
  }

  // PMS-based strategy
  const pmsStrategy = pmsData ? (() => {
    const occ = pmsData.occupancyPct
    const vacantWithRevenue = pmsData.units
      .filter(u => (u.total_count - u.occupied_count) > 0)
      .map(u => ({ type: u.unit_type, vacant: u.total_count - u.occupied_count, rate: u.street_rate || 0 }))
    const monthlyRevenueGap = vacantWithRevenue.reduce((s, u) => s + u.vacant * u.rate, 0)
    const lowestPrice = Math.min(...pmsData.units.map(u => u.web_rate || u.street_rate || 999))
    const topVacant = vacantWithRevenue.sort((a, b) => b.vacant - a.vacant).slice(0, 3)

    let strategyLabel: string, strategyColor: string, strategyDetail: string, bidRec: string
    if (occ < 80) {
      strategyLabel = 'Aggressive Demand Generation'
      strategyColor = 'text-red-400'
      strategyDetail = 'Broad targeting. Strong offers. CPMI target is secondary to volume -- fill units first.'
      bidRec = 'maximize_clicks'
    } else if (occ < 90) {
      strategyLabel = 'Targeted by Unit Type'
      strategyColor = 'text-amber-400'
      strategyDetail = `Focus on underperforming types: ${topVacant.map(u => u.type).join(', ') || 'varies'}. Optimize CPMI.`
      bidRec = 'maximize_conversions'
    } else if (occ < 95) {
      strategyLabel = 'Selective + Rate Optimization'
      strategyColor = 'text-[var(--color-blue)]'
      strategyDetail = 'Fill specific vacancies only. Rate increases are the primary revenue lever now.'
      bidRec = 'target_cpa'
    } else {
      strategyLabel = 'Revenue Maximization Only'
      strategyColor = 'text-emerald-400'
      strategyDetail = 'Minimal acquisition spend. Focus on rate increases and waitlist campaigns.'
      bidRec = 'target_roas'
    }

    return { occ, vacantWithRevenue, monthlyRevenueGap, lowestPrice, topVacant, strategyLabel, strategyColor, strategyDetail, bidRec }
  })() : null

  // Revenue impact projections
  const revenueProjection = config.keywords.length > 0 && pmsData ? (() => {
    const avgCPC = config.keywords.reduce((s, k) => s + k.estimatedCPC, 0) / config.keywords.length
    const dailyClicks = config.dailyBudget / avgCPC
    const conversionRate = 0.08
    const dailyLeads = dailyClicks * conversionRate
    const monthlyLeads = dailyLeads * 30
    const closeRate = 0.35
    const monthlyMoveIns = monthlyLeads * closeRate
    const avgMonthlyRevenue = pmsData.units.length > 0
      ? pmsData.units.reduce((s, u) => s + (u.street_rate || 0), 0) / pmsData.units.length
      : 120
    const ltv = avgMonthlyRevenue * 10
    const monthlyRevenueImpact = monthlyMoveIns * avgMonthlyRevenue
    const annualRevenueImpact = monthlyMoveIns * ltv
    const adSpend = config.dailyBudget * 30
    const roas = adSpend > 0 ? annualRevenueImpact / adSpend : 0

    return { dailyClicks, dailyLeads, monthlyLeads, monthlyMoveIns, monthlyRevenueImpact, annualRevenueImpact, adSpend, roas, avgCPC }
  })() : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-dark)]">Google Ads Laboratory</h4>
        <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">Build, score, and optimize Google Search campaigns</p>
      </div>

      {/* PMS Context Bar */}
      <PMSContextBar
        pmsLoading={pmsLoading}
        pmsStrategy={pmsStrategy}
        pmsData={pmsData}
        suggestedBudget={suggestedBudget}
        config={config}
      />

      {/* Campaign Score */}
      {score && <CampaignScoreCard score={score} />}

      {/* Revenue Impact Projections */}
      {revenueProjection && <RevenueProjections revenueProjection={revenueProjection} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Campaign Config */}
        <CampaignSettingsPanel config={config} setConfig={setConfig} />

        {/* Right: Keywords */}
        <KeywordsPanel
          keywords={keywords}
          config={config}
          loading={loading}
          error={error}
          expandedGroup={expandedGroup}
          setExpandedGroup={setExpandedGroup}
          generateKeywords={generateKeywords}
          toggleKeyword={toggleKeyword}
        />
      </div>
    </div>
  )
}
