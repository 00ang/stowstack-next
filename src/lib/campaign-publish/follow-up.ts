import type { NurtureSequenceTemplate } from "@/lib/nurture-templates";

/**
 * The follow-up a campaign's Follow-up function arms: for somebody who asked
 * about a unit and has not reserved. Short, specific, and it never invents an
 * offer — `{offer_line}` is the running special when the campaign names one,
 * and empty otherwise.
 *
 * Merge tags are the ones /api/cron/process-nurture fills: first_name,
 * facility_name, facility_location, facility_phone, plus the enrollment's own
 * metadata (reserve_link, unit_size, offer_line).
 *
 * `delay_minutes` is the gap before that step: the first from the moment they
 * asked (the 60-second text-back has already answered them by then), each
 * later one from the step before.
 */

type Step = NurtureSequenceTemplate["steps"][number];

const DAY = 24 * 60;
const TEXT_HOURS = { start: "09:00", end: "20:00" };

const nudge: Step = {
  step_number: 1,
  delay_minutes: DAY,
  channel: "sms",
  subject: null,
  body: "Hi {first_name}, it's {facility_name}. Still need a {unit_size}? Reply with your move date and we'll set one aside, or reserve here: {reserve_link}",
  send_window: TEXT_HOURS,
};

const details: Step = {
  step_number: 2,
  delay_minutes: 2 * DAY,
  channel: "email",
  subject: "Your {unit_size} at {facility_name}",
  body:
    "Hi {first_name},\n\nThanks for asking about a {unit_size} at {facility_name}. {offer_line}\n\nWhere: {facility_location}\nReserve online: {reserve_link}\nOr call us: {facility_phone}\n\n{facility_name}",
  send_window: null,
};

const lastText: Step = {
  step_number: 3,
  delay_minutes: 4 * DAY,
  channel: "sms",
  subject: null,
  body: "{first_name}, one last note from {facility_name}: if you still need space, it's here: {reserve_link}. If your plans changed, you won't hear from us again.",
  send_window: TEXT_HOURS,
};

const question: Step = {
  step_number: 3,
  delay_minutes: 3 * DAY,
  channel: "sms",
  subject: null,
  body: "Hi {first_name}, any questions about sizes or access at {facility_name}? Reply here and we'll answer. {reserve_link}",
  send_window: TEXT_HOURS,
};

const checkIn: Step = {
  step_number: 4,
  delay_minutes: 4 * DAY,
  channel: "email",
  subject: "Still looking for storage, {first_name}?",
  body:
    "Hi {first_name},\n\nIf you still need a {unit_size}, we can have one ready the day you move. {offer_line}\n\nReserve: {reserve_link}\nCall: {facility_phone}\n\n{facility_name}",
  send_window: null,
};

/** 3 steps over 7 days, or 5 over 14. */
export function followUpSteps(count: "3" | "5"): Step[] {
  const steps = count === "5" ? [nudge, details, question, checkIn, { ...lastText, delay_minutes: 4 * DAY }] : [nudge, details, lastText];
  return steps.map((s, i) => ({ ...s, step_number: i + 1 }));
}

/** Days from the first message to the last, for the line the owner reads. */
export function followUpDays(count: "3" | "5"): number {
  return Math.round(followUpSteps(count).reduce((sum, s) => sum + s.delay_minutes, 0) / DAY);
}

/** The trigger a campaign's sequence is stored under, so its leads can be enrolled. */
export function followUpTrigger(funnelId: string): string {
  return `campaign:${funnelId}`;
}
