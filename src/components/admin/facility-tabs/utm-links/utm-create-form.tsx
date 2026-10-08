"use client"

import { useState } from "react"
import { Loader2, Link2 } from "lucide-react"
import type { LandingPageOption } from "./types"

interface UTMCreateFormProps {
  facilityId: string
  adminKey: string
  landingPages: LandingPageOption[]
  onCreated: (link: Record<string, unknown>) => void
  onCancel: () => void
  initialValues?: {
    label: string
    landingPageId: string
    utmSource: string
    utmMedium: string
    utmCampaign: string
    utmContent: string
    utmTerm: string
  }
}

export default function UTMCreateForm({
  facilityId,
  adminKey,
  landingPages,
  onCreated,
  onCancel,
  initialValues,
}: UTMCreateFormProps) {
  const [label, setLabel] = useState(initialValues?.label || "")
  const [landingPageId, setLandingPageId] = useState(
    initialValues?.landingPageId || ""
  )
  const [utmSource, setUtmSource] = useState(initialValues?.utmSource || "meta")
  const [utmMedium, setUtmMedium] = useState(
    initialValues?.utmMedium || "paid_social"
  )
  const [utmCampaign, setUtmCampaign] = useState(
    initialValues?.utmCampaign || ""
  )
  const [utmContent, setUtmContent] = useState(initialValues?.utmContent || "")
  const [utmTerm, setUtmTerm] = useState(initialValues?.utmTerm || "")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls =
    "w-full px-3 py-2 rounded-lg border text-sm bg-[var(--color-light)] border-[var(--border-subtle)] text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:border-[var(--color-gold)]/50 outline-none transition-all"
  const selectCls = inputCls

  const BASE_URL =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://storageads.com"

  const selectedPage = landingPages.find((p) => p.id === landingPageId)

  const buildPreviewUrl = () => {
    let dest = BASE_URL
    if (selectedPage) dest = `${BASE_URL}/lp/${selectedPage.slug}`
    const params = new URLSearchParams()
    if (utmSource) params.set("utm_source", utmSource)
    if (utmMedium) params.set("utm_medium", utmMedium)
    if (utmCampaign) params.set("utm_campaign", utmCampaign)
    if (utmContent) params.set("utm_content", utmContent)
    if (utmTerm) params.set("utm_term", utmTerm)
    const qs = params.toString()
    return qs ? `${dest}?${qs}` : dest
  }

  const handleCreate = async () => {
    if (!label.trim() || !utmSource || !utmMedium) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/utm-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          facilityId,
          landingPageId: landingPageId || undefined,
          label: label.trim(),
          utmSource,
          utmMedium,
          utmCampaign: utmCampaign || undefined,
          utmContent: utmContent || undefined,
          utmTerm: utmTerm || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.link) {
        onCreated(data.link)
      } else {
        setError(data.error || "Couldn't create the link. Nothing was saved; try again.")
      }
    } catch {
      setError("Couldn't reach StorageAds. Check your connection and try again.")
    }
    setCreating(false)
  }

  return (
    <div className="border border-[var(--border-subtle)] rounded-xl p-5 space-y-4 bg-[var(--bg-elevated)]">
      <p className="text-sm font-medium text-[var(--color-dark)]">
        Create Tracked Link
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Label *
          </label>
          <input
            className={inputCls}
            placeholder="e.g. March FB campaign"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Landing Page
          </label>
          <select
            className={selectCls}
            value={landingPageId}
            onChange={(e) => setLandingPageId(e.target.value)}
          >
            <option value="">Homepage (storageads.com)</option>
            {landingPages
              .filter((p) => p.status === "published")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Source *
          </label>
          <select
            className={selectCls}
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
          >
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="tiktok">TikTok</option>
            <option value="email">Email</option>
            <option value="direct_mail">Direct Mail</option>
            <option value="direct">Direct</option>
            <option value="referral">Referral</option>
            <option value="organic">Organic</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Medium *
          </label>
          <select
            className={selectCls}
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
          >
            <option value="paid_social">paid_social</option>
            <option value="cpc">cpc</option>
            <option value="cpm">cpm</option>
            <option value="social">social</option>
            <option value="email">email</option>
            <option value="print">print</option>
            <option value="referral">referral</option>
            <option value="organic">organic</option>
            <option value="display">display</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Campaign
          </label>
          <input
            className={inputCls}
            placeholder="spring-promo"
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Content (A/B testing)
          </label>
          <input
            className={inputCls}
            placeholder="hero-cta-v2"
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
            Term (keywords)
          </label>
          <input
            className={inputCls}
            placeholder="storage+units"
            value={utmTerm}
            onChange={(e) => setUtmTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Live URL preview */}
      <div>
        <label className="block text-xs font-medium text-[var(--color-mid-gray)] mb-1">
          Destination Preview
        </label>
        <div className="p-3 rounded-lg text-xs font-mono break-all bg-[var(--color-light)] text-[var(--color-gold)] border border-[var(--border-subtle)]">
          {buildPreviewUrl()}
        </div>
      </div>

      {error && (
        <div role="alert" className="border-l-2 border-[var(--color-red)] pl-3 text-sm font-medium text-[var(--color-dark)]">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={creating || !label.trim() || !utmSource || !utmMedium}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-gold)] text-[var(--color-light)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold)]/90 disabled:opacity-50 transition-colors"
        >
          {creating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Link2 size={14} />
          )}
          Create Link
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg text-[var(--color-mid-gray)] hover:text-[var(--color-dark)]"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
