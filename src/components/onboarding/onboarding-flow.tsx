"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Trash2, Upload } from "lucide-react";
import { usePortal } from "@/components/portal/portal-shell";
import { useFlow } from "@/components/flow/flow-context";
import { ActionFill } from "@/components/ontology/action-fill";
import { TypeGlyph } from "@/components/ontology/object-mark";
import { FacilityInstrument } from "@/components/ontology/facility-instrument";
import { GoalPanel, useGoalContext, useStartCampaign } from "@/components/campaigns/campaigns-home";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import { FigureOne, Question, SkyBand } from "@/components/design/dl003/ui";
import type { ObjectTypeKey } from "@/lib/ontology/types";

/**
 * Regions are divs, not <section>s, and text blocks are divs, not <p>s: the
 * site-wide .urbit-landing rules repaint sections and thin every paragraph.
 *
 * The short onboarding: what StorageAds should get you, the facility, the
 * units, and then the facility as StorageAds sees it with a campaign built
 * for the goal. About three minutes to see the facility; the campaign opens
 * in the builder. It saves into the same onboarding record the detailed form
 * uses (primary goal, selling points, unit mix), so everything that reads
 * those keeps working; the detailed form stays as optional brand details.
 */

type StepData = Record<string, unknown>;
type Steps = Record<string, { completed: boolean; data: StepData }>;

const STEPS = ["Goal", "Facility", "Units", "Your facility"] as const;

const OUTCOMES: { key: string; title: string; line: string; type: ObjectTypeKey }[] = [
  { key: "fill-units", title: "Fill empty units", line: "Mostly full, with a few sizes sitting empty.", type: "units" },
  { key: "lease-up", title: "Lease up a new facility", line: "Most of the building is still empty.", type: "campaigns" },
  { key: "seasonal-push", title: "Push a season", line: "Get ahead of a busy or slow stretch with an offer.", type: "offers" },
];

const COMMON_SIZES = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"];

interface UnitRow {
  size: string;
  climate: boolean;
  total: string;
  empty: string;
  rate: string;
}

const blankRow = (size = ""): UnitRow => ({ size, climate: false, total: "", empty: "", rate: "" });

function monthName(): string {
  return new Date().toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

/** Whole, non-negative number from a field, or NaN when it isn't one. */
function count(value: string): number {
  if (!/^\d+$/.test(value.trim())) return NaN;
  return Number(value.trim());
}

function rowProblem(row: UnitRow): string | null {
  if (!row.size.trim()) return "Name the size (for example 10x10).";
  const total = count(row.total);
  const empty = count(row.empty);
  const rate = Number(row.rate);
  if (!Number.isFinite(total) || total <= 0) return `How many ${row.size} units are there?`;
  if (!Number.isFinite(empty)) return `How many ${row.size} units are empty? (0 is fine)`;
  if (empty > total) return `${row.size}: more empty than there are.`;
  if (!Number.isFinite(rate) || rate <= 0) return `What does a ${row.size} rent for, per month?`;
  return null;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">{children}</div>;
}

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="alert" className="mt-3 border-l-2 border-[var(--color-red)] pl-3 text-[14px] font-semibold text-[var(--ic-ink)]">
      {text}
    </div>
  );
}

function StepBar({ step, done, onGo }: { step: number; done: number; onGo: (i: number) => void }) {
  return (
    <ol className="grid grid-cols-2 border border-[var(--ic-ink)] bg-[var(--ic-pane)] sm:grid-cols-4" aria-label="Setup steps">
      {STEPS.map((label, i) => {
        const current = i === step;
        const reachable = i <= done;
        return (
          <li key={label} className="border-b border-r border-[var(--ic-ink)]/20 last:border-r-0 sm:border-b-0">
            <button
              type="button"
              disabled={!reachable || current}
              onClick={() => onGo(i)}
              aria-current={current ? "step" : undefined}
              className={`ic-label flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-[10.5px] ${
                current ? "bg-[var(--ic-selected)] text-white" : reachable ? "text-[var(--ic-ink)] hover:bg-[var(--ic-soft)]" : "text-[var(--ic-secondary)]"
              }`}
            >
              {i < done && !current ? <Check className="h-3.5 w-3.5" aria-hidden /> : <span>{i + 1} ·</span>}
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingFlow() {
  const { session, client, authFetch } = usePortal();
  const flow = useFlow();
  const router = useRouter();
  const sample = isPortalDemo();
  const [steps, setSteps] = useState<Steps | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Step 1
  const [outcome, setOutcome] = useState<string>("");
  const [moveIns, setMoveIns] = useState<string>("");
  // Step 2
  const [points, setPoints] = useState<string[]>(["", "", ""]);
  // Step 3
  const [rows, setRows] = useState<UnitRow[]>([blankRow("10x10"), blankRow("10x20")]);
  const [unitsMode, setUnitsMode] = useState<"type" | "upload" | null>(null);
  const [upload, setUpload] = useState<{ state: "idle" | "sending" | "done" | "held" | "error"; note?: string }>({ state: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await authFetch("/api/client-onboarding");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { onboarding: { steps: Steps } };
      const s = json.onboarding.steps ?? {};
      setSteps(s);
      const goal = String((s.adPreferences?.data as StepData | undefined)?.primaryGoal ?? "");
      setOutcome(goal);
      const sp = (s.facilityDetails?.data as StepData | undefined)?.sellingPoints;
      if (Array.isArray(sp) && sp.length) setPoints([...sp.map(String), "", "", ""].slice(0, 3));
    } catch {
      setLoadError(true);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  // The goal number starts from what's already set (this month's, or the default).
  const pace = flow?.pace ?? null;
  useEffect(() => {
    if (moveIns) return;
    const known = pace && pace.target > 0 ? pace.target : client.monthlyGoal > 0 ? client.monthlyGoal : 0;
    if (known > 0) setMoveIns(String(known));
  }, [pace, client.monthlyGoal, moveIns]);

  const saveStep = useCallback(
    async (key: string, data: StepData, finish = false) => {
      const res = await authFetch("/api/client-onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: key, data, ...(finish ? { finish: true } : {}) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Couldn't save that. Try again.");
      const next = (json as { onboarding?: { steps?: Steps } }).onboarding?.steps;
      if (next) setSteps(next);
    },
    [authFetch],
  );

  const finish = useCallback(async () => {
    const res = await authFetch("/api/client-onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finish: true }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error || "Couldn't finish setup. Try again.");
    }
  }, [authFetch]);

  const go = (i: number) => {
    setProblem(null);
    setStep(i);
    setDone((d) => Math.max(d, i));
    window.scrollTo({ top: 0 });
  };

  /* ─── step 1: the goal ─── */
  async function saveGoal() {
    setProblem(null);
    const n = count(moveIns);
    if (!outcome) return setProblem("Pick what StorageAds should get you.");
    if (!Number.isFinite(n) || n <= 0) return setProblem(`How many move-ins do you want in ${monthName()}?`);
    setSaving(true);
    try {
      const prior = (steps?.adPreferences?.data as StepData | undefined) ?? {};
      await saveStep("adPreferences", { ...prior, primaryGoal: outcome });
      const res = await fetch("/api/client-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email, accessCode: session.accessCode, monthlyGoal: n }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Couldn't save the goal. Try again.");
      }
      flow?.refresh();
      go(1);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── step 2: the facility ─── */
  async function saveFacility() {
    setProblem(null);
    const typed = points.map((p) => p.trim()).filter(Boolean);
    if (!typed.length) return go(2);
    setSaving(true);
    try {
      const prior = (steps?.facilityDetails?.data as StepData | undefined) ?? {};
      await saveStep("facilityDetails", { ...prior, sellingPoints: typed });
      go(2);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ─── step 3: the units ─── */
  const knownUnits = useMemo(() => (flow?.ontology?.objects ?? []).filter((o) => o.type === "units"), [flow?.ontology]);

  async function saveTyped() {
    setProblem(null);
    const filled = rows.filter((r) => r.size.trim() || r.total || r.empty || r.rate);
    if (!filled.length) return setProblem("Add at least one size, or upload a file instead.");
    const bad = filled.map(rowProblem).find(Boolean);
    if (bad) return setProblem(bad);
    setSaving(true);
    try {
      await saveStep("unitMix", {
        units: filled.map((r) => {
          const size = r.size.trim().toLowerCase().replace(/\s*[×x]\s*/, "x");
          return {
            type: r.climate ? `${size} Climate` : size,
            size,
            monthlyRate: Number(r.rate),
            availableCount: count(r.empty),
            totalCount: count(r.total),
          };
        }),
        specials: String((steps?.unitMix?.data as StepData | undefined)?.specials ?? ""),
      });
      flow?.refresh();
      go(3);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't save the sizes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendFile(file: File) {
    setProblem(null);
    if (!/\.csv$/i.test(file.name)) {
      setUpload({ state: "error", note: "Send a CSV export (your PMS can make one). PDFs and spreadsheets go through Upload, and our team reads them." });
      return;
    }
    setUpload({ state: "sending" });
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("reportType", "csv");
      const res = await authFetch("/api/portal-upload", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as { status?: string; notes?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "The upload didn't go through. Try again.");
      if (json.status === "processed") {
        setUpload({ state: "done", note: json.notes });
        flow?.refresh();
      } else {
        setUpload({ state: "held", note: json.notes });
      }
    } catch (err) {
      setUpload({ state: "error", note: err instanceof Error ? err.message : "The upload didn't go through. Try again." });
    }
  }

  /* ─── step 4: the facility, and a campaign for it ─── */
  const ctx = useGoalContext(flow?.ontology ?? null, pace, sample);
  const { start, creating, error: startError } = useStartCampaign(client.facilityId);
  const [leaving, setLeaving] = useState(false);

  async function finishTo(href: string) {
    setProblem(null);
    setLeaving(true);
    try {
      await finish();
      flow?.refresh();
      router.push(href);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't finish setup. Try again.");
      setLeaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div role="alert" className="border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-5">
          <div className="text-[16px] font-extrabold text-[var(--ic-ink)]">Couldn&apos;t open setup.</div>
          <button type="button" onClick={() => void load()} className="mt-1 text-[14px] font-extrabold underline underline-offset-4">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!steps) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[14px] font-semibold text-[var(--ic-secondary)]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Opening setup…
      </div>
    );
  }

  // Inputs take their size inline: the site-wide `.urbit-landing input` rule
  // sets 13px and outranks utility classes. (Phones keep their 16px rule.)
  const fieldSize = { fontSize: 15 } as const;
  const field = "w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-[15px] font-semibold text-[var(--ic-ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--ic-selected)]";

  return (
    <div className="pb-16">
      {sample && (
        <div data-dl003="setup">
          <SkyBand variant="hero" short label="003 · A sky · welcome band" />
          <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4">
            <FigureOne />
            <Question
              sage
              kicker="003 · sage · plain reassurance"
              q="We're not spending anything yet."
              a="Most independent operators start here. Nothing goes live until you publish a campaign, and you still mark each move-in yourself."
            />
          </div>
        </div>
      )}
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 md:pt-8">
      <Label>Setup · about 3 minutes to see your facility</Label>
      <div className="mt-2">
        <StepBar step={step} done={done} onGo={go} />
      </div>

      {step === 0 && (
        <div role="region" className="mt-6" aria-labelledby="ob-goal">
          <h1 id="ob-goal" className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ic-ink)] sm:text-[34px]">
            What should StorageAds get you?
          </h1>
          <div className="mt-1 text-[15px] font-semibold text-[var(--ic-secondary)]">Everything after this is built toward it.</div>
          <div role="radiogroup" aria-label="Outcome" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OUTCOMES.map((o) => {
              const on = outcome === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOutcome(o.key)}
                  className={`border bg-[var(--ic-pane)] p-4 text-left ${
                    on ? "border-[var(--ic-selected)] outline outline-[3px] outline-offset-[-1px] outline-[var(--ic-selected)]" : "border-[var(--ic-ink)] hover:bg-[var(--ic-soft)]"
                  }`}
                >
                  <TypeGlyph type={o.type} className="h-6 w-6" />
                  <div className="mt-2 text-[17px] font-extrabold leading-tight text-[var(--ic-ink)]">{o.title}</div>
                  <div className="mt-1 text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">{o.line}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
            <label htmlFor="ob-moveins" className="block text-[17px] font-extrabold text-[var(--ic-ink)]">
              How many move-ins do you want in {monthName()}?
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                data-fill="4"
                className="act-fill flex h-12 w-12 items-center justify-center"
                aria-label="One fewer"
                onClick={() => setMoveIns((v) => String(Math.max(1, (count(v) || 1) - 1)))}
              >
                <Minus className="h-5 w-5" aria-hidden />
              </button>
              <input
                id="ob-moveins"
                inputMode="numeric"
                value={moveIns}
                onChange={(e) => setMoveIns(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
                placeholder="10"
                style={{ fontSize: 30 }}
                className="h-12 w-28 border border-[var(--ic-ink)] bg-[var(--ic-pane)] text-center text-[30px] font-extrabold tabular-nums text-[var(--ic-selected)] outline-none focus:outline focus:outline-2 focus:outline-[var(--ic-selected)]"
              />
              <button
                type="button"
                data-fill="5"
                className="act-fill flex h-12 w-12 items-center justify-center"
                aria-label="One more"
                onClick={() => setMoveIns((v) => String((count(v) || 0) + 1))}
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="mt-3 text-[13px] font-semibold text-[var(--ic-secondary)]">
              {pace && pace.actual > 0 ? `${pace.actual} so far this month. ` : ""}Every campaign and next move is aimed at it. Change it any time in Settings.
            </div>
          </div>

          <Problem text={problem} />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ActionFill n={0} onClick={() => void saveGoal()}>
              {saving ? "Saving…" : "Next: your facility"}
            </ActionFill>
          </div>
        </div>
      )}

      {step === 1 && (
        <div role="region" className="mt-6" aria-labelledby="ob-facility">
          <h1 id="ob-facility" className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ic-ink)] sm:text-[34px]">
            Is this {client.facilityName}?
          </h1>
          <div className="mt-5 border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
            <dl className="grid grid-cols-1 sm:grid-cols-3">
              {[
                ["Facility", client.facilityName],
                ["Where", client.location || "Not on file yet"],
                ["Units", client.totalUnits ? `${client.totalUnits.toLocaleString("en-US")} in all` : "Not on file yet"],
              ].map(([k, v]) => (
                <div key={k} className="border-b border-[var(--ic-ink)]/15 px-4 py-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <dt>
                    <Label>{k}</Label>
                  </dt>
                  <dd className="mt-0.5 text-[16px] font-extrabold text-[var(--ic-ink)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-2 text-[13px] font-semibold text-[var(--ic-secondary)]">
            Something wrong?{" "}
            <Link href="/portal/messages" className="font-extrabold text-[var(--ic-ink)] underline underline-offset-4">
              Tell us
            </Link>{" "}
            and we&apos;ll fix it.
          </div>

          <div className="mt-6 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
            <div className="text-[17px] font-extrabold text-[var(--ic-ink)]">What makes it the one to pick?</div>
            <div className="mt-0.5 text-[13px] font-semibold text-[var(--ic-secondary)]">
              Optional. Up to three, in your words. They go into every ad and page StorageAds writes.
            </div>
            <div className="mt-3 space-y-2">
              {points.map((p, i) => (
                <input
                  key={i}
                  aria-label={`Reason ${i + 1}`}
                  value={p}
                  maxLength={120}
                  onChange={(e) => setPoints((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={["Drive-up units right off Main Street", "Gate open 6am to 10pm, every day", "Locally owned, a manager on site"][i]}
                  className={field}
                  style={fieldSize}
                />
              ))}
            </div>
          </div>

          <Problem text={problem} />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <ActionFill n={1} onClick={() => void saveFacility()}>
              {saving ? "Saving…" : "Looks right: next, units"}
            </ActionFill>
            <button type="button" onClick={() => go(0)} className="text-[14px] font-extrabold underline underline-offset-4">
              Back
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div role="region" className="mt-6" aria-labelledby="ob-units">
          <h1 id="ob-units" className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ic-ink)] sm:text-[34px]">
            What do you rent?
          </h1>
          <div className="mt-1 text-[15px] font-semibold text-[var(--ic-secondary)]">
            Sizes, how many are empty, and the price. Every suggestion StorageAds makes starts here.
          </div>

          {knownUnits.length > 0 && unitsMode === null ? (
            <div className="mt-5 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4">
              <div className="flex items-center gap-2">
                <TypeGlyph type="units" className="h-6 w-6" />
                <div className="text-[17px] font-extrabold text-[var(--ic-ink)]">
                  We already have {knownUnits.length} {knownUnits.length === 1 ? "size" : "sizes"} for {client.facilityName}.
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {knownUnits.map((u) => (
                  <li key={u.address} className="border border-[var(--ic-ink)]/25 px-2 py-0.5 text-[13px] font-bold text-[var(--ic-ink)]">
                    {u.name} · {u.facts.find((f) => f.label === "Empty")?.value ?? "?"}
                  </li>
                ))}
              </ul>
              {sample && <div className="ic-label mt-2 text-[10px] text-[var(--ic-instruction)]">Sample facility · counts are sample</div>}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <ActionFill n={2} onClick={() => go(3)}>
                  Next: see your facility
                </ActionFill>
                <button type="button" onClick={() => setUnitsMode("type")} className="text-[14px] font-extrabold underline underline-offset-4">
                  Change them
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnitsMode("upload");
                    fileRef.current?.click();
                  }}
                  className={`border bg-[var(--ic-pane)] p-4 text-left ${unitsMode === "upload" ? "outline outline-[3px] outline-offset-[-1px] outline-[var(--ic-selected)]" : "border-[var(--ic-ink)] hover:bg-[var(--ic-soft)]"}`}
                >
                  <Upload className="h-6 w-6 text-[var(--onto-units)]" aria-hidden />
                  <div className="mt-2 text-[17px] font-extrabold text-[var(--ic-ink)]">Upload a CSV from your PMS</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">A unit mix or rent roll export. Clean files import in seconds.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitsMode("type")}
                  className={`border bg-[var(--ic-pane)] p-4 text-left ${unitsMode === "type" ? "outline outline-[3px] outline-offset-[-1px] outline-[var(--ic-selected)]" : "border-[var(--ic-ink)] hover:bg-[var(--ic-soft)]"}`}
                >
                  <TypeGlyph type="units" className="h-6 w-6" />
                  <div className="mt-2 text-[17px] font-extrabold text-[var(--ic-ink)]">Type your main sizes</div>
                  <div className="mt-1 text-[13px] font-semibold text-[var(--ic-secondary)]">Two or three is enough to start. Add the rest later.</div>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Unit mix or rent roll CSV"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void sendFile(file);
                  e.target.value = "";
                }}
              />

              {unitsMode === "upload" && upload.state !== "idle" && (
                <div className="mt-4 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4" role="status">
                  {upload.state === "sending" && (
                    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[var(--ic-ink)]">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading the file…
                    </span>
                  )}
                  {upload.state === "done" && (
                    <>
                      <div className="text-[16px] font-extrabold text-[var(--ic-ink)]">Imported.</div>
                      {upload.note && <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">{upload.note}</div>}
                      <ActionFill n={3} className="mt-3" onClick={() => go(3)}>
                        Next: see your facility
                      </ActionFill>
                    </>
                  )}
                  {upload.state === "held" && (
                    <>
                      <div className="text-[16px] font-extrabold text-[var(--ic-ink)]">Got it. Our team is checking this file.</div>
                      <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">
                        {upload.note ?? "It usually takes a few hours."} Type your main sizes meanwhile so nothing waits on it.
                      </div>
                      <button type="button" onClick={() => setUnitsMode("type")} className="mt-2 text-[14px] font-extrabold underline underline-offset-4">
                        Type them now
                      </button>
                    </>
                  )}
                  {upload.state === "error" && <Problem text={upload.note ?? "The upload didn't go through."} />}
                </div>
              )}

              {unitsMode === "type" && (
                <div className="mt-4 border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
                  <div className="hidden grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_auto_auto] gap-2 border-b border-[var(--ic-ink)]/20 px-4 py-2 sm:grid">
                    {["Size", "How many", "Empty", "Per month", "Climate", ""].map((h) => (
                      <Label key={h || "x"}>{h}</Label>
                    ))}
                  </div>
                  <ul>
                    {rows.map((row, i) => (
                      <li key={i} className="grid grid-cols-2 gap-2 border-b border-[var(--ic-ink)]/15 px-4 py-3 last:border-b-0 sm:grid-cols-[1.3fr_0.8fr_0.8fr_0.9fr_auto_auto] sm:items-center">
                        <label className="col-span-2 sm:col-span-1">
                          <span className="sr-only">Size</span>
                          <input
                            list="ob-sizes"
                            value={row.size}
                            onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, size: e.target.value } : r)))}
                            placeholder="10x10"
                            className={field}
                            style={fieldSize}
                          />
                        </label>
                        {(["total", "empty", "rate"] as const).map((k) => (
                          <label key={k} className="block">
                            <span className="ic-label mb-0.5 block text-[10px] text-[var(--ic-instruction)] sm:sr-only">
                              {k === "total" ? "How many" : k === "empty" ? "Empty" : "Per month ($)"}
                            </span>
                            <input
                              inputMode={k === "rate" ? "decimal" : "numeric"}
                              value={row[k]}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, j) => (j === i ? { ...r, [k]: e.target.value.replace(k === "rate" ? /[^\d.]/g : /[^\d]/g, "") } : r)),
                                )
                              }
                              placeholder={k === "total" ? "80" : k === "empty" ? "18" : "$119"}
                              className={field}
                              style={fieldSize}
                            />
                          </label>
                        ))}
                        <label className="flex items-center gap-2 text-[14px] font-bold text-[var(--ic-ink)]">
                          <input
                            type="checkbox"
                            checked={row.climate}
                            onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, climate: e.target.checked } : r)))}
                            className="h-4 w-4"
                          />
                          <span className="sm:sr-only">Climate</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [blankRow()]))}
                          aria-label={`Remove ${row.size || "this size"}`}
                          className="justify-self-end p-1.5 text-[var(--ic-secondary)] hover:text-[var(--ic-ink)]"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <datalist id="ob-sizes">
                    {COMMON_SIZES.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <div className="border-t border-[var(--ic-ink)]/20 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => [...prev, blankRow()])}
                      className="text-[14px] font-extrabold underline underline-offset-4"
                    >
                      Add a size
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <Problem text={problem} />
          {(unitsMode === "type" || (knownUnits.length === 0 && unitsMode !== "upload")) && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {unitsMode === "type" && (
                <ActionFill n={2} onClick={() => void saveTyped()}>
                  {saving ? "Saving…" : "Save sizes: see your facility"}
                </ActionFill>
              )}
              <button type="button" onClick={() => go(3)} className="text-[14px] font-extrabold underline underline-offset-4">
                Skip for now
              </button>
              <button type="button" onClick={() => go(1)} className="text-[14px] font-extrabold underline underline-offset-4">
                Back
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div role="region" className="mt-6" aria-labelledby="ob-yours">
          <h1 id="ob-yours" className="text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ic-ink)] sm:text-[34px]">
            Here&apos;s {client.facilityName}, as StorageAds sees it.
          </h1>
          <div className="mt-1 text-[15px] font-semibold text-[var(--ic-secondary)]">
            Every unit, offer, lead and review has one address and links to everything it touches. Each pane opens the full list.
          </div>
          <div className="mt-5">
            {flow?.ontology ? (
              <FacilityInstrument summaries={flow.ontology.summaries} />
            ) : (
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ic-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your facility…
              </div>
            )}
          </div>
          {sample && <div className="ic-label mt-2 text-[10px] text-[var(--ic-instruction)]">Sample facility · counts are sample</div>}

          <div className="mt-8">
            <GoalPanel
              onStart={(key) => void start(key, ctx, finish)}
              creating={creating}
              error={startError ?? problem}
              compact
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={leaving}
              onClick={() => void finishTo("/portal")}
              className="text-[14px] font-extrabold underline underline-offset-4"
            >
              {leaving ? "Finishing…" : "Not now: finish and go to the dashboard"}
            </button>
            <button type="button" onClick={() => go(2)} className="text-[14px] font-extrabold underline underline-offset-4">
              Back
            </button>
          </div>
          <div className="mt-6 text-[13px] font-semibold text-[var(--ic-secondary)]">
            Want sharper ads? Tell us about your brand, your renters and your rivals in the{" "}
            <Link href="/portal/onboarding/details" className="font-extrabold text-[var(--ic-ink)] underline underline-offset-4">
              brand details
            </Link>
            . It&apos;s optional and takes about ten minutes.
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
