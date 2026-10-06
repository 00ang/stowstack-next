"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import { adminFetch } from "@/hooks/use-admin-fetch";
import { FORMAT_LABELS, OFFER_LABELS, PLATFORM_LABELS, UNIT_LABELS } from "@/lib/proven-ads/types";
import { FONT } from "./shared";

interface SourceInfo {
  id: string;
  coverage: string;
  automated: boolean;
  configured: boolean;
}

interface SearchRow {
  id: string;
  adapter: string;
  label: string;
  enabled: boolean;
  last_run_at: string | null;
  last_result: { fetched?: number; upserted?: number; note?: string | null } | null;
}

const fill = (hue: string) => ({
  background: `color-mix(in srgb, ${hue} 13%, transparent)`,
  color: `color-mix(in srgb, ${hue} 80%, var(--color-dark))`,
  fontWeight: 750,
});

function ToolButton({ onClick, icon: Icon, hue, children }: { onClick: () => void; icon: typeof Plus; hue: string; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-[4px] px-3 text-[13px] transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-dark)]"
      style={fill(hue)}
    >
      <Icon size={14} aria-hidden />
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--color-dark) 38%, transparent)" }} />
      <div
        className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[6px] border border-[var(--border-subtle)] p-5 sm:rounded-[4px]"
        style={{ background: "var(--color-light)", fontFamily: FONT }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px]" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-[4px] p-1.5 text-[var(--color-dark)] hover:bg-[var(--color-dark)]/[0.06]">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[13px] text-[var(--color-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-dark)]";

function Field({ name, label, required, textarea, wide }: { name: string; label: string; required?: boolean; textarea?: boolean; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 700 }}>
        {label}
      </span>
      {textarea ? (
        <textarea name={name} required={required} rows={3} className={inputCls} style={{ fontWeight: 550 }} />
      ) : (
        <input name={name} required={required} className={inputCls} style={{ fontWeight: 550 }} />
      )}
    </label>
  );
}

function Pick({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 700 }}>
        {label}
      </span>
      <select name={name} className={`${inputCls} h-9`} style={{ fontWeight: 600 }}>
        <option value="">Read it from the copy</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Pull an observation list out of whatever JSON shape the export used. */
function observationsOf(json: unknown): { observations: unknown[]; observed_at?: string } | null {
  if (Array.isArray(json)) return { observations: json };
  if (json && typeof json === "object") {
    const o = json as { ads?: unknown; observations?: unknown; savedAt?: unknown; observed_at?: unknown };
    const list = Array.isArray(o.observations) ? o.observations : Array.isArray(o.ads) ? o.ads : null;
    if (!list) return null;
    const at = typeof o.observed_at === "string" ? o.observed_at : typeof o.savedAt === "string" ? o.savedAt : undefined;
    return { observations: list, observed_at: at };
  }
  return null;
}

/**
 * Admin-only controls for the library: add an ad by hand, import a CSV or an
 * Ad Library export, see the configured API searches, kick a refresh.
 */
export function ProvenAdsAdminTools({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [modal, setModal] = useState<"add" | "import" | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        adminFetch<{ sources: SourceInfo[] }>("/api/proven-ads?limit=1"),
        adminFetch<{ searches: SearchRow[] }>("/api/proven-ads/searches"),
      ]);
      setSources(a.sources || []);
      setSearches(b.searches || []);
    } catch {
      /* admin extras; the library itself still loads */
    }
  }, []);

  useEffect(() => {
    if (open) loadMeta();
  }, [open, loadMeta]);

  async function addManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const body: Record<string, string> = {};
    new FormData(e.currentTarget).forEach((v, k) => {
      if (typeof v === "string" && v.trim()) body[k] = v.trim();
    });
    try {
      await adminFetch("/api/proven-ads", { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      setNote("Saved. The read is queued and lands within the hour.");
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const text = await file.text();
      let body: string;
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = observationsOf(JSON.parse(text));
        if (!parsed) throw new Error("That JSON has no ads or observations list.");
        body = JSON.stringify(parsed);
      } else {
        body = JSON.stringify({ csv: text });
      }
      const r = await adminFetch<{ created: number; updated: number; skipped?: number; families?: number }>(
        "/api/proven-ads/import",
        { method: "POST", body }
      );
      setModal(null);
      setNote(
        `Imported: ${r.created} new, ${r.updated} refreshed${r.skipped ? `, ${r.skipped} skipped (under 60 days or unreadable)` : ""}. Reads are queued.`
      );
      onChanged();
    } catch (err) {
      setNote(err instanceof Error ? err.message.slice(0, 200) : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function refreshNow() {
    setNote(null);
    try {
      const r = await adminFetch<{ note: string }>("/api/proven-ads/refresh", { method: "POST", body: "{}" });
      setNote(r.note);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  return (
    <section className="mb-6 rounded-[4px] border border-[var(--border-subtle)]" style={{ fontFamily: FONT }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px]" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
          Library admin
        </span>
        <ChevronDown size={15} aria-hidden className={`text-[var(--color-dark)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--border-subtle)] px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <ToolButton onClick={() => setModal("add")} icon={Plus} hue="var(--hue-a)">
              Add an ad
            </ToolButton>
            <ToolButton onClick={() => setModal("import")} icon={Upload} hue="var(--hue-c)">
              Import CSV or Ad Library export
            </ToolButton>
            <ToolButton onClick={refreshNow} icon={RefreshCw} hue="var(--hue-d)">
              Refresh API searches
            </ToolButton>
          </div>
          {note && (
            <p className="text-[13px]" style={{ color: "var(--color-dark)", fontWeight: 650 }}>
              {note}
            </p>
          )}
          {sources.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-body-text)", fontWeight: 800 }}>
                Sources
              </div>
              {sources.map((s) => (
                <p key={s.id} className="text-[12px] leading-relaxed" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                  <span style={{ fontWeight: 800 }}>{s.id}</span>. {s.coverage}
                  {s.automated && !s.configured ? " No token is set, so this source is idle." : ""}
                </p>
              ))}
            </div>
          )}
          {searches.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--color-body-text)", fontWeight: 800 }}>
                API searches
              </div>
              {searches.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 text-[12px]">
                  <div>
                    <div style={{ color: "var(--color-dark)", fontWeight: 750 }}>
                      {s.label} {!s.enabled && <span style={{ color: "var(--color-body-text)", fontWeight: 600 }}>(paused)</span>}
                    </div>
                    {s.last_result?.note && <div style={{ color: "var(--color-body-text)", fontWeight: 550 }}>{s.last_result.note}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminFetch(`/api/proven-ads/searches/${s.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !s.enabled }) });
                      loadMeta();
                    }}
                    className="shrink-0 underline-offset-2 hover:underline"
                    style={{ color: "var(--color-dark)", fontWeight: 750 }}
                  >
                    {s.enabled ? "Pause" : "Enable"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal === "add" && (
        <Modal title="Add a proven ad" onClose={() => setModal(null)}>
          <p className="mb-3 text-[13px] leading-relaxed" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
            Copy it from the public Ad Library. Keep the Ad Library link as the reference and never upload the other
            facility&apos;s photos.
          </p>
          <form onSubmit={addManual} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field name="advertiser_name" label="Advertiser" required />
            <Field name="started_at" label="Started running (YYYY-MM-DD)" required />
            <Field name="headline" label="Headline" />
            <Field name="cta" label="Button" />
            <Field name="primary_text" label="Primary text" textarea wide />
            <Field name="snapshot_url" label="Ad Library link" wide />
            <Field name="landing_url" label="Landing page" wide />
            <Pick name="platform" label="Platform" options={Object.entries(PLATFORM_LABELS)} />
            <Pick name="format" label="Format" options={Object.entries(FORMAT_LABELS)} />
            <Field name="city" label="City" />
            <Field name="state" label="State" />
            <Pick name="offer_type" label="Offer" options={Object.entries(OFFER_LABELS)} />
            <Pick name="unit_type" label="Unit" options={Object.entries(UNIT_LABELS)} />
            <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-[4px] px-5 text-[14px] disabled:opacity-60"
                style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "import" && (
        <Modal title="Import ads" onClose={() => setModal(null)}>
          <p className="mb-2 text-[13px] leading-relaxed" style={{ color: "var(--color-dark)", fontWeight: 600 }}>
            A <span style={{ fontWeight: 800 }}>.json</span> Ad Library export: one observation per ad (id, page, start,
            body, title, cta, link, fmt). Near-identical ads from one advertiser collapse into one entry, and only ads past
            60 days are kept.
          </p>
          <p className="mb-4 text-[13px] leading-relaxed" style={{ color: "var(--color-dark)", fontWeight: 600 }}>
            Or a <span style={{ fontWeight: 800 }}>.csv</span> with a header row: advertiser_name, started_at, headline,
            primary_text, platform, format, city, state, country, offer_type, unit_type, snapshot_url, landing_url, cta,
            source_ad_id, active.
          </p>
          <label
            className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[4px] text-[14px]"
            style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
            {busy ? "Importing" : "Choose a file"}
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
              }}
            />
          </label>
        </Modal>
      )}
    </section>
  );
}
