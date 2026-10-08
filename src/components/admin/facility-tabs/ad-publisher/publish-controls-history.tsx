"use client";

import {
  Loader2,
  Send,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────────── */

interface MetaAdContent {
  angle: string;
  angleLabel: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  targetingNote: string;
}

interface AdVariation {
  id: string;
  facility_id: string;
  brief_id: string | null;
  created_at: string;
  platform: string;
  format: string;
  angle: string;
  content_json: MetaAdContent | Record<string, unknown>;
  asset_urls: Record<string, string> | null;
  status: string;
  feedback: string | null;
  version: number;
}

interface Asset {
  id: string;
  facility_id: string;
  created_at: string;
  type: string;
  source: string;
  url: string;
  metadata: Record<string, unknown> | null;
}

interface PlatformConnection {
  id: string;
  facility_id: string;
  platform: string;
  status: string;
  account_id: string | null;
  account_name: string | null;
  page_id: string | null;
  page_name: string | null;
  created_at: string;
  updated_at: string;
  token_expires_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface PublishLogEntry {
  id: string;
  facility_id: string;
  variation_id: string;
  connection_id: string;
  platform: string;
  status: string;
  external_id: string | null;
  external_url: string | null;
  error_message: string | null;
  created_at: string;
  content_json: Record<string, string> | null;
  angle: string | null;
}

/* ── Constants ───────────────────────────────────────────────── */

const PLATFORM_COLORS: Record<string, string> = {
  meta: "bg-[var(--color-gold)]",
  google: "bg-red-500",
  tiktok: "bg-black border border-[var(--border-medium)]",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google Ads",
  tiktok: "TikTok",
};

const PLATFORM_LETTERS: Record<string, string> = {
  meta: "M",
  google: "G",
  tiktok: "T",
};

const PUBLISH_STATUS_STYLES: Record<string, string> = {
  published: "bg-emerald-500/10 text-emerald-400",
  success: "bg-emerald-500/10 text-emerald-400",
  failed: "bg-red-500/10 text-red-400",
  pending: "bg-yellow-500/10 text-yellow-400",
};

/* ── Publish Controls ── */

export function PublishControls({
  variations,
  connectedPlatforms,
  assets,
  selectedVariation,
  setSelectedVariation,
  selectedConnection,
  setSelectedConnection,
  selectedImage,
  setSelectedImage,
  ctaOverride,
  setCtaOverride,
  publishing,
  publishAd,
  publishError,
  publishSuccess,
}: {
  variations: AdVariation[];
  connectedPlatforms: PlatformConnection[];
  assets: Asset[];
  selectedVariation: string;
  setSelectedVariation: (v: string) => void;
  selectedConnection: string;
  setSelectedConnection: (c: string) => void;
  selectedImage: string;
  setSelectedImage: (i: string) => void;
  ctaOverride: string;
  setCtaOverride: (c: string) => void;
  publishing: boolean;
  publishAd: () => void;
  publishError: string | null;
  publishSuccess: string | null;
}) {
  return (
    <div className="border border-[var(--border-subtle)] rounded-xl p-5 bg-[var(--bg-elevated)]">
      <h4 className="text-sm font-semibold text-[var(--color-dark)] mb-4 flex items-center gap-2">
        <Send size={14} className="text-[var(--color-gold)]" />
        Publish an Ad
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ad Variation selector */}
        <div>
          <label className="text-xs font-medium text-[var(--color-mid-gray)] block mb-1.5">
            Ad Copy
          </label>
          <select
            value={selectedVariation}
            onChange={(e) => setSelectedVariation(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
          >
            {variations.map((v) => {
              const c = v.content_json as MetaAdContent;
              return (
                <option key={v.id} value={v.id}>
                  {c.angleLabel || v.angle} &mdash;{" "}
                  {c.headline?.slice(0, 30)}
                </option>
              );
            })}
          </select>
        </div>

        {/* Platform selector */}
        <div>
          <label className="text-xs font-medium text-[var(--color-mid-gray)] block mb-1.5">
            Platform
          </label>
          <select
            value={selectedConnection}
            onChange={(e) => setSelectedConnection(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
          >
            <option value="">Select platform...</option>
            {connectedPlatforms.map((c) => (
              <option key={c.id} value={c.id}>
                {PLATFORM_LABELS[c.platform] || c.platform} &mdash;{" "}
                {c.account_name || c.account_id}
              </option>
            ))}
          </select>
        </div>

        {/* Image selector */}
        <div>
          <label className="text-xs font-medium text-[var(--color-mid-gray)] block mb-1.5">
            Image
          </label>
          <select
            value={selectedImage}
            onChange={(e) => setSelectedImage(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
          >
            <option value="">No image</option>
            {assets.map((a, i) => (
              <option key={a.id} value={a.url}>
                {a.source === "website_scrape"
                  ? "Scraped"
                  : a.source === "stock_library"
                    ? "Stock"
                    : "Uploaded"}{" "}
                image {i + 1}
              </option>
            ))}
          </select>
        </div>

        {/* CTA Override */}
        <div>
          <label className="text-xs font-medium text-[var(--color-mid-gray)] block mb-1.5">
            CTA Override
          </label>
          <input
            value={ctaOverride}
            onChange={(e) => setCtaOverride(e.target.value)}
            placeholder="Optional custom CTA..."
            className="w-full px-3 py-2 border border-[var(--border-subtle)] rounded-lg text-sm bg-[var(--color-light)] text-[var(--color-dark)] placeholder:text-[var(--color-mid-gray)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={publishAd}
            disabled={
              !selectedVariation || !selectedConnection || publishing
            }
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-light)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold-hover)] disabled:opacity-40 transition-colors"
          >
            {publishing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Publishing...
              </>
            ) : (
              <>
                <Send size={14} /> Publish Ad
              </>
            )}
          </button>
          {selectedImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={selectedImage}
              alt=""
              className="h-10 w-16 object-cover rounded border border-[var(--border-subtle)]"
            />
          )}
        </div>
        <p className="text-xs text-[var(--color-mid-gray)]">
          Ad will be created as{" "}
          <span className="font-semibold text-[var(--color-body-text)]">PAUSED</span> in
          Ads Manager. Review targeting and budget there, then activate when
          ready.
        </p>

        {publishError && (
          <div role="alert" className="flex items-start gap-2 border-l-2 border-[var(--color-red)] bg-[var(--bg-elevated)] p-3">
            <XCircle
              size={14}
              className="text-[var(--color-red)] mt-0.5 shrink-0"
            />
            <div>
              <div className="font-semibold text-xs text-[var(--color-dark)] mb-0.5">
                Publish failed
              </div>
              <div className="text-xs font-medium text-[var(--color-dark)]">{publishError}</div>
            </div>
          </div>
        )}
        {publishSuccess && (
          <div role="status" className="flex items-start gap-2 border-l-2 border-[var(--color-green)] bg-[var(--bg-elevated)] p-3">
            <CheckCircle2
              size={14}
              className="text-[var(--color-green)] mt-0.5 shrink-0"
            />
            <div className="text-xs font-semibold text-[var(--color-dark)]">{publishSuccess}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Publish History ── */

export function PublishHistory({
  publishLog,
  connectedPlatforms,
}: {
  publishLog: PublishLogEntry[];
  connectedPlatforms: PlatformConnection[];
}) {
  if (publishLog.length > 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-dark)] mb-3 flex items-center gap-2">
          <Clock size={14} className="text-[var(--color-mid-gray)]" />
          Publish History
        </h4>
        <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden bg-[var(--bg-elevated)]">
          {/* Table header */}
          <div className="grid grid-cols-[40px_1fr_100px_80px_80px] gap-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--color-light-gray)]">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
              Variation
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
              Date
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
              Status
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-mid-gray)]">
              Link
            </span>
          </div>
          {/* Table rows */}
          {publishLog.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[40px_1fr_100px_80px_80px] gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-b-0 items-center hover:bg-[var(--color-light-gray)] transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold ${PLATFORM_COLORS[log.platform] || "bg-[var(--color-gold)]"}`}
              >
                {PLATFORM_LETTERS[log.platform] || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--color-dark)] truncate">
                  {log.content_json?.headline ||
                    log.angle ||
                    "Ad variation"}
                </p>
                {log.error_message && (
                  <p
                    className="text-[10px] text-red-400 truncate"
                    title={log.error_message}
                  >
                    {log.error_message}
                  </p>
                )}
              </div>
              <p className="text-[10px] text-[var(--color-mid-gray)]">
                {new Date(log.created_at).toLocaleDateString()}
              </p>
              <span
                className={`text-xs px-2 py-1 rounded font-medium text-center ${PUBLISH_STATUS_STYLES[log.status] || "bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]"}`}
              >
                {log.status}
              </span>
              <div>
                {log.external_url && (
                  <a
                    href={log.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--color-gold)] hover:text-[var(--color-blue)] flex items-center gap-1 transition-colors"
                  >
                    View <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (connectedPlatforms.length > 0) {
    return (
      <div className="text-center py-6 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
        <Clock size={24} className="mx-auto mb-2 text-[var(--color-mid-gray)]" />
        <p className="text-sm text-[var(--color-mid-gray)]">
          No publish history yet. Publish your first ad above.
        </p>
      </div>
    );
  }

  return null;
}
