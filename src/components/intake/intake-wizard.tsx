"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  reactionFor,
  type FacilityAnswer,
  type IntakeStep,
} from "@/lib/intake/questions";
import {
  intakePhone,
  PHONE_CLIENT_ERROR,
  PHONE_HINT,
  PHONE_PLACEHOLDER,
} from "@/lib/intake/phone";

const INK = "#16161A";
const INSTRUCTION = "#525766";
const SOFT = "#F0F0F3";

interface Created {
  facilityId: string;
  intakeToken: string;
}

export function IntakeWizard({
  steps,
  showContact,
  initialAnswers,
  onCreate,
  onFinished,
  finishLabel = "That's enough",
}: {
  steps: IntakeStep[];
  showContact: boolean;
  initialAnswers?: Record<string, unknown> | null;
  onCreate: (input: {
    name: string;
    phone: string;
    consent: boolean;
    website: string;
    elapsedSeconds: number;
  }) => Promise<Created>;
  onFinished: (ids: Created) => void;
  finishLabel?: string;
}) {
  const started = useRef(Date.now());
  const [phase, setPhase] = useState<"contact" | "questions">(
    showContact ? "contact" : "questions"
  );
  const [ids, setIds] = useState<Created | null>(null);
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);

  const visible = steps.filter((step) => !alreadyAnswered(initialAnswers, step.id));
  const step = visible[index];
  const total = (showContact ? 1 : 0) + visible.length;
  const current = phase === "contact" ? 1 : (showContact ? 1 : 0) + index + 1;

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    };
  }, []);

  function elapsed() {
    return Math.round((Date.now() - started.current) / 1000);
  }

  async function save(target: Created, answers: Record<string, unknown>) {
    const res = await fetch("/api/audit-form", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: target.facilityId,
        intakeToken: target.intakeToken,
        answers,
        elapsedSeconds: elapsed(),
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || "Couldn't save that. You can skip it.");
    }
  }

  function goNext(target: Created) {
    setReaction(null);
    setPicked(null);
    if (index + 1 >= visible.length) onFinished(target);
    else setIndex((n) => n + 1);
  }

  function scheduleNext(target: Created) {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => goNext(target), 900);
  }

  async function choose(value: string) {
    if (!ids || !step || busy) return;
    setError(null);
    setPicked(value);
    setReaction(reactionFor(step.id, value));
    setBusy(true);
    try {
      await save(ids, { [step.id]: value });
      scheduleNext(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (!ids || !step) return;
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    setError(null);
    setBusy(true);
    try {
      await save(ids, { [step.id]: null });
      goNext(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim() || !intakePhone(phone) || !consent) {
      setError(
        !consent
          ? "Check the box so we can call or text you."
          : !intakePhone(phone)
            ? PHONE_CLIENT_ERROR
            : "Name and phone are required."
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate({
        name: name.trim(),
        phone: phone.trim(),
        consent: true,
        website,
        elapsedSeconds: elapsed(),
      });
      setIds(created);
      if (visible.length === 0) onFinished(created);
      else setPhase("questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 h-0.5 w-full" style={{ background: SOFT }} aria-hidden>
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, Math.round((current / Math.max(total, 1)) * 100))}%`,
            background: INK,
          }}
        />
      </div>
      <p className="sr-only">
        Question {current} of {total}
      </p>

      {phase === "contact" ? (
        <form onSubmit={submitContact} className="space-y-3" noValidate>
          <h2
            id="homepage-lead-title"
            className="mb-2 text-[1.65rem] font-extrabold leading-tight tracking-tight"
            style={{ color: INK, fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
          >
            Leave your name and number.
          </h2>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: INSTRUCTION }}>
            We&apos;ll call and walk through what this would do at your facility.
          </p>
          <input
            type="text"
            name="website_url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-10000px",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
          <label htmlFor="homepage-lead-name" className="sr-only">
            Your name
          </label>
          <input
            id="homepage-lead-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            autoCapitalize="words"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <label htmlFor="homepage-lead-phone" className="sr-only">
            Phone
          </label>
          <input
            id="homepage-lead-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="tel"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <p className="text-xs" style={{ color: INSTRUCTION }}>
            {PHONE_HINT}
          </p>
          <label className="flex items-start gap-2 text-xs" style={{ color: INSTRUCTION }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree StorageAds can call or text me about this offer. Reply STOP to opt out.
              Message and data rates may apply.
            </span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn-primary flex w-full items-center justify-center gap-2"
            style={{ minHeight: 52 }}
          >
            {busy ? "Saving…" : "Get my free month"}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
          {error && <ErrorText text={error} />}
        </form>
      ) : step ? (
        <Question
          step={step}
          ids={ids}
          picked={picked}
          reaction={reaction}
          busy={busy}
          error={error}
          onChoose={choose}
          onSkip={skip}
          onFacility={async (facility) => {
            if (!ids) return;
            setBusy(true);
            setError(null);
            try {
              await save(ids, { facility });
              setReaction(reactionFor("facility", facility.name));
              scheduleNext(ids);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save that.");
            } finally {
              setBusy(false);
            }
          }}
          onText={async (text) => {
            if (!ids || !step) return;
            setBusy(true);
            setError(null);
            try {
              await save(ids, { [step.id]: text });
              setReaction(reactionFor(step.id, text));
              scheduleNext(ids);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't save that.");
            } finally {
              setBusy(false);
            }
          }}
          onNext={() => ids && goNext(ids)}
        />
      ) : null}
      {phase === "questions" && reaction && (
        <button
          type="button"
          className="mt-3 w-full text-sm font-semibold"
          style={{ color: INK, minHeight: 44 }}
          onClick={() => ids && goNext(ids)}
        >
          {index + 1 >= visible.length ? finishLabel : "Next"}
        </button>
      )}
    </div>
  );
}

function alreadyAnswered(answers: Record<string, unknown> | null | undefined, id: string): boolean {
  if (!answers) return false;
  const value = answers[id];
  if (typeof value === "string" && value.trim()) return true;
  if (id === "facility" && answers.facility && typeof answers.facility === "object") return true;
  return false;
}

function ErrorText({ text }: { text: string }) {
  return (
    <p role="alert" className="text-center text-xs" style={{ color: "var(--color-red, #c0452b)" }}>
      {text}
    </p>
  );
}

function Question({
  step,
  ids,
  picked,
  reaction,
  busy,
  error,
  onChoose,
  onSkip,
  onFacility,
  onText,
  onNext,
}: {
  step: IntakeStep;
  ids: Created | null;
  picked: string | null;
  reaction: string | null;
  busy: boolean;
  error: string | null;
  onChoose: (value: string) => void;
  onSkip: () => void;
  onFacility: (facility: FacilityAnswer) => Promise<void>;
  onText: (text: string) => Promise<void>;
  onNext: () => void;
}) {
  return (
    <div>
      <h2
        id="homepage-lead-title"
        className="mb-1 text-[1.45rem] font-extrabold leading-tight tracking-tight"
        style={{ color: INK, fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
      >
        {step.prompt}
      </h2>
      {step.hint && (
        <p className="mb-4 text-sm" style={{ color: INSTRUCTION }}>
          {step.hint}
        </p>
      )}
      {!step.hint && <div className="mb-4" />}

      {step.kind === "choice" && (
        <div className="flex flex-col gap-2">
          {(step.options || []).map((opt) => {
            const on = picked === opt.label;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={busy || !ids}
                onClick={() => onChoose(opt.label)}
                className="w-full px-4 text-left text-base font-semibold"
                style={{
                  minHeight: 52,
                  color: on ? "#FFFFFF" : INK,
                  background: on ? INK : "#FFFFFF",
                  border: `1px solid ${INK}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {step.kind === "multi" && (
        <Multi
          step={step}
          disabled={busy || !ids}
          onSave={onChoose}
        />
      )}

      {step.kind === "pms" && (
        <Pms step={step} disabled={busy || !ids} onSave={onChoose} />
      )}

      {step.kind === "facility" && <FacilitySearch disabled={busy || !ids} onSave={onFacility} />}

      {step.kind === "text" && (
        <TextAnswer
          placeholder={step.placeholder}
          disabled={busy || !ids}
          onSave={onText}
          onSkip={onSkip}
        />
      )}

      {reaction && (
        <p className="mt-4 text-sm leading-relaxed" style={{ color: INSTRUCTION }} role="status">
          {reaction}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <ErrorText text={error} />
        </div>
      )}

      {step.kind !== "text" && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 w-full text-sm"
          style={{ color: INSTRUCTION, minHeight: 44 }}
        >
          Skip
        </button>
      )}
      {reaction && (
        <span className="sr-only">
          <button type="button" onClick={onNext}>
            Continue
          </button>
        </span>
      )}
    </div>
  );
}

function Multi({
  step,
  disabled,
  onSave,
}: {
  step: IntakeStep;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  function toggle(label: string) {
    setPicked((cur) => (cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label]));
  }
  return (
    <div>
      <div className="flex flex-col gap-2">
        {(step.options || []).map((opt) => {
          const on = picked.includes(opt.label);
          return (
            <button
              key={opt.label}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.label)}
              className="w-full px-4 text-left text-base font-semibold"
              style={{
                minHeight: 52,
                color: on ? "#FFFFFF" : INK,
                background: on ? INK : "#FFFFFF",
                border: `1px solid ${INK}`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled || picked.length === 0}
        onClick={() => onSave(picked.join(" · "))}
        className="btn-primary mt-3 w-full"
        style={{ minHeight: 48 }}
      >
        Save
      </button>
    </div>
  );
}

function Pms({
  step,
  disabled,
  onSave,
}: {
  step: IntakeStep;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [other, setOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {(step.options || []).map((opt) => (
        <button
          key={opt.label}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (opt.label === "Other") {
              setShowOther(true);
              return;
            }
            onSave(opt.label);
          }}
          className="w-full px-4 text-left text-base font-semibold"
          style={{
            minHeight: 52,
            color: INK,
            background: "#FFFFFF",
            border: `1px solid ${INK}`,
          }}
        >
          {opt.label === "Other" ? "Other (type it)" : opt.label}
        </button>
      ))}
      {showOther && (
        <form
          className="mt-1 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim()) onSave(`Other: ${other.trim()}`);
          }}
        >
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="PMS name"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="btn-primary w-full" style={{ minHeight: 48 }}>
            Save
          </button>
        </form>
      )}
    </div>
  );
}

function TextAnswer({
  placeholder,
  disabled,
  onSave,
  onSkip,
}: {
  placeholder?: string;
  disabled: boolean;
  onSave: (text: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) void onSave(text.trim());
        else onSkip();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={500}
        className="input-field w-full"
        style={{ fontSize: 16 }}
      />
      <button
        type="submit"
        disabled={disabled}
        className="btn-primary mt-3 w-full"
        style={{ minHeight: 48 }}
      >
        {text.trim() ? "Save" : "Skip"}
      </button>
    </form>
  );
}

function FacilitySearch({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (facility: FacilityAnswer) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ placeId: string; name: string; address: string }>>([]);
  const [typed, setTyped] = useState(false);
  const [fallback, setFallback] = useState({ name: "", city: "", website: "" });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/places-suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json().catch(() => null);
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function pick(placeId: string, name: string, address: string) {
    try {
      const res = await fetch("/api/places-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json().catch(() => null);
      const place = data?.place;
      await onSave({
        name: place?.name || name,
        address: place?.address || address,
        website: place?.website || undefined,
        placeId,
        country: place?.country || undefined,
        rating: place?.rating ?? null,
        reviewCount: place?.reviewCount ?? null,
      });
    } catch {
      await onSave({ name, address, placeId, typed: false });
    }
  }

  return (
    <div>
      <label htmlFor="facility-search" className="sr-only">
        Start typing your facility name
      </label>
      <input
        id="facility-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing your facility name"
        autoComplete="organization"
        className="input-field w-full"
        style={{ fontSize: 16 }}
      />
      {searching && (
        <p className="mt-2 text-xs" style={{ color: INSTRUCTION }}>
          Looking…
        </p>
      )}
      <div className="mt-2 flex flex-col gap-2">
        {results.map((r) => (
          <button
            key={r.placeId}
            type="button"
            disabled={disabled}
            onClick={() => pick(r.placeId, r.name, r.address)}
            className="w-full px-4 py-3 text-left"
            style={{ minHeight: 52, border: `1px solid ${INK}`, background: "#FFFFFF" }}
          >
            <span className="block text-base font-semibold" style={{ color: INK }}>
              {r.name}
            </span>
            {r.address && (
              <span className="mt-0.5 block text-xs" style={{ color: INSTRUCTION }}>
                {r.address}
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 text-sm"
        style={{ color: INSTRUCTION, minHeight: 44 }}
        onClick={() => setTyped((v) => !v)}
      >
        I don&apos;t see it
      </button>
      {typed && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fallback.name.trim()) return;
            void onSave({
              name: fallback.name.trim(),
              city: fallback.city.trim(),
              website: fallback.website.trim() || undefined,
              typed: true,
            });
          }}
        >
          <input
            value={fallback.name}
            onChange={(e) => setFallback({ ...fallback, name: e.target.value })}
            placeholder="Facility name"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <input
            value={fallback.city}
            onChange={(e) => setFallback({ ...fallback, city: e.target.value })}
            placeholder="City, region, country"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <input
            value={fallback.website}
            onChange={(e) => setFallback({ ...fallback, website: e.target.value })}
            placeholder="Website (optional)"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="btn-primary w-full" style={{ minHeight: 48 }} disabled={disabled}>
            Use this
          </button>
        </form>
      )}
    </div>
  );
}
