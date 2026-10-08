"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useToolFocus } from "@/components/ontology/tool-focus"
import { useHandoff } from "@/components/flow/use-handoff"
import { slugify as addressSlug } from "@/lib/ontology/address"
import {
  type LPSection,
  type LandingPageRecord,
  SECTION_TYPE_META,
  PAGE_TEMPLATES,
} from "./lp-builder-types"
import { TemplatePicker } from "./lp-template-picker"
import { PageList } from "./lp-page-list"
import { PageEditor } from "./lp-page-editor"

/* ── Landing Page Builder ── */

export default function LandingPageBuilder({
  facilityId,
  adminKey,
}: {
  facilityId: string
  adminKey: string
}) {
  const [pages, setPages] = useState<LandingPageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPage, setEditingPage] = useState<LandingPageRecord | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [generating, setGenerating] = useState(false)
  // Opened from an object (portal ?focus=): a page opens itself; an ad
  // becomes the ad a generated page is matched to.
  const focus = useToolFocus()
  const handoff = useHandoff()
  const openedFocus = useRef(false)

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/landing-pages?facilityId=${facilityId}`,
        {
          headers: { "X-Admin-Key": adminKey },
        }
      )
      if (!res.ok) throw new Error("Failed to fetch pages")
      const data = await res.json()
      setPages(data.pages || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [facilityId, adminKey])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  useEffect(() => {
    if (openedFocus.current || focus?.type !== "pages") return
    openedFocus.current = true
    fetch(`/api/landing-pages?id=${encodeURIComponent(focus.id)}`, {
      headers: { "X-Admin-Key": adminKey },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load page")
        return res.json()
      })
      .then((data) => {
        if (data?.page) setEditingPage(data.page)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error")
      })
  }, [focus, adminKey])

  function slugify(str: string) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  function createFromTemplate(templateKey: string) {
    const template = PAGE_TEMPLATES[templateKey]
    if (!template) return
    const sections: LPSection[] = template.sectionTypes.map((type, i) => ({
      id: crypto.randomUUID(),
      section_type: type,
      sort_order: i,
      config: JSON.parse(
        JSON.stringify(
          SECTION_TYPE_META[type]?.defaultConfig || {}
        )
      ),
    }))

    setEditingPage({
      id: "",
      facility_id: facilityId,
      slug: slugify("landing-page"),
      title: "New Landing Page",
      status: "draft",
      meta_title: "",
      meta_description: "",
      theme: {},
      storedge_widget_url: "",
      sections,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setShowTemplatePicker(false)
  }

  async function clonePage(pageId: string) {
    try {
      const res = await fetch("/api/landing-pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ cloneFrom: pageId }),
      })
      if (!res.ok) throw new Error("Clone failed")
      const data = await res.json()
      fetchPages()
      setEditingPage(data.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  async function savePage() {
    if (!editingPage) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        facilityId,
        title: editingPage.title,
        slug: editingPage.slug,
        metaTitle: editingPage.meta_title,
        metaDescription: editingPage.meta_description,
        theme: editingPage.theme,
        status: editingPage.status,
        storedgeWidgetUrl: editingPage.storedge_widget_url,
        variationIds: editingPage.variation_ids || [],
        sections: (editingPage.sections || []).map((s, i) => ({
          sectionType: s.section_type,
          sortOrder: i,
          config: s.config,
        })),
      }

      const isNew = !editingPage.id
      const url = isNew
        ? "/api/landing-pages"
        : `/api/landing-pages?id=${editingPage.id}`
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok)
        throw new Error(data.error || data.fields?.slug || "Save failed")

      setEditingPage(data.page)
      fetchPages()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  async function publishPage() {
    if (!editingPage?.id) {
      await savePage()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/landing-pages?id=${editingPage.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Key": adminKey,
          },
          body: JSON.stringify({ status: "published" }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Publish failed")
      setEditingPage({
        ...editingPage,
        status: "published",
        published_at: new Date().toISOString(),
      })
      fetchPages()
      const slug = editingPage.slug
      if (slug) {
        handoff({
          sentence: `/lp/${slug} is live.`,
          reason: "Give it a tracking link for each way in, so every move-in shows where it came from.",
          label: "Make a tracking link",
          href: `/portal/tools?tool=utm-links&focus=pages/${addressSlug(slug, "page")}`,
        })
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  async function deletePage(id: string) {
    try {
      await fetch(`/api/landing-pages?id=${id}`, {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      })
      fetchPages()
      if (editingPage?.id === id) setEditingPage(null)
    } catch {
      /* silent */
    }
  }

  async function openPageForEdit(pageId: string) {
    try {
      const res = await fetch(`/api/landing-pages?id=${pageId}`, {
        headers: { "X-Admin-Key": adminKey },
      })
      if (!res.ok) throw new Error("Failed to load page")
      const data = await res.json()
      setEditingPage(data.page)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  async function generatePage(
    funnelStage = "consideration",
    archetypeKey?: string
  ) {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          facilityId,
          funnelStage,
          archetypeKey: archetypeKey || null,
          adVariationId: focus?.type === "ads" ? focus.id : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setEditingPage(data.page)
      fetchPages()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setGenerating(false)
    }
  }

  /* ── TEMPLATE PICKER ── */
  if (showTemplatePicker) {
    return (
      <TemplatePicker
        pages={pages}
        onSelectTemplate={createFromTemplate}
        onClonePage={clonePage}
        onClose={() => setShowTemplatePicker(false)}
      />
    )
  }

  /* ── PAGE LIST VIEW ── */
  if (!editingPage) {
    return (
      <PageList
        pages={pages}
        loading={loading}
        error={error}
        generating={generating}
        onCreateNew={() => setShowTemplatePicker(true)}
        onGenerate={generatePage}
        onOpenPage={openPageForEdit}
        onClonePage={clonePage}
        onDeletePage={deletePage}
        onDismissError={() => setError(null)}
      />
    )
  }

  /* ── PAGE EDITOR VIEW ── */
  return (
    <PageEditor
      facilityId={facilityId}
      adminKey={adminKey}
      editingPage={editingPage}
      saving={saving}
      error={error}
      onUpdatePage={setEditingPage}
      onSave={savePage}
      onPublish={publishPage}
      onBack={() => setEditingPage(null)}
      onDismissError={() => setError(null)}
    />
  )
}
