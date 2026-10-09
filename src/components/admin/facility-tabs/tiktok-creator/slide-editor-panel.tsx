'use client'

import { useState } from 'react'
import {
  Loader2, Plus, Trash2,
  Download, Hash, Type,
  ChevronLeft, ChevronRight, Send,
} from 'lucide-react'

/* ── Types ── */

interface Asset {
  id: string
  url: string
  type: string
  label?: string
}

interface Slide {
  id: string
  imageUrl: string
  textOverlay: string
  subText: string
  duration: number
  kenBurns: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'none'
  textPosition: 'top' | 'center' | 'bottom'
}

const STORAGE_HOOKS = [
  "Running out of space? We've got you covered.",
  "Declutter your life. Store with confidence.",
  "Your stuff deserves a safe home too.",
  "Moving? We'll hold onto your things.",
  "Storage made simple. Reserve your unit today.",
  "Garage looking like a disaster? We can help.",
  "First month free -- limited units available.",
  "Climate-controlled units starting at $49/mo.",
  "Don't throw it away. Store it away.",
  "5-star rated storage in your neighborhood.",
]

const HASHTAG_SETS = [
  '#selfstorage #storageunit #moving #declutter #organization #movingtips',
  '#storagelife #packingtips #movingday #storagesolutions #organize #rental',
  '#ministorage #storagefacility #movingout #storageunits #cleanout #spacesaver',
]

export function SlideEditorPanel({
  onPublish,
  slides,
  activeSlideIdx,
  setActiveSlideIdx,
  setPlaying,
  updateSlide,
  moveSlide,
  removeSlide,
  addSlide,
  caption,
  setCaption,
  assets,
  totalDuration,
  exporting,
  exportProgress,
  exportVideo,
}: {
  /** Hand off to where it can actually be posted (the portal shows the next step). */
  onPublish?: () => void
  slides: Slide[]
  activeSlideIdx: number
  setActiveSlideIdx: (idx: number) => void
  setPlaying: (playing: boolean) => void
  updateSlide: (idx: number, updates: Partial<Slide>) => void
  moveSlide: (idx: number, dir: -1 | 1) => void
  removeSlide: (idx: number) => void
  addSlide: (imageUrl: string) => void
  caption: string
  setCaption: (caption: string) => void
  assets: Asset[]
  totalDuration: number
  exporting: boolean
  exportProgress?: string | null
  exportVideo: () => void
}) {
  const [publishNote, setPublishNote] = useState(false)
  const activeSlide = slides[activeSlideIdx]

  return (
    <div className="space-y-4">
      {/* Caption & Hashtags */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[var(--color-body-text)]">Caption & Hashtags</label>
          <span className="text-[10px] text-[var(--color-mid-gray)]">{caption.length}/2200</span>
        </div>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          rows={3}
          maxLength={2200}
          placeholder="Write your TikTok caption... #selfstorage #moving"
          className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light-gray)] text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)] resize-none"
        />
      </div>

      {/* Hashtag quick-insert */}
      <div>
        <label className="text-xs font-medium text-[var(--color-body-text)] flex items-center gap-1 mb-1.5">
          <Hash size={11} /> Quick Hashtag Sets
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HASHTAG_SETS.map((set, i) => (
            <button
              key={i}
              onClick={() => setCaption(caption + (caption.endsWith('\n') || caption === '' ? '' : '\n\n') + set)}
              className="text-[10px] px-2 py-1 rounded border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] hover:text-[var(--color-dark)] transition-colors truncate max-w-[200px]"
            >
              {set}
            </button>
          ))}
        </div>
      </div>

      {/* Storage hooks */}
      <div>
        <label className="text-xs font-medium text-[var(--color-body-text)] flex items-center gap-1 mb-1.5">
          <Type size={11} /> Storage Hooks (tap to use as headline)
        </label>
        <div className="grid grid-cols-1 gap-1 max-h-[120px] overflow-y-auto pr-1">
          {STORAGE_HOOKS.map((hook, i) => (
            <button
              key={i}
              onClick={() => {
                if (activeSlide) {
                  updateSlide(activeSlideIdx, { textOverlay: hook })
                }
              }}
              className="text-left text-[11px] px-2.5 py-1.5 rounded border border-[var(--border-subtle)] text-[var(--color-body-text)] hover:bg-[var(--color-gold)]/10 hover:text-[var(--color-dark)] hover:border-[var(--color-gold)]/30 transition-colors"
            >
              {hook}
            </button>
          ))}
        </div>
      </div>

      {/* Slide list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--color-body-text)]">Slides ({slides.length})</label>
        </div>
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              onClick={() => { setPlaying(false); setActiveSlideIdx(idx) }}
              className={`flex gap-3 p-2 border rounded-lg cursor-pointer transition-colors ${
                idx === activeSlideIdx
                  ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/5'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-medium)]'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                alt=""
                className="w-14 h-14 object-cover rounded flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="flex-1 min-w-0 space-y-1">
                {/* Headline input */}
                <input
                  value={slide.textOverlay}
                  onChange={e => updateSlide(idx, { textOverlay: e.target.value })}
                  placeholder="Headline text..."
                  className="w-full text-xs px-1.5 py-0.5 rounded bg-transparent text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] border-none outline-none focus:bg-[var(--color-light-gray)]"
                  onClick={e => e.stopPropagation()}
                />
                {/* Subtext input */}
                <input
                  value={slide.subText}
                  onChange={e => updateSlide(idx, { subText: e.target.value })}
                  placeholder="Subtext..."
                  className="w-full text-[10px] px-1.5 py-0.5 rounded bg-transparent text-[var(--color-body-text)] placeholder-[var(--color-mid-gray)] border-none outline-none focus:bg-[var(--color-light-gray)]"
                  onClick={e => e.stopPropagation()}
                />
                <div className="flex gap-1.5 items-center">
                  {/* Duration */}
                  <select
                    value={slide.duration}
                    onChange={e => updateSlide(idx, { duration: parseFloat(e.target.value) })}
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-light-gray)] text-[var(--color-body-text)] border-none outline-none"
                  >
                    {[1, 1.5, 2, 2.5, 3, 4, 5].map(d => (
                      <option key={d} value={d}>{d}s</option>
                    ))}
                  </select>
                  {/* Ken Burns */}
                  <select
                    value={slide.kenBurns}
                    onChange={e => updateSlide(idx, { kenBurns: e.target.value as Slide['kenBurns'] })}
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-light-gray)] text-[var(--color-body-text)] border-none outline-none"
                  >
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                    <option value="pan-left">Pan Left</option>
                    <option value="pan-right">Pan Right</option>
                    <option value="none">Static</option>
                  </select>
                  {/* Text Position */}
                  <select
                    value={slide.textPosition}
                    onChange={e => updateSlide(idx, { textPosition: e.target.value as Slide['textPosition'] })}
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-light-gray)] text-[var(--color-body-text)] border-none outline-none"
                  >
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                  <div className="flex-1" />
                  {/* Move controls */}
                  <button onClick={e => { e.stopPropagation(); moveSlide(idx, -1) }} disabled={idx === 0} aria-label="Move slide left" className="p-0.5 text-[var(--color-mid-gray)] disabled:opacity-20 hover:text-[var(--color-dark)]"><ChevronLeft size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); moveSlide(idx, 1) }} disabled={idx === slides.length - 1} aria-label="Move slide right" className="p-0.5 text-[var(--color-mid-gray)] disabled:opacity-20 hover:text-[var(--color-dark)]"><ChevronRight size={11} /></button>
                  <button onClick={e => { e.stopPropagation(); removeSlide(idx) }} aria-label="Delete slide" className="p-0.5 text-red-400 hover:text-red-300"><Trash2 size={11} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add slide from assets */}
      <div>
        <label className="text-xs font-medium text-[var(--color-body-text)] block mb-1.5">Add Image</label>
        {assets.filter(a => !slides.some(s => s.imageUrl === a.url)).length === 0 ? (
          <p className="text-[10px] text-[var(--color-mid-gray)]">All available images are in the slideshow.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-24 overflow-y-auto">
            {assets.filter(a => !slides.some(s => s.imageUrl === a.url)).map(a => (
              <button
                key={a.id}
                onClick={() => addSlide(a.url)}
                className="relative h-10 rounded overflow-hidden hover:ring-2 hover:ring-[var(--color-gold)] transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Plus size={12} className="text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Export & Publish */}
      <div className="space-y-2">
        <button
          onClick={exportVideo}
          disabled={exporting || slides.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-gold)] text-[var(--color-light)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold-hover)] disabled:opacity-40 transition-colors"
        >
          {exporting ? (
            <><Loader2 size={14} className="animate-spin" /> {exportProgress || 'Exporting…'}</>
          ) : (
            <><Download size={14} /> Export Video ({totalDuration.toFixed(0)}s)</>
          )}
        </button>
        <button
          onClick={() => {
            setPublishNote(true)
            onPublish?.()
          }}
          disabled={slides.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-light-gray)] text-[var(--color-dark)] text-sm font-medium rounded-lg hover:bg-[var(--color-light-gray)] disabled:opacity-40 transition-colors border border-[var(--border-subtle)]"
        >
          <Send size={14} /> Post on TikTok ({slides.length} slides)
        </button>
        {publishNote && (
          <div role="status" className="border-l-2 border-[var(--color-dark)] bg-[var(--bg-elevated)] p-3 text-xs font-medium text-[var(--color-dark)]">
            The slideshow is a video: export it above, then post it from the TikTok app. A single photo post can go out
            from Publish Ads.
          </div>
        )}
      </div>
    </div>
  )
}
