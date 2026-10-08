"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * "How did you first find us?" — the page behind the link in a new tenant's
 * email. One tap records the answer. Nothing is recorded by opening the link,
 * so a mail scanner can't answer for anyone.
 *
 * Divs, not paragraphs, and sizes set inline: the site's global rules thin
 * every <p> and shrink form text.
 */

interface Loaded {
  facilityName: string;
  answers: { key: string; label: string }[];
  answer: string | null;
}

function HeardInner() {
  const token = useSearchParams().get("t") ?? "";
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/heard?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Loaded & { error?: string };
        if (cancel) return;
        if (!res.ok) setFailed(body.error || "This link has expired.");
        else {
          setData(body);
          setSaved(body.answer);
        }
      })
      .catch(() => !cancel && setFailed("That didn't load. Check your connection and try again."));
    return () => {
      cancel = true;
    };
  }, [token]);

  async function choose(key: string) {
    setSaving(key);
    setFailed(null);
    try {
      const res = await fetch("/api/heard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, answer: key }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "That didn't save. Try again.");
      setSaved(key);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(null);
    }
  }

  const chosen = data?.answers.find((a) => a.key === saved);

  return (
    <div className="min-h-[100dvh] bg-white px-5 py-12 text-[#141413] sm:py-20">
      <div className="mx-auto max-w-md">
        {!data && !failed && <div style={{ fontSize: 16 }} className="font-semibold">Loading…</div>}
        {failed && !data && (
          <div role="alert" className="border-l-4 border-[#A12A2A] pl-3 font-bold" style={{ fontSize: 17 }}>
            {failed}
          </div>
        )}
        {data && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#141413]/75">{data.facilityName}</div>
            <h1 className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight sm:text-[36px]">
              {chosen ? "Thank you." : "How did you first find us?"}
            </h1>
            {chosen ? (
              <div className="mt-3 font-semibold" style={{ fontSize: 17 }}>
                You said: <b className="font-extrabold">{chosen.label}</b>. That’s all we needed. Tap another answer if
                that’s not right.
              </div>
            ) : (
              <div className="mt-3 font-semibold" style={{ fontSize: 17 }}>
                One tap. It helps {data.facilityName} know what’s working.
              </div>
            )}
            <div className="mt-6 grid gap-2.5">
              {data.answers.map((a, i) => {
                const on = saved === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    disabled={!!saving}
                    onClick={() => void choose(a.key)}
                    aria-pressed={on}
                    data-fill={String((i % 6) + 1)}
                    className={`flex min-h-[56px] items-center justify-between px-4 text-left font-extrabold ${
                      on ? "bg-[#1E3C74] text-white" : "act-fill"
                    }`}
                    style={{ fontSize: 17 }}
                  >
                    {a.label}
                    {saving === a.key ? <span className="text-[13px] font-bold">Saving…</span> : on ? <span aria-hidden>✓</span> : null}
                  </button>
                );
              })}
            </div>
            {failed && (
              <div role="alert" className="mt-4 border-l-4 border-[#A12A2A] pl-3 font-bold" style={{ fontSize: 15 }}>
                {failed}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HeardPage() {
  return (
    <Suspense fallback={null}>
      <HeardInner />
    </Suspense>
  );
}
