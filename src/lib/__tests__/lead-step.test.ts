import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_STEPS, POPUP_STEPS } from "@/lib/intake/questions";
import { applyAnswerProgress, readProgress, withAuditFinished, withAuditStarted } from "@/lib/intake/progress";
import { deriveLeadStep, selectNurture, stuckLabel, type NurtureInput } from "@/lib/lead-step";

const NOW = new Date("2026-10-11T12:00:00.000Z");
const CREATED = "2026-10-08T12:00:00.000Z";
const popupTotal = POPUP_STEPS.length;
const auditTotal = DIAGNOSTIC_STEPS.length;
const firstPopup = POPUP_STEPS[0];
const secondPopup = POPUP_STEPS[1];
const firstAudit = DIAGNOSTIC_STEPS[0];

function requiredAnswers(steps: typeof POPUP_STEPS): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const step of steps) {
    if (step.optional) continue;
    if (step.id === "facility") continue;
    const label = step.options?.[0]?.label;
    if (label) answers[step.id] = label;
  }
  return answers;
}

describe("deriveLeadStep", () => {
  it("does not call a blank facility a contact", () => {
    const step = deriveLeadStep({}, NOW);
    expect(step.id).toBe("no_contact");
    expect(step.stuckDays).toBeNull();
    expect(step.nurture).toEqual([]);
    expect(stuckLabel(step.stuckDays)).toBe("No time stored for how long they've been here");
  });

  it("stops at contact when only name and phone are saved", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactPhone: "+15125550123",
        createdAt: CREATED,
        intakeAnswers: { source: "homepage_popup", consent: true },
      },
      NOW
    );
    expect(step.id).toBe("contact_saved");
    expect(step.detail).toMatch(/No popup answer/);
    expect(step.nextAction).toContain(firstPopup.prompt);
    expect(step.stuckDays).toBe(3);
    expect(stuckLabel(3)).toBe("Stuck here since 3 days");
    expect(step.evidenced).toEqual(["contact_saved"]);
  });

  it("counts popup answers and does not invent a reach time", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactPhone: "+15125550123",
        createdAt: CREATED,
        intakeAnswers: { source: "homepage_popup", role: "Owner" },
      },
      NOW
    );
    expect(step.id).toBe("popup_questions");
    expect(step.popupAnswered).toBe(1);
    expect(step.popupTotal).toBe(popupTotal);
    expect(step.detail).toContain(`1 of ${popupTotal}`);
    expect(step.detail).toContain("Last answered: You are the…");
    expect(step.detail).toContain("No reach time is stored");
    expect(step.lastQuestionKind).toBe("answered");
    expect(step.nextAction).toContain(secondPopup.prompt);
    expect(step.stuckSince).toBeNull();
  });

  it("uses the reached stamp when they skipped ahead of the answers", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactPhone: "+15125550123",
        intakeAnswers: {
          role: "Owner",
          progress: {
            last_step: "occupancy",
            last_step_at: "2026-10-10T12:00:00.000Z",
            reached: { role: "2026-10-10T11:00:00.000Z", occupancy: "2026-10-10T12:00:00.000Z" },
            skipped: ["occupancy"],
          },
        },
      },
      NOW
    );
    expect(step.id).toBe("popup_questions");
    expect(step.popupAnswered).toBe(1);
    expect(step.lastQuestionKind).toBe("reached");
    expect(step.detail).toContain("Last reached: Occupancy by units today.");
    expect(step.stuckDays).toBe(1);
  });

  it("stays on popup questions when the popup is done and the audit link is closed", () => {
    const answers = {
      ...requiredAnswers(POPUP_STEPS),
      facility: { name: "Main Street Storage" },
    };
    const step = deriveLeadStep(
      { contactName: "Pat", contactPhone: "+15125550123", intakeAnswers: answers },
      NOW
    );
    expect(step.id).toBe("popup_questions");
    expect(step.nextAction).toBe("Popup questions are done. The audit link has not been opened.");
  });

  it("marks the diagnostic open when the link was stamped", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        intakeAnswers: {
          source: "homepage_popup",
          role: "Owner",
          progress: { audit_started_at: "2026-10-09T12:00:00.000Z" },
        },
      },
      NOW
    );
    expect(step.id).toBe("audit_started");
    expect(step.detail).toContain(`0 of ${auditTotal}`);
    expect(step.nextAction).toContain(firstAudit.prompt);
    expect(step.stuckDays).toBe(2);
    expect(step.evidenced).toContain("popup_questions");
  });

  it("treats a diagnostic-source lead with no answers as audit started", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactPhone: "+15125550123",
        createdAt: CREATED,
        pipelineStatus: "diagnostic_submitted",
        intakeAnswers: {
          source: "diagnostic",
          progress: { audit_started_at: CREATED },
        },
      },
      NOW
    );
    expect(step.id).toBe("audit_started");
    expect(step.auditAnswered).toBe(0);
  });

  it("moves to audit questions done only when the required diagnostic answers are in", () => {
    const answers = {
      ...requiredAnswers(POPUP_STEPS),
      ...requiredAnswers(DIAGNOSTIC_STEPS),
      facility: { name: "Main Street Storage" },
    };
    const step = deriveLeadStep(
      { contactName: "Pat", contactEmail: "pat@example.com", intakeAnswers: answers },
      NOW
    );
    expect(step.id).toBe("audit_questions_done");
    expect(step.nextAction).toBe("The audit has not been generated.");
    expect(step.stuckSince).toBeNull();
  });

  it("reads a legacy full-form submission from notes and does not invent intake answers", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        pipelineStatus: "diagnostic_submitted",
        notes: JSON.stringify({
          source: "diagnostic_form",
          responses: { "What is your total unit count (approximately)?": "200–349" },
        }),
      },
      NOW
    );
    expect(step.id).toBe("audit_questions_done");
    expect(step.auditAnswered).toBe(0);
    expect(step.detail).toContain("Per-question answers are not in intake");
  });

  it("keeps a generated audit that was never emailed at generated", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        sharedAuditSlug: "main-street",
        auditCreatedAt: "2026-10-01T12:00:00.000Z",
        pipelineStatus: "diagnostic_submitted",
      },
      NOW
    );
    expect(step.id).toBe("audit_generated");
    expect(step.detail).toContain("has not been emailed");
    expect(step.stuckDays).toBe(10);
    expect(step.nextAction).toBe("Email the audit.");
  });

  it("does not treat a pipeline label as an email when no send time exists", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        sharedAuditSlug: "main-street",
        pipelineStatus: "audit_sent",
      },
      NOW
    );
    expect(step.id).toBe("audit_generated");
    expect(step.pipelineNote).toBe("Pipeline status is Audit sent. No accepted email time is stored.");
  });

  it("uses the accepted email time for audit emailed", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        sharedAuditSlug: "main-street",
        auditSentAt: "2026-10-10T15:00:00.000Z",
        pipelineStatus: "audit_sent",
      },
      NOW
    );
    expect(step.id).toBe("audit_emailed");
    expect(step.stuckDays).toBe(0);
    expect(stuckLabel(0)).toBe("Stuck here since today");
    expect(step.nextAction).toBe("A call is not booked.");
  });

  it("reports audit not delivered from the error, including when no file exists", () => {
    const failed = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        pipelineStatus: "audit_not_delivered",
        auditDeliveryError: "No email on file",
        deliveryFailedAt: "2026-10-09T12:00:00.000Z",
      },
      NOW
    );
    expect(failed.id).toBe("audit_not_delivered");
    expect(failed.detail).toContain("No audit file is saved.");
    expect(failed.detail).toContain("No email on file");
    expect(failed.nextAction).toBe("The audit was not generated.");
    expect(failed.stuckDays).toBe(2);

    const saved = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        sharedAuditSlug: "main-street",
        pipelineStatus: "audit_not_delivered",
        auditDeliveryError: "Email was not accepted",
      },
      NOW
    );
    expect(saved.id).toBe("audit_not_delivered");
    expect(saved.detail).toContain("The audit file is saved.");
    expect(saved.nextAction).toBe("Resend the audit.");
  });

  it("lets a Cal.com booking outrank the email, and ignores a manual call_scheduled", () => {
    const booked = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        auditSentAt: "2026-10-01T12:00:00.000Z",
        pipelineStatus: "call_booked",
        callBookedAt: "2026-10-06T12:00:00.000Z",
      },
      NOW
    );
    expect(booked.id).toBe("call_booked");
    expect(booked.detail).toBe("A Cal.com booking is on file.");
    expect(booked.stuckDays).toBe(5);
    expect(booked.evidenced).toContain("audit_emailed");

    const scheduled = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        auditSentAt: "2026-10-01T12:00:00.000Z",
        pipelineStatus: "call_scheduled",
      },
      NOW
    );
    expect(scheduled.id).toBe("audit_emailed");
    expect(scheduled.pipelineNote).toBe(
      "Pipeline status is Call scheduled. No Cal.com booking is on file."
    );
    expect(scheduled.nextAction).toBe(scheduled.pipelineNote);
  });

  it("says a signed lead is signed instead of asking for a call", () => {
    const step = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        auditSentAt: "2026-10-01T12:00:00.000Z",
        pipelineStatus: "client_signed",
      },
      NOW
    );
    expect(step.id).toBe("audit_emailed");
    expect(step.nextAction).toBe("Pipeline status is Signed.");
  });

  it("names the nurture message, the next send, and a sort-lower hold", () => {
    const nurture: NurtureInput = {
      engine: "nurture",
      sequenceName: "Post-Audit Follow-up",
      currentStep: 1,
      stepCount: 3,
      status: "active",
      nextSendAt: "2026-10-12T15:00:00.000Z",
    };
    const held = deriveLeadStep(
      {
        contactName: "Pat",
        contactEmail: "pat@example.com",
        auditSentAt: "2026-10-01T12:00:00.000Z",
        sortLast: true,
        nurture: [nurture],
      },
      NOW
    );
    expect(held.nurture[0]).toContain("held because this lead sorts lower");
    expect(held.nurture[0]).toContain("Next message is 2 of 3");
    expect(held.nurture[0]).toContain("Next send 2026-10-12 UTC");

    const drip = deriveLeadStep(
      {
        contactName: "Pat",
        contactPhone: "+15125550123",
        nurture: [
          {
            engine: "drip",
            sequenceName: "Post-Audit Follow-up",
            currentStep: 0,
            stepCount: 3,
            status: "paused",
            nextSendAt: null,
          },
        ],
      },
      NOW
    );
    expect(drip.nurture[0]).toContain("Drip “Post-Audit Follow-up” is paused");
    expect(drip.nurture[0]).toContain("No next send date is stored");
    expect(drip.nurture[0]).not.toContain("sorts lower");
  });
});

describe("selectNurture", () => {
  it("keeps active sequences ahead of finished ones", () => {
    const rows: NurtureInput[] = [
      { engine: "drip", sequenceName: "Old", currentStep: 3, stepCount: 3, status: "completed" },
      {
        engine: "nurture",
        sequenceName: "Post-Audit Follow-up",
        currentStep: 0,
        stepCount: 3,
        status: "active",
        nextSendAt: "2026-10-12T00:00:00.000Z",
      },
    ];
    const picked = selectNurture(rows, 1);
    expect(picked.shown.map((row) => row.sequenceName)).toEqual(["Post-Audit Follow-up"]);
    expect(picked.more).toBe(1);
  });
});

describe("intake progress", () => {
  const at = new Date("2026-10-11T12:00:00.000Z");

  it("records the question that was saved and leaves other answers alone", () => {
    const before = { source: "homepage_popup", consent: true };
    const after = { ...before, role: "Owner" };
    const next = applyAnswerProgress(before, after, { role: "Owner" }, at);
    expect(next.role).toBe("Owner");
    expect(next.source).toBe("homepage_popup");
    expect(next.occupancy).toBeUndefined();
    expect(readProgress(next)).toMatchObject({
      last_step: "role",
      last_step_at: at.toISOString(),
      reached: { role: at.toISOString() },
    });
  });

  it("records a skip without putting an answer back", () => {
    const before = { role: "Owner", occupancy: "60–69%" };
    const after = { role: "Owner" };
    const next = applyAnswerProgress(before, after, { occupancy: null }, at);
    expect(next.occupancy).toBeUndefined();
    expect(next.role).toBe("Owner");
    const progress = readProgress(next);
    expect(progress.last_step).toBe("occupancy");
    expect(progress.skipped).toEqual(["occupancy"]);
    expect(progress.reached?.occupancy).toBe(at.toISOString());
  });

  it("keeps the first reach time when the same question is saved again", () => {
    const first = applyAnswerProgress({}, { role: "Owner" }, { role: "Owner" }, at);
    const later = new Date("2026-10-12T12:00:00.000Z");
    const second = applyAnswerProgress(
      first,
      { ...first, role: "Manager" },
      { role: "Manager" },
      later
    );
    expect(readProgress(second).reached?.role).toBe(at.toISOString());
    expect(readProgress(second).last_step_at).toBe(later.toISOString());
  });

  it("stamps audit start once, and finish without erasing answers", () => {
    const started = withAuditStarted({ role: "Owner" }, at);
    expect(started.changed).toBe(true);
    const again = withAuditStarted(started.answers, new Date("2026-10-12T00:00:00.000Z"));
    expect(again.changed).toBe(false);
    expect(readProgress(again.answers).audit_started_at).toBe(at.toISOString());

    const finished = withAuditFinished(started.answers, new Date("2026-10-12T00:00:00.000Z"));
    expect(finished.role).toBe("Owner");
    expect(readProgress(finished).audit_finished_at).toBe("2026-10-12T00:00:00.000Z");
    expect(readProgress(finished).audit_started_at).toBe(at.toISOString());
  });

  it("ignores a progress object sent in as an answer", () => {
    const next = applyAnswerProgress(
      { role: "Owner" },
      { role: "Owner" },
      { progress: { last_step: "timeline" } },
      at
    );
    expect(readProgress(next).last_step).toBeUndefined();
  });
});
