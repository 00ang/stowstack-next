"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePortal } from "@/components/portal/portal-shell";
import { useFlow } from "@/components/flow/flow-context";
import { BlockPage } from "@/components/landing/block-page";
import { graphFromRecord, list, param, readGraph, type FunnelGraph } from "@/lib/funnel-graph";
import type { FunnelRecord } from "@/lib/funnel-graph/from-record";
import { parsePrice } from "@/lib/ontology/address";
import type { OntologyObject } from "@/lib/ontology/types";
import {
  BLOCK_LABEL,
  BLOCK_TYPES,
  TEMPLATE_KEYS,
  TEMPLATE_META,
  applyFix,
  blocksToSections,
  draftFromCampaign,
  draftFromTemplate,
  findBlock,
  makeBlock,
  moveBlock,
  pageInsights,
  removeBlock,
  sectionsToBlocks,
  slugFor,
  textOf,
  updateBlock,
  type Block,
  type LiveUnit,
  type PageFacts,
  type PageInsight,
} from "@/lib/page-blocks";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";

/**
 * Create and edit a campaign's landing page. Blocks reorder by drag or
 * by the up and down buttons (the buttons are what a phone can use).
 * Edits autosave as a draft. Publish writes a snapshot the public URL
 * serves, so a later edit does not change the live page.
 */

interface PageRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  facility_id?: string;
  funnel_id?: string | null;
  variation_ids?: string[];
  storedge_widget_url?: string | null;
  published_snapshot?: unknown;
  sections?: { id: string; section_type: string; sort_order: number; config: unknown }[];
}

const LOCAL = "sa-campaign-graph";

function unitsFromObjects(objects: OntologyObject[]): LiveUnit[] {
  return objects
    .filter((o) => o.type === "units")
    .map((o) => {
      const empty = o.facts.find((f) => f.label === "Empty")?.value ?? "";
      const match = /(\d[\d,]*)\s+of\s+(\d[\d,]*)/.exec(empty);
      const vacant = match ? Number(match[1].replace(/,/g, "")) : 0;
      const total = match ? Number(match[2].replace(/,/g, "")) : 0;
      const features = (o.facts.find((f) => f.label === "Features")?.value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      return {
        key: o.name,
        name: o.name,
        size: o.name,
        rate: parsePrice(o.facts.find((f) => f.label === "Web rate")?.value) ?? parsePrice(o.facts.find((f) => f.label === "Street rate")?.value),
        vacant,
        total,
        features,
        climate: /climate/i.test(o.name),
      };
    });
}

function factsFor(
  objects: OntologyObject[],
  graph: FunnelGraph | null,
  facilityName: string,
  place: string | null,
  storedgeUrl: string | null,
  sample: boolean,
): PageFacts {
  const units = unitsFromObjects(objects);
  const campaign = graph ? objects.find((o) => o.type === "campaigns" && o.name === graph.name) : undefined;
  const ads = objects.filter((o) => o.type === "ads" && campaign && o.links.includes(campaign.address));
  const unitNode = graph?.nodes.find((n) => n.type === "units");
  const sizeIds = unitNode ? list(unitNode.params.sizes) : [];
  const named = sizeIds.length
    ? objects.filter((o) => o.type === "units" && sizeIds.includes(o.id)).map((o) => o.name)
    : [];
  const offerNode = graph?.nodes.find((n) => n.type === "offer");
  const offerId = offerNode ? param(offerNode, "offer") : "";
  const offer = offerId ? objects.find((o) => o.type === "offers" && o.id === offerId) : objects.find((o) => o.type === "offers" && o.status === "running");
  return {
    facilityName,
    address: place,
    phone: null,
    hours: sample ? "Office open 7 days. Gate 6am to 10pm." : null,
    sizes: named,
    offerName: offer?.name ?? null,
    offerDetail: offer?.facts.find((f) => f.label === "Deal")?.value ?? null,
    adHeadline: ads[0]?.name ?? null,
    units: units.map((u) => ({ ...u, key: u.name })),
    photos: [],
    storedgeUrl,
  };
}

export function PageStudio({ funnelId }: { funnelId: string }) {
  const { client, authFetch } = usePortal();
  const flow = useFlow();
  const router = useRouter();
  const search = useSearchParams();
  const sample = isPortalDemo();
  const objects = flow?.ontology?.objects;
  const [graph, setGraph] = useState<FunnelGraph | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [page, setPage] = useState<PageRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [storedgeUrl, setStoredgeUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [past, setPast] = useState<{ blocks: Block[]; title: string }[]>([]);
  const [future, setFuture] = useState<{ blocks: Block[]; title: string }[]>([]);
  const [frame, setFrame] = useState<"phone" | "desktop">("phone");
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [publishing, setPublishing] = useState(false);
  const ready = useRef(false);
  const dragFrom = useRef<number | null>(null);
  const blocksRef = useRef(blocks);
  const titleRef = useRef(title);
  const urlRef = useRef(storedgeUrl);
  blocksRef.current = blocks;
  titleRef.current = title;
  urlRef.current = storedgeUrl;

  const nodeId = search.get("node");
  const askedId = search.get("page");
  const askedSlug = search.get("slug");

  const load = useCallback(async () => {
    setLoading(true);
    ready.current = false;
    try {
      const [funnelRes, listRes] = await Promise.all([
        authFetch(`/api/funnels?id=${encodeURIComponent(funnelId)}`),
        authFetch(`/api/landing-pages?facilityId=${encodeURIComponent(client.facilityId)}`),
      ]);
      const funnel = funnelRes.ok ? ((await funnelRes.json()) as FunnelRecord) : null;
      const list = listRes.ok ? ((await listRes.json()) as { pages?: PageRow[] }) : {};
      const g = funnel ? readGraph(funnel.config) ?? graphFromRecord(funnel) : null;
      setGraph(g);
      const rows = list.pages ?? [];
      setPages(rows);
      const node = g?.nodes.find((n) => n.id === nodeId && n.type === "page");
      const linked = askedId || (node ? param(node, "page") : "") || "";
      const slug = askedSlug || node?.slug || "";
      const hit = rows.find((p) => p.id === linked) || rows.find((p) => slug && p.slug === slug) || null;
      if (hit) {
        const detailRes = await authFetch(`/api/landing-pages?id=${encodeURIComponent(hit.id)}`);
        const detail = detailRes.ok ? ((await detailRes.json()) as { page?: PageRow }).page : hit;
        if (detail) openPage(detail);
      }
    } catch {
      setNotice("Couldn’t open the page.");
    } finally {
      setLoading(false);
      ready.current = true;
    }
  }, [authFetch, askedId, askedSlug, client.facilityId, funnelId, nodeId]);

  useEffect(() => {
    void load();
  }, [load]);

  function openPage(row: PageRow) {
    const next = sectionsToBlocks(row.sections ?? []);
    setPage(row);
    setBlocks(next);
    setTitle(row.title);
    setStoredgeUrl(row.storedge_widget_url ?? "");
    setPast([]);
    setFuture([]);
    ready.current = true;
  }

  const facts = useMemo(
    () => factsFor(objects ?? [], graph, client.facilityName, client.location || null, storedgeUrl || null, sample),
    [objects, graph, client.facilityName, client.location, storedgeUrl, sample],
  );
  const liveUnits = useMemo(() => unitsFromObjects(objects ?? []), [objects]);
  const expectsReserve = !!graph?.nodes.some((n) => n.type === "reserve") || !!storedgeUrl;
  const adHeadline = useMemo(() => {
    const ids = page?.variation_ids ?? [];
    const linked = ids
      .map((id) => objects?.find((o) => o.type === "ads" && o.id === id))
      .filter((o): o is NonNullable<typeof o> => !!o);
    return linked[0]?.name ?? facts.adHeadline;
  }, [page?.variation_ids, objects, facts.adHeadline]);
  const insight: PageInsight | undefined = page
    ? pageInsights({
        blocks,
        campaignSizes: facts.sizes.map((name) => ({ name, rate: facts.units.find((u) => u.name === name)?.rate ?? null })),
        units: facts.units,
        adHeadline,
        facilityName: client.facilityName,
        offerName: facts.offerName,
        offerDetail: facts.offerDetail,
        expectsReserve,
      })[0]
    : undefined;

  const save = useCallback(async () => {
    const current = page;
    if (!current) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/landing-pages?id=${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          title: titleRef.current,
          storedge_widget_url: urlRef.current || null,
          theme: { editor: "blocks" },
          sections: blocksToSections(blocksRef.current),
        }),
      });
      if (!res.ok) {
        setNotice("The draft didn’t save.");
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setNotice("The draft didn’t save.");
    } finally {
      setSaving(false);
    }
  }, [authFetch, page]);

  useEffect(() => {
    if (!page || !ready.current) return;
    const t = window.setTimeout(() => void save(), 700);
    return () => window.clearTimeout(t);
  }, [blocks, title, storedgeUrl, page, save]);

  function edit(nextBlocks: Block[], nextTitle = title) {
    setPast((p) => [...p, { blocks, title }].slice(-40));
    setFuture([]);
    setBlocks(nextBlocks);
    setTitle(nextTitle);
  }

  function undo() {
    setPast((p) => {
      const prev = p[p.length - 1];
      if (!prev) return p;
      setFuture((f) => [{ blocks, title }, ...f]);
      setBlocks(prev.blocks);
      setTitle(prev.title);
      return p.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      const next = f[0];
      if (!next) return f;
      setPast((p) => [...p, { blocks, title }]);
      setBlocks(next.blocks);
      setTitle(next.title);
      return f.slice(1);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function attach(row: PageRow) {
    if (!nodeId || !graph) return;
    const next: FunnelGraph = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, slug: row.slug, params: { ...n.params, page: row.id } } : n)),
    };
    setGraph(next);
    try {
      sessionStorage.setItem(`${LOCAL}:${funnelId}`, JSON.stringify(next));
    } catch {
      /* the server copy still updates */
    }
    await authFetch("/api/funnels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: funnelId, graph: next }),
    }).catch(() => undefined);
  }

  async function create(draftTitle: string, draftBlocks: Block[], url: string | null) {
    const taken = pages.map((p) => p.slug);
    const slug = slugFor(draftTitle, taken);
    const res = await authFetch("/api/landing-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: client.facilityId,
        title: draftTitle,
        slug,
        status: "draft",
        funnelId,
        theme: { editor: "blocks" },
        storedgeWidgetUrl: url,
        sections: blocksToSections(draftBlocks),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { page?: PageRow; error?: string };
    if (!res.ok || !body.page) {
      setNotice(body.error || "The page wasn’t created.");
      return;
    }
    const row = { ...body.page, sections: body.page.sections ?? blocksToSections(draftBlocks).map((s, i) => ({ id: `new-${i}`, ...s })) };
    setPages((p) => [row, ...p]);
    openPage(row);
    await attach(row);
    router.replace(`/portal/campaigns/${funnelId}/page?page=${row.id}${nodeId ? `&node=${nodeId}` : ""}`);
  }

  async function publish() {
    if (!page) return;
    setPublishing(true);
    try {
      await save();
      const res = await authFetch("/api/landing-pages/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: page.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { href?: string; error?: string; version?: number };
      if (!res.ok) {
        setNotice(body.error || "The page didn’t publish.");
        return;
      }
      setPage({ ...page, status: "published", published_snapshot: { editor: "blocks" } });
      setNotice(sample ? `Sample page is up in this tab${body.version ? `, version ${body.version}` : ""}.` : `Published${body.version ? `, version ${body.version}` : ""}.`);
    } finally {
      setPublishing(false);
    }
  }

  const back = `/portal/campaigns/${funnelId}`;

  if (loading) {
    return <div className="p-4 text-[14px] font-semibold text-[var(--ic-secondary)]">Opening the page…</div>;
  }

  if (!page) {
    return (
      <CreatePage
        back={back}
        pages={pages.filter((p) => !p.funnel_id || p.funnel_id === funnelId || p.facility_id === client.facilityId)}
        facts={facts}
        sample={sample}
        onCreate={create}
        onPick={async (row) => {
          const detailRes = await authFetch(`/api/landing-pages?id=${encodeURIComponent(row.id)}`);
          const detail = detailRes.ok ? ((await detailRes.json()) as { page?: PageRow }).page : row;
          if (!detail) return;
          openPage(detail);
          await attach(detail);
          router.replace(`/portal/campaigns/${funnelId}/page?page=${detail.id}${nodeId ? `&node=${nodeId}` : ""}`);
        }}
      />
    );
  }

  const hero = findBlock(blocks, "hero");
  const published = page.status === "published" && !!page.published_snapshot;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ic-ground)] text-[var(--ic-ink)]">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2">
        <Link href={back} className="text-[13px] font-extrabold underline underline-offset-4">
          Campaign
        </Link>
        <input
          aria-label="Page title"
          value={title}
          onChange={(e) => edit(blocks, e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[16px] font-extrabold outline-none"
        />
        {sample && <span className="ic-label border border-[var(--ic-instruction)] px-1 text-[9px]">Sample</span>}
        <span className="text-[12px] font-semibold text-[var(--ic-secondary)]">
          {saving ? "Saving…" : savedAt ? "Draft saved" : page.status === "published" ? "Live" : "Draft"}
        </span>
        <button type="button" onClick={undo} disabled={!past.length} className="px-2 text-[13px] font-extrabold underline underline-offset-4 disabled:no-underline disabled:opacity-40">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!future.length} className="px-2 text-[13px] font-extrabold underline underline-offset-4 disabled:no-underline disabled:opacity-40">
          Redo
        </button>
        <button type="button" data-fill="6" className="act-fill h-9 px-3 text-[13px] font-extrabold" onClick={() => void publish()} disabled={publishing}>
          {publishing ? "Publishing…" : "Publish page"}
        </button>
        {published && (
          <a
            href={sample ? `/lp/${page.slug}?demo` : `/lp/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            data-fill="4"
            className="act-fill inline-flex h-9 items-center px-3 text-[13px] font-extrabold"
          >
            Open live page
          </a>
        )}
      </header>

      {insight && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--ic-ink)] bg-[var(--ic-soft)] px-3 py-2">
          <p className="min-w-0 flex-1 text-[14px] font-extrabold leading-snug">
            {insight.line} <span className="font-semibold text-[var(--ic-secondary)]">{insight.why}</span>
          </p>
          <button
            type="button"
            data-fill="2"
            className="act-fill h-9 shrink-0 px-3 text-[13px] font-extrabold"
            onClick={() => {
              const next = applyFix(blocks, insight.fix);
              const headline = textOf(findBlock(next, "hero"), "headline");
              edit(next, insight.fix.kind === "set-headline" ? headline || title : title);
            }}
          >
            {insight.fixLabel}
          </button>
        </div>
      )}
      {notice && <div className="shrink-0 border-b border-[var(--ic-ink)] px-3 py-1.5 text-[13px] font-semibold">{notice}</div>}

      <div className="flex shrink-0 border-b border-[var(--ic-ink)] md:hidden">
        <button type="button" onClick={() => setPane("edit")} className={`flex-1 py-2 text-[13px] font-extrabold ${pane === "edit" ? "bg-[var(--ic-ink)] text-[var(--ic-pane)]" : ""}`}>
          Blocks
        </button>
        <button type="button" onClick={() => setPane("preview")} className={`flex-1 py-2 text-[13px] font-extrabold ${pane === "preview" ? "bg-[var(--ic-ink)] text-[var(--ic-pane)]" : ""}`}>
          Preview
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className={`${pane === "edit" ? "flex" : "hidden"} min-h-0 w-full max-md:w-full flex-col overflow-y-auto border-[var(--ic-ink)] md:flex md:w-[380px] md:max-w-[380px] md:shrink-0 md:basis-[380px] md:border-r`}>
          <ol className="flex flex-col gap-2 p-3">
            {blocks.map((block, index) => (
              <li
                key={block.id}
                draggable
                onDragStart={() => {
                  dragFrom.current = index;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  if (from == null) return;
                  edit(moveBlock(blocks, from, index));
                }}
                className="border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-2"
              >
                <div className="flex items-center gap-1">
                  <span className="cursor-grab px-1 text-[12px] font-extrabold" aria-hidden title="Drag to reorder">
                    ::
                  </span>
                  <span className="ic-label flex-1 text-[10px] text-[var(--ic-instruction)]">
                    {block.type === "custom" ? "Kept" : BLOCK_LABEL[block.type]}
                  </span>
                  <button type="button" aria-label="Move up" className="px-1 text-[14px] font-extrabold" onClick={() => edit(moveBlock(blocks, index, index - 1))}>
                    ↑
                  </button>
                  <button type="button" aria-label="Move down" className="px-1 text-[14px] font-extrabold" onClick={() => edit(moveBlock(blocks, index, index + 1))}>
                    ↓
                  </button>
                  <button type="button" className="px-1 text-[12px] font-extrabold underline underline-offset-4" onClick={() => edit(removeBlock(blocks, block.id))}>
                    Remove
                  </button>
                </div>
                <BlockFields
                  block={block}
                  units={liveUnits}
                  storedgeUrl={storedgeUrl}
                  onStoredge={setStoredgeUrl}
                  onChange={(patch) => edit(updateBlock(blocks, block.id, patch))}
                  onTitle={hero?.id === block.id ? (headline) => edit(updateBlock(blocks, block.id, { headline }), headline) : undefined}
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-1.5 px-3 pb-4">
            {BLOCK_TYPES.filter((type) => !blocks.some((b) => b.type === type)).map((type, i) => (
              <button
                key={type}
                type="button"
                data-fill={String((i % 6) + 1)}
                className="act-fill h-8 px-2 text-[12px] font-extrabold"
                onClick={() => edit([...blocks, makeBlock(type, type === "hero" ? { facilityName: client.facilityName, headline: title } : {})])}
              >
                Add {BLOCK_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
        <div className={`${pane === "preview" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-1.5">
            <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Preview</span>
            <button type="button" onClick={() => setFrame("phone")} className={`px-2 py-1 text-[12px] font-extrabold ${frame === "phone" ? "bg-[var(--ic-ink)] text-[var(--ic-pane)]" : ""}`}>
              Phone
            </button>
            <button type="button" onClick={() => setFrame("desktop")} className={`px-2 py-1 text-[12px] font-extrabold ${frame === "desktop" ? "bg-[var(--ic-ink)] text-[var(--ic-pane)]" : ""}`}>
              Desktop
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-[var(--ic-soft)] p-3">
            <div className={frame === "phone" ? "mx-auto w-full max-w-[390px] border border-[var(--ic-ink)] bg-white shadow-[4px_4px_0_var(--ic-ink)]" : "min-h-full border border-[var(--ic-ink)] bg-white"}>
              <BlockPage
                title={title}
                blocks={blocks}
                units={liveUnits}
                facilityName={client.facilityName}
                storedgeUrl={storedgeUrl || null}
                facilityId={client.facilityId}
                pageId={page.id}
                sample={sample}
                onText={(id, key, value) => {
                  if (key === "headline" && hero?.id === id) edit(updateBlock(blocks, id, { headline: value }), value);
                  else edit(updateBlock(blocks, id, { [key]: value }));
                }}
                onFaq={(id, index, key, value) => {
                  const block = blocks.find((b) => b.id === id);
                  const items = Array.isArray(block?.config.items) ? [...(block.config.items as { q?: string; a?: string }[])] : [];
                  items[index] = { ...items[index], [key]: value };
                  edit(updateBlock(blocks, id, { items }));
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  units,
  storedgeUrl,
  onStoredge,
  onChange,
  onTitle,
}: {
  block: Block;
  units: LiveUnit[];
  storedgeUrl: string;
  onStoredge: (url: string) => void;
  onChange: (patch: Record<string, unknown>) => void;
  onTitle?: (headline: string) => void;
}) {
  const field = "mt-1 w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 py-1.5 text-[14px] font-semibold";
  if (block.type === "hero") {
    return (
      <div className="mt-2 grid gap-2">
        <label className="text-[12px] font-extrabold">
          Headline
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "headline")} onChange={(e) => (onTitle ? onTitle(e.target.value) : onChange({ headline: e.target.value }))} />
        </label>
        <label className="text-[12px] font-extrabold">
          Subhead
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "subheadline")} onChange={(e) => onChange({ subheadline: e.target.value })} />
        </label>
        <label className="text-[12px] font-extrabold">
          Photo URL
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "backgroundImage")} placeholder="A photo of the facility" onChange={(e) => onChange({ backgroundImage: e.target.value })} />
        </label>
      </div>
    );
  }
  if (block.type === "units") {
    const keys = Array.isArray(block.config.sizeKeys) ? (block.config.sizeKeys as string[]) : [];
    const fold = (value: string) => value.toLowerCase().replace(/×/g, "x").replace(/\s+/g, "");
    return (
      <fieldset className="mt-2">
        <legend className="text-[12px] font-extrabold">Sizes on the page. Rates come from the facility.</legend>
        <div className="mt-1 text-[12px] font-semibold text-[var(--ic-secondary)]">{keys.length === 0 ? "Every size with a rate." : `${keys.length} selected.`}</div>
        {units.map((u) => (
          <label key={u.key} className="mt-1 flex items-center gap-2 text-[13px] font-semibold">
            <input
              type="checkbox"
              checked={keys.length === 0 || keys.some((k) => fold(k) === fold(u.name))}
              onChange={(e) => {
                const base = keys.length ? keys : units.map((x) => x.name);
                const next = e.target.checked ? [...new Set([...base, u.name])] : base.filter((k) => fold(k) !== fold(u.name));
                onChange({ live: true, sizeKeys: next.length === units.length ? [] : next });
              }}
            />
            {u.name}
            {u.rate != null ? ` · $${u.rate}/mo` : ""}
            {u.vacant ? ` · ${u.vacant} open` : ""}
          </label>
        ))}
      </fieldset>
    );
  }
  if (block.type === "offer") {
    return (
      <div className="mt-2 grid gap-2">
        <label className="text-[12px] font-extrabold">
          Special
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "name")} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label className="text-[12px] font-extrabold">
          Detail
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "detail")} onChange={(e) => onChange({ detail: e.target.value })} />
        </label>
      </div>
    );
  }
  if (block.type === "reserve") {
    return (
      <label className="mt-2 block text-[12px] font-extrabold">
        storEDGE link
        <input className={field} style={{ fontSize: 16 }} value={storedgeUrl} placeholder="https://" onChange={(e) => onStoredge(e.target.value)} />
      </label>
    );
  }
  if (block.type === "location") {
    return (
      <div className="mt-2 grid gap-2">
        <label className="text-[12px] font-extrabold">
          Address
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "address")} onChange={(e) => onChange({ address: e.target.value })} />
        </label>
        <label className="text-[12px] font-extrabold">
          Hours
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "hours")} onChange={(e) => onChange({ hours: e.target.value })} />
        </label>
        <label className="text-[12px] font-extrabold">
          Phone
          <input className={field} style={{ fontSize: 16 }} value={textOf(block, "phone")} onChange={(e) => onChange({ phone: e.target.value })} />
        </label>
      </div>
    );
  }
  if (block.type === "faq") {
    const items = Array.isArray(block.config.items) ? (block.config.items as { q?: string; a?: string }[]) : [];
    return (
      <div className="mt-2 grid gap-2">
        {items.map((item, i) => (
          <div key={i} className="grid gap-1">
            <input className={field} style={{ fontSize: 16 }} value={item.q ?? ""} aria-label="Question" onChange={(e) => {
              const next = items.slice();
              next[i] = { ...item, q: e.target.value };
              onChange({ items: next });
            }} />
            <input className={field} style={{ fontSize: 16 }} value={item.a ?? ""} aria-label="Answer" onChange={(e) => {
              const next = items.slice();
              next[i] = { ...item, a: e.target.value };
              onChange({ items: next });
            }} />
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "ask" || block.type === "access" || block.type === "photos" || block.type === "custom") {
    return <p className="mt-1 text-[12px] font-semibold text-[var(--ic-secondary)]">{block.type === "photos" ? "Uses the facility’s photos." : block.type === "ask" ? "Name, phone, email. Lands on this page." : "Shown on the page as written."}</p>;
  }
  return null;
}

function CreatePage({
  back,
  pages,
  facts,
  sample,
  onCreate,
  onPick,
}: {
  back: string;
  pages: PageRow[];
  facts: PageFacts;
  sample: boolean;
  onCreate: (title: string, blocks: Block[], url: string | null) => Promise<void>;
  onPick: (row: PageRow) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function go(key: string, run: () => { title: string; blocks: Block[]; storedgeUrl: string | null }) {
    setBusy(key);
    const draft = run();
    await onCreate(draft.title, draft.blocks, draft.storedgeUrl);
    setBusy(null);
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--ic-ground)] px-4 py-4 text-[var(--ic-ink)]">
      <Link href={back} className="text-[13px] font-extrabold underline underline-offset-4">
        Campaign
      </Link>
      <h1 className="mt-2 text-[26px] font-extrabold tracking-tight">Start a page</h1>
      <p className="mt-1 max-w-lg text-[14px] font-semibold text-[var(--ic-secondary)]">
        Built from this facility’s sizes, rates and the ad. {sample ? "Sample. Nothing is published for real." : "It stays a draft until you publish it."}
      </p>
      <button
        type="button"
        data-fill="6"
        disabled={!!busy}
        className="act-fill mt-4 block w-full max-w-lg px-3 py-3 text-left"
        onClick={() => void go("campaign", () => draftFromCampaign(facts))}
      >
        <span className="block text-[16px] font-extrabold">{busy === "campaign" ? "Building…" : "From this campaign"}</span>
        <span className="mt-0.5 block text-[13px] font-semibold">The goal’s sizes, the offer, and the ad’s line.</span>
      </button>
      <div className="ic-label mt-6 text-[10px] text-[var(--ic-instruction)]">Templates</div>
      <div className="mt-2 grid max-w-lg gap-2">
        {TEMPLATE_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            data-fill={String((i % 6) + 1)}
            disabled={!!busy}
            className="act-fill px-3 py-3 text-left"
            onClick={() => void go(key, () => draftFromTemplate(key, facts))}
          >
            <span className="block text-[15px] font-extrabold">{TEMPLATE_META[key].label}</span>
            <span className="mt-0.5 block text-[13px] font-semibold">{TEMPLATE_META[key].line}</span>
          </button>
        ))}
      </div>
      {pages.length > 0 && (
        <>
          <div className="ic-label mt-6 text-[10px] text-[var(--ic-instruction)]">This facility’s pages</div>
          <ul className="mt-2 max-w-lg border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
            {pages.map((p) => (
              <li key={p.id} className="border-b border-[var(--ic-dither)]/40 last:border-b-0">
                <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[var(--ic-soft)]" onClick={() => void onPick(p)}>
                  <span className="block text-[14px] font-extrabold">{p.title}</span>
                  <span className="text-[12px] font-semibold text-[var(--ic-secondary)]">/lp/{p.slug} · {p.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
