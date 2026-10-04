"use client";

import { useState } from "react";
import {
  Link2,
  Unlink,
  AlertTriangle,
  Clock,
  Plug,
  Shield,
  Check,
  Loader2,
} from "lucide-react";
import { readWriteBackSettings } from "@/lib/attribution/connection-settings";

/* ── Types ───────────────────────────────────────────────────── */

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

function isTokenExpiring(conn: PlatformConnection): boolean {
  if (!conn.token_expires_at) return false;
  const expiresAt = new Date(conn.token_expires_at).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return expiresAt - Date.now() < sevenDays;
}

/* ── Move-in reporting (MISSION.md s12) ─────────────────────── */

export type SaveWriteBackSettings = (
  connectionId: string,
  settings: Record<string, string>
) => Promise<Record<string, string>>;

const WRITE_BACK_FIELD_UI: Record<string, { key: string; label: string; placeholder: string; hint: string }[]> = {
  meta: [
    {
      key: "pixelId",
      label: "Meta pixel ID",
      placeholder: "e.g. 1234567890123456",
      hint: "Leave empty to report move-ins to the StorageAds pixel.",
    },
  ],
  google_ads: [
    {
      key: "moveInConversionActionId",
      label: "Move-in conversion action",
      placeholder: "Conversion action ID",
      hint: "Required. Create an offline \"Import from clicks\" action in Google Ads and paste its ID.",
    },
    {
      key: "loginCustomerId",
      label: "Manager account (optional)",
      placeholder: "123-456-7890",
      hint: "Only if this account is reached through a manager account.",
    },
  ],
};

function MoveInReportingSettings({
  conn,
  save,
}: {
  conn: PlatformConnection;
  save: SaveWriteBackSettings;
}) {
  const fields = WRITE_BACK_FIELD_UI[conn.platform];
  const initial = readWriteBackSettings(conn.platform, conn.metadata);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  if (!fields) return null;
  const dirty = fields.some((f) => (values[f.key] ?? "") !== (saved[f.key] ?? ""));

  async function onSave() {
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) payload[f.key] = (values[f.key] ?? "").trim();
      const next = await save(conn.id, payload);
      setSaved(next);
      setValues(next);
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
        Move-in reporting
      </p>
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="block text-[11px] font-medium text-[var(--color-dark)]">{f.label}</span>
          <input
            value={values[f.key] ?? ""}
            onChange={(e) => {
              setValues((v) => ({ ...v, [f.key]: e.target.value }));
              setJustSaved(false);
            }}
            placeholder={f.placeholder}
            className="mt-1 w-full px-2 py-1.5 text-xs border border-[var(--border-medium)] bg-[var(--color-light)] text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-dark)]"
          />
          <span className="block text-[10px] text-[var(--color-mid-gray)] mt-0.5">{f.hint}</span>
        </label>
      ))}
      {error && <p className="text-[11px] text-[var(--color-red)]">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-dark)] text-[var(--color-light)] disabled:opacity-40"
        >
          {saving && <Loader2 size={11} className="animate-spin" aria-hidden />}
          Save
        </button>
        {justSaved && !dirty && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-mid-gray)]">
            <Check size={11} aria-hidden /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

export function PlatformConnectionsSection({
  platforms,
  connections,
  disconnect,
  disconnecting,
  saveWriteBackSettings,
}: {
  platforms: PlatformInfo[];
  connections: PlatformConnection[];
  disconnect: (connectionId: string) => void;
  disconnecting: string | null;
  saveWriteBackSettings?: SaveWriteBackSettings;
}) {
  function getConnection(platform: string) {
    return connections.find(
      (c) => c.platform === platform && c.status === "connected"
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-dark)] mb-3 flex items-center gap-2">
        <Plug size={14} className="text-[var(--color-gold)]" />
        Platform Connections
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((platform) => {
          const conn = getConnection(platform.id);
          const expiring = conn ? isTokenExpiring(conn) : false;
          return (
            <div
              key={platform.id}
              className="border border-[var(--border-subtle)] rounded-xl p-4 bg-[var(--bg-elevated)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-semibold ${PLATFORM_COLORS[platform.id] || "bg-[var(--color-gold)]"}`}
                >
                  {PLATFORM_LETTERS[platform.id] || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-dark)]">
                    {platform.name}
                  </p>
                  <p className="text-xs text-[var(--color-mid-gray)] mt-0.5">
                    {platform.description}
                  </p>

                  {conn ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <span className="text-xs font-medium text-emerald-400">
                          Connected
                        </span>
                      </div>
                      {conn.account_name && (
                        <p className="text-xs text-[var(--color-mid-gray)]">
                          Account: {conn.account_name}
                        </p>
                      )}
                      {conn.page_name && (
                        <p className="text-xs text-[var(--color-mid-gray)]">
                          Page: {conn.page_name}
                        </p>
                      )}
                      {conn.token_expires_at && (
                        <div className="flex items-center gap-1">
                          {expiring ? (
                            <AlertTriangle
                              size={10}
                              className="text-amber-400"
                            />
                          ) : (
                            <Clock size={10} className="text-[var(--color-mid-gray)]" />
                          )}
                          <p
                            className={`text-[10px] ${expiring ? "text-amber-400" : "text-[var(--color-mid-gray)]"}`}
                          >
                            Token expires:{" "}
                            {new Date(
                              conn.token_expires_at
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => disconnect(conn.id)}
                        disabled={disconnecting === conn.id}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                      >
                        <Unlink size={10} />
                        {disconnecting === conn.id
                          ? "Disconnecting..."
                          : "Disconnect"}
                      </button>
                      {saveWriteBackSettings && (
                        <MoveInReportingSettings conn={conn} save={saveWriteBackSettings} />
                      )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      {platform.configured ? (
                        <a
                          href={platform.connectUrl || "#"}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-gold)] text-[var(--color-light)] text-xs font-medium rounded-lg hover:bg-[var(--color-gold-hover)] transition-colors"
                        >
                          <Link2 size={12} />
                          Connect{" "}
                          {PLATFORM_LABELS[platform.id] || platform.name}
                        </a>
                      ) : (
                        <div className="p-3 rounded-lg border border-dashed border-[var(--border-medium)]">
                          <div className="flex items-start gap-2">
                            <Shield
                              size={12}
                              className="text-[var(--color-mid-gray)] mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-xs text-[var(--color-mid-gray)]">
                                {platform.id === "meta"
                                  ? "Requires META_APP_ID and META_APP_SECRET environment variables."
                                  : platform.id === "tiktok"
                                    ? "Requires TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET environment variables."
                                    : "Requires GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN environment variables."}
                              </p>
                              <p className="text-[10px] text-[var(--color-mid-gray)] mt-1">
                                Add these in Vercel &rarr; Settings &rarr;
                                Environment Variables
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {platforms.length === 0 && (
          <div className="col-span-full text-center py-8 border border-[var(--border-subtle)] rounded-xl bg-[var(--bg-elevated)]">
            <Plug size={24} className="mx-auto mb-2 text-[var(--color-mid-gray)]" />
            <p className="text-sm text-[var(--color-mid-gray)]">
              No platform configurations found.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
