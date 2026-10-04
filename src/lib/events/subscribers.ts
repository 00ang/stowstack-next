/**
 * Who listens to what (MISSION.md s7).
 *
 * One event fans out to every queue named here. Adding a subscriber is one line
 * plus a handler in `src/lib/jobs/handlers.ts`; nothing else in the system needs
 * to know it exists, which is the whole point of the bus.
 *
 * The queues below are the Modules v2 capabilities that were waiting on an X to
 * their "when X happens, do Y". They are listed — deliberately — before their
 * handlers exist: an unregistered queue FREEZES rather than fails (see the
 * runner), so the events accumulate visibly and are re-deliverable the day the
 * handler ships, instead of being silently dropped between now and then.
 *
 * Registered handlers today: `respond.waitlist-notify`, and the two `prove.*`
 * write-back queues (MISSION.md s12). The rest are intentional placeholders,
 * which is why the map is the documentation.
 */

import type { EventType } from "./types";

export const SUBSCRIBERS: Record<EventType, string[]> = {
  // MAIL m2 welcome kit (gate code + map, move-in day) · RETAIN t4 autopay push
  // · RETAIN t5 insurance and lock upsell · RETAIN t1 review request at day 3
  "unit.moved_in": ["mail.welcome-kit", "retain.autopay-push", "retain.review-request"],

  // MAIL m4 winback at 6/12/24 months · REACH h7 past-tenant audience ·
  // RETAIN t7 exit survey
  "unit.moved_out": ["mail.winback-schedule", "reach.past-tenant-audience", "retain.exit-survey"],

  // RETAIN t3 delinquency ladder — text and email with a payment link, before
  // lien costs. The event carries which threshold was crossed.
  "tenant.delinquent": ["retain.delinquency-notice"],

  // MAIL m5 rate-increase letter softened with a referral offer.
  "unit.rate_changed": ["mail.rate-increase-letter"],

  // RESPOND r9 sold-out waitlist · CONVERT c6 back-in-stock alerts. The unit
  // sells itself before it is vacant a day — which only works if this fires
  // within minutes, so it is the strongest argument for the one-minute worker.
  "inventory.available": ["respond.waitlist-notify"],

  // PROVE s12 — tell the ad platforms a click became a move-in, so they bid on
  // move-ins rather than form fills. One queue per platform, so a Google outage
  // never holds up the Meta report or the other way round. Handlers live in
  // `src/lib/attribution/write-back.ts`.
  "lead.moved_in": ["prove.meta-conversion", "prove.google-conversion"],
};

/** Every queue any event can fan out to. Useful for coverage checks and ops. */
export const ALL_SUBSCRIBER_QUEUES: string[] = [
  ...new Set(Object.values(SUBSCRIBERS).flat()),
];
