"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { adminFetch } from "@/hooks/use-admin-fetch";
import { ADVERTISER_SCALES, AD_FORMATS, ANGLES, AUDIENCES, OFFER_TYPES, UNIT_TYPES } from "@/lib/proven-ads/types";
import type { LibraryPatterns } from "@/lib/proven-ads/patterns";
import { AdCard } from "./ad-card";
import { AdSheet } from "./ad-sheet";
import { PatternsPanel } from "./patterns-panel";
import { FONT, KIND, type Kind, type LibraryResponse, type ProvenAd } from "./shared";

const PAGE = 24;

type FilterKey = "offer_type" | "unit_type" | "angle" | "audience" | "format" | "scale" | "state";
type Filters = Partial<Record<FilterKey, string>> & { q?: string; sort?: string };

const FILTERS: { key: FilterKey; kind?: Kind; label: string; values: readonly string[] }[] = [
  { key: "offer_type", kind: "offer", label: "Offer", values: OFFER_TYPES },
  { key: "unit_type", kind: "unit", label: "Unit", values: UNIT_TYPES },
  { key: "angle", kind: "angle", label: "Leads with", values: ANGLES },
  { key: "audience", kind: "audience", label: "Aimed at", values: AUDIENCES },
  { key: "format", kind: "format", label: "Format", values: AD_FORMATS.filter((f) => f !== "unknown") },
  { key: "scale", kind: "scale", label: "Advertiser", values: ADVERTISER_SCALES },
  { key: "state", label: "State", values: [] },
];

const SORTS: [string, string][] = [
  ["study", "Most to learn from"],
  ["longest", "Longest running"],
  ["reach", "Most live versions"],
  ["recent", "Newly proven"],
];

function query(filters: Filters, offset: number, withPatterns: boolean): string {
  const p = new URLSearchParams({ proven: "1", limit: String(PAGE), offset: String(offset) });
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  if (withPatterns) p.set("patterns", "1");
  return `/api/proven-ads?${p.toString()}`;
}

function optionLabel(f: (typeof FILTERS)[number], v: string): string {
  if (!f.kind) return v;
  return KIND[f.kind].labels[v] ?? v;
}

function SelectBox({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none truncate rounded-[4px] border border-[var(--border-subtle)] bg-transparent py-1 pl-3 pr-8 text-[13px] text-[var(--color-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-dark)]"
        style={{ fontWeight: value ? 750 : 600, fontFamily: FONT }}
      >
        {options.map(([v, l]) => (
          <option key={v + l} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-body-text)]"
      />
    </label>
  );
}

export interface ProvenAdsLibraryProps {
  mode: "owner" | "admin";
  /** Owner mode: the facility the owner is working on. */
  facility?: { id: string; name: string; state?: string | null };
  /** Owner mode: open the Ad Generator on the new draft. */
  onOpenDraft?: (variationId: string) => void;
  /** Admin mode: facilities the action can target. */
  facilities?: { id: string; name: string; location?: string | null }[];
  /** Admin mode: the facility picked when the sheet opens. */
  defaultTargetId?: string;
  /** Admin mode: tools rendered under the header. */
  adminSlot?: ReactNode;
  /** Bump to reload (after an import, say). */
  reloadKey?: number;
  /** Called with the facility a draft was made for. */
  onDraftCreated?: (facilityId: string) => void;
}

type Draft = { state: "idle" } | { state: "working" } | { state: "done"; variationId: string; studioUrl: string; via: string } | { state: "error"; message: string };

export function ProvenAdsLibrary({
  mode,
  facility,
  onOpenDraft,
  facilities = [],
  defaultTargetId,
  adminSlot,
  reloadKey = 0,
  onDraftCreated,
}: ProvenAdsLibraryProps) {
  const [filters, setFilters] = useState<Filters>({ sort: "study" });
  const [qInput, setQInput] = useState("");
  const [ads, setAds] = useState<ProvenAd[]>([]);
  const [total, setTotal] = useState(0);
  const [patterns, setPatterns] = useState<LibraryPatterns | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ProvenAd | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<Draft>({ state: "idle" });
  const [target, setTarget] = useState<string>(facility?.id ?? defaultTargetId ?? "");
  const firstLoad = useRef(true);
  const requestId = useRef(0);

  // Debounce typing into the search box.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: qInput.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      const withPatterns = firstLoad.current;
      if (offset === 0) setLoading(true);
      else setMore(true);
      setError(null);
      try {
        const data = await adminFetch<LibraryResponse>(query(filters, offset, withPatterns));
        if (id !== requestId.current) return;
        setAds((prev) => (offset === 0 ? data.ads : [...prev, ...data.ads]));
        setTotal(data.total);
        if (data.patterns) {
          setPatterns(data.patterns);
          setStates(data.states);
          firstLoad.current = false;
        }
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error && err.message.length < 200 ? err.message : "Couldn't load the library. Refresh to try again.");
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [filters]
  );

  const lastReload = useRef(reloadKey);
  useEffect(() => {
    if (reloadKey !== lastReload.current) {
      lastReload.current = reloadKey;
      firstLoad.current = true;
    }
    load(0);
  }, [load, reloadKey]);

  const setFilter = useCallback((key: FilterKey, value: string) => {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value || undefined }));
  }, []);

  const activeFilters = useMemo(
    () =>
      FILTERS.filter((f) => filters[f.key]).map((f) => ({
        key: f.key,
        text: `${f.label}: ${optionLabel(f, filters[f.key] as string)}`,
      })),
    [filters]
  );

  const openAd = useCallback((ad: ProvenAd) => {
    setDraft({ state: "idle" });
    setOpen(ad);
  }, []);

  const makeDraft = useCallback(async () => {
    if (!open) return;
    const facilityId = mode === "owner" ? facility?.id : target;
    if (!facilityId) {
      setDraft({ state: "error", message: "Pick a facility first." });
      return;
    }
    setDraft({ state: "working" });
    try {
      const data = await adminFetch<{ variationId: string; studioUrl: string; via: string }>(
        `/api/proven-ads/${open.id}/duplicate`,
        { method: "POST", body: JSON.stringify({ facilityId }) }
      );
      setDraft({ state: "done", ...data });
      onDraftCreated?.(facilityId);
    } catch (err) {
      setDraft({ state: "error", message: err instanceof Error && err.message.length < 160 ? err.message : "That didn't work. Try again." });
    }
  }, [open, mode, facility?.id, target, onDraftCreated]);

  const nearState = mode === "owner" && facility?.state && states.includes(facility.state) ? facility.state : null;

  const footer = open ? (
    <div className="space-y-2.5">
      {draft.state === "done" ? (
        <>
          <div className="flex items-center gap-2 text-[14px]" style={{ color: "var(--color-dark)", fontWeight: 750 }}>
            <Check size={16} aria-hidden /> Your version is ready as a draft.
          </div>
          {mode === "owner" && onOpenDraft ? (
            <button
              type="button"
              onClick={() => onOpenDraft(draft.variationId)}
              className="flex h-11 w-full items-center justify-center rounded-[4px] text-[14px] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dark)]"
              style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
            >
              Open it in the Ad Generator
            </button>
          ) : (
            <a
              href={draft.studioUrl}
              className="flex h-11 w-full items-center justify-center rounded-[4px] text-[14px] transition-opacity hover:opacity-90"
              style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
            >
              Open it in Ad Studio
            </a>
          )}
          <p className="text-[12px] leading-[1.5]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
            {draft.via === "claude"
              ? "New copy, written for your facility. Add your own photo before it runs."
              : "A starting draft from your facility's details. Edit the copy and add your own photo before it runs."}
          </p>
        </>
      ) : (
        <>
          {mode === "admin" && (
            <SelectBox
              label="Facility"
              value={target}
              onChange={setTarget}
              options={[["", "Pick a facility"], ...facilities.map((f) => [f.id, f.location ? `${f.name} · ${f.location}` : f.name] as [string, string])]}
            />
          )}
          <button
            type="button"
            onClick={makeDraft}
            disabled={draft.state === "working" || (mode === "admin" && !target)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[4px] text-[14px] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dark)]"
            style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
          >
            {draft.state === "working" && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {draft.state === "working"
              ? "Writing your version"
              : mode === "owner"
                ? `Make my version for ${facility?.name ?? "my facility"}`
                : "Make a version for this facility"}
          </button>
          {draft.state === "error" ? (
            <p role="alert" className="text-[13px]" style={{ color: "var(--accent-dim)", fontWeight: 700 }}>
              {draft.message}
            </p>
          ) : (
            <p className="text-[12px] leading-[1.5]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
              Keeps the angle, the offer and the format. Writes new copy from your rates, specials and reviews. Their name, words
              and photos stay behind.
            </p>
          )}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[1120px] pb-16" style={{ fontFamily: FONT }}>
      <header className="mb-6 sm:mb-8">
        <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--color-body-text)", fontWeight: 800 }}>
          Proven ads
        </div>
        <h1
          className="mt-2 text-[26px] leading-[1.15] sm:text-[32px]"
          style={{ color: "var(--color-dark)", fontWeight: 800, letterSpacing: "-0.025em" }}
        >
          The storage ads nobody turned off.
        </h1>
        <p className="mt-3 max-w-[640px] text-[15px] leading-[1.55]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
          Every ad here has run on Facebook and Instagram for at least 60 days. Nobody pays for two months of an ad that
          isn&apos;t renting units. Find one that fits your facility, see why it works, and make your own version.
        </p>
      </header>

      {adminSlot}

      {patterns && patterns.total > 0 && (
        <div className="mb-6">
          <PatternsPanel
            patterns={patterns}
            active={{
              offer_type: filters.offer_type,
              angle: filters.angle,
              unit_type: filters.unit_type,
              format: filters.format,
            }}
            onPick={(field, value) => setFilter(field, value)}
          />
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search ads</span>
            <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body-text)]" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search advertiser, words in the ad, city"
              className="h-10 w-full rounded-[4px] border border-[var(--border-subtle)] bg-transparent pl-9 pr-3 text-[14px] text-[var(--color-dark)] placeholder:text-[var(--color-body-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-dark)]"
              style={{ fontWeight: 600, fontFamily: FONT }}
            />
          </label>
          <div className="flex gap-2">
            {nearState && (
              <button
                type="button"
                aria-pressed={filters.state === nearState}
                onClick={() => setFilter("state", nearState)}
                className="h-10 shrink-0 rounded-[4px] px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-dark)]"
                style={{
                  background: filters.state === nearState ? "var(--color-dark)" : "color-mix(in srgb, var(--hue-a) 12%, transparent)",
                  color: filters.state === nearState ? "var(--color-light)" : "color-mix(in srgb, var(--hue-a) 80%, var(--color-dark))",
                  fontWeight: 750,
                }}
              >
                In {nearState}
              </button>
            )}
            <div className="min-w-0 flex-1 sm:w-[190px] sm:flex-none">
              <SelectBox
                label="Sort"
                value={filters.sort ?? "study"}
                onChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
                options={SORTS}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((s) => !s)}
              aria-expanded={showFilters}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-dark)] sm:hidden"
              style={{ background: "color-mix(in srgb, var(--hue-d) 12%, transparent)", color: "color-mix(in srgb, var(--hue-d) 80%, var(--color-dark))", fontWeight: 750 }}
            >
              <SlidersHorizontal size={14} aria-hidden />
              <span className="hidden min-[400px]:inline">Filters</span>
              {activeFilters.length ? <span>{` ${activeFilters.length}`}</span> : null}
              <span className="sr-only min-[400px]:hidden">Filters</span>
            </button>
          </div>
        </div>

        <div className={`${showFilters ? "grid" : "hidden"} grid-cols-2 gap-2 sm:grid sm:grid-cols-4 lg:grid-cols-7`}>
          {FILTERS.map((f) => {
            const values = f.key === "state" ? states : f.values;
            if (f.key === "state" && values.length === 0) return null;
            return (
              <SelectBox
                key={f.key}
                label={f.label}
                value={filters[f.key] ?? ""}
                onChange={(v) => setFilters((cur) => ({ ...cur, [f.key]: v || undefined }))}
                options={[["", `${f.label}: any`], ...values.map((v) => [v, optionLabel(f, v)] as [string, string])]}
              />
            );
          })}
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilters.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setFilters((f) => ({ ...f, [a.key]: undefined }))}
                className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-dark)]"
                style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 700 }}
                aria-label={`Remove ${a.text}`}
              >
                {a.text} <X size={12} aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setQInput("");
                setFilters((f) => ({ sort: f.sort }));
              }}
              className="px-2 py-1 text-[12px] underline-offset-2 hover:underline"
              style={{ color: "var(--color-dark)", fontWeight: 700 }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-[14px]" style={{ color: "var(--color-dark)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {loading ? "Loading" : `${total.toLocaleString("en-US")} ad${total === 1 ? "" : "s"}`}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-[14px]" style={{ color: "var(--accent-dim)", fontWeight: 700 }}>
          {error}
        </p>
      )}

      {loading && ads.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-[var(--color-body-text)]" size={22} aria-label="Loading" />
        </div>
      ) : ads.length === 0 ? (
        <div className="rounded-[4px] border border-[var(--border-subtle)] px-6 py-14 text-center">
          <div className="text-[16px]" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
            {activeFilters.length || filters.q ? "Nothing matches those filters." : "The library is empty."}
          </div>
          <p className="mx-auto mt-2 max-w-[420px] text-[14px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
            {activeFilters.length || filters.q
              ? "Loosen a filter or clear them all."
              : mode === "admin"
                ? "Import an Ad Library export or add an ad by hand."
                : "Check back soon. We add ads as they pass two months."}
          </p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${loading ? "opacity-60" : ""} transition-opacity`}>
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onOpen={openAd} />
            ))}
          </div>
          {ads.length < total && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => load(ads.length)}
                disabled={more}
                className="flex h-11 items-center gap-2 rounded-[4px] px-6 text-[14px] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dark)]"
                style={{ background: "color-mix(in srgb, var(--hue-c) 14%, transparent)", color: "color-mix(in srgb, var(--hue-c) 80%, var(--color-dark))", fontWeight: 800 }}
              >
                {more && <Loader2 size={15} className="animate-spin" aria-hidden />}
                Show {Math.min(PAGE, total - ads.length)} more
              </button>
            </div>
          )}
        </>
      )}

      {open && <AdSheet ad={open} onClose={() => setOpen(null)} footer={footer} />}
    </div>
  );
}
