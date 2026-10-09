"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { useToolFocus } from "@/components/ontology/tool-focus";
import { useFlow } from "@/components/flow/flow-context";
import { useHandoff } from "@/components/flow/use-handoff";
import { campaignHref } from "@/lib/flow";
import { FocusScopeToggle } from "@/components/ontology/focus-scope";
import { linkedIds, splitByFocus, variationText } from "@/lib/tools-track/focus-match";
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
  // Opened for an ad (portal ?focus=ads/…): it is the one selected, or, still a
  // draft, it points back to Creative Studio to be approved first.
  const focus = useToolFocus();
  const flow = useFlow();
  const working = flow?.working ?? null;
  const handoff = useHandoff();
  const focusAd = useRef(focus?.type === "ads" ? focus.id : null);
  const [focusDraft, setFocusDraft] = useState<string | null>(null);
  // Back from connecting an ad account (?auth=success&platform=meta).
  const [connectNote, setConnectNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [scope, setScope] = useState<{ address: string | null; showAll: boolean }>({ address: null, showAll: false });
  const showAll = scope.address === (focus?.address ?? null) && scope.showAll;

  useEffect(() => {
    // Connect links come back here, not to the homepage. The outcome params are
    // read once and cleared from the address.
    const here = new URL(window.location.href);
    const auth = here.searchParams.get("auth");
    const platformName: Record<string, string> = { meta: "Meta", google_ads: "Google Ads", tiktok: "TikTok" };
    if (auth) {
      const which = platformName[here.searchParams.get("platform") ?? ""] ?? "The account";
      setConnectNote(
        auth === "success"
          ? { ok: true, text: `${which} is connected.` }
          : { ok: false, text: `${which} didn't connect: ${here.searchParams.get("message") ?? "it was cancelled"}.` },
      );
      for (const k of ["auth", "platform", "message"]) here.searchParams.delete(k);
      window.history.replaceState(null, "", here);
    }
    const returnTo = `${here.pathname}${here.search}`;
    Promise.all([
      fetch(`/api/platform-connections?facilityId=${facilityId}&returnTo=${encodeURIComponent(returnTo)}`, {
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
          const focusId = focusAd.current;
          const focusRow = focusId
            ? (creativeData.variations as AdVariation[]).find((v) => v.id === focusId)
            : undefined;
          if (focusRow && approved.some((v: AdVariation) => v.id === focusRow.id)) setSelectedVariation(focusRow.id);
          else if (approved.length) setSelectedVariation(approved[0].id);
          if (focusRow && !approved.some((v: AdVariation) => v.id === focusRow.id)) setFocusDraft(focusRow.id);
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
        // Meta and Google are created paused: say so, and hand off to switching it on.
        const where = data.platform === "google_ads" ? "Google Ads" : data.platform === "meta" ? "Ads Manager" : "TikTok";
        setPublishSuccess(
          data.paused
            ? `Created in ${where}, paused. Nothing spends until you switch it on there.`
            : data.note || "Posted."
        );
        if (data.paused && data.externalUrl) {
          handoff({
            sentence: `Created in ${where}, paused.`,
            reason: `Check the budget and audience there, then switch it on. Nothing spends until you do.`,
            label: `Open ${where}`,
            href: data.externalUrl,
          });
        } else {
          handoff(
            working
              ? { sentence: "It's posted.", reason: `Carry on with ${working.name}.`, label: `Back to ${working.name}`, href: campaignHref(working.id) }
              : { sentence: "It's posted.", reason: "See what needs you next.", label: "Back to the dashboard", href: "/portal" },
          );
        }
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
  const scoped = focus?.type === "units" || focus?.type === "ads" || focus?.type === "campaigns";
  const { named } = splitByFocus(
    scoped ? focus : null,
    variations,
    (v) => variationText(v.content_json),
    (v) => v.id,
    focus ? linkedIds(flow?.ontology, focus.address, "ads") : new Set(),
  );
  const adChoices = scoped && !showAll ? named : variations;

  return (
    <div className="space-y-6">
      {connectNote && (
        <div
          role="status"
          className={`border-l-2 bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-[var(--color-dark)] ${connectNote.ok ? "border-[var(--color-green)]" : "border-[var(--color-red)]"}`}
        >
          {connectNote.text}
        </div>
      )}
      {focusDraft && (
        <div className="border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-4 py-3">
          <div className="text-[15px] font-extrabold text-[var(--ic-ink)]">This ad is still a draft.</div>
          <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">
            Approve it in Creative Studio first; then it can be published here.{" "}
            {focus && (
              <Link href={`/portal/tools?tool=creative-studio&focus=${focus.address}`} className="font-extrabold text-[var(--ic-ink)] underline underline-offset-4">
                Open it in Creative Studio
              </Link>
            )}
          </div>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center gap-3 border-l-2 border-[var(--color-red)] bg-[var(--bg-elevated)] px-4 py-3 mb-4">
          <p className="flex-1 text-sm font-medium text-[var(--color-dark)]">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-[var(--color-dark)]">
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

      {scoped && focus && (
        <FocusScopeToggle
          name={focus.name}
          named={named.length}
          total={variations.length}
          showAll={showAll}
          onToggle={() => setScope({ address: focus.address, showAll: !showAll })}
        />
      )}

      {/* Publish Controls */}
      {connectedPlatforms.length > 0 && adChoices.length > 0 && (
        <PublishControls
          variations={adChoices}
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
