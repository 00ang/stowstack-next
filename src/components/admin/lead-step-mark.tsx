"use client";

import { STEP_BAR, stuckLabel, type LeadStep, type LeadStepId } from "@/lib/lead-step";

function segmentOn(stepId: LeadStepId, barId: LeadStepId, altId?: LeadStepId): boolean {
  return stepId === barId || stepId === altId;
}

function segmentDone(step: LeadStep, barId: LeadStepId, altId?: LeadStepId): boolean {
  if (step.evidenced.includes(barId)) return true;
  return Boolean(altId && step.evidenced.includes(altId));
}

export function LeadStepMark({ step }: { step: LeadStep }) {
  const alert = step.id === "audit_not_delivered";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-dark)]">{step.label}</p>
        <p className="text-xs text-[var(--color-mid-gray)]">{stuckLabel(step.stuckDays)}</p>
      </div>
      <ol className="flex gap-1" aria-label={`Lead step: ${step.label}. ${step.detail}`}>
        {STEP_BAR.map((segment) => {
          const current = segmentOn(step.id, segment.id, segment.altId);
          const done = segmentDone(step, segment.id, segment.altId);
          const problem = current && alert;
          const background = problem
            ? "var(--color-red)"
            : current || done
              ? "var(--color-dark)"
              : "var(--bdr-strong)";
          return (
            <li key={segment.id} className="min-w-0 flex-1">
              <span
                className="block h-1.5"
                style={{ background, opacity: done && !current && !problem ? 0.45 : 1 }}
                title={current && alert ? "Audit not delivered" : segment.short}
              />
              <span
                className={`mt-1 block truncate text-xs ${
                  current
                    ? "font-semibold text-[var(--color-dark)]"
                    : "hidden text-[var(--color-mid-gray)] sm:block"
                }`}
              >
                {current && alert ? "Not sent" : segment.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-sm leading-snug text-[var(--color-body-text)]">{step.detail}</p>
      <p className="text-sm font-medium text-[var(--color-dark)]">{step.nextAction}</p>
      {step.pipelineNote && step.pipelineNote !== step.nextAction && (
        <p className="text-xs text-[var(--color-mid-gray)]">{step.pipelineNote}</p>
      )}
      {step.nurture.map((line) => (
        <p key={line} className="text-xs leading-snug text-[var(--color-body-text)]">
          {line}
        </p>
      ))}
    </div>
  );
}
