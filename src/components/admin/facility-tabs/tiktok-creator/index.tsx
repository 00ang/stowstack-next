'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useToolFocus } from '@/components/ontology/tool-focus'
import { useFlow } from '@/components/flow/flow-context'
import { useHandoff } from '@/components/flow/use-handoff'
import {
  Loader2, Sparkles, ImageIcon, Clock, X
} from 'lucide-react'
import { TikTokPreview } from './tiktok-preview'
import { SlideEditorPanel } from './slide-editor-panel'
import { renderSlideshow } from './slideshow-renderer'

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

const KB_EFFECTS: Slide['kenBurns'][] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'none']

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

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

/* ── Component ── */

export default function TikTokCreator({ facilityId, adminKey, facilityName }: {
  facilityId: string
  adminKey: string
  facilityName?: string
}) {
  // The first slide names what the post is about: the object it was opened
  // for (portal ?focus=), else the facility.
  const focus = useToolFocus()
  const inPortal = !!useFlow()
  const handoff = useHandoff()
  const opener = focus?.name ?? facilityName ?? 'Your Facility'
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<Slide[]>([])
  const [activeSlideIdx, setActiveSlideIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [caption, setCaption] = useState('')
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [engagementCounts] = useState(() => ({
    heart: Math.floor(Math.random() * 500) + 100,
    comment: Math.floor(Math.random() * 80) + 10,
    share: Math.floor(Math.random() * 40) + 5,
    bookmark: Math.floor(Math.random() * 60) + 8,
  }))

  // Load assets
  useEffect(() => {
    fetch(`/api/facility-assets?facilityId=${facilityId}`, {
      headers: { 'X-Admin-Key': adminKey },
    })
      .then(r => r.json())
      .then(data => {
        const photos = (data.assets || []).filter((a: Asset) => a.type === 'photo')
        setAssets(photos)

        // Auto-generate initial slideshow
        if (photos.length > 0) {
          const initial = photos.slice(0, 5).map((a: Asset, i: number) => ({
            id: generateId(),
            imageUrl: a.url,
            textOverlay: i === 0 ? opener : '',
            subText: '',
            duration: 2,
            kenBurns: KB_EFFECTS[i % KB_EFFECTS.length],
            textPosition: 'bottom' as const,
          }))
          setSlides(initial)
        }
      })
      .catch(() => { setError('Failed to load assets. Please try refreshing the page.') })
      .finally(() => setLoading(false))
  }, [facilityId, adminKey, opener])

  // Playback
  const advanceSlide = useCallback(() => {
    setActiveSlideIdx(prev => {
      const next = prev + 1
      if (next >= slides.length) {
        setPlaying(false)
        return 0
      }
      return next
    })
  }, [slides.length])

  useEffect(() => {
    if (playing && slides.length > 0) {
      const currentSlide = slides[activeSlideIdx]
      timerRef.current = setTimeout(advanceSlide, currentSlide.duration * 1000)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [playing, activeSlideIdx, slides, advanceSlide])

  function togglePlay() {
    if (playing) {
      setPlaying(false)
    } else {
      if (activeSlideIdx >= slides.length - 1) setActiveSlideIdx(0)
      setPlaying(true)
    }
  }

  function addSlide(imageUrl: string) {
    setSlides(prev => [...prev, {
      id: generateId(),
      imageUrl,
      textOverlay: '',
      subText: '',
      duration: 2,
      kenBurns: KB_EFFECTS[prev.length % KB_EFFECTS.length],
      textPosition: 'bottom',
    }])
  }

  function removeSlide(idx: number) {
    setSlides(prev => prev.filter((_, i) => i !== idx))
    if (activeSlideIdx >= slides.length - 1) setActiveSlideIdx(Math.max(0, slides.length - 2))
  }

  function updateSlide(idx: number, updates: Partial<Slide>) {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s))
  }

  function moveSlide(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= slides.length) return
    setSlides(prev => {
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[newIdx]
      copy[newIdx] = temp
      return copy
    })
    setActiveSlideIdx(newIdx)
  }

  async function autoGenerate() {
    setGenerating(true)
    try {
      const images = assets.slice(0, 6)
      if (images.length === 0) return

      const hookText = STORAGE_HOOKS[Math.floor(Math.random() * STORAGE_HOOKS.length)]
      const headline = opener
      const cta = 'Reserve Your Unit Today'

      const newSlides: Slide[] = [
        {
          id: generateId(),
          imageUrl: images[0].url,
          textOverlay: headline,
          subText: '',
          duration: 2.5,
          kenBurns: 'zoom-in',
          textPosition: 'center',
        },
        ...images.slice(1, -1).map((img, i) => ({
          id: generateId(),
          imageUrl: img.url,
          textOverlay: [
            'Clean, Secure Units',
            '24/7 Access Available',
            'Climate Controlled',
            'Month-to-Month Leases',
            'Drive-Up Access',
          ][i % 5],
          subText: '',
          duration: 2,
          kenBurns: KB_EFFECTS[(i + 1) % KB_EFFECTS.length] as Slide['kenBurns'],
          textPosition: 'bottom' as const,
        })),
        {
          id: generateId(),
          imageUrl: images[images.length - 1].url,
          textOverlay: cta,
          subText: hookText.slice(0, 80),
          duration: 3,
          kenBurns: 'zoom-out',
          textPosition: 'center',
        },
      ]

      setSlides(newSlides)
      setActiveSlideIdx(0)
      setCaption(`${hookText}\n\n${HASHTAG_SETS[Math.floor(Math.random() * HASHTAG_SETS.length)]}`)
    } finally {
      setGenerating(false)
    }
  }

  async function exportVideo() {
    if (slides.length === 0 || exporting) return
    setExporting(true)
    setError(null)
    try {
      const blob = await renderSlideshow(slides, (p) => {
        if (p.phase === 'recording' && p.total) {
          const pct = Math.round(((p.elapsed || 0) / p.total) * 100)
          setExportProgress(`Rendering… ${pct}%`)
        } else if (p.phase === 'loading') {
          setExportProgress('Loading images…')
        } else if (p.phase === 'finalizing') {
          setExportProgress('Finalizing…')
        }
      })

      const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tiktok-slideshow-${Date.now()}.${extension}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setExporting(false)
      setExportProgress(null)
    }
  }

  const totalDuration = slides.reduce((sum, s) => sum + s.duration, 0)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--color-gold)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 mb-4">
          <p className="flex-1 text-sm text-red-300">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Ken Burns keyframes */}
      <style>{`
        @keyframes kenBurnsZoomIn {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }
        @keyframes kenBurnsZoomOut {
          from { transform: scale(1.15); }
          to { transform: scale(1); }
        }
        @keyframes kenBurnsPanLeft {
          from { transform: translateX(0); }
          to { transform: translateX(-5%); }
        }
        @keyframes kenBurnsPanRight {
          from { transform: translateX(0); }
          to { transform: translateX(5%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-dark)]">TikTok Content Creator</h4>
          <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">Build slideshows for organic TikTok posting</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={autoGenerate}
            disabled={generating || assets.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold-hover)] disabled:opacity-40 transition-colors"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Auto-Generate
          </button>
          <span className="flex items-center gap-1 text-xs text-[var(--color-mid-gray)]">
            <Clock size={12} /> {totalDuration.toFixed(1)}s
          </span>
        </div>
      </div>

      {slides.length === 0 ? (
        <div className="text-center py-12 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
          <ImageIcon size={32} className="mx-auto mb-3 text-[var(--color-mid-gray)]" />
          <p className="text-sm text-[var(--color-body-text)]">
            {assets.length === 0
              ? 'No images available. Upload images in the Assets tab first.'
              : 'Click "Auto-Generate" to create a slideshow, or add slides manually below.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: TikTok Preview */}
          <TikTokPreview
            slides={slides}
            activeSlideIdx={activeSlideIdx}
            setActiveSlideIdx={setActiveSlideIdx}
            playing={playing}
            togglePlay={togglePlay}
            caption={caption}
            engagementCounts={engagementCounts}
          />

          {/* Right: Slide editor */}
          <SlideEditorPanel
            onPublish={() => {
              // The slideshow is a video file: it's posted from TikTok itself.
              // A photo post goes out through Publish Ads.
              if (inPortal) {
                handoff({
                  sentence: 'Export the video, then post it in TikTok.',
                  reason: 'A single photo post can go out from Publish Ads instead.',
                  label: 'Open Publish Ads',
                  href: '/portal/tools?tool=ad-publisher',
                })
              }
            }}
            slides={slides}
            activeSlideIdx={activeSlideIdx}
            setActiveSlideIdx={setActiveSlideIdx}
            setPlaying={setPlaying}
            updateSlide={updateSlide}
            moveSlide={moveSlide}
            removeSlide={removeSlide}
            addSlide={addSlide}
            caption={caption}
            setCaption={setCaption}
            assets={assets}
            totalDuration={totalDuration}
            exporting={exporting}
            exportProgress={exportProgress}
            exportVideo={exportVideo}
          />
        </div>
      )}
    </div>
  )
}
