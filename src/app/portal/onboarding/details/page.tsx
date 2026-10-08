"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Users,
  Package,
  Search,
  Megaphone,
  ClipboardCheck,
  Plus,
  Trash2,
} from "lucide-react";

/* ─── types ─── */

interface PortalSession {
  email: string;
  accessCode: string;
  loginAt: number;
}

interface StepData {
  [key: string]: unknown;
}

interface OnboardingSteps {
  [step: string]: { completed: boolean; data: StepData };
}

interface OnboardingResponse {
  onboarding: {
    accessCode: string;
    updatedAt: string;
    completedAt: string | null;
    steps: OnboardingSteps;
  };
  completionPct: number;
}

/* ─── constants ─── */

const SESSION_KEY = "storageads_portal_session";
// Extended TTL for onboarding — 7 days so clients can complete across sessions
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const STEP_KEYS = [
  "facilityDetails",
  "targetDemographics",
  "unitMix",
  "competitorIntel",
  "adPreferences",
  "review",
] as const;

type StepKey = (typeof STEP_KEYS)[number];

const STEP_META: Record<
  StepKey,
  { label: string; icon: React.ReactNode }
> = {
  facilityDetails: {
    label: "Facility Details",
    icon: <Building2 className="h-4 w-4" />,
  },
  targetDemographics: {
    label: "Target Demographics (Optional)",
    icon: <Users className="h-4 w-4" />,
  },
  unitMix: {
    label: "Unit Mix & Pricing",
    icon: <Package className="h-4 w-4" />,
  },
  competitorIntel: {
    label: "Competitor Intel (Optional)",
    icon: <Search className="h-4 w-4" />,
  },
  adPreferences: {
    label: "Ad Preferences",
    icon: <Megaphone className="h-4 w-4" />,
  },
  review: {
    label: "Review & Submit",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
};

const INCOME_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "low-mid", label: "Low-Mid" },
  { value: "mid-high", label: "Mid-High" },
  { value: "high", label: "High" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
  { value: "premium", label: "Premium" },
];

const BUDGET_OPTIONS = [
  { value: "under-1k", label: "Under $1k" },
  { value: "1k-2.5k", label: "$1k - $2.5k" },
  { value: "2.5k-5k", label: "$2.5k - $5k" },
  { value: "5k-10k", label: "$5k - $10k" },
  { value: "10k+", label: "$10k+" },
];

const GOAL_OPTIONS = [
  { value: "fill-units", label: "Fill Units" },
  { value: "lease-up", label: "Lease-Up" },
  { value: "seasonal-push", label: "Seasonal Push" },
  { value: "rebrand", label: "Rebrand" },
];

/* ─── helpers ─── */

function getSession(): PortalSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: PortalSession = JSON.parse(raw);
    if (Date.now() - session.loginAt > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/* ─── shared UI ─── */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-[var(--color-light-gray)] ${className}`} />
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-red)]/20 bg-[var(--color-red-light)] p-6 text-center">
      <AlertCircle className="h-8 w-8 text-[var(--color-red)]" />
      <p className="text-sm text-[var(--color-body-text)]">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-light-gray)] px-4 py-2 text-sm font-medium text-[var(--color-dark)] transition-colors hover:bg-[var(--color-light-gray)]"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-[var(--color-body-text)]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={ariaLabel || placeholder}
      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  ariaLabel?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel || placeholder}
      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25 resize-none"
    />
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
  ariaLabel,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] outline-none transition-colors focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--color-dark)] outline-none transition-colors focus:border-[var(--color-dark)]/50 focus:ring-1 focus:ring-[var(--color-dark)]/25"
    >
      <option value="">Select...</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-[var(--color-dark)]" : "bg-[var(--color-light-gray)]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[var(--color-light)] transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span className="text-sm text-[var(--color-body-text)]">{label}</span>
    </label>
  );
}

/* ─── main page ─── */

export default function OnboardingPage() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      window.location.href = "/portal";
      return;
    }
    setSession(s); // eslint-disable-line react-hooks/set-state-in-effect -- sync session init
    setLoading(false);
  }, []);

  if (loading || !session) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-dark)]" />
      </div>
    );
  }

  return <OnboardingWizard session={session} />;
}

/* ─── wizard ─── */

function OnboardingWizard({ session }: { session: PortalSession }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingSteps>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch(
      `/api/client-onboarding?code=${session.accessCode}&email=${encodeURIComponent(session.email)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: OnboardingResponse) => {
        setSteps(d.onboarding.steps);
        setCompletedAt(d.onboarding.completedAt);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session.accessCode, session.email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveStep = useCallback(
    async (step: string, data: StepData) => {
      setSaving(true);
      try {
        const res = await fetch(
          `/api/client-onboarding?code=${encodeURIComponent(session.accessCode)}&email=${encodeURIComponent(session.email)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step, data }),
          }
        );
        if (!res.ok) throw new Error();
        const json: { onboarding: { steps: OnboardingSteps; completedAt: string | null } } =
          await res.json();
        setSteps(json.onboarding.steps);
        setCompletedAt(json.onboarding.completedAt);
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [session.accessCode, session.email]
  );

  function handleNext() {
    if (currentStep < STEP_KEYS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  }

  function handleBack() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Skeleton className="mb-8 h-12 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorState message="Failed to load onboarding data" onRetry={loadData} />
      </div>
    );
  }

  const stepKey = STEP_KEYS[currentStep];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* back to portal */}
      <a
        href="/portal"
        className="mb-6 inline-flex items-center gap-1 text-xs text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-body-text)]"
      >
        <ChevronLeft className="h-3 w-3" />
        Back to Portal
      </a>

      <h1 className="mb-6 text-xl font-semibold">Onboarding Setup</h1>

      {/* step indicator */}
      <div className="mb-8">
        <div className="flex items-center">
          {STEP_KEYS.map((key, i) => {
            const isActive = i === currentStep;
            const isComplete = key !== "review" && steps[key]?.completed;
            const isPast = i < currentStep;
            return (
              <div key={key} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => {
                    setCurrentStep(i);
                    window.scrollTo(0, 0);
                  }}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-[var(--color-dark)] text-[var(--color-light)]"
                      : isComplete
                        ? "bg-[var(--color-green-light)] text-[var(--color-green)]"
                        : isPast
                          ? "bg-[var(--color-light-gray)] text-[var(--color-body-text)]"
                          : "bg-[var(--color-light-gray)] text-[var(--color-mid-gray)]"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  )}
                </button>
                {i < STEP_KEYS.length - 1 && (
                  <div
                    className={`mx-1 h-px flex-1 ${
                      isComplete || isPast
                        ? "bg-[var(--color-dark)]/[0.06]"
                        : "bg-[var(--color-light-gray)]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-sm font-medium text-[var(--color-body-text)]">
          {STEP_META[stepKey].label}
        </p>
      </div>

      {/* step content */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
        {stepKey === "facilityDetails" && (
          <FacilityDetailsStep
            data={steps.facilityDetails?.data || {}}
            onSave={async (data) => {
              const ok = await saveStep("facilityDetails", data);
              if (ok) handleNext();
            }}
            saving={saving}
          />
        )}
        {stepKey === "targetDemographics" && (
          <TargetDemographicsStep
            data={steps.targetDemographics?.data || {}}
            onSave={async (data) => {
              const ok = await saveStep("targetDemographics", data);
              if (ok) handleNext();
            }}
            saving={saving}
          />
        )}
        {stepKey === "unitMix" && (
          <UnitMixStep
            data={steps.unitMix?.data || {}}
            onSave={async (data) => {
              const ok = await saveStep("unitMix", data);
              if (ok) handleNext();
            }}
            saving={saving}
          />
        )}
        {stepKey === "competitorIntel" && (
          <CompetitorIntelStep
            data={steps.competitorIntel?.data || {}}
            onSave={async (data) => {
              const ok = await saveStep("competitorIntel", data);
              if (ok) handleNext();
            }}
            saving={saving}
          />
        )}
        {stepKey === "adPreferences" && (
          <AdPreferencesStep
            data={steps.adPreferences?.data || {}}
            onSave={async (data) => {
              const ok = await saveStep("adPreferences", data);
              if (ok) handleNext();
            }}
            saving={saving}
          />
        )}
        {stepKey === "review" && (
          <ReviewStep steps={steps} completedAt={completedAt} />
        )}
      </div>

      {/* navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-body-text)] transition-colors hover:text-[var(--color-dark)] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {stepKey !== "review" && (
          <button
            onClick={handleNext}
            className="flex items-center gap-1 text-sm text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-body-text)]"
          >
            Skip
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── step 1: facility details ─── */

function FacilityDetailsStep({
  data,
  onSave,
  saving,
}: {
  data: StepData;
  onSave: (data: StepData) => Promise<void>;
  saving: boolean;
}) {
  const [brandDescription, setBrandDescription] = useState(
    (data.brandDescription as string) || ""
  );
  const [brandColors, setBrandColors] = useState(
    (data.brandColors as string) || ""
  );
  const [sellingPoints, setSellingPoints] = useState<string[]>(
    Array.isArray(data.sellingPoints)
      ? (data.sellingPoints as string[])
      : [""]
  );

  function addPoint() {
    if (sellingPoints.length < 5) {
      setSellingPoints([...sellingPoints, ""]);
    }
  }

  function removePoint(i: number) {
    setSellingPoints(sellingPoints.filter((_, idx) => idx !== i));
  }

  function updatePoint(i: number, val: string) {
    const updated = [...sellingPoints];
    updated[i] = val;
    setSellingPoints(updated);
  }

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Brand Description</FieldLabel>
        <TextArea
          value={brandDescription}
          onChange={setBrandDescription}
          placeholder="Describe your facility's brand, vibe, and what makes it unique..."
          rows={4}
        />
        <p className="mt-1 text-[10px] text-[var(--color-mid-gray)]">
          {brandDescription.length}/500
        </p>
      </div>

      <div>
        <FieldLabel>Brand Colors</FieldLabel>
        <TextInput
          value={brandColors}
          onChange={setBrandColors}
          placeholder="e.g. Navy blue, white, gold"
        />
      </div>

      <div>
        <FieldLabel>Key Selling Points</FieldLabel>
        <div className="space-y-2">
          {sellingPoints.map((point, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextInput
                value={point}
                onChange={(val) => updatePoint(i, val)}
                placeholder={`Selling point ${i + 1}`}
              />
              {sellingPoints.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePoint(i)}
                  className="shrink-0 rounded-lg p-2 text-[var(--color-mid-gray)] transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {sellingPoints.length < 5 && (
            <button
              type="button"
              onClick={addPoint}
              className="flex items-center gap-1 text-xs text-[var(--color-dark)] transition-colors hover:text-[var(--color-dark)]"
            >
              <Plus className="h-3 w-3" />
              Add selling point
            </button>
          )}
        </div>
      </div>

      <button
        onClick={() =>
          onSave({ brandDescription, brandColors, sellingPoints })
        }
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

/* ─── step 2: target demographics ─── */

function TargetDemographicsStep({
  data,
  onSave,
  saving,
}: {
  data: StepData;
  onSave: (data: StepData) => Promise<void>;
  saving: boolean;
}) {
  const [ageMin, setAgeMin] = useState(Number(data.ageMin) || 25);
  const [ageMax, setAgeMax] = useState(Number(data.ageMax) || 65);
  const [radiusMiles, setRadiusMiles] = useState(
    Number(data.radiusMiles) || 15
  );
  const [incomeLevel, setIncomeLevel] = useState(
    (data.incomeLevel as string) || "any"
  );
  const [targetRenters, setTargetRenters] = useState(
    data.targetRenters !== false
  );
  const [targetOwners, setTargetOwners] = useState(
    data.targetOwners !== false
  );
  const [notes, setNotes] = useState((data.notes as string) || "");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>Min Age</FieldLabel>
          <NumberInput
            value={ageMin}
            onChange={setAgeMin}
            min={18}
            max={99}
          />
        </div>
        <div>
          <FieldLabel>Max Age</FieldLabel>
          <NumberInput
            value={ageMax}
            onChange={setAgeMax}
            min={18}
            max={99}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Target Radius (miles)</FieldLabel>
        <NumberInput
          value={radiusMiles}
          onChange={setRadiusMiles}
          min={1}
          max={100}
        />
      </div>

      <div>
        <FieldLabel>Income Level</FieldLabel>
        <SelectInput
          value={incomeLevel}
          onChange={setIncomeLevel}
          options={INCOME_OPTIONS}
        />
      </div>

      <div className="space-y-3">
        <Toggle
          checked={targetRenters}
          onChange={setTargetRenters}
          label="Target renters"
        />
        <Toggle
          checked={targetOwners}
          onChange={setTargetOwners}
          label="Target homeowners"
        />
      </div>

      <div>
        <FieldLabel>Additional Notes</FieldLabel>
        <TextArea
          value={notes}
          onChange={setNotes}
          placeholder="Any other targeting details..."
        />
      </div>

      <button
        onClick={() =>
          onSave({
            ageMin,
            ageMax,
            radiusMiles,
            incomeLevel,
            targetRenters,
            targetOwners,
            notes,
          })
        }
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

/* ─── step 3: unit mix & pricing ─── */

interface UnitEntry {
  type: string;
  size: string;
  monthlyRate: number;
  availableCount: number;
}

function UnitMixStep({
  data,
  onSave,
  saving,
}: {
  data: StepData;
  onSave: (data: StepData) => Promise<void>;
  saving: boolean;
}) {
  const [units, setUnits] = useState<UnitEntry[]>(
    Array.isArray(data.units) && (data.units as UnitEntry[]).length > 0
      ? (data.units as UnitEntry[])
      : [{ type: "", size: "", monthlyRate: 0, availableCount: 0 }]
  );
  const [specials, setSpecials] = useState((data.specials as string) || "");

  function addUnit() {
    if (units.length < 10) {
      setUnits([
        ...units,
        { type: "", size: "", monthlyRate: 0, availableCount: 0 },
      ]);
    }
  }

  function removeUnit(i: number) {
    setUnits(units.filter((_, idx) => idx !== i));
  }

  function updateUnit(i: number, field: keyof UnitEntry, val: string | number) {
    const updated = [...units];
    updated[i] = { ...updated[i], [field]: val };
    setUnits(updated);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {units.map((unit, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)]/20 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-body-text)]">
                Unit {i + 1}
              </span>
              {units.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUnit(i)}
                  className="text-[var(--color-mid-gray)] transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Type</FieldLabel>
                <TextInput
                  value={unit.type}
                  onChange={(val) => updateUnit(i, "type", val)}
                  placeholder="e.g. Standard"
                />
              </div>
              <div>
                <FieldLabel>Size</FieldLabel>
                <TextInput
                  value={unit.size}
                  onChange={(val) => updateUnit(i, "size", val)}
                  placeholder="e.g. 10x10"
                />
              </div>
              <div>
                <FieldLabel>Monthly Rate ($)</FieldLabel>
                <NumberInput
                  value={unit.monthlyRate}
                  onChange={(val) => updateUnit(i, "monthlyRate", val)}
                  min={0}
                />
              </div>
              <div>
                <FieldLabel>Available Count</FieldLabel>
                <NumberInput
                  value={unit.availableCount}
                  onChange={(val) => updateUnit(i, "availableCount", val)}
                  min={0}
                />
              </div>
            </div>
          </div>
        ))}

        {units.length < 10 && (
          <button
            type="button"
            onClick={addUnit}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-medium)] py-3 text-xs text-[var(--color-mid-gray)] transition-colors hover:border-[var(--color-dark)]/30 hover:text-[var(--color-dark)]"
          >
            <Plus className="h-3 w-3" />
            Add unit type
          </button>
        )}
      </div>

      <div>
        <FieldLabel>Current Specials / Promotions</FieldLabel>
        <TextArea
          value={specials}
          onChange={setSpecials}
          placeholder="Describe any active specials..."
        />
      </div>

      <button
        onClick={() => onSave({ units, specials })}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

/* ─── step 4: competitor intel ─── */

interface CompetitorEntry {
  name: string;
  distance: string;
  pricingNotes: string;
}

function CompetitorIntelStep({
  data,
  onSave,
  saving,
}: {
  data: StepData;
  onSave: (data: StepData) => Promise<void>;
  saving: boolean;
}) {
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(
    Array.isArray(data.competitors) &&
      (data.competitors as CompetitorEntry[]).length > 0
      ? (data.competitors as CompetitorEntry[])
      : [{ name: "", distance: "", pricingNotes: "" }]
  );
  const [differentiation, setDifferentiation] = useState(
    (data.differentiation as string) || ""
  );

  function addCompetitor() {
    if (competitors.length < 5) {
      setCompetitors([
        ...competitors,
        { name: "", distance: "", pricingNotes: "" },
      ]);
    }
  }

  function removeCompetitor(i: number) {
    setCompetitors(competitors.filter((_, idx) => idx !== i));
  }

  function updateCompetitor(
    i: number,
    field: keyof CompetitorEntry,
    val: string
  ) {
    const updated = [...competitors];
    updated[i] = { ...updated[i], [field]: val };
    setCompetitors(updated);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {competitors.map((comp, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light-gray)]/20 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-body-text)]">
                Competitor {i + 1}
              </span>
              {competitors.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCompetitor(i)}
                  className="text-[var(--color-mid-gray)] transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>Name</FieldLabel>
                <TextInput
                  value={comp.name}
                  onChange={(val) => updateCompetitor(i, "name", val)}
                  placeholder="Competitor name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Distance</FieldLabel>
                  <TextInput
                    value={comp.distance}
                    onChange={(val) => updateCompetitor(i, "distance", val)}
                    placeholder="e.g. 2 miles"
                  />
                </div>
                <div>
                  <FieldLabel>Pricing Notes</FieldLabel>
                  <TextInput
                    value={comp.pricingNotes}
                    onChange={(val) =>
                      updateCompetitor(i, "pricingNotes", val)
                    }
                    placeholder="e.g. $10 cheaper"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {competitors.length < 5 && (
          <button
            type="button"
            onClick={addCompetitor}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-medium)] py-3 text-xs text-[var(--color-mid-gray)] transition-colors hover:border-[var(--color-dark)]/30 hover:text-[var(--color-dark)]"
          >
            <Plus className="h-3 w-3" />
            Add competitor
          </button>
        )}
      </div>

      <div>
        <FieldLabel>How do you differentiate?</FieldLabel>
        <TextArea
          value={differentiation}
          onChange={setDifferentiation}
          placeholder="What makes your facility stand out from these competitors?"
          rows={4}
        />
      </div>

      <button
        onClick={() => onSave({ competitors, differentiation })}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

/* ─── step 5: ad preferences ─── */

function AdPreferencesStep({
  data,
  onSave,
  saving,
}: {
  data: StepData;
  onSave: (data: StepData) => Promise<void>;
  saving: boolean;
}) {
  const [toneOfVoice, setToneOfVoice] = useState(
    (data.toneOfVoice as string) || ""
  );
  const [pastAdExperience, setPastAdExperience] = useState(
    (data.pastAdExperience as string) || ""
  );
  const [monthlyBudget, setMonthlyBudget] = useState(
    (data.monthlyBudget as string) || ""
  );
  const [primaryGoal, setPrimaryGoal] = useState(
    (data.primaryGoal as string) || ""
  );
  const [notes, setNotes] = useState((data.notes as string) || "");

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Tone of Voice</FieldLabel>
        <SelectInput
          value={toneOfVoice}
          onChange={setToneOfVoice}
          options={TONE_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>Monthly Ad Budget</FieldLabel>
        <SelectInput
          value={monthlyBudget}
          onChange={setMonthlyBudget}
          options={BUDGET_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>Primary Goal</FieldLabel>
        <SelectInput
          value={primaryGoal}
          onChange={setPrimaryGoal}
          options={GOAL_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>Past Ad Experience</FieldLabel>
        <TextArea
          value={pastAdExperience}
          onChange={setPastAdExperience}
          placeholder="Have you run ads before? What worked or didn't?"
          rows={3}
        />
      </div>

      <div>
        <FieldLabel>Additional Notes</FieldLabel>
        <TextArea
          value={notes}
          onChange={setNotes}
          placeholder="Anything else we should know..."
        />
      </div>

      <button
        onClick={() =>
          onSave({
            toneOfVoice,
            pastAdExperience,
            monthlyBudget,
            primaryGoal,
            notes,
          })
        }
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-dark)] py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Save & Continue
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}

/* ─── step 6: review & submit ─── */

function ReviewStep({
  steps,
  completedAt,
}: {
  steps: OnboardingSteps;
  completedAt: string | null;
}) {
  const dataSteps = STEP_KEYS.filter((k) => k !== "review");
  const allComplete = dataSteps.every((k) => steps[k]?.completed);

  const reviewSections: {
    key: string;
    label: string;
    icon: React.ReactNode;
    items: { label: string; value: string }[];
  }[] = [
    {
      key: "facilityDetails",
      label: "Facility Details",
      icon: <Building2 className="h-4 w-4" />,
      items: [
        {
          label: "Brand Description",
          value: (steps.facilityDetails?.data?.brandDescription as string) || "—",
        },
        {
          label: "Colors",
          value: (steps.facilityDetails?.data?.brandColors as string) || "—",
        },
        {
          label: "Selling Points",
          value: Array.isArray(steps.facilityDetails?.data?.sellingPoints)
            ? (steps.facilityDetails.data.sellingPoints as string[])
                .filter(Boolean)
                .join(", ") || "—"
            : "—",
        },
      ],
    },
    {
      key: "targetDemographics",
      label: "Target Demographics",
      icon: <Users className="h-4 w-4" />,
      items: [
        {
          label: "Age Range",
          value: `${steps.targetDemographics?.data?.ageMin || "—"} - ${steps.targetDemographics?.data?.ageMax || "—"}`,
        },
        {
          label: "Radius",
          value: `${steps.targetDemographics?.data?.radiusMiles || "—"} miles`,
        },
        {
          label: "Income",
          value: (steps.targetDemographics?.data?.incomeLevel as string) || "—",
        },
      ],
    },
    {
      key: "unitMix",
      label: "Unit Mix",
      icon: <Package className="h-4 w-4" />,
      items: [
        {
          label: "Unit Types",
          value: Array.isArray(steps.unitMix?.data?.units)
            ? `${(steps.unitMix.data.units as { type: string }[]).length} types defined`
            : "—",
        },
        {
          label: "Specials",
          value: (steps.unitMix?.data?.specials as string) || "None",
        },
      ],
    },
    {
      key: "competitorIntel",
      label: "Competitor Intel",
      icon: <Search className="h-4 w-4" />,
      items: [
        {
          label: "Competitors",
          value: Array.isArray(steps.competitorIntel?.data?.competitors)
            ? (steps.competitorIntel.data.competitors as { name: string }[])
                .map((c) => c.name)
                .filter(Boolean)
                .join(", ") || "—"
            : "—",
        },
        {
          label: "Differentiation",
          value:
            (steps.competitorIntel?.data?.differentiation as string) || "—",
        },
      ],
    },
    {
      key: "adPreferences",
      label: "Ad Preferences",
      icon: <Megaphone className="h-4 w-4" />,
      items: [
        {
          label: "Tone",
          value: (steps.adPreferences?.data?.toneOfVoice as string) || "—",
        },
        {
          label: "Budget",
          value: (steps.adPreferences?.data?.monthlyBudget as string) || "—",
        },
        {
          label: "Goal",
          value: (steps.adPreferences?.data?.primaryGoal as string) || "—",
        },
      ],
    },
  ];

  if (completedAt) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-green-light)]">
          <Check className="h-8 w-8 text-[var(--color-green)]" />
        </div>
        <h2 className="text-lg font-semibold">Onboarding Complete</h2>
        <p className="mt-2 text-sm text-[var(--color-body-text)]">
          Your setup is finished. The StorageAds team is building your campaigns now.
        </p>
        <div
          className="mt-4 mx-auto max-w-sm rounded-lg px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: "var(--bg-hi)", color: "var(--color-dark)" }}
        >
          Your campaigns will be live within 48 hours.
        </div>
        <p className="mx-auto mt-6 max-w-sm text-sm text-[var(--color-body-text)]">
          Your facility tools are open now. Make ads, build landing pages, and manage your Google listing while we
          build.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <a
            href="/portal/tools"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-dark)] px-6 py-3 text-sm font-semibold text-[var(--color-light)] transition-colors hover:opacity-90"
          >
            Open Facility Tools
          </a>
          <a href="/portal" className="text-sm font-medium text-[var(--color-body-text)] hover:text-[var(--color-dark)]">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-body-text)]">
        Review your information below. Go back to any step to make changes.
      </p>

      {reviewSections.map((section) => {
        const isComplete = steps[section.key]?.completed;
        return (
          <div
            key={section.key}
            className={`rounded-lg border p-4 ${
              isComplete
                ? "border-[var(--color-green)]/20 bg-[var(--color-green-light)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-hi)]"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className={isComplete ? "text-[var(--color-green)]" : "text-[var(--color-mid-gray)]"}>
                {section.icon}
              </span>
              <h3 className="text-sm font-medium">{section.label}</h3>
              {isComplete ? (
                <Check className="ml-auto h-4 w-4 text-[var(--color-green)]" />
              ) : (
                <span className="ml-auto text-[10px] text-[var(--color-mid-gray)]">
                  Incomplete
                </span>
              )}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-[var(--color-mid-gray)]">{item.label}</span>
                  <span className="max-w-[60%] truncate text-right text-[var(--color-body-text)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {allComplete ? (
        <div className="rounded-lg bg-[var(--color-green-light)] p-4 text-center">
          <Check className="mx-auto mb-2 h-6 w-6 text-[var(--color-green)]" />
          <p className="text-sm font-medium text-[var(--color-green)]">
            All steps complete. Your setup is submitted.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--bg-hi)] p-4 text-center">
          <p className="text-sm text-[var(--color-body-text)]">
            Complete all steps above to finish onboarding.
          </p>
        </div>
      )}
    </div>
  );
}
