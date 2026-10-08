/**
 * "How did you find us?" — what a renter says, as opposed to what we measured.
 *
 * Self-reported source sees what no click does (word of mouth, the sign out
 * front, Maps), and is wrong in its own ways (people name the last thing they
 * remember). So it is kept beside the measured trail, never in place of it,
 * and the ledger shows when the two agree.
 *
 * Pure: no I/O. The ask itself is in ./heard-ask.
 */

export const HEARD_ANSWERS = [
  ["google_search", "Searched Google"],
  ["google_maps", "Google Maps"],
  ["social", "Facebook or Instagram"],
  ["drove_by", "Drove by or saw the sign"],
  ["friend", "A friend or family"],
  ["returning", "Rented here before"],
  ["other", "Something else"],
] as const;

export type HeardAnswer = (typeof HEARD_ANSWERS)[number][0];

export interface Heard {
  answer: HeardAnswer;
  at: string;
  /** Where the answer came from: the one-tap link, or the office's walk-in form. */
  via: "link" | "counter";
}

export function isHeardAnswer(v: unknown): v is HeardAnswer {
  return typeof v === "string" && HEARD_ANSWERS.some(([k]) => k === v);
}

export function heardLabel(answer: HeardAnswer): string {
  return HEARD_ANSWERS.find(([k]) => k === answer)?.[1] ?? "Something else";
}

/** The walk-in form's sources (src/app/walkin/[code]/page.tsx) in the same terms. */
export function heardFromWalkin(source: string): HeardAnswer {
  switch (source) {
    case "facebook_instagram_ad":
      return "social";
    case "google_search":
      return "google_search";
    case "drove_by_signage":
      return "drove_by";
    case "friend_family_referral":
      return "friend";
    case "repeat_customer":
      return "returning";
    default:
      return "other";
  }
}

/** Read a tenant's stored answer from its metadata, if it has one. */
export function readHeard(metadata: unknown): Heard | null {
  const h = (metadata && typeof metadata === "object" ? (metadata as { heardFrom?: unknown }).heardFrom : null) as
    | Partial<Heard>
    | null
    | undefined;
  if (!h || !isHeardAnswer(h.answer)) return null;
  return { answer: h.answer, at: typeof h.at === "string" ? h.at : "", via: h.via === "counter" ? "counter" : "link" };
}

/**
 * Whether what they said agrees with the visit we measured. Null when there is
 * nothing to compare (no visit, or an answer no click could show).
 */
export function agrees(answer: HeardAnswer, channel: string | null, source: string | null): boolean | null {
  if (!channel) return null;
  const s = (source ?? "").toLowerCase();
  const google = s === "google";
  const meta = s === "meta" || s === "facebook" || s === "instagram";
  switch (answer) {
    case "google_search":
      return google && (channel === "paid_search" || channel === "organic_search");
    case "google_maps":
      return google && channel === "organic_search";
    case "social":
      return meta;
    case "drove_by":
    case "friend":
    case "returning":
    case "other":
      return null;
  }
}

/** The trigger a facility's "how did you find us" sequence is stored under. */
export const HEARD_TRIGGER = "move_in_heard";

/** One email, a day after the move-in is seen. Merge tags are process-nurture's. */
export function heardSequenceSteps() {
  return [
    {
      step_number: 1,
      delay_minutes: 24 * 60,
      channel: "email",
      subject: "One quick question from {facility_name}",
      body:
        "Hi {first_name},\n\nWelcome to {facility_name}. One quick question, one tap to answer: how did you first find us?\n\n{heard_link}\n\nThank you,\n{facility_name}",
      send_window: null,
    },
  ];
}
