"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IntakeWizard } from "@/components/intake/intake-wizard";
import { DIAGNOSTIC_STEPS, POPUP_STEPS } from "@/lib/intake/questions";
import { intakePhone, PHONE_CLIENT_ERROR, PHONE_HINT, PHONE_PLACEHOLDER } from "@/lib/intake/phone";

const INK = "#16161A";
const INSTRUCTION = "#525766";

interface Created {
  facilityId: string;
  intakeToken: string;
}

export function DiagnosticForm() {
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<Created | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState("");
  const [needEmail, setNeedEmail] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const finishing = useRef(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("t");
    if (!token) {
      setReady(true);
      return;
    }
    fetch(`/api/audit-form?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("That link doesn't match a lead.");
        return res.json();
      })
      .then((data) => {
        setIds({ facilityId: data.facilityId, intakeToken: token });
        setAnswers(data.answers || {});
        setEmail(data.email || "");
        setNeedEmail(!data.email);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't open that lead."))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !ids || needEmail || done || finishing.current) return;
    const pending = [...POPUP_STEPS, ...DIAGNOSTIC_STEPS].filter((step) => {
      const value = answers?.[step.id];
      if (typeof value === "string" && value.trim()) return false;
      if (step.id === "facility" && answers?.facility) return false;
      return true;
    });
    if (pending.length > 0) return;
    finishing.current = true;
    finish(ids, email).catch((err) => {
      finishing.current = false;
      setError(err instanceof Error ? err.message : "Couldn't finish.");
    });
  }, [ready, ids, needEmail, done, answers, email]);

  const steps = useMemo(() => {
    const all = [...POPUP_STEPS, ...DIAGNOSTIC_STEPS];
    if (!answers) return all;
    return all.filter((step) => {
      const value = answers[step.id];
      if (typeof value === "string" && value.trim()) return false;
      if (step.id === "facility" && answers.facility) return false;
      return true;
    });
  }, [answers]);

  async function finish(current: Created, nextEmail: string) {
    setError(null);
    const res = await fetch("/api/diagnostic-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "finish",
        facilityId: current.facilityId,
        intakeToken: current.intakeToken,
        email: nextEmail,
        website_url: website,
      }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || "Couldn't finish. Your answers are saved.");
    setDone(true);
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-5 py-10" style={{ background: "#FFFFFF", color: INK }}>
      <Link href="/" className="text-sm font-semibold" style={{ color: INK }}>
        storageads
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider" style={{ color: INSTRUCTION }}>
        Free facility audit
      </p>

      {!ready ? (
        <p className="mt-6 text-sm" style={{ color: INSTRUCTION }}>
          Opening…
        </p>
      ) : done ? (
        <div className="mt-4">
          <h1
            className="text-[1.7rem] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
          >
            We're writing it now.
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "#3F4350" }}>
            {email
              ? `It will land at ${email}. If it doesn't show up, it stays in the Pipeline as not delivered, and we can send it again.`
              : "We don't have an email, so this one stays in the Pipeline until we can reach you."}
          </p>
        </div>
      ) : needEmail && ids ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
              setError("That email doesn't look right. You can leave it blank.");
              return;
            }
            setNeedEmail(false);
          }}
        >
          <h1
            className="text-[1.5rem] font-extrabold leading-tight"
            style={{ fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
          >
            Where should we send the audit?
          </h1>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="input-field w-full"
            style={{ fontSize: 16 }}
          />
          <button type="submit" className="btn-primary w-full" style={{ minHeight: 48 }}>
            Continue
          </button>
          {error && <p className="text-xs" style={{ color: "var(--color-red, #c0452b)" }}>{error}</p>}
        </form>
      ) : ids ? (
        <div className="mt-4">
          <IntakeWizard
            steps={steps}
            showContact={false}
            existing={ids}
            initialAnswers={answers}
            finishLabel="Send my audit"
            onCreate={async () => ids}
            onFinished={async (current) => {
              try {
                await finish(current, email);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Couldn't finish.");
              }
            }}
          />
          {error && <p className="mt-3 text-xs" style={{ color: "var(--color-red, #c0452b)" }}>{error}</p>}
        </div>
      ) : (
        <ColdStart
          website={website}
          setWebsite={setWebsite}
          onCreated={(created, nextEmail) => {
            setIds(created);
            setEmail(nextEmail);
            setAnswers({});
          }}
        />
      )}
    </div>
  );
}

function ColdStart({
  website,
  setWebsite,
  onCreated,
}: {
  website: string;
  setWebsite: (v: string) => void;
  onCreated: (ids: Created, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !intakePhone(phone))) {
      setError("Name, and an email or a phone number.");
      return;
    }
    if (phone.trim() && !intakePhone(phone)) {
      setError(PHONE_CLIENT_ERROR);
      return;
    }
    if (!consent) {
      setError("Check the box so we can call or text you.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/diagnostic-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "start",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          website_url: website,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.facilityId) {
        throw new Error(payload?.error || "Couldn't save that.");
      }
      onCreated(
        { facilityId: payload.facilityId, intakeToken: payload.intakeToken },
        email.trim()
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
      <h1
        className="text-[1.7rem] font-extrabold leading-tight"
        style={{ fontFamily: "var(--font-manrope), Manrope, sans-serif" }}
      >
        Tell us about the facility.
      </h1>
      <p className="text-sm leading-relaxed" style={{ color: INSTRUCTION }}>
        One question at a time after this. About two minutes. Skip anything you don't know.
      </p>
      <input
        name="website_url"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: "absolute", left: "-10000px", width: 1, height: 1, opacity: 0 }}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
        className="input-field w-full"
        style={{ fontSize: 16 }}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for the audit"
        autoComplete="email"
        inputMode="email"
        className="input-field w-full"
        style={{ fontSize: 16 }}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={PHONE_PLACEHOLDER}
        autoComplete="tel"
        inputMode="tel"
        className="input-field w-full"
        style={{ fontSize: 16 }}
      />
      <p className="text-xs" style={{ color: INSTRUCTION }}>{PHONE_HINT}</p>
      <label className="flex items-start gap-2 text-xs" style={{ color: INSTRUCTION }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>I agree StorageAds can call or text me about this. Reply STOP to opt out.</span>
      </label>
      <button type="submit" disabled={busy} className="btn-primary w-full" style={{ minHeight: 52 }}>
        {busy ? "Saving…" : "Start the audit"}
      </button>
      {error && <p className="text-xs" style={{ color: "var(--color-red, #c0452b)" }}>{error}</p>}
    </form>
  );
}
