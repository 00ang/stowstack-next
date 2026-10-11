/**
 * Where an operator lead is in the homepage → audit → call path.
 *
 * Every step is a fact already stored on the facility (or on its audit,
 * booking activity, drip, or nurture row). A blank is left blank.
 *
 * 1. Contact saved — name plus a phone or email, and no popup question yet.
 * 2. Popup questions — at least one popup answer, or a reached/skipped stamp.
 * 3. Audit started — diagnostic link opened, diagnostic source, a diagnostic
 *    answer, or pipeline_status diagnostic_submitted.
 * 4. Audit questions done — every required diagnostic question answered, the
 *    diagnostic finish stamp, or a legacy full-form submission in notes.
 * 5. Audit generated — shared_audit_slug or an audits row.
 * 6. Audit emailed — audit_sent_at. Audit not delivered — pipeline_status
 *    audit_not_delivered, or an error with no send time.
 * 7. Call booked — pipeline_status call_booked (Cal.com webhook) or a
 *    call_booked activity row.
 *
 * A nurture or drip enrollment is reported beside the step. It does not
 * move the step. sort_last holds an active sequence; the row can still
 * say active because the cron skips it instead of pausing it.
 */

import { DIAGNOSTIC_STEPS, POPUP_STEPS, type IntakeStep } from "@/lib/intake/questions";
import { readProgress, type IntakeProgress } from "@/lib/intake/progress";

export const LEAD_STEP_IDS = [
  "no_contact",
  "contact_saved",
  "popup_questions",
  "audit_started",
  "audit_questions_done",
  "audit_generated",
  "audit_emailed",
  "audit_not_delivered",
  "call_booked",
] as const;

export type LeadStepId = (typeof LEAD_STEP_IDS)[number];

export const STEP_LABELS: Record<LeadStepId, string> = {
  no_contact: "No contact on file",
  contact_saved: "Contact saved",
  popup_questions: "Popup questions",
  audit_started: "Audit started",
  audit_questions_done: "Audit questions done",
  audit_generated: "Audit generated",
  audit_emailed: "Audit emailed",
  audit_not_delivered: "Audit not delivered",
  call_booked: "Call booked",
};

/** Compact bar. The email slot is either delivered or not delivered. */
export const STEP_BAR: Array<{ id: LeadStepId; short: string; altId?: LeadStepId }> = [
  { id: "contact_saved", short: "Contact" },
  { id: "popup_questions", short: "Popup" },
  { id: "audit_started", short: "Started" },
  { id: "audit_questions_done", short: "Questions" },
  { id: "audit_generated", short: "Generated" },
  { id: "audit_emailed", short: "Emailed", altId: "audit_not_delivered" },
  { id: "call_booked", short: "Call" },
];

const PRIORITY: LeadStepId[] = [
  "call_booked",
  "audit_emailed",
  "audit_not_delivered",
  "audit_generated",
  "audit_questions_done",
  "audit_started",
  "popup_questions",
  "contact_saved",
  "no_contact",
];

const OUTSIDE_STATUS: Record<string, string> = {
  form_sent: "Proposal sent",
  form_completed: "Form completed",
  call_scheduled: "Call scheduled",
  client_signed: "Signed",
  _client_signed: "Signed",
  lost: "Lost",
  self_serve: "Self serve",
};

export interface NurtureInput {
  engine: "nurture" | "drip";
  sequenceName: string;
  /** 0-based index of the next message. Matches current_step on both tables. */
  currentStep: number;
  /** 0 when the template length is not stored. */
  stepCount: number;
  status: string;
  nextSendAt?: string | Date | null;
  enrolledAt?: string | Date | null;
}

export interface LeadStepInput {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  intakeAnswers?: unknown;
  pipelineStatus?: string | null;
  sharedAuditSlug?: string | null;
  auditSentAt?: string | Date | null;
  auditDeliveryError?: string | null;
  /** Earliest audits.created_at for this facility, when a row exists. */
  auditCreatedAt?: string | Date | null;
  /** Latest activity_log row of type audit_delivery_failed. */
  deliveryFailedAt?: string | Date | null;
  /** Earliest activity_log row of type call_booked. */
  callBookedAt?: string | Date | null;
  createdAt?: string | Date | null;
  /** Legacy diagnostic-intake stores the full form here as JSON. */
  notes?: string | null;
  sortLast?: boolean;
  nurture?: NurtureInput[];
  /** Sequences that exist but were not included in nurture. */
  nurtureMore?: number;
}

export interface LeadStep {
  id: LeadStepId;
  label: string;
  detail: string;
  nextAction: string;
  pipelineNote: string | null;
  stuckSince: string | null;
  stuckDays: number | null;
  evidenced: LeadStepId[];
  popupAnswered: number;
  popupTotal: number;
  auditAnswered: number;
  auditTotal: number;
  lastQuestion: string | null;
  lastQuestionKind: "reached" | "answered" | null;
  nurture: string[];
}

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value: string | Date | null | undefined): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function utcDay(value: string | Date | null | undefined): string | null {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function answersOf(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function answered(answers: Record<string, unknown>, step: IntakeStep): boolean {
  if (step.id === "facility") {
    const facility = answers.facility;
    if (!facility || typeof facility !== "object" || Array.isArray(facility)) return false;
    const name = (facility as { name?: unknown }).name;
    return typeof name === "string" && name.trim().length > 0;
  }
  const raw = answers[step.id];
  return typeof raw === "string" && raw.trim().length > 0;
}

function countAnswered(steps: IntakeStep[], answers: Record<string, unknown>): number {
  return steps.filter((step) => answered(answers, step)).length;
}

function requiredComplete(steps: IntakeStep[], answers: Record<string, unknown>): boolean {
  return steps.filter((step) => !step.optional).every((step) => answered(answers, step));
}

function firstOpen(steps: IntakeStep[], answers: Record<string, unknown>): IntakeStep | null {
  return steps.find((step) => !answered(answers, step)) ?? null;
}

function furthestAnswered(steps: IntakeStep[], answers: Record<string, unknown>): IntakeStep | null {
  let found: IntakeStep | null = null;
  for (const step of steps) {
    if (answered(answers, step)) found = step;
  }
  return found;
}

function legacyDiagnosticForm(notes: string | null | undefined): boolean {
  if (!notes) return false;
  try {
    const parsed = JSON.parse(notes) as { source?: unknown; responses?: unknown };
    return (
      parsed?.source === "diagnostic_form" &&
      parsed.responses != null &&
      typeof parsed.responses === "object"
    );
  } catch {
    return false;
  }
}

function wholeDays(sinceIso: string | null, now: Date): number | null {
  if (!sinceIso) return null;
  const then = new Date(sinceIso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = now.getTime() - then;
  if (diff < 0) return 0;
  return Math.floor(diff / 86_400_000);
}

export function stuckLabel(days: number | null): string {
  if (days == null) return "No time stored for how long they've been here";
  if (days <= 0) return "Stuck here since today";
  return `Stuck here since ${days} ${days === 1 ? "day" : "days"}`;
}

function rankStatus(status: string): number {
  if (status === "active") return 0;
  if (status === "paused") return 1;
  return 2;
}

/** Active and paused sequences first. The rest stay available as a count. */
export function selectNurture(rows: NurtureInput[], limit = 3): { shown: NurtureInput[]; more: number } {
  const sorted = [...rows].sort((a, b) => {
    const rank = rankStatus(a.status) - rankStatus(b.status);
    if (rank !== 0) return rank;
    const aSend = toDate(a.nextSendAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bSend = toDate(b.nextSendAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aSend !== bSend) return aSend - bSend;
    const aEnrolled = toDate(a.enrolledAt)?.getTime() ?? 0;
    const bEnrolled = toDate(b.enrolledAt)?.getTime() ?? 0;
    return bEnrolled - aEnrolled;
  });
  return { shown: sorted.slice(0, limit), more: Math.max(0, sorted.length - limit) };
}

function describeNurture(row: NurtureInput, sortLast: boolean): string {
  const kind = row.engine === "drip" ? "Drip" : "Nurture";
  const name = text(row.sequenceName) || "Untitled sequence";
  const count = row.stepCount;
  const next = row.currentStep + 1;
  const date = utcDay(row.nextSendAt);
  const finished = row.status === "completed" || (count > 0 && row.currentStep >= count);

  if (finished) {
    return count > 0
      ? `${kind} “${name}” is finished (${count} ${count === 1 ? "message" : "messages"}).`
      : `${kind} “${name}” is finished. Message count isn't stored.`;
  }

  const position =
    count > 0
      ? `Next message is ${next} of ${count}.`
      : `Next message index is ${next}. Message count isn't stored.`;
  const send = date ? `Next send ${date} UTC.` : "No next send date is stored.";
  const held = sortLast && row.status === "active";

  if (held) {
    return `${kind} “${name}” is held because this lead sorts lower. ${position} ${send}`;
  }
  if (row.status === "paused") {
    return `${kind} “${name}” is paused. ${position} ${send}`;
  }
  if (row.status === "active") {
    return `${kind} “${name}”. ${position} ${send}`;
  }
  const status = text(row.status) || "not active";
  return `${kind} “${name}” is ${status}. ${position} ${send}`;
}

function quote(prompt: string): string {
  return `“${prompt}”`;
}

export function deriveLeadStep(input: LeadStepInput, now: Date = new Date()): LeadStep {
  const answers = answersOf(input.intakeAnswers);
  const progress: IntakeProgress = readProgress(answers);
  const status = text(input.pipelineStatus);
  const popupAnswered = countAnswered(POPUP_STEPS, answers);
  const auditAnswered = countAnswered(DIAGNOSTIC_STEPS, answers);
  const popupTotal = POPUP_STEPS.length;
  const auditTotal = DIAGNOSTIC_STEPS.length;

  const hasContact = Boolean(text(input.contactName) || text(input.contactEmail) || text(input.contactPhone));
  const reached = progress.reached || {};
  const popupReached = POPUP_STEPS.some((step) => reached[step.id] || progress.last_step === step.id);
  const popupEngaged = popupAnswered > 0 || popupReached;

  const source = typeof answers.source === "string" ? answers.source : "";
  const auditStartedStamp = Boolean(progress.audit_started_at);
  const diagnosticAnswer = auditAnswered > 0;
  const legacyForm = legacyDiagnosticForm(input.notes);
  const diagnosticStatus = status === "diagnostic_submitted";
  const questionsDone =
    requiredComplete(DIAGNOSTIC_STEPS, answers) || Boolean(progress.audit_finished_at) || legacyForm;
  const auditStartEvidence =
    auditStartedStamp || source === "diagnostic" || diagnosticAnswer || diagnosticStatus || questionsDone;

  const slug = text(input.sharedAuditSlug);
  const auditGenerated = Boolean(slug || toDate(input.auditCreatedAt));
  const emailed = Boolean(toDate(input.auditSentAt));
  const error = text(input.auditDeliveryError);
  const notDelivered = !emailed && (status === "audit_not_delivered" || error.length > 0);
  const callBooked = status === "call_booked" || Boolean(toDate(input.callBookedAt));

  const evidenced: LeadStepId[] = [];
  if (hasContact) evidenced.push("contact_saved");
  if (popupEngaged) evidenced.push("popup_questions");
  if (auditStartEvidence) evidenced.push("audit_started");
  if (questionsDone && auditStartEvidence) evidenced.push("audit_questions_done");
  if (auditGenerated) evidenced.push("audit_generated");
  if (emailed) evidenced.push("audit_emailed");
  if (notDelivered) evidenced.push("audit_not_delivered");
  if (callBooked) evidenced.push("call_booked");

  const evidencedSet = new Set(evidenced);
  const id = PRIORITY.find((step) => evidencedSet.has(step)) ?? "no_contact";

  const lastReachedStep = progress.last_step
    ? [...POPUP_STEPS, ...DIAGNOSTIC_STEPS].find((step) => step.id === progress.last_step) ?? null
    : null;
  const lastAnsweredStep = furthestAnswered([...POPUP_STEPS, ...DIAGNOSTIC_STEPS], answers);
  const lastQuestion = lastReachedStep?.prompt ?? lastAnsweredStep?.prompt ?? null;
  const lastQuestionKind: LeadStep["lastQuestionKind"] = lastReachedStep
    ? "reached"
    : lastAnsweredStep
      ? "answered"
      : null;

  const nextPopup = firstOpen(POPUP_STEPS, answers);
  const nextAudit = firstOpen(DIAGNOSTIC_STEPS, answers);
  const popupRequiredDone = requiredComplete(POPUP_STEPS, answers);

  let detail = "";
  let nextAction = "";
  let stuckSince: string | null = null;

  if (id === "no_contact") {
    detail = "No name, email, or phone is saved.";
    nextAction = "Nothing to follow up until a contact is saved.";
  } else if (id === "contact_saved") {
    detail = "Name and a phone or email are saved. No popup answer is on file.";
    nextAction = nextPopup
      ? `They stopped after contact. The next popup question is ${quote(nextPopup.prompt)}.`
      : "They stopped after contact.";
    stuckSince = toIso(input.createdAt);
  } else if (id === "popup_questions") {
    const where = lastReachedStep
      ? `Last reached: ${lastReachedStep.prompt}.`
      : lastAnsweredStep
        ? `Last answered: ${lastAnsweredStep.prompt}. No reach time is stored.`
        : "No question label is stored.";
    detail = `${popupAnswered} of ${popupTotal} popup questions answered. ${where}`;
    if (popupRequiredDone) {
      nextAction = "Popup questions are done. The audit link has not been opened.";
    } else if (nextPopup) {
      nextAction = `The next popup question is ${quote(nextPopup.prompt)}.`;
    } else {
      nextAction = "Popup questions are done. The audit link has not been opened.";
    }
    stuckSince = progress.last_step_at ?? null;
  } else if (id === "audit_started") {
    detail = `The diagnostic is open. ${auditAnswered} of ${auditTotal} audit questions answered.`;
    if (!progress.audit_started_at && !diagnosticAnswer && diagnosticStatus) {
      detail = `Pipeline status is diagnostic submitted. ${auditAnswered} of ${auditTotal} audit questions are in intake.`;
    }
    nextAction = nextAudit
      ? `The next audit question is ${quote(nextAudit.prompt)}.`
      : "The audit questions on file are answered. Finish has not been recorded.";
    stuckSince = progress.audit_started_at ?? (source === "diagnostic" ? toIso(input.createdAt) : null);
  } else if (id === "audit_questions_done") {
    if (legacyForm && auditAnswered === 0 && !progress.audit_finished_at) {
      detail = "Submitted on the full diagnostic form. Per-question answers are not in intake.";
    } else if (progress.audit_finished_at) {
      detail = `Finish was sent. ${auditAnswered} of ${auditTotal} audit questions answered.`;
    } else {
      detail = `${auditAnswered} of ${auditTotal} audit questions answered. The required ones are in.`;
    }
    nextAction = "The audit has not been generated.";
    stuckSince = progress.audit_finished_at ?? null;
  } else if (id === "audit_generated") {
    detail = slug
      ? "The audit file is saved. It has not been emailed."
      : "An audit row is saved. No shared link or email time is stored.";
    nextAction = "Email the audit.";
    stuckSince = toIso(input.auditCreatedAt);
  } else if (id === "audit_emailed") {
    detail = "The audit email was accepted.";
    nextAction = "A call is not booked.";
    stuckSince = toIso(input.auditSentAt);
  } else if (id === "audit_not_delivered") {
    const file = auditGenerated ? "The audit file is saved." : "No audit file is saved.";
    detail = error ? `${file} ${error}` : `${file} No error text is stored.`;
    nextAction = auditGenerated ? "Resend the audit." : "The audit was not generated.";
    stuckSince = toIso(input.deliveryFailedAt);
  } else {
    detail = toDate(input.callBookedAt)
      ? "A Cal.com booking is on file."
      : "Pipeline status is call_booked. No booking time is stored.";
    nextAction = "The call is booked.";
    stuckSince = toIso(input.callBookedAt);
  }

  let pipelineNote: string | null = null;
  if (status === "call_scheduled" && id !== "call_booked") {
    pipelineNote = "Pipeline status is Call scheduled. No Cal.com booking is on file.";
  } else if (status === "audit_sent" && id !== "audit_emailed") {
    pipelineNote = "Pipeline status is Audit sent. No accepted email time is stored.";
  } else if (status === "audit_generated" && !auditGenerated) {
    pipelineNote = "Pipeline status is Audit generated. No audit file is on file.";
  } else if (OUTSIDE_STATUS[status]) {
    pipelineNote = `Pipeline status is ${OUTSIDE_STATUS[status]}.`;
  }

  if (pipelineNote && (status === "client_signed" || status === "_client_signed" || status === "lost")) {
    nextAction = pipelineNote;
  } else if (pipelineNote && status === "call_scheduled" && id !== "call_booked") {
    nextAction = pipelineNote;
  }

  const nurtureRows = input.nurture ?? [];
  const nurture = nurtureRows.map((row) => describeNurture(row, input.sortLast === true));
  if ((input.nurtureMore ?? 0) > 0) {
    const extra = input.nurtureMore ?? 0;
    nurture.push(`${extra} more ${extra === 1 ? "sequence" : "sequences"} not shown.`);
  }

  return {
    id,
    label: STEP_LABELS[id],
    detail,
    nextAction,
    pipelineNote,
    stuckSince,
    stuckDays: wholeDays(stuckSince, now),
    evidenced,
    popupAnswered,
    popupTotal,
    auditAnswered,
    auditTotal,
    lastQuestion,
    lastQuestionKind,
    nurture,
  };
}
