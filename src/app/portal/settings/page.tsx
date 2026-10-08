"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Target,
  Calendar,
  LogOut,
  Loader2,
  Check,
  User,
  Bell,
  BellOff,
} from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import { clearPortalSession, accountManagerOf, telHref } from "@/lib/portal-helpers";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { PortalPage, Card, Button } from "@/components/portal/ui";

export default function SettingsPage() {
  const { session, client } = usePortal();
  const [goalValue, setGoalValue] = useState(String(client.monthlyGoal ?? ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [goalError, setGoalError] = useState("");
  const [address, setAddress] = useState(client.streetAddress ?? "");
  const [addressState, setAddressState] = useState<"idle" | "saving" | "saved">("idle");
  const [addressError, setAddressError] = useState("");

  async function handleSaveAddress() {
    setAddressState("saving");
    setAddressError("");
    try {
      const res = await fetch("/api/client-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email, accessCode: session.accessCode, streetAddress: address }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Unable to save. Please try again.");
      }
      setAddressState("saved");
      setTimeout(() => setAddressState("idle"), 2000);
    } catch (e) {
      setAddressState("idle");
      setAddressError(e instanceof Error ? e.message : "Unable to save. Please try again.");
    }
  }

  // Push notifications (client-authenticated via the portal session).
  const pushCredentials = useMemo(
    () => ({ email: session.email, accessCode: session.accessCode }),
    [session.email, session.accessCode]
  );
  const { supported, permission, subscription, subscribe, unsubscribe } =
    usePushNotifications({
      endpoint: "/api/portal-push-subscribe",
      userType: "client",
      credentials: pushCredentials,
    });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const pushEnabled = !!subscription;

  async function handleTogglePush() {
    setPushBusy(true);
    setPushError("");
    try {
      if (pushEnabled) {
        await unsubscribe();
      } else {
        const sub = await subscribe();
        if (!sub) {
          setPushError(
            permission === "denied"
              ? "Notifications are blocked in your browser settings."
              : "Could not enable notifications. Please try again."
          );
        }
      }
    } catch {
      setPushError("Something went wrong. Please try again.");
    } finally {
      setPushBusy(false);
    }
  }

  const manager = accountManagerOf(client);
  const managerTel = telHref(manager.phone);
  const signedDate = client.signedAt
    ? new Date(client.signedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  async function handleSaveGoal() {
    const parsed = parseInt(goalValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      setGoalError("Please enter a valid number.");
      return;
    }
    setSaving(true);
    setGoalError("");
    try {
      const res = await fetch("/api/client-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          accessCode: session.accessCode,
          monthlyGoal: parsed,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setGoalError("Unable to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    clearPortalSession();
    window.location.href = "/portal";
  }

  return (
    <PortalPage
      title="Account Settings"
      subtitle="Manage your facility info and preferences"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Facility info */}
        <Card as="section">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">Facility Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Facility Name</p>
                <p className="text-sm text-[var(--color-dark)]">{client.facilityName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Location</p>
                <p className="text-sm text-[var(--color-dark)]">{client.location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div className="min-w-0 flex-1">
                <label htmlFor="street-address" className="text-xs font-semibold text-[var(--color-dark)]">
                  Street address
                </label>
                <p className="text-xs text-[var(--color-dark)]">Your ads run within a few miles of it.</p>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="street-address"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressError("");
                    }}
                    autoComplete="street-address"
                    placeholder="123 Main St, Kalamazoo, MI 49001"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] px-3 py-2 text-sm text-[var(--color-dark)] outline-none focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveAddress}
                    loading={addressState === "saving"}
                    icon={addressState === "saved" ? <Check className="h-3.5 w-3.5" /> : undefined}
                  >
                    {addressState === "saving" ? "Saving..." : addressState === "saved" ? "Saved" : "Save"}
                  </Button>
                </div>
                {addressError && <p className="mt-1.5 border-l-2 border-[#A12A2A] pl-2 text-xs font-semibold text-[var(--color-dark)]">{addressError}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Email</p>
                <p className="text-sm text-[var(--color-dark)]">{client.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Occupancy Range</p>
                <p className="text-sm text-[var(--color-dark)]">{client.occupancyRange}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Total Units</p>
                <p className="text-sm text-[var(--color-dark)]">{client.totalUnits}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Monthly goal */}
        <Card as="section">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">Monthly Goal</h3>
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 shrink-0 text-[var(--color-dark)]" />
            <div className="flex-1">
              <label htmlFor="monthly-goal" className="mb-1 block text-xs text-[var(--color-mid-gray)]">
                Target move-ins per month
              </label>
              <div className="flex gap-2">
                <input
                  id="monthly-goal"
                  type="number"
                  value={goalValue}
                  onChange={(e) => {
                    setGoalValue(e.target.value);
                    setSaved(false);
                    setGoalError("");
                  }}
                  min={0}
                  className="w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] px-3 py-2 text-sm text-[var(--color-dark)] outline-none focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
                />
                <Button
                  size="sm"
                  onClick={handleSaveGoal}
                  loading={saving}
                  icon={!saving && saved ? <Check className="h-3.5 w-3.5" /> : undefined}
                >
                  {saving ? "Saving..." : saved ? "Saved" : "Save"}
                </Button>
              </div>
              {goalError && (
                <p className="mt-1.5 text-xs text-[var(--color-red)]">{goalError}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card as="section">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">Notifications</h3>
          {!supported ? (
            <p className="text-xs text-[var(--color-mid-gray)]">
              Push notifications aren’t supported in this browser. Install the app to your home
              screen to enable them.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-dark)]/[0.06]">
                    {pushEnabled ? (
                      <Bell className="h-5 w-5 text-[var(--color-dark)]" />
                    ) : (
                      <BellOff className="h-5 w-5 text-[var(--color-mid-gray)]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-dark)]">Push notifications</p>
                    <p className="text-xs text-[var(--color-mid-gray)]">
                      Get alerted about new leads, messages, and campaign changes.
                    </p>
                  </div>
                </div>
                <Button
                  variant={pushEnabled ? "secondary" : "primary"}
                  size="sm"
                  onClick={handleTogglePush}
                  loading={pushBusy}
                >
                  {pushEnabled ? "Turn off" : "Enable"}
                </Button>
              </div>
              {pushError && <p className="mt-3 text-xs text-[var(--color-red)]">{pushError}</p>}
            </>
          )}
        </Card>

        {/* Account manager */}
        <Card as="section">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-dark)]">Your Account Manager</h3>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-dark)]/[0.06]">
              <User className="h-5 w-5 text-[var(--color-dark)]" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-dark)]">{manager.name}</p>
              <p className="text-xs text-[var(--color-mid-gray)]">Account Manager</p>
              <div className="flex flex-col gap-1 pt-1">
                <a
                  href={`mailto:${manager.email}`}
                  className="flex items-center gap-2 text-xs text-[var(--color-body-text)] transition-colors hover:text-[var(--color-dark)]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {manager.email}
                </a>
                {manager.phone && managerTel && (
                  <a
                    href={managerTel}
                    className="flex items-center gap-2 text-xs text-[var(--color-body-text)] transition-colors hover:text-[var(--color-dark)]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {manager.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Client since + sign out */}
        <Card as="section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-[var(--color-dark)]" />
              <div>
                <p className="text-xs text-[var(--color-mid-gray)]">Client Since</p>
                <p className="text-sm text-[var(--color-dark)]">{signedDate ?? "N/A"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-red)]/20 bg-[var(--color-red-light)] px-4 py-2 text-xs font-medium text-[var(--color-red)] transition-colors hover:bg-[var(--color-red)]/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </Card>
      </div>
    </PortalPage>
  );
}
