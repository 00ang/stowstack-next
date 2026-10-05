'use client'

import { useState, useEffect } from 'react'
import { Loader2, ChevronRight } from 'lucide-react'
import type { AdVariation, Asset, ImageTemplate, GenerationJob, StudioStep } from './ad-studio/types'
import { CopyStep } from './ad-studio/copy-step'
import { ImageStep } from './ad-studio/image-step'
import { PreviewStep } from './ad-studio/preview-step'

/* ── Step Indicator ── */

function StepIndicator({ current, onStep }: { current: StudioStep; onStep: (s: StudioStep) => void }) {
  const steps: { key: StudioStep; label: string; num: number }[] = [
    { key: 'copy', label: 'Select Copy', num: 1 },
    { key: 'image', label: 'Generate Image', num: 2 },
    { key: 'preview', label: 'Preview & Publish', num: 3 },
  ]
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onStep(s.key)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              current === s.key
                ? 'bg-[var(--color-gold)] text-[var(--color-light)]'
                : 'text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
              current === s.key ? 'bg-[var(--color-dark)]/20' : 'bg-[var(--color-light-gray)]'
            }`}>{s.num}</span>
            <span className="hidden sm:inline">{s.label}</span>
            <span className="sm:hidden">{s.label.split(' ')[0]}</span>
          </button>
          {i < steps.length - 1 && <ChevronRight size={12} className="text-[var(--color-mid-gray)] shrink-0" />}
        </div>
      ))}
    </div>
  )
}

/* ── Main Component ── */

export default function AdStudio({ facilityId, adminKey, facilityName }: {
  facilityId: string
  adminKey: string
  facilityName?: string
}) {
  const [step, setStep] = useState<StudioStep>('copy')
  const [variations, setVariations] = useState<AdVariation[]>([])
  const [selectedVariation, setSelectedVariation] = useState<AdVariation | null>(null)
  const [templates, setTemplates] = useState<ImageTemplate[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [jobs, setJobs] = useState<GenerationJob[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch all data on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/generate-image', { headers: { 'X-Admin-Key': adminKey } }).then(r => r.json()),
      fetch(`/api/facility-creatives?facilityId=${facilityId}`, { headers: { 'X-Admin-Key': adminKey } }).then(r => r.json()),
      fetch(`/api/facility-assets?facilityId=${facilityId}`, { headers: { 'X-Admin-Key': adminKey } }).then(r => r.json()).catch(() => ({ assets: [] })),
    ]).then(([imageData, creativeData, assetData]) => {
      if (imageData.templates) {
        setTemplates(imageData.templates)
      }
      if (creativeData.variations?.length) {
        const metaVariations = creativeData.variations.filter(
          (v: AdVariation) => v.platform === 'meta_feed' && v.status !== 'rejected'
        )
        setVariations(metaVariations)
        const wanted =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('variation')
            : null
        const fromProven = wanted
          ? metaVariations.find((v: AdVariation) => v.id === wanted)
          : null
        if (fromProven) setSelectedVariation(fromProven)
        else if (metaVariations.length) setSelectedVariation(metaVariations[0])
      }
      if (assetData.assets) {
        const photos = assetData.assets.filter((a: Asset) => a.type === 'photo')
        setAssets(photos)
        if (photos.length > 0) setSelectedImage(photos[0].url)
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [facilityId, adminKey])

  const selectedCopy = (selectedVariation?.content_json || {}) as Record<string, string>
  const resolvedFacilityName = facilityName || 'Storage Facility'

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--color-gold)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-dark)]">Ad Studio</h4>
          <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">Select copy, generate images, preview as mockup</p>
        </div>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} onStep={setStep} />

      {/* ─── STEP 1: SELECT COPY ─── */}
      {step === 'copy' && (
        <CopyStep
          variations={variations}
          selectedVariation={selectedVariation}
          onSelectVariation={setSelectedVariation}
          onSetStep={setStep}
        />
      )}

      {/* ─── STEP 2: GENERATE / SELECT IMAGE ─── */}
      {step === 'image' && (
        <ImageStep
          facilityId={facilityId}
          adminKey={adminKey}
          selectedVariation={selectedVariation}
          selectedCopy={selectedCopy}
          templates={templates}
          assets={assets}
          selectedImage={selectedImage}
          onSelectImage={setSelectedImage}
          onSetStep={setStep}
          jobs={jobs}
          onJobsChange={setJobs}
        />
      )}

      {/* ─── STEP 3: PREVIEW & PUBLISH ─── */}
      {step === 'preview' && (
        <PreviewStep
          variations={variations}
          selectedVariation={selectedVariation}
          onSelectVariation={setSelectedVariation}
          selectedCopy={selectedCopy}
          selectedImage={selectedImage}
          onSelectImage={setSelectedImage}
          facilityName={resolvedFacilityName}
          adminKey={adminKey}
          jobs={jobs}
          assets={assets}
          onSetStep={setStep}
          onVariationsChange={setVariations}
        />
      )}
    </div>
  )
}
