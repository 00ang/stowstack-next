'use client'

import { Wand2, ChevronRight } from 'lucide-react'
import type { AdVariation, MetaAdContent, StudioStep } from './types'
import { STATUS_BADGE } from './types'

export function CopyStep({ variations, selectedVariation, onSelectVariation, onSetStep }: {
  variations: AdVariation[]
  selectedVariation: AdVariation | null
  onSelectVariation: (v: AdVariation) => void
  onSetStep: (s: StudioStep) => void
}) {
  return (
    <div className="space-y-4">
      {variations.length === 0 ? (
        <div className="text-center py-12 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
          <Wand2 size={32} className="mx-auto mb-3 text-[var(--color-mid-gray)]" />
          <p className="font-medium text-[var(--color-dark)]">No ad copy yet</p>
          <p className="text-sm text-[var(--color-mid-gray)] mt-1">Generate ad variations in the Creative Studio tab first, then return here to build complete ads.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-body-text)]">Select the ad copy this image will be paired with. The image generator will design visuals to complement your chosen copy.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variations.map(v => {
              const c = v.content_json as MetaAdContent
              return (
                <button
                  key={v.id}
                  onClick={() => onSelectVariation(v)}
                  className={`w-full text-left p-4 border rounded-xl transition-all ${
                    selectedVariation?.id === v.id
                      ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-medium)]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-[var(--color-light-gray)] text-[var(--color-body-text)]">
                      {c.angleLabel || v.angle}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[v.status] || ''}`}>
                      {v.status}
                    </span>
                    {v.source_proven_ad_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase bg-[var(--color-dark)] text-[var(--color-light)]">
                        From proven ad
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--color-dark)] mb-1">{c.headline}</p>
                  <p className="text-[11px] text-[var(--color-mid-gray)] line-clamp-2">{c.primaryText}</p>
                  {c.cta && <p className="text-[10px] text-[var(--color-gold)] mt-1.5">{c.cta}</p>}
                </button>
              )
            })}
          </div>
          {selectedVariation && (
            <button
              onClick={() => onSetStep('image')}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-light)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold-hover)] transition-colors"
            >
              Next: Generate Image <ChevronRight size={14} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
