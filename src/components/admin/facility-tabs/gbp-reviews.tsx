"use client"

import { useState } from "react"
import { useToolFocus } from "@/components/ontology/tool-focus"
import { useFlow } from "@/components/flow/flow-context"
import { useHandoff } from "@/components/flow/use-handoff"
import { campaignHref } from "@/lib/flow"
import {
  Loader2,
  Star,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import {
  type GBPReview,
  type GBPConnection,
  type ReviewStats,
  card,
  textPrimary,
  textSecondary,
  textTertiary,
  inputCls,
  btnPrimary,
  btnSecondary,
  formatDate,
  responseStatusColors,
  chipClass,
} from "./gbp-shared"

interface GBPReviewsProps {
  facilityId: string
  adminKey: string
  reviews: GBPReview[]
  setReviews: React.Dispatch<React.SetStateAction<GBPReview[]>>
  reviewStats: ReviewStats
  connection: GBPConnection | null
  loadAll: () => Promise<void>
  syncing: string | null
  setSyncing: React.Dispatch<React.SetStateAction<string | null>>
}

export default function GBPReviews({
  facilityId,
  adminKey,
  reviews,
  setReviews,
  reviewStats,
  connection,
  loadAll,
  syncing,
  setSyncing,
}: GBPReviewsProps) {
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<Record<string, string>>({})
  const [approvingFor, setApprovingFor] = useState<string | null>(null)
  const [reviewFilter, setReviewFilter] = useState("all")
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  // Opened for one review (portal ?focus=reviews/…): it leads the list, marked.
  const focus = useToolFocus()
  const focusId = focus?.type === "reviews" ? focus.id : null
  const flow = useFlow()
  const working = flow?.working ?? null
  const handoff = useHandoff()

  // ── Review actions ──

  async function generateAIResponse(reviewId: string) {
    setGeneratingFor(reviewId)
    setReviewError(null)
    try {
      const res = await fetch("/api/gbp-reviews?action=generate-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ reviewId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.aiDraft) {
        setEditingDraft((prev) => ({ ...prev, [reviewId]: data.aiDraft }))
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, ai_draft: data.aiDraft, response_status: "ai_drafted" }
              : r
          )
        )
      } else {
        setReviewError(data.error || "Couldn't draft a reply. Try again, or write one yourself.")
      }
    } catch {
      setReviewError("Couldn't reach StorageAds. Check your connection and try again.")
    }
    setGeneratingFor(null)
  }

  async function bulkGenerateResponses() {
    setBulkGenerating(true)
    try {
      const res = await fetch("/api/gbp-reviews?action=bulk-generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId }),
      })
      if (res.ok) await loadAll()
    } catch {
      /* silent */
    }
    setBulkGenerating(false)
  }

  async function approveResponse(reviewId: string) {
    const responseText = editingDraft[reviewId]
    if (!responseText?.trim()) return
    setApprovingFor(reviewId)
    setReviewError(null)
    try {
      const res = await fetch("/api/gbp-reviews?action=approve-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ reviewId, responseText }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setReviewError(data.error || "Couldn't post the reply. Nothing was sent; try again.")
        setApprovingFor(null)
        return
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? { ...r, response_status: "published", response_text: responseText }
            : r
        )
      )
      setEditingDraft((prev) => {
        const n = { ...prev }
        delete n[reviewId]
        return n
      })
      // Hand off to the next review still waiting, by name, with it in focus.
      const waitingReviews = reviews.filter((r) => r.id !== reviewId && r.response_status === "pending")
      const next = waitingReviews[0]
      const nextAddress = next
        ? flow?.ontology?.objects.find((o) => o.type === "reviews" && o.id === next.id)?.address
        : undefined
      const waiting = waitingReviews.length
      handoff(
        next
          ? {
              sentence: "The reply is posted.",
              reason: `${waiting} more ${waiting === 1 ? "review is" : "reviews are"} waiting. Replies show people a manager reads them.`,
              label: `Reply to ${next.author_name ?? "the next one"}`,
              href: nextAddress ? `/portal/tools?tool=gbp&focus=${nextAddress}` : "/portal/tools?tool=gbp",
            }
          : working
            ? {
                sentence: "Every review has a reply.",
                reason: `Carry on with ${working.name}.`,
                label: `Back to ${working.name}`,
                href: campaignHref(working.id),
              }
            : {
                sentence: "Every review has a reply.",
                reason: "See what needs you next.",
                label: "Back to the dashboard",
                href: "/portal",
              },
      )
    } catch {
      setReviewError("Couldn't reach StorageAds. Check your connection and try again.")
    }
    setApprovingFor(null)
  }

  async function syncReviews() {
    setSyncing("reviews")
    try {
      await fetch("/api/gbp-reviews?action=sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId }),
      })
      await loadAll()
    } catch {
      /* silent */
    }
    setSyncing(null)
  }

  // ── Derived data ──

  const filteredReviews =
    reviewFilter === "all"
      ? reviews
      : reviewFilter === "unresponded"
        ? reviews.filter(
            (r) =>
              r.response_status === "pending" ||
              r.response_status === "ai_drafted"
          )
        : reviews.filter((r) => r.response_status === reviewFilter)

  const pendingReviewCount = reviews.filter(
    (r) => r.response_status === "pending"
  ).length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Avg Rating",
            value: `\u2605 ${reviewStats.avg_rating}`,
            icon: Star,
          },
          {
            label: "Total Reviews",
            value: reviewStats.total,
            icon: MessageSquare,
          },
          {
            label: "Responded",
            value: reviewStats.responded,
            icon: CheckCircle2,
          },
          {
            label: "Response Rate",
            value: `${reviewStats.response_rate}%`,
            icon: Send,
          },
        ].map((stat) => (
          <div key={stat.label} className={card + " p-4"}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={14} className={textTertiary} />
              <span className={`text-xs font-medium ${textTertiary}`}>
                {stat.label}
              </span>
            </div>
            <p className={`text-xl font-semibold ${textPrimary}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Rating distribution */}
      {reviewStats.total > 0 && (
        <div className={card + " p-4"}>
          <h4
            className={`text-xs font-semibold ${textTertiary} mb-3 uppercase tracking-wider`}
          >
            Rating Distribution
          </h4>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = reviewStats.distribution?.[rating] || 0
              const pct =
                reviewStats.total > 0
                  ? (count / reviewStats.total) * 100
                  : 0
              return (
                <div key={rating} className="flex items-center gap-2">
                  <span className={`text-xs w-8 text-right ${textPrimary}`}>
                    {rating} {"\u2605"}
                  </span>
                  <div className="flex-1 h-4 rounded-full overflow-hidden bg-[var(--color-light-gray)]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        rating >= 4
                          ? "bg-emerald-500"
                          : rating === 3
                            ? "bg-[var(--ic-secondary)]"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs w-16 ${textTertiary}`}>
                    {count} ({Math.round(pct)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {["all", "unresponded", "published"].map((f) => (
            <button
              key={f}
              onClick={() => setReviewFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                reviewFilter === f
                  ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                  : "text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "unresponded"
                  ? "Needs Response"
                  : "Responded"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {pendingReviewCount > 0 && (
            <button
              onClick={bulkGenerateResponses}
              disabled={bulkGenerating}
              className={btnSecondary}
            >
              {bulkGenerating ? (
                <Loader2
                  size={13}
                  className="inline animate-spin mr-1"
                />
              ) : (
                <Sparkles size={13} className="inline mr-1" />
              )}
              AI Draft All ({pendingReviewCount})
            </button>
          )}
          {connection?.status === "connected" && (
            <button
              onClick={syncReviews}
              disabled={syncing === "reviews"}
              className={btnSecondary}
            >
              {syncing === "reviews" ? (
                <Loader2
                  size={13}
                  className="inline animate-spin mr-1"
                />
              ) : (
                <RefreshCw size={13} className="inline mr-1" />
              )}
              Sync Reviews
            </button>
          )}
        </div>
      </div>

      {reviewError && (
        <div role="alert" className="border-l-2 border-[var(--color-red)] pl-3 text-sm font-medium text-[var(--color-dark)]">
          {reviewError}
        </div>
      )}

      {filteredReviews.length === 0 ? (
        <div className={card + " p-8 text-center"}>
          <MessageSquare
            size={32}
            className={`mx-auto mb-2 opacity-40 ${textTertiary}`}
          />
          <p className={`text-sm ${textSecondary}`}>
            No reviews{" "}
            {reviewFilter !== "all" ? "matching this filter" : "yet"}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(focusId
            ? [...filteredReviews].sort((a, b) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0))
            : filteredReviews
          ).map((review) => (
            <div
              key={review.id}
              className={`${card} p-4 ${review.id === focusId ? "border-l-[3px] border-l-[var(--ic-selected)]" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[var(--ic-ink)] text-sm" aria-label={`${review.rating} of 5 stars`}>
                    {"\u2605".repeat(review.rating)}
                    {"\u2606".repeat(5 - review.rating)}
                  </span>
                  <span
                    className={`text-sm font-medium ${textPrimary}`}
                  >
                    {review.author_name || "Anonymous"}
                  </span>
                  <span
                    className={chipClass(
                      review.response_status,
                      responseStatusColors
                    )}
                  >
                    {review.response_status.replace(/_/g, " ")}
                  </span>
                  <span className={`text-xs ${textTertiary}`}>
                    {formatDate(review.review_time)}
                  </span>
                </div>
                {review.review_text && (
                  <p className={`text-sm ${textSecondary} mt-1`}>
                    {review.review_text}
                  </p>
                )}

                {review.response_status === "published" &&
                  review.response_text && (
                    <div className="mt-3 p-3 rounded-lg text-sm bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs font-medium mb-1 text-emerald-400">
                        Your Response
                      </p>
                      <p className="text-emerald-300">
                        {review.response_text}
                      </p>
                    </div>
                  )}

                {(review.response_status === "pending" ||
                  review.response_status === "ai_drafted") && (
                  <div className="mt-3 space-y-2">
                    {editingDraft[review.id] || review.ai_draft ? (
                      <>
                        {(editingDraft[review.id] || review.ai_draft) && (
                          <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 mb-2">
                            <p className="text-[10px] uppercase tracking-wider text-purple-400 mb-1">
                              AI-Generated Draft
                            </p>
                          </div>
                        )}
                        <textarea
                          value={
                            editingDraft[review.id] ??
                            review.ai_draft ??
                            ""
                          }
                          onChange={(e) =>
                            setEditingDraft((prev) => ({
                              ...prev,
                              [review.id]: e.target.value,
                            }))
                          }
                          rows={3}
                          className={inputCls}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveResponse(review.id)}
                            disabled={approvingFor === review.id}
                            className={btnPrimary}
                          >
                            {approvingFor === review.id ? (
                              <Loader2
                                size={13}
                                className="inline animate-spin mr-1"
                              />
                            ) : (
                              <CheckCircle2
                                size={13}
                                className="inline mr-1"
                              />
                            )}
                            Approve & Publish
                          </button>
                          <button
                            onClick={() =>
                              generateAIResponse(review.id)
                            }
                            disabled={generatingFor === review.id}
                            className={btnSecondary}
                          >
                            <Sparkles
                              size={13}
                              className="inline mr-1"
                            />{" "}
                            Regenerate
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          generateAIResponse(review.id)
                        }
                        disabled={generatingFor === review.id}
                        className={btnSecondary}
                      >
                        {generatingFor === review.id ? (
                          <Loader2
                            size={13}
                            className="inline animate-spin mr-1"
                          />
                        ) : (
                          <Sparkles
                            size={13}
                            className="inline mr-1"
                          />
                        )}
                        Generate AI Response
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
