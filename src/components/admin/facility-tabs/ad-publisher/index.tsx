"use client";

import { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { PlatformConnectionsSection } from "./platform-connections";
import { PublishControls, PublishHistory } from "./publish-controls-history";

/* ── Types ───────────────────────────────────��───────────────── */

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

interface PlatformInfo {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  connectUrl: string | null;
  icon: string;
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

/* ── Main Component ──────────────────────────────────────────── */

export default function AdPublisher({
  facilityId,
  adminKey,
}: {
  facilityId: string;
  adminKey: string;
}) {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [variations, setVariations] = useState<AdVariation[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [publishLog, setPublishLog] = useState<PublishLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedConnection, setSelectedConnection] = useState<string>("");
  const [ctaOverride, setCtaOverride] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/platform-connections?facilityId=${facilityId}`, {
        headers: { "X-Admin-Key": adminKey },
      }).then((r) => r.json()),
      fetch(`/api/facility-creatives?facilityId=${facilityId}`, {
        headers: { "X-Admin-Key": adminKey },
      }).then((r) => r.json()),
      fetch(`/api/facility-assets?facilityId=${facilityId}`, {
        headers: { "X-Admin-Key": adminKey },
      }).then((r) => r.json()),
      fetch(`/api/publish-ad?facilityId=${facilityId}`, {
        headers: { "X-Admin-Key": adminKey },
      }).then((r) => r.json()),
    ])
      .then(([connData, creativeData, assetData, logData]) => {
        if (connData.platforms) setPlatforms(connData.platforms);
        if (connData.connections) {
          setConnections(connData.connections);
          const firstConnected = connData.connections.find(
            (c: PlatformConnection) => c.status === "connected"
          );
          if (firstConnected) setSelectedConnection(firstConnected.id);
        }
        if (creativeData.variations) {
          const approved = creativeData.variations.filter(
            (v: AdVariation) =>
              v.status === "approved" || v.status === "published"
          );
          setVariations(approved);
          if (approved.length) setSelectedVariation(approved[0].id);
        }
        if (assetData.assets) {
          const photos = assetData.assets.filter(
            (a: Asset) => a.type === "photo"
          );
          setAssets(photos);
          if (photos.length) setSelectedImage(photos[0].url);
        }
        if (logData.logs) setPublishLog(logData.logs);
      })
      .catch(() => { setError('Failed to load publisher data. Please try refreshing the page.'); })
      .finally(() => setLoading(false));
  }, [facilityId, adminKey]);

  async function disconnect(connectionId: string) {
    setDisconnecting(connectionId);
    try {
      await fetch("/api/platform-connections", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({ connectionId }),
      });
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, status: "disconnected" } : c
        )
      );
    } catch {
      setError('Failed to disconnect platform. Please try again.');
    } finally {
      setDisconnecting(null);
    }
  }

  /** MISSION.md s12 — save a connection's move-in reporting settings. */
  async function saveWriteBackSettings(
    connectionId: string,
    settings: Record<string, string>
  ): Promise<Record<string, string>> {
    const res = await fetch("/api/platform-connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey },
      body: JSON.stringify({ connectionId, settings }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not save settings.");
    const next = (json.settings ?? {}) as Record<string, string>;
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connectionId
          ? { ...c, metadata: { ...(c.metadata ?? {}), ...next } }
          : c
      )
    );
    return next;
  }

  async function publishAd() {
    if (!selectedVariation || !selectedConnection) return;
    setPublishing(true);
    setPublishError(null);
    setPublishSuccess(null);
    try {
      const res = await fetch("/api/publish-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": adminKey,
        },
        body: JSON.stringify({
          variationId: selectedVariation,
          connectionId: selectedConnection,
          imageUrl: selectedImage || undefined,
          ctaOverride: ctaOverride || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublishSuccess(
          data.externalUrl
            ? "Ad published! View in Ads Manager."
            : "Ad published successfully!"
        );
        const logRes = await fetch(
          `/api/publish-ad?facilityId=${facilityId}`,
          { headers: { "X-Admin-Key": adminKey } }
        );
        const logData = await logRes.json();
        if (logData.logs) setPublishLog(logData.logs);
      } else {
        setPublishError(
          data.details ||
            data.error ||
            "Publishing failed -- check Ads Manager for details."
        );
      }
    } catch (err) {
      setPublishError(
        err instanceof Error
          ? err.message
          : "Network error -- could not reach publish API."
      );
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--color-gold)]" />
      </div>
    );
  }

  const connectedPlatforms = connections.filter(
    (c) => c.status === "connected"
  );

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

      {/* Platform Connections */}
      <PlatformConnectionsSection
        platforms={platforms}
        connections={connections}
        disconnect={disconnect}
        disconnecting={disconnecting}
        saveWriteBackSettings={saveWriteBackSettings}
      />

      {/* Publish Controls */}
      {connectedPlatforms.length > 0 && variations.length > 0 && (
        <PublishControls
          variations={variations}
          connectedPlatforms={connectedPlatforms}
          assets={assets}
          selectedVariation={selectedVariation}
          setSelectedVariation={setSelectedVariation}
          selectedConnection={selectedConnection}
          setSelectedConnection={setSelectedConnection}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          ctaOverride={ctaOverride}
          setCtaOverride={setCtaOverride}
          publishing={publishing}
          publishAd={publishAd}
          publishError={publishError}
          publishSuccess={publishSuccess}
        />
      )}

      {/* No approved variations message */}
      {connectedPlatforms.length > 0 && variations.length === 0 && (
        <div className="text-center py-6 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
          <p className="text-sm text-[var(--color-mid-gray)]">
            No approved ad variations yet. Go to the Creative Studio to approve
            some ads first.
          </p>
        </div>
      )}

      {/* Publish History */}
      <PublishHistory
        publishLog={publishLog}
        connectedPlatforms={connectedPlatforms}
      />
    </div>
  );
}
