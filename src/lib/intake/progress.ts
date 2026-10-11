/**
 * Progress stamps stored on facilities.intake_answers.progress.
 * Existing answer keys are left alone. A skipped question is recorded
 * as reached and is not filled with a stand-in answer.
 */

import { INTAKE_STEPS, DIAGNOSTIC_STEPS } from "@/lib/intake/questions";

const STEP_IDS = new Set(INTAKE_STEPS.map((step) => step.id));
const DIAGNOSTIC_IDS = new Set(DIAGNOSTIC_STEPS.map((step) => step.id));

export interface IntakeProgress {
  last_step?: string;
  last_step_at?: string;
  reached?: Record<string, string>;
  skipped?: string[];
  audit_started_at?: string;
  audit_finished_at?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export function readProgress(answers: unknown): IntakeProgress {
  const raw = asRecord(asRecord(answers).progress);
  const progress: IntakeProgress = {};
  if (typeof raw.last_step === "string" && STEP_IDS.has(raw.last_step)) {
    progress.last_step = raw.last_step;
  }
  if (typeof raw.last_step_at === "string") progress.last_step_at = raw.last_step_at;
  if (typeof raw.audit_started_at === "string") progress.audit_started_at = raw.audit_started_at;
  if (typeof raw.audit_finished_at === "string") progress.audit_finished_at = raw.audit_finished_at;

  if (raw.reached && typeof raw.reached === "object" && !Array.isArray(raw.reached)) {
    const reached: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.reached as Record<string, unknown>)) {
      if (STEP_IDS.has(key) && typeof value === "string") reached[key] = value;
    }
    if (Object.keys(reached).length > 0) progress.reached = reached;
  }

  if (Array.isArray(raw.skipped)) {
    const skipped = raw.skipped.filter((id): id is string => typeof id === "string" && STEP_IDS.has(id));
    if (skipped.length > 0) progress.skipped = skipped;
  }

  return progress;
}

function isSkip(value: unknown): boolean {
  return value == null || value === "" || value === "skip";
}

function answerLanded(answers: Record<string, unknown>, id: string): boolean {
  if (id === "facility") {
    const facility = answers.facility;
    if (!facility || typeof facility !== "object" || Array.isArray(facility)) return false;
    const name = (facility as { name?: unknown }).name;
    return typeof name === "string" && name.trim().length > 0;
  }
  const value = answers[id];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Record which question the operator just saved or skipped.
 * Rejected values (not a real option) are not recorded.
 */
export function applyAnswerProgress(
  before: unknown,
  after: Record<string, unknown>,
  patch: Record<string, unknown>,
  at: Date
): Record<string, unknown> {
  const prev = readProgress(before);
  const reached = { ...(prev.reached || {}) };
  const skipped = new Set(prev.skipped || []);
  let last = prev.last_step;
  let lastAt = prev.last_step_at;
  let changed = false;
  let touchedDiagnostic = false;

  for (const key of Object.keys(patch)) {
    if (!STEP_IDS.has(key)) continue;
    const iso = at.toISOString();
    if (isSkip(patch[key])) {
      if (!reached[key]) reached[key] = iso;
      skipped.add(key);
      last = key;
      lastAt = iso;
      changed = true;
      if (DIAGNOSTIC_IDS.has(key)) touchedDiagnostic = true;
      continue;
    }
    if (!answerLanded(after, key)) continue;
    if (!reached[key]) reached[key] = iso;
    skipped.delete(key);
    last = key;
    lastAt = iso;
    changed = true;
    if (DIAGNOSTIC_IDS.has(key)) touchedDiagnostic = true;
  }

  if (!changed) return after;

  const progress: IntakeProgress = {
    ...prev,
    last_step: last,
    last_step_at: lastAt,
    reached,
  };
  if (skipped.size > 0) progress.skipped = [...skipped];
  else delete progress.skipped;
  if (touchedDiagnostic && !progress.audit_started_at) {
    progress.audit_started_at = at.toISOString();
  }

  return { ...after, progress };
}

export function withAuditStarted(
  answers: unknown,
  at: Date
): { answers: Record<string, unknown>; changed: boolean } {
  const base = asRecord(answers);
  const prev = readProgress(base);
  if (prev.audit_started_at) return { answers: base, changed: false };
  return {
    changed: true,
    answers: {
      ...base,
      progress: { ...prev, audit_started_at: at.toISOString() },
    },
  };
}

export function withAuditFinished(answers: unknown, at: Date): Record<string, unknown> {
  const base = asRecord(answers);
  const prev = readProgress(base);
  return {
    ...base,
    progress: { ...prev, audit_finished_at: at.toISOString() },
  };
}
