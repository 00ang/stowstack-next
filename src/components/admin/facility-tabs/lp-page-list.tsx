"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Copy,
  Loader2,
  Sparkles,
} from "lucide-react"
import { type LandingPageRecord } from "./lp-builder-types"
import { useToolFocus } from "@/components/ontology/tool-focus"
import { useFlow } from "@/components/flow/flow-context"
import { FocusScopeToggle } from "@/components/ontology/focus-scope"
import { linkedIds, splitByFocus } from "@/lib/tools-track/focus-match"

const FUNNEL_OPTIONS = [
  {
    key: "awareness",
    label: "Awareness",
    desc: "Reach new customers — problem-focused, aspirational",
  },
  {
    key: "consideration",
    label: "Consideration",
    desc: "Show why you're the best option — features, proof, pricing",
  },
  {
    key: "decision",
    label: "Decision",
    desc: "Close the deal — offer-led, urgent, direct",
  },
  {
    key: "retargeting",
    label: "Retargeting",
    desc: "Remind past visitors — short, memorable, direct",
  },
]

const ARCHETYPE_OPTIONS = [
  { key: "", label: "General" },
  { key: "downsizer", label: "Downsizer" },
  { key: "business", label: "Business Owner" },
  { key: "student", label: "Student" },
  { key: "military", label: "Military / Relocating" },
  { key: "renovator", label: "Renovator" },
  { key: "life_event", label: "Life Event" },
]

export function PageList({
  pages,
  loading,
  error,
  generating,
  onCreateNew,
  onGenerate,
  onOpenPage,
  onClonePage,
  onDeletePage,
  onDismissError,
}: {
  pages: LandingPageRecord[]
  loading: boolean
  error: string | null
  generating?: boolean
  onCreateNew: () => void
  onGenerate?: (funnelStage: string, archetypeKey?: string) => void
  onOpenPage: (pageId: string) => void
  onClonePage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onDismissError: () => void
}) {
  const [showGenerate, setShowGenerate] = useState(false)
  const [funnelStage, setFunnelStage] = useState("consideration")
  const [archetype, setArchetype] = useState("")
  const focus = useToolFocus()
  const ontology = useFlow()?.ontology
  const [scope, setScope] = useState<{ address: string | null; showAll: boolean }>({ address: null, showAll: false })
  const showAll = scope.address === (focus?.address ?? null) && scope.showAll
  const { named } = splitByFocus(
    focus,
    pages,
    (p) => `${p.title} ${p.slug}`,
    (p) => p.id,
    focus ? linkedIds(ontology, focus.address, "pages") : new Set(),
  )
  const visible = focus && !showAll ? named : pages
  return (
    <div className="space-y-4">
      <div className="border border-black/[0.08] rounded-xl bg-white overflow-hidden">
        <div className="p-3 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-[#111827]">
                Landing Pages
              </h3>
              <p className="text-xs sm:text-sm text-[#9CA3AF]">
                Ad-specific pages for this facility
              </p>
              {focus && (
                <div className="mt-2">
                  <FocusScopeToggle
                    name={focus.name}
                    named={named.length}
                    total={pages.length}
                    showAll={showAll}
                    onToggle={() => setScope({ address: focus.address, showAll: !showAll })}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onGenerate && (
                <button
                  onClick={() => setShowGenerate(!showGenerate)}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#111827] border border-black/[0.08] hover:bg-black/[0.04] transition-colors disabled:opacity-40"
                >
                  {generating ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  <span className="hidden sm:inline">{generating ? "Generating..." : "AI Generate"}</span>
                  <span className="sm:hidden">{generating ? "..." : "AI"}</span>
                </button>
              )}
              <button
                onClick={onCreateNew}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#141413] hover:bg-[#141413]/90 transition-colors"
              >
                <Plus size={12} /> <span className="hidden sm:inline">Create Page</span><span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {showGenerate && onGenerate && (
            <div className="mb-5 p-3 sm:p-5 border border-black/[0.08] rounded-xl bg-[#F9FAFB]">
              <h4 className="text-xs sm:text-sm font-semibold text-[#111827] mb-1">
                AI Landing Page Generator
              </h4>
              <p className="text-[10px] sm:text-xs text-[#9CA3AF] mb-3 sm:mb-4">
                Generates a complete landing page using facility data, photos,
                reviews, and professional ad copy principles.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                {FUNNEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setFunnelStage(opt.key)}
                    className={`p-2 sm:p-3 rounded-lg border text-left transition-all ${
                      funnelStage === opt.key
                        ? "border-[#141413] bg-[#141413]/5"
                        : "border-black/[0.08] hover:border-black/[0.15]"
                    }`}
                  >
                    <span className="text-[11px] sm:text-xs font-semibold text-[#111827]">
                      {opt.label}
                    </span>
                    <p className="text-[9px] sm:text-[10px] text-[#9CA3AF] mt-0.5 leading-snug hidden sm:block">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <select
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                  className="h-9 px-3 rounded-lg text-xs border border-black/[0.08] bg-white text-[#111827] outline-none"
                >
                  {ARCHETYPE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    onGenerate(funnelStage, archetype || undefined)
                    setShowGenerate(false)
                  }}
                  disabled={generating}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-[#141413] hover:bg-[#141413]/90 transition-colors disabled:opacity-40"
                >
                  {generating ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Generate
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-12">
              <Loader2
                size={20}
                className="animate-spin text-[#3B82F6]"
              />
            </div>
          )}

          {!loading && pages.length === 0 && (
            <div className="text-center py-12 rounded-xl border-2 border-dashed border-black/[0.08]">
              <FileText
                size={32}
                className="mx-auto mb-3 text-[#9CA3AF]"
              />
              <p className="text-sm font-medium text-[#111827] mb-1">
                No landing pages yet
              </p>
              <p className="text-xs text-[#9CA3AF] mb-4">
                Create your first ad-specific landing page for this
                facility
              </p>
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#111827] bg-[#3B82F6] hover:bg-[#3B82F6]/90"
              >
                <Plus size={14} /> Create Page
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400 mb-4">
              {error}
              <button
                onClick={onDismissError}
                className="ml-2 font-medium hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="space-y-2">
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-black/[0.08] cursor-pointer hover:bg-black/[0.03] transition-all"
                  onClick={() => onOpenPage(p.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#111827] truncate">
                        {p.title}
                      </p>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                          p.status === "published"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : p.status === "archived"
                              ? "bg-black/[0.04] text-[#9CA3AF]"
                              : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.variation_ids &&
                        p.variation_ids.length > 0 && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#3B82F6]/10 text-[#3B82F6]">
                            {p.variation_ids.length} ad
                            {p.variation_ids.length > 1 ? "s" : ""}{" "}
                            linked
                          </span>
                        )}
                    </div>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      /lp/{p.slug}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      Created{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/lp/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg hover:bg-black/[0.04]"
                      title="Open preview"
                    >
                      <ExternalLink
                        size={14}
                        className="text-[#9CA3AF]"
                      />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onClonePage(p.id)
                      }}
                      aria-label="Duplicate page"
                      className="p-1.5 rounded-lg hover:bg-black/[0.04]"
                      title="Duplicate page"
                    >
                      <Copy size={14} className="text-[#9CA3AF]" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeletePage(p.id)
                      }}
                      aria-label="Delete page"
                      className="p-1.5 rounded-lg hover:bg-black/[0.04]"
                      title="Delete page"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
