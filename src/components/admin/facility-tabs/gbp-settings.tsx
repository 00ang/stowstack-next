"use client"

import { useState, useEffect } from "react"
import {
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image,
} from "lucide-react"
import {
  type GBPConnection,
  type GBPSyncLog,
  card,
  textPrimary,
  textSecondary,
  textTertiary,
  btnPrimary,
  formatDate,
} from "./gbp-shared"

interface GBPSettingsProps {
  facilityId: string
  adminKey: string
  connection: GBPConnection | null
  setConnection: React.Dispatch<React.SetStateAction<GBPConnection | null>>
  syncLog: GBPSyncLog[]
  loadAll: () => Promise<void>
  syncing: string | null
  setSyncing: React.Dispatch<React.SetStateAction<string | null>>
  /** Which sub-tab to show: "sync" or "settings" */
  activeTab: "sync" | "settings"
}

export default function GBPSettings({
  facilityId,
  adminKey,
  connection,
  setConnection,
  syncLog,
  loadAll,
  syncing,
  setSyncing,
  activeTab,
}: GBPSettingsProps) {
  // Settings state
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [reviewSettings, setReviewSettings] = useState<{
    auto_respond: boolean
    min_rating: number
    response_tone: string
  }>({ auto_respond: false, min_rating: 4, response_tone: "professional" })

  // Load review settings when settings tab is shown
  useEffect(() => {
    if (activeTab !== "settings") return
    setSettingsLoading(true) // eslint-disable-line react-hooks/set-state-in-effect -- async fetch
    fetch(`/api/gbp-review-settings?facilityId=${facilityId}`, {
      headers: { "X-Admin-Key": adminKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) setReviewSettings(data.settings)
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false))
  }, [activeTab, facilityId, adminKey])

  async function triggerSync(type: string) {
    setSyncing(type)
    try {
      await fetch("/api/gbp-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId, type }),
      })
      await loadAll()
    } catch {
      /* silent */
    }
    setSyncing(null)
  }

  async function updateSyncConfig(key: string, value: boolean) {
    if (!connection) return
    const newConfig = { ...connection.sync_config, [key]: value }
    try {
      const res = await fetch("/api/gbp-sync", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId, syncConfig: newConfig }),
      })
      const data = await res.json()
      if (data.connection) setConnection(data.connection)
    } catch {
      /* silent */
    }
  }

  async function saveReviewSettings(
    updates: Partial<typeof reviewSettings>
  ) {
    const merged = { ...reviewSettings, ...updates }
    setReviewSettings(merged)
    try {
      await fetch("/api/gbp-review-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ facilityId, ...merged }),
      })
    } catch {
      /* silent */
    }
  }

  if (activeTab === "sync") {
    return (
      <div className="space-y-3">
        <h3 className={`text-sm font-semibold ${textPrimary}`}>
          Profile Sync
        </h3>

        {/* Connection status */}
        <div className={card + " p-4"}>
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-3 h-3 rounded-full ${connection?.status === "connected" ? "bg-emerald-500" : "bg-red-500"}`}
            />
            <span className={`text-sm font-medium ${textPrimary}`}>
              {connection?.status === "connected"
                ? "Connected"
                : "Not Connected"}
            </span>
          </div>
          {connection && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className={textTertiary}>Last Sync</span>
              <span className={textSecondary}>
                {formatDate(connection.last_sync_at)}
              </span>
              <span className={textTertiary}>Location</span>
              <span className={textSecondary}>
                {connection.location_name || "\u2014"}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              type: "hours",
              label: "Sync Hours",
              desc: "Push facility hours to GBP",
              icon: Clock,
            },
            {
              type: "photos",
              label: "Sync Photos",
              desc: "Upload latest photos to GBP",
              icon: Image,
            },
            {
              type: "full",
              label: "Full Sync",
              desc: "Sync everything at once",
              icon: RefreshCw,
            },
          ].map((s) => (
            <div key={s.type} className={card + " p-4"}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon size={16} className={textTertiary} />
                <span className={`text-sm font-medium ${textPrimary}`}>
                  {s.label}
                </span>
              </div>
              <p className={`text-xs ${textTertiary} mb-3`}>{s.desc}</p>
              <button
                onClick={() => triggerSync(s.type)}
                disabled={
                  syncing === s.type ||
                  connection?.status !== "connected"
                }
                className={btnPrimary + " w-full"}
              >
                {syncing === s.type ? (
                  <>
                    <Loader2
                      size={13}
                      className="inline animate-spin mr-1"
                    />{" "}
                    Syncing...
                  </>
                ) : (
                  s.label
                )}
              </button>
            </div>
          ))}
        </div>

        {syncLog.length > 0 && (
          <div className={card}>
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h4 className={`text-sm font-semibold ${textPrimary}`}>
                Sync History
              </h4>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {syncLog.map((log) => (
                <div
                  key={log.id}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  {log.status === "success" ? (
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  ) : log.status === "partial" ? (
                    <AlertCircle size={14} className="text-[var(--ic-secondary)]" />
                  ) : (
                    <AlertCircle size={14} className="text-red-500" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${textPrimary}`}>
                      {log.sync_type}
                    </span>
                    {log.error_message && (
                      <p className="text-xs text-red-400 truncate">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs ${textTertiary}`}>
                    {formatDate(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Settings tab ──
  return (
    <div className="space-y-3">
      <h3 className={`text-sm font-semibold ${textPrimary}`}>
        Automation Settings
      </h3>

      {settingsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2
            size={20}
            className="animate-spin text-[var(--color-gold)] mr-2"
          />
          <span className={textSecondary}>Loading settings...</span>
        </div>
      ) : (
        <>
          <div className={card + " p-4 space-y-4"}>
            {/* Sync automation toggles */}
            {[
              {
                key: "auto_post",
                label: "Auto-Post Updates",
                desc: "Automatically publish scheduled posts at their scheduled time",
              },
              {
                key: "auto_respond",
                label: "Auto-Respond to Reviews",
                desc: "Automatically generate and publish AI responses to new reviews",
              },
              {
                key: "sync_hours",
                label: "Auto-Sync Hours",
                desc: "Keep GBP hours in sync with facility hours on file",
              },
              {
                key: "sync_photos",
                label: "Auto-Sync Photos",
                desc: "Automatically push new facility photos to GBP",
              },
            ].map((setting) => (
              <div
                key={setting.key}
                className="flex items-center justify-between"
              >
                <div>
                  <p className={`text-sm font-medium ${textPrimary}`}>
                    {setting.label}
                  </p>
                  <p className={`text-xs ${textTertiary}`}>
                    {setting.desc}
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateSyncConfig(
                      setting.key,
                      !connection?.sync_config?.[
                        setting.key as keyof typeof connection.sync_config
                      ]
                    )
                  }
                  disabled={!connection}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    connection?.sync_config?.[
                      setting.key as keyof typeof connection.sync_config
                    ]
                      ? "bg-[var(--color-gold)]"
                      : "bg-[var(--color-light-gray)]"
                  } ${!connection ? "opacity-40" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      connection?.sync_config?.[
                        setting.key as keyof typeof connection.sync_config
                      ]
                        ? "translate-x-[22px]"
                        : "translate-x-[2px]"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* Review response settings */}
          <div className={card + " p-4 space-y-4"}>
            <h4
              className={`text-xs font-semibold ${textTertiary} uppercase tracking-wider`}
            >
              Review Response Settings
            </h4>

            {/* Auto-respond toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${textPrimary}`}>
                  Auto-Respond
                </p>
                <p className={`text-xs ${textTertiary}`}>
                  Automatically respond to reviews meeting minimum rating
                </p>
              </div>
              <button
                onClick={() =>
                  saveReviewSettings({
                    auto_respond: !reviewSettings.auto_respond,
                  })
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  reviewSettings.auto_respond
                    ? "bg-[var(--color-gold)]"
                    : "bg-[var(--color-light-gray)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    reviewSettings.auto_respond
                      ? "translate-x-[22px]"
                      : "translate-x-[2px]"
                  }`}
                />
              </button>
            </div>

            {/* Min rating slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm font-medium ${textPrimary}`}>
                  Minimum Rating for Auto-Respond
                </p>
                <span className={`text-sm font-semibold ${textPrimary}`}>
                  {reviewSettings.min_rating} {"\u2605"}
                </span>
              </div>
              <p className={`text-xs ${textTertiary} mb-2`}>
                Only auto-respond to reviews at or above this rating
              </p>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={reviewSettings.min_rating}
                onChange={(e) =>
                  saveReviewSettings({
                    min_rating: Number(e.target.value),
                  })
                }
                className="w-full accent-[var(--color-gold)]"
              />
              <div className="flex justify-between text-[10px] text-[var(--color-mid-gray)] mt-0.5">
                <span>1 star</span>
                <span>2 stars</span>
                <span>3 stars</span>
                <span>4 stars</span>
                <span>5 stars</span>
              </div>
            </div>

            {/* Response tone */}
            <div>
              <p className={`text-sm font-medium ${textPrimary} mb-2`}>
                Response Tone
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      value: "professional",
                      label: "Professional",
                      desc: "Clean, authoritative",
                    },
                    {
                      value: "friendly",
                      label: "Friendly",
                      desc: "Warm, conversational",
                    },
                    {
                      value: "empathetic",
                      label: "Empathetic",
                      desc: "Understanding, caring",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.value}
                    onClick={() =>
                      saveReviewSettings({ response_tone: t.value })
                    }
                    className={`px-3 py-2 rounded-lg border text-left transition-all ${
                      reviewSettings.response_tone === t.value
                        ? "bg-[var(--color-gold)]/10 border-[var(--color-gold)]/30 text-[var(--color-gold)]"
                        : "border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
                    }`}
                  >
                    <p className="text-xs font-medium">{t.label}</p>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        reviewSettings.response_tone === t.value
                          ? "text-[var(--color-gold)]/70"
                          : textTertiary
                      }`}
                    >
                      {t.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Connection details */}
          {connection && (
            <div className={card + " p-4"}>
              <h4 className={`text-sm font-semibold ${textPrimary} mb-2`}>
                Connection Details
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className={textTertiary}>Status</span>
                <span className={textPrimary}>{connection.status}</span>
                <span className={textTertiary}>Location</span>
                <span className={textPrimary}>
                  {connection.location_name || "\u2014"}
                </span>
                <span className={textTertiary}>Google Account</span>
                <span className={textPrimary}>
                  {connection.google_account_id || "\u2014"}
                </span>
                <span className={textTertiary}>Connected</span>
                <span className={textPrimary}>
                  {formatDate(connection.created_at)}
                </span>
                <span className={textTertiary}>Last Sync</span>
                <span className={textPrimary}>
                  {formatDate(connection.last_sync_at)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
