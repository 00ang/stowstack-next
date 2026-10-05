"use client";

import { useState, useEffect } from "react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import {
  Building,
  Bell,
  Plug,
  AlertTriangle,
  Save,
  Loader2,
  LogOut,
  Trash2,
  Shield,
  CheckCircle,
  Clock,
  Eye,
} from "lucide-react";

interface Settings {
  company_name: string;
  email: string;
  phone: string;
  signature: string;
  notifications: {
    new_leads: boolean;
    overdue_alerts: boolean;
    messages: boolean;
    campaign_alerts: boolean;
  };
  integrations: {
    twilio_sid: string;
    default_follow_up_days: number;
  };
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} style={{ color: "#3B82F6" }} />
        <h2 className="text-base font-semibold" style={{ color: "#111827" }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "#6E6E73" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500/50"
        style={{ backgroundColor: "#F9FAFB", borderColor: "rgba(0,0,0,0.08)", color: "#111827" }}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm" style={{ color: "#111827" }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-10 h-5 rounded-full transition-colors"
        style={{ backgroundColor: checked ? "#3B82F6" : "rgba(255,255,255,0.1)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ left: checked ? "22px" : "2px" }}
        />
      </button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border p-6 animate-pulse"
          style={{ backgroundColor: "#FFFFFF", borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="h-5 w-32 rounded bg-black/5 mb-5" />
          <div className="space-y-4">
            <div className="h-10 rounded bg-black/5" />
            <div className="h-10 rounded bg-black/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DeletionRequest {
  id: string;
  email: string;
  name: string | null;
  reason: string | null;
  source: string;
  status: string;
  data_found: Record<string, number>;
  data_deleted: Record<string, number> | null;
  admin_notes: string | null;
  requested_at: string;
  acknowledged_at: string | null;
  completed_at: string | null;
}

function DeletionRequestsSection() {
  const { data, loading, refetch } = useAdminFetch<{ requests: DeletionRequest[] }>("/api/data-deletion");
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const requests = data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const acknowledged = requests.filter((r) => r.status === "acknowledged");
  const completed = requests.filter((r) => r.status === "completed");

  const handleAction = async (id: string, action: "acknowledge" | "execute") => {
    setProcessing(id);
    try {
      await adminFetch("/api/data-deletion", {
        method: "POST",
        body: JSON.stringify({ action, id }),
      });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return "#AB5505";
      case "acknowledged": return "#3B82F6";
      case "completed": return "#22C55E";
      default: return "#6E6E73";
    }
  };

  if (loading) {
    return (
      <SectionCard title="Data Deletion Requests" icon={Shield}>
        <div className="animate-pulse space-y-3">
          <div className="h-10 rounded bg-black/5" />
          <div className="h-10 rounded bg-black/5" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Data Deletion Requests" icon={Shield}>
      {requests.length === 0 ? (
        <p className="text-sm" style={{ color: "#6E6E73" }}>No deletion requests.</p>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex gap-4 text-xs mb-2">
            <span style={{ color: "#AB5505" }}>{pending.length} pending</span>
            <span style={{ color: "#3B82F6" }}>{acknowledged.length} acknowledged</span>
            <span style={{ color: "#22C55E" }}>{completed.length} completed</span>
          </div>

          {/* Request List */}
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-lg border p-3"
              style={{ backgroundColor: "#F9FAFB", borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: statusColor(req.status) }}
                  />
                  <span className="text-sm font-medium" style={{ color: "#111827" }}>
                    {req.email}
                  </span>
                  {req.name && (
                    <span className="text-xs" style={{ color: "#6E6E73" }}>({req.name})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full capitalize"
                    style={{ backgroundColor: `${statusColor(req.status)}20`, color: statusColor(req.status) }}
                  >
                    {req.status}
                  </span>
                  <button
                    onClick={() => setExpanded(expanded === req.id ? null : req.id)}
                    className="p-1 rounded transition-colors hover:bg-black/5"
                  >
                    <Eye size={14} style={{ color: "#6E6E73" }} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs" style={{ color: "#6E6E73" }}>
                <span>Requested: {new Date(req.requested_at).toLocaleDateString()}</span>
                {req.acknowledged_at && (
                  <span>Acknowledged: {new Date(req.acknowledged_at).toLocaleDateString()}</span>
                )}
                {req.completed_at && (
                  <span>Completed: {new Date(req.completed_at).toLocaleDateString()}</span>
                )}
              </div>

              {/* Expanded details */}
              {expanded === req.id && (
                <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                  {req.reason && (
                    <div>
                      <span className="text-xs font-medium" style={{ color: "#6E6E73" }}>Reason: </span>
                      <span className="text-xs" style={{ color: "#6B7280" }}>{req.reason}</span>
                    </div>
                  )}
                  {req.data_found && Object.keys(req.data_found).length > 0 && (
                    <div>
                      <span className="text-xs font-medium" style={{ color: "#6E6E73" }}>Data found: </span>
                      <span className="text-xs" style={{ color: "#6B7280" }}>
                        {Object.entries(req.data_found).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </span>
                    </div>
                  )}
                  {req.data_deleted && Object.keys(req.data_deleted).length > 0 && (
                    <div>
                      <span className="text-xs font-medium" style={{ color: "#6E6E73" }}>Data deleted: </span>
                      <span className="text-xs" style={{ color: "#22C55E" }}>
                        {Object.entries(req.data_deleted).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {req.status !== "completed" && (
                    <div className="flex gap-2 pt-2">
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleAction(req.id, "acknowledge")}
                          disabled={processing === req.id}
                          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3B82F6" }}
                        >
                          {processing === req.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Clock size={12} />
                          )}
                          Acknowledge
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`This will permanently delete all data for ${req.email}. This cannot be undone. Continue?`)) {
                            handleAction(req.id, "execute");
                          }
                        }}
                        disabled={processing === req.id}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#EF4444" }}
                      >
                        {processing === req.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        Execute Deletion
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { data: rawData, loading, error, refetch } = useAdminFetch<{ settings: Settings }>("/api/admin-settings");
  const settings = rawData?.settings ?? null;
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await adminFetch("/api/admin-settings", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setSaveMsg("Settings saved");
      refetch();
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("storageads_admin_key");
    window.location.href = "/admin";
  };

  const handleClearCache = () => {
    if (typeof caches !== "undefined") {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
    localStorage.clear();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#111827" }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: "#6E6E73" }}>Manage your account and preferences</p>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
          Failed to load settings: {error}
        </div>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#111827" }}>Settings</h1>
          <p className="text-sm mt-1" style={{ color: "#6E6E73" }}>Manage your account and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className="text-xs" style={{ color: saveMsg.includes("saved") ? "#22C55E" : "#EF4444" }}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: "#3B82F6", color: "#fff" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <SectionCard title="Company Info" icon={Building}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Company Name"
            value={form.company_name}
            onChange={(v) => setForm({ ...form, company_name: v })}
          />
          <InputField
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <InputField
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <InputField
            label="Signature"
            value={form.signature}
            onChange={(v) => setForm({ ...form, signature: v })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Notifications" icon={Bell}>
        <div className="space-y-1">
          <Toggle
            label="New lead notifications"
            checked={form.notifications.new_leads}
            onChange={(v) =>
              setForm({ ...form, notifications: { ...form.notifications, new_leads: v } })
            }
          />
          <Toggle
            label="Overdue task alerts"
            checked={form.notifications.overdue_alerts}
            onChange={(v) =>
              setForm({ ...form, notifications: { ...form.notifications, overdue_alerts: v } })
            }
          />
          <Toggle
            label="Message notifications"
            checked={form.notifications.messages}
            onChange={(v) =>
              setForm({ ...form, notifications: { ...form.notifications, messages: v } })
            }
          />
          <Toggle
            label="Campaign alerts"
            checked={form.notifications.campaign_alerts}
            onChange={(v) =>
              setForm({ ...form, notifications: { ...form.notifications, campaign_alerts: v } })
            }
          />
        </div>
      </SectionCard>

      <SectionCard title="Integrations" icon={Plug}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Twilio Account SID"
            value={form.integrations.twilio_sid}
            onChange={(v) =>
              setForm({ ...form, integrations: { ...form.integrations, twilio_sid: v } })
            }
            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <InputField
            label="Default Follow-up Days"
            type="number"
            value={String(form.integrations.default_follow_up_days)}
            onChange={(v) =>
              setForm({
                ...form,
                integrations: { ...form.integrations, default_follow_up_days: parseInt(v) || 0 },
              })
            }
          />
        </div>
      </SectionCard>

      <DeletionRequestsSection />

      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgba(239,68,68,0.2)" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle size={18} style={{ color: "#EF4444" }} />
          <h2 className="text-base font-semibold" style={{ color: "#EF4444" }}>Danger Zone</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors hover:bg-red-500/20"
            style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}
          >
            <LogOut size={14} />
            Logout
          </button>
          <button
            onClick={handleClearCache}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-colors hover:bg-red-500/20"
            style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}
          >
            <Trash2 size={14} />
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  );
}
