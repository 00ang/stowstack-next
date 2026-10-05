"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useAdmin } from "@/lib/admin-context";
import { useFacility } from "@/lib/facility-context";
import { adminFetch } from "@/hooks/use-admin-fetch";
import {
  ANGLE_LABELS,
  FORMAT_LABELS,
  OFFER_LABELS,
  PLATFORM_LABELS,
  UNIT_LABELS,
  type AdFormat,
  type Angle,
  type OfferType,
  type ProvenPlatform,
  type UnitType,
} from "@/lib/proven-ads/types";

interface SourceInfo {
  id: string;
  coverage: string;
  automated: boolean;
  configured: boolean;
}

interface ProvenAd {
  id: string;
  source: string;
  platform: string;
  advertiser_name: string;
  format: string;
  headline: string | null;
  primary_text: string | null;
  description: string | null;
  cta: string | null;
  landing_url: string | null;
  snapshot_url: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  offer_type: string | null;
  unit_type: string | null;
  angle: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  active: boolean;
  notes: string | null;
  days_running: number;
  proven: boolean;
  why_flagged: string;
}

interface SearchRow {
  id: string;
  adapter: string;
  label: string;
  config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  last_result: { fetched?: number; upserted?: number; note?: string | null } | null;
}

type Filters = {
  platform: string;
  state: string;
  format: string;
  offer_type: string;
  unit_type: string;
  proven: string;
  q: string;
};

const EMPTY_FILTERS: Filters = {
  platform: "",
  state: "",
  format: "",
  offer_type: "",
  unit_type: "",
  proven: "1",
  q: "",
};

const FONT = "var(--font), var(--font-manrope), system-ui, sans-serif";

function labelOf(map: Record<string, string>, key: string | null): string {
  if (!key) return "—";
  return map[key] ?? key;
}

export default function ProvenAdsPage() {
  const { adminKey } = useAdmin();
  const { facilities, current, currentId, setFacility } = useFacility();
  const [ads, setAds] = useState<ProvenAd[]>([]);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSearches, setShowSearches] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [dupResult, setDupResult] = useState<{ url: string; via: string } | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAds = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    try {
      const data = await adminFetch<{ ads: ProvenAd[]; sources: SourceInfo[] }>(
        `/api/proven-ads?${params.toString()}`
      );
      setAds(data.ads || []);
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [adminKey, filters]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const loadSearches = useCallback(async () => {
    try {
      const data = await adminFetch<{ searches: SearchRow[] }>("/api/proven-ads/searches");
      setSearches(data.searches || []);
    } catch {
      /* searches are admin-only extras */
    }
  }, []);

  useEffect(() => {
    if (showSearches) loadSearches();
  }, [showSearches, loadSearches]);

  const states = useMemo(() => {
    const set = new Set<string>();
    ads.forEach((a) => {
      if (a.state) set.add(a.state);
    });
    return Array.from(set).sort();
  }, [ads]);

  async function refreshNow() {
    setRefreshNote(null);
    try {
      const data = await adminFetch<{ note: string; queued: boolean }>("/api/proven-ads/refresh", {
        method: "POST",
        body: "{}",
      });
      setRefreshNote(data.note);
    } catch (err) {
      setRefreshNote(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  async function duplicate(adId: string, facilityId: string) {
    setDuplicating(true);
    setError(null);
    try {
      const data = await adminFetch<{ studioUrl: string; via: string }>(
        `/api/proven-ads/${adId}/duplicate`,
        { method: "POST", body: JSON.stringify({ facilityId }) }
      );
      if (currentId !== facilityId) setFacility(facilityId);
      setDupResult({ url: data.studioUrl, via: data.via });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setDuplicating(false);
    }
  }

  async function addManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v.trim()) body[k] = v.trim();
    });
    try {
      await adminFetch("/api/proven-ads", { method: "POST", body: JSON.stringify(body) });
      setShowAdd(false);
      await loadAds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(file: File) {
    setSaving(true);
    setError(null);
    const csv = await file.text();
    try {
      await adminFetch("/api/proven-ads/import", { method: "POST", body: JSON.stringify({ csv }) });
      setShowImport(false);
      await loadAds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  const pickFacilityId =
    current !== "all" && currentId !== "all" ? currentId : facilities[0]?.id ?? null;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 pb-16" style={{ fontFamily: FONT }}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-dark)]">
            Proven Ads
          </h1>
          <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-[var(--color-body-text)]">
            Ads that have been running 60 days or more. Nobody pays for two months of a
            creative that is not bringing in move-ins — take the structure, rewrite it
            for your facility, generate your own image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => setShowAdd(true)} icon={Plus}>
            Add ad
          </GhostButton>
          <GhostButton onClick={() => setShowImport(true)} icon={Upload}>
            Import CSV
          </GhostButton>
          <GhostButton onClick={() => setShowSearches((s) => !s)} icon={Filter}>
            Searches
          </GhostButton>
          <GhostButton onClick={refreshNow} icon={RefreshCw}>
            Refresh now
          </GhostButton>
        </div>
      </header>

      {sources.length > 0 && (
        <div className="space-y-2 rounded-xl border border-[var(--color-light-gray)] bg-[var(--color-light)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-mid-gray)]">
            Sources
          </p>
          {sources.map((s) => (
            <p key={s.id} className="text-[12px] leading-relaxed text-[var(--color-body-text)]">
              <span className="font-semibold text-[var(--color-dark)]">{s.id}</span>
              {" — "}
              {s.coverage}
              {s.automated && !s.configured ? " Token not configured; this source is idle." : ""}
            </p>
          ))}
        </div>
      )}

      {refreshNote && (
        <p className="text-[12px] text-[var(--color-body-text)]">{refreshNote}</p>
      )}
      {error && (
        <p className="text-[13px] text-[var(--color-red)]">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-light)] px-3">
          <Search size={13} className="text-[var(--color-mid-gray)]" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Search advertiser, copy, city"
            className="w-[180px] bg-transparent text-[13px] text-[var(--color-dark)] outline-none"
          />
        </div>
        <Select
          value={filters.platform}
          onChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
          options={[["", "All platforms"], ...Object.entries(PLATFORM_LABELS)]}
        />
        <Select
          value={filters.state}
          onChange={(v) => setFilters((f) => ({ ...f, state: v }))}
          options={[["", "All regions"], ...states.map((s) => [s, s] as [string, string])]}
        />
        <Select
          value={filters.format}
          onChange={(v) => setFilters((f) => ({ ...f, format: v }))}
          options={[["", "All formats"], ...Object.entries(FORMAT_LABELS)]}
        />
        <Select
          value={filters.offer_type}
          onChange={(v) => setFilters((f) => ({ ...f, offer_type: v }))}
          options={[["", "All offers"], ...Object.entries(OFFER_LABELS)]}
        />
        <Select
          value={filters.unit_type}
          onChange={(v) => setFilters((f) => ({ ...f, unit_type: v }))}
          options={[["", "All unit types"], ...Object.entries(UNIT_LABELS)]}
        />
        <Select
          value={filters.proven}
          onChange={(v) => setFilters((f) => ({ ...f, proven: v }))}
          options={[
            ["1", "Proven (60+ days)"],
            ["", "Any duration"],
          ]}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-[var(--color-mid-gray)]" size={20} />
        </div>
      ) : ads.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-light-gray)] px-6 py-14 text-center">
          <ShieldCheck className="mx-auto mb-3 text-[var(--color-mid-gray)]" size={28} />
          <p className="text-[14px] font-semibold text-[var(--color-dark)]">No ads in the library yet</p>
          <p className="mx-auto mt-1 max-w-[420px] text-[13px] text-[var(--color-body-text)]">
            Add one from the public Meta Ad Library, import a CSV, or wait for the
            scheduled Meta API refresh if a token is configured.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ads.map((ad) => (
            <article
              key={ad.id}
              className="flex flex-col rounded-xl border border-[var(--color-light-gray)] bg-[var(--color-light)] p-4"
            >
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {ad.proven && (
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--color-dark)] text-[var(--color-light)]">
                    Proven
                  </span>
                )}
                <span className="rounded bg-[var(--color-light-gray)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-body-text)]">
                  {labelOf(PLATFORM_LABELS, ad.platform as ProvenPlatform)}
                </span>
                <span className="rounded bg-[var(--color-light-gray)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-body-text)]">
                  {labelOf(FORMAT_LABELS, ad.format as AdFormat)}
                </span>
                {ad.offer_type && (
                  <span className="rounded bg-[var(--color-light-gray)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-body-text)]">
                    {labelOf(OFFER_LABELS, ad.offer_type as OfferType)}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1 text-[11px] text-[var(--color-mid-gray)]">
                  <Clock size={11} />
                  {ad.days_running}d
                </span>
              </div>
              <p className="text-[14px] font-semibold text-[var(--color-dark)]">
                {ad.headline || ad.advertiser_name}
              </p>
              <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-[var(--color-body-text)]">
                {ad.primary_text || "No primary text captured — open the snapshot."}
              </p>
              <p className="mt-2 text-[11px] text-[var(--color-mid-gray)]">
                {ad.advertiser_name}
                {ad.city || ad.state || ad.country
                  ? ` · ${[ad.city, ad.state, ad.country].filter(Boolean).join(", ")}`
                  : ""}
                {ad.angle ? ` · ${labelOf(ANGLE_LABELS, ad.angle as Angle)}` : ""}
                {ad.unit_type ? ` · ${labelOf(UNIT_LABELS, ad.unit_type as UnitType)}` : ""}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-dark)]">
                {ad.why_flagged}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ad.snapshot_url && (
                  <a
                    href={ad.snapshot_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-dark)] underline-offset-2 hover:underline"
                  >
                    View at source <ExternalLink size={11} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDupResult(null);
                    setDuplicateId(ad.id);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-dark)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-light)]"
                >
                  <Copy size={12} /> Duplicate to my ads
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showSearches && (
        <section className="rounded-xl border border-[var(--color-light-gray)] p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--color-dark)]">
            Configured searches
          </h2>
          {searches.length === 0 ? (
            <p className="text-[12px] text-[var(--color-body-text)]">
              Default Meta EU/UK searches will seed on the first refresh.
            </p>
          ) : (
            <ul className="space-y-2">
              {searches.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 text-[12px]">
                  <div>
                    <p className="font-medium text-[var(--color-dark)]">
                      {s.label}{" "}
                      <span className="font-normal text-[var(--color-mid-gray)]">
                        ({s.adapter}{s.enabled ? "" : ", paused"})
                      </span>
                    </p>
                    {s.last_result?.note && (
                      <p className="text-[var(--color-body-text)]">{s.last_result.note}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminFetch(`/api/proven-ads/searches/${s.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ enabled: !s.enabled }),
                      });
                      loadSearches();
                    }}
                    className="text-[var(--color-dark)] underline-offset-2 hover:underline"
                  >
                    {s.enabled ? "Pause" : "Enable"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showAdd && (
        <Modal title="Add a proven ad" onClose={() => setShowAdd(false)}>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--color-body-text)]">
            Transcribe from the public Ad Library page. Store the snapshot URL as a
            reference — do not upload the other facility&apos;s photos.
          </p>
          <form onSubmit={addManual} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field name="advertiser_name" label="Advertiser" required />
            <Field name="started_at" label="Started (YYYY-MM-DD)" required />
            <Field name="headline" label="Headline" />
            <Field name="cta" label="CTA" />
            <Field name="primary_text" label="Primary text" className="sm:col-span-2" textarea />
            <Field name="snapshot_url" label="Ad Library / snapshot URL" className="sm:col-span-2" />
            <Field name="landing_url" label="Landing URL" className="sm:col-span-2" />
            <SelectField name="platform" label="Platform" options={Object.entries(PLATFORM_LABELS)} />
            <SelectField name="format" label="Format" options={Object.entries(FORMAT_LABELS)} />
            <Field name="city" label="City" />
            <Field name="state" label="State / region" />
            <Field name="country" label="Country (US, GB…)" />
            <SelectField name="offer_type" label="Offer" options={Object.entries(OFFER_LABELS)} />
            <SelectField name="unit_type" label="Unit type" options={Object.entries(UNIT_LABELS)} />
            <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
              <GhostButton onClick={() => setShowAdd(false)}>Cancel</GhostButton>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--color-dark)] px-4 py-2 text-[13px] font-medium text-[var(--color-light)]"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title="Import CSV" onClose={() => setShowImport(false)}>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--color-body-text)]">
            Header row required. Columns: advertiser_name, started_at, headline,
            primary_text, platform, format, city, state, country, offer_type,
            unit_type, snapshot_url, landing_url, cta, source_ad_id, active.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importCsv(f);
            }}
          />
        </Modal>
      )}

      {duplicateId && (
        <Modal title="Duplicate to my ads" onClose={() => setDuplicateId(null)}>
          {dupResult ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-[13px] text-[var(--color-dark)]">
                <Check size={14} /> Draft created ({dupResult.via}). Copy was rewritten
                for the selected facility — source photos were not reused.
              </p>
              <a
                href={dupResult.url}
                className="inline-flex rounded-lg bg-[var(--color-dark)] px-4 py-2 text-[13px] font-medium text-[var(--color-light)]"
              >
                Open in Ad Studio
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] leading-relaxed text-[var(--color-body-text)]">
                We keep the angle, offer and format, then rewrite the copy for this
                facility. Source name, logo and photos stay behind.
              </p>
              <ul className="max-h-[40vh] space-y-1 overflow-y-auto">
                {facilities.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      disabled={duplicating}
                      onClick={() => duplicate(duplicateId, f.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-[var(--color-light-gray)] px-3 py-2 text-left text-[13px] hover:bg-[var(--color-light-gray)]"
                    >
                      <span>
                        <span className="font-medium text-[var(--color-dark)]">{f.name}</span>
                        {f.location && (
                          <span className="block text-[11px] text-[var(--color-mid-gray)]">
                            {f.location}
                          </span>
                        )}
                      </span>
                      {duplicating && pickFacilityId === f.id && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-light)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-dark)]"
    >
      {Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][] | [string, string][];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-light)] py-1 pl-3 pr-7 text-[12px] text-[var(--color-dark)]"
      >
        {options.map(([v, label]) => (
          <option key={v + label} value={v}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-mid-gray)]"
      />
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-dark)]/40 p-3 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-xl border border-[var(--color-light-gray)] bg-[var(--color-light)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--color-dark)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} className="text-[var(--color-mid-gray)]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  textarea,
  className,
}: {
  name: string;
  label: string;
  required?: boolean;
  textarea?: boolean;
  className?: string;
}) {
  const cls =
    "w-full rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-light)] px-3 py-2 text-[13px] text-[var(--color-dark)]";
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-body-text)]">{label}</span>
      {textarea ? (
        <textarea name={name} required={required} rows={3} className={cls} />
      ) : (
        <input name={name} required={required} className={cls} />
      )}
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[var(--color-body-text)]">{label}</span>
      <select
        name={name}
        className="h-9 w-full rounded-lg border border-[var(--color-light-gray)] bg-[var(--color-light)] px-3 text-[13px] text-[var(--color-dark)]"
      >
        <option value="">—</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
