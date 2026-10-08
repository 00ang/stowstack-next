"use client"

import { useState, useEffect, useCallback } from "react"
import { useToolFocus } from "@/components/ontology/tool-focus"
import {
  Loader2,
  MapPin,
  Send,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  BarChart3,
  Settings,
} from "lucide-react"
import {
  type GBPConnection,
  type GBPPost,
  type GBPReview,
  type GBPSyncLog,
  type GBPQuestion,
  type GBPInsight,
  type InsightsSummary,
  type ReviewStats,
  type QAStats,
  card,
  textPrimary,
  textSecondary,
  textTertiary,
  btnPrimary,
  btnSecondary,
  formatDate,
} from "./gbp-shared"
import GBPPosts from "./gbp-posts"
import GBPReviews from "./gbp-reviews"
import GBPQA from "./gbp-qa"
import GBPInsights from "./gbp-insights"
import GBPSettings from "./gbp-settings"

// ---------------------------------------------------------------------------
// Section type
// ---------------------------------------------------------------------------

type Section = "posts" | "reviews" | "qa" | "insights" | "sync" | "settings"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GBPFull({
  facilityId,
  adminKey,
}: {
  facilityId: string
  adminKey: string
}) {
  // Opened for a review (portal ?focus=reviews/…): start on Reviews.
  const focus = useToolFocus()
  const [section, setSection] = useState<Section>(focus?.type === "reviews" ? "reviews" : "posts")
  const [connection, setConnection] = useState<GBPConnection | null>(null)
  const [posts, setPosts] = useState<GBPPost[]>([])
  const [reviews, setReviews] = useState<GBPReview[]>([])
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    total: 0,
    avg_rating: 0,
    responded: 0,
    response_rate: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  })
  const [syncLog, setSyncLog] = useState<GBPSyncLog[]>([])
  const [questions, setQuestions] = useState<GBPQuestion[]>([])
  const [qaStats, setQaStats] = useState<QAStats>({
    total: 0,
    answered: 0,
    unanswered: 0,
  })
  const [insights, setInsights] = useState<GBPInsight[]>([])
  const [insightsSummary, setInsightsSummary] =
    useState<InsightsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  // Insights range (needs to live here because it affects loadAll fetch)
  const [insightsRange, setInsightsRange] = useState("30d")

  // Shared syncing state
  const [syncing, setSyncing] = useState<string | null>(null)

  // ── Data fetching ──

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const headers = { "X-Admin-Key": adminKey }
      const [syncRes, postsRes, reviewsRes, qaRes, insightsRes] =
        await Promise.all([
          fetch(`/api/gbp-sync?facilityId=${facilityId}`, { headers }).then(
            (r) => r.json()
          ),
          fetch(`/api/gbp-posts?facilityId=${facilityId}`, { headers }).then(
            (r) => r.json()
          ),
          fetch(`/api/gbp-reviews?facilityId=${facilityId}`, {
            headers,
          }).then((r) => r.json()),
          fetch(`/api/gbp-questions?facilityId=${facilityId}`, {
            headers,
          }).then((r) => r.json()),
          fetch(
            `/api/gbp-insights?facilityId=${facilityId}&range=${insightsRange}`,
            { headers }
          ).then((r) => r.json()),
        ])
      if (syncRes.connection) setConnection(syncRes.connection)
      if (syncRes.syncLog) setSyncLog(syncRes.syncLog)
      if (postsRes.posts) setPosts(postsRes.posts)
      if (reviewsRes.reviews) setReviews(reviewsRes.reviews)
      if (reviewsRes.stats) setReviewStats(reviewsRes.stats)
      if (qaRes.questions) setQuestions(qaRes.questions)
      if (qaRes.stats) setQaStats(qaRes.stats)
      if (insightsRes.insights) setInsights(insightsRes.insights)
      if (insightsRes.summary) setInsightsSummary(insightsRes.summary)
    } catch {
      /* silent */
    }
    setLoading(false)
  }, [facilityId, adminKey, insightsRange])

  useEffect(() => {
    loadAll() // eslint-disable-line react-hooks/set-state-in-effect -- async fetch on mount
  }, [loadAll])

  // ── Derived badge counts ──

  const pendingReviewCount = reviews.filter(
    (r) => r.response_status === "pending"
  ).length
  const pendingQACount = questions.filter(
    (q) => q.answer_status === "pending"
  ).length

  // ── Full sync trigger (used by connection banner) ──

  async function triggerFullSync() {
    setSyncing("full")
    try {
      await fetch("/api/gbp-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId, type: "full" }),
      })
      await loadAll()
    } catch {
      /* silent */
    }
    setSyncing(null)
  }

  // ── Loading state ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2
          size={20}
          className="animate-spin text-[var(--color-gold)] mr-2"
        />
        <span className={textSecondary}>
          Loading Google Business Profile...
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connection banner */}
      <div className={card + " p-4"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                connection?.status === "connected"
                  ? "bg-emerald-500/10"
                  : "bg-[var(--color-light-gray)]"
              }`}
            >
              <MapPin
                size={18}
                className={
                  connection?.status === "connected"
                    ? "text-emerald-400"
                    : textTertiary
                }
              />
            </div>
            <div>
              <p className={`text-sm font-semibold ${textPrimary}`}>
                {connection?.status === "connected"
                  ? connection.location_name || "Connected"
                  : "Google Business Profile"}
              </p>
              <p className={`text-xs ${textTertiary}`}>
                {connection?.status === "connected"
                  ? `Connected \u00B7 Last synced ${connection.last_sync_at ? formatDate(connection.last_sync_at) : "never"}`
                  : "Not connected \u2014 connect to enable auto-posting and review management"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connection?.status === "connected" && (
              <button
                onClick={triggerFullSync}
                disabled={syncing === "full"}
                className={btnSecondary}
              >
                {syncing === "full" ? (
                  <Loader2 size={13} className="inline animate-spin mr-1" />
                ) : (
                  <RefreshCw size={13} className="inline mr-1" />
                )}
                Sync Now
              </button>
            )}
            {connection?.status === "pending_location_selection" && (
              <div className="w-full mt-3">
                <p className="text-xs font-semibold text-[var(--color-dark)] mb-2">
                  Multiple locations found. Select one:
                </p>
                <div className="space-y-2">
                  {(
                    (
                      connection.sync_config as Record<string, unknown>
                    )?.pending_locations as
                      | Array<{ name: string; title: string }>
                      | undefined
                  )?.map((loc) => (
                    <button
                      key={loc.name}
                      className="w-full text-left rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 text-sm hover:border-[var(--accent)] transition-colors"
                      onClick={async () => {
                        try {
                          await fetch(`/api/gbp-sync`, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "X-Admin-Key": adminKey,
                            },
                            body: JSON.stringify({
                              facilityId,
                              type: "select-location",
                              locationId: loc.name,
                              locationName: loc.title,
                            }),
                          })
                          loadAll()
                        } catch {
                          /* retry */
                        }
                      }}
                    >
                      <span className="font-medium text-[var(--text-primary)]">
                        {loc.title}
                      </span>
                      <span className="block text-xs text-[var(--text-tertiary)]">
                        {loc.name}
                      </span>
                    </button>
                  )) || null}
                </div>
              </div>
            )}
            {(!connection ||
              (connection.status !== "connected" &&
                connection.status !== "pending_location_selection")) && (
              <button
                className={btnPrimary}
                onClick={() => {
                  window.open(
                    `/api/gbp-sync?action=oauth&facilityId=${facilityId}`,
                    "_blank"
                  )
                }}
              >
                Connect GBP
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section pills */}
      <div className="flex gap-1 flex-wrap">
        {(
          [
            ["posts", "Posts", Send, 0],
            ["reviews", "Reviews", MessageSquare, pendingReviewCount],
            ["qa", "Q&A", HelpCircle, pendingQACount],
            ["insights", "Insights", BarChart3, 0],
            ["sync", "Profile Sync", RefreshCw, 0],
            ["settings", "Settings", Settings, 0],
          ] as const
        ).map(([id, label, Icon, badge]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              section === id
                ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
            }`}
          >
            <Icon size={13} /> {label}
            {badge > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[var(--ic-selected)] text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ──── POSTS ──── */}
      {section === "posts" && (
        <GBPPosts
          facilityId={facilityId}
          adminKey={adminKey}
          posts={posts}
          setPosts={setPosts}
          connection={connection}
          loadAll={loadAll}
        />
      )}

      {/* ──── REVIEWS ──── */}
      {section === "reviews" && (
        <GBPReviews
          facilityId={facilityId}
          adminKey={adminKey}
          reviews={reviews}
          setReviews={setReviews}
          reviewStats={reviewStats}
          connection={connection}
          loadAll={loadAll}
          syncing={syncing}
          setSyncing={setSyncing}
        />
      )}

      {/* ──── Q&A ──── */}
      {section === "qa" && (
        <GBPQA
          facilityId={facilityId}
          adminKey={adminKey}
          questions={questions}
          setQuestions={setQuestions}
          qaStats={qaStats}
          connection={connection}
          loadAll={loadAll}
          syncing={syncing}
          setSyncing={setSyncing}
        />
      )}

      {/* ──── INSIGHTS ──── */}
      {section === "insights" && (
        <GBPInsights
          facilityId={facilityId}
          adminKey={adminKey}
          insights={insights}
          insightsSummary={insightsSummary}
          connection={connection}
          loadAll={loadAll}
          syncing={syncing}
          setSyncing={setSyncing}
          insightsRange={insightsRange}
          setInsightsRange={setInsightsRange}
        />
      )}

      {/* ──── PROFILE SYNC ──── */}
      {section === "sync" && (
        <GBPSettings
          facilityId={facilityId}
          adminKey={adminKey}
          connection={connection}
          setConnection={setConnection}
          syncLog={syncLog}
          loadAll={loadAll}
          syncing={syncing}
          setSyncing={setSyncing}
          activeTab="sync"
        />
      )}

      {/* ──── SETTINGS ──── */}
      {section === "settings" && (
        <GBPSettings
          facilityId={facilityId}
          adminKey={adminKey}
          connection={connection}
          setConnection={setConnection}
          syncLog={syncLog}
          loadAll={loadAll}
          syncing={syncing}
          setSyncing={setSyncing}
          activeTab="settings"
        />
      )}
    </div>
  )
}
