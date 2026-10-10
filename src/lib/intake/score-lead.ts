import { db } from "@/lib/db";
import { answersJson } from "@/lib/intake/merge-answers";
import {
  JEV_INTAKE_MODEL,
  JEV_INTAKE_QUESTIONS,
  LIKELY_AUTOMATED_LINE,
} from "@/lib/intake/jev-schema";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

export interface JevAnswer {
  type?: string;
  noul?: number;
  score?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface JevResponse {
  model?: string;
  answers?: Record<string, JevAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/**
 * Run the v2 schema on saved answers. No-ops when TYPESAFE_API_KEY is
 * unset. A failed call leaves the lead unscored. It never drops or hides.
 */
export async function scoreIntake(
  state: Record<string, unknown>
): Promise<JevResponse | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: JEV_INTAKE_MODEL,
        state,
        questions: JEV_INTAKE_QUESTIONS,
      }),
    });
    if (!res.ok) {
      console.error(`[jev] scoring returned ${res.status}`);
      return null;
    }
    return (await res.json()) as JevResponse;
  } catch (err) {
    console.error("[jev] scoring failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export function automatedNoul(response: JevResponse | null): number | null {
  const noul = response?.answers?.likely_automated_or_test?.noul;
  return typeof noul === "number" ? noul : null;
}

/**
 * Neutral line for the Pipeline. The score stays in jev_scores.
 * This text does not call the lead a bot.
 */
export function neutralSortReason(honeypot: boolean): string {
  if (honeypot) return "A hidden field was filled.";
  return "Sorted lower for a look.";
}

export async function scoreAndStore(facilityId: string): Promise<void> {
  if (!process.env.TYPESAFE_API_KEY) return;

  const facility = await db.facilities.findUnique({
    where: { id: facilityId },
    select: {
      id: true,
      contact_name: true,
      contact_phone: true,
      contact_email: true,
      name: true,
      location: true,
      intake_answers: true,
      sort_last_cleared_at: true,
      sort_last: true,
    },
  });
  if (!facility) return;

  const answers =
    facility.intake_answers && typeof facility.intake_answers === "object"
      ? (facility.intake_answers as Record<string, unknown>)
      : {};

  const state = {
    contact_name: facility.contact_name,
    contact_phone: facility.contact_phone,
    contact_email: facility.contact_email,
    facility_name: facility.name,
    location: facility.location,
    answers,
  };

  const scored = await scoreIntake(state);
  if (!scored) {
    await db.facilities
      .update({
        where: { id: facilityId },
        data: {
          jev_scores: answersJson({
            status: "unscored",
            at: new Date().toISOString(),
          }),
        },
      })
      .catch((err) => console.error("[jev] could not mark unscored:", err));
    return;
  }

  const noul = automatedNoul(scored);
  const honeypot = answers.hidden_field_filled === true;
  const overLine = (noul != null && noul >= LIKELY_AUTOMATED_LINE) || honeypot;
  const cleared = facility.sort_last_cleared_at != null;

  await db.facilities.update({
    where: { id: facilityId },
    data: {
      jev_scores: answersJson({
        status: "scored",
        at: new Date().toISOString(),
        model: scored.model || JEV_INTAKE_MODEL,
        answers: scored.answers || {},
        usage: scored.usage || null,
      }),
      ...(cleared
        ? {}
        : {
            sort_last: overLine,
            sort_last_reason: overLine ? neutralSortReason(honeypot) : null,
          }),
    },
  });
}
