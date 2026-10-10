/**
 * Jev intake schema v2. Answers go in as named state fields, never as
 * instructions. Jev only sorts and suggests.
 */
export const JEV_INTAKE_MODEL = "jev-1.13.0";

export const JEV_INTAKE_QUESTIONS = {
  likely_automated_or_test: {
    type: "noul",
    instructions:
      "This submission was most likely made by a bot, a script, or as a test, not by a person. Weigh the quiet quality signals (seconds to complete, hidden-field fill, bot check result, random-looking company or person names, email never verified, many near-identical signups) together with the answers. A thin but plausible submission from a named storage business is NOT automated. Country, phone format, a free email address, or an unusual answer are never evidence of automation on their own. This answer only sorts the lead lower with a reason; it never removes it.",
  },
  worth_a_quick_look: {
    type: "noul",
    instructions:
      "Something in this submission is worth a founder's quick look before replying: the website or Google listing names a different business, two answers contradict each other (for example 95%+ occupied but 'filling a new facility'), a US or Canadian phone area code is far from the facility's state or province, it looks like a founder or team test, or the submitter may not be a storage operator (vendor, job seeker, renter looking for a unit). Do not flag international phone numbers, international addresses, or thin-but-consistent records.",
  },
  founder_call_worth: {
    type: "score",
    instructions:
      "How worth a personal call from a StorageAds founder is this lead this week? StorageAds runs move-in focused paid ads, landing pages and a move-in ledger for independent self-storage operators. High worth: a real operator who can decide, a facility with room to fill (roughly 60-88% occupied, falling, lease-up, or move-outs outpacing move-ins), a near-term timeline, and enough detail to have a useful conversation. Country is never a negative. Thin records with only a name and town score low even if real.",
    criteria: [
      "not worth a founder's time this week",
      "worth a light personal touch",
      "worth a founder call this week",
    ],
  },
  readiness_to_buy: {
    type: "score",
    instructions:
      "How ready is this operator to start paying for help in the next 30 days, using only who signs off on spend, timeline, current ad spend or the budget they'd commit, and their own words? Pain alone is not readiness.",
    criteria: [
      "not ready / just looking",
      "interested, needs convincing or someone else's approval",
      "ready to start if the fit is right",
    ],
  },
  next_step: {
    type: "choice",
    instructions:
      "Suggest the single best next step for a founder, using only the fields given. A founder always decides; nothing happens automatically.",
    criteria: {
      call_today: "Real decision-maker, phone on file, room to fill, and wants help now or this month.",
      call_this_week: "Real operator with a phone and clear pain, but timeline is 1-3 months or someone else signs off.",
      send_audit: "Real operator who asked for an audit or gave enough facility detail for one, and no audit has gone out yet.",
      personal_email: "Real operator worth a personal note but no phone on file, or signals are moderate.",
      nurture: "Real but full and stable, a far-off timeline, or too thin to act on; light periodic touch.",
      polite_redirect: "A person, but not a storage operator (vendor, job seeker, renter looking for a unit); answer politely or point them to the right place.",
      check_if_real: "Looks automated or like a test; a human glances at it before anyone reaches out.",
    },
  },
  icp_route: {
    type: "choice",
    instructions:
      "Which StorageAds customer group does this facility belong to? This only routes the lead to the right offer and next step; every group is served.",
    criteria: {
      primary_owner_operator:
        "Independent owner-operator with 1-5 facilities, this facility open and renting (stabilized or late lease-up), about 200-750 units, room to fill (roughly 60-88% occupied, falling, or move-outs outpacing move-ins), and the person who fills this out can sign off on spend.",
      secondary_lease_up:
        "New build, expansion, conversion or purchase: under construction, opening within about 12 months, or opened in the last 3 years and still filling from a low base. Includes developers and investors.",
      secondary_multi_site:
        "Independent or regional operator with 6+ facilities, or a third-party manager running sites for owners, where marketing is decided centrally.",
      serve_not_chase:
        "A real operator we help but do not prioritize: under about 150 units, 90%+ occupied and stable, the problem is rates rather than move-ins, no timeline, or a REIT or national brand with its own marketing team.",
      not_an_operator_or_unclear: "Not enough facility detail to place it, or not a storage operator at all.",
    },
  },
  pain_category: {
    type: "choice",
    instructions:
      "What is this facility's main problem, judged from the structured answers first and their own words second?",
    criteria: {
      not_enough_inquiries: "Too few calls, web reservations or walk-ins.",
      inquiries_not_converting: "Enough inquiries but too few become move-ins.",
      move_outs_outpacing: "Churn: move-outs equal or exceed move-ins.",
      lease_up_fill: "New, expanded or not-yet-open facility that needs to fill from a low base.",
      rates_or_revenue: "Occupancy is fine; the problem is rate, revenue per unit or discounts.",
      unclear: "Nothing given points to a specific problem.",
    },
  },
  urgency: {
    type: "choice",
    instructions:
      "When does this operator actually want to act? Use the timeline answer first, then their own words. If neither exists, choose not_stated; do not guess from silence.",
    criteria: {
      now: "This month, or words like 'need help now'.",
      next_90_days: "Within about 1-3 months.",
      later: "Later this year or tied to a future event (opening, purchase).",
      just_looking: "They said they are exploring, comparing, or have no rush.",
      not_stated: "No timeline answer and nothing in their words about timing.",
    },
  },
  offer_route: {
    type: "choice",
    instructions:
      "Which StorageAds starting point fits best? Plans in the app today: Launch (1 facility), Growth (up to 3), Portfolio (custom). Every new client's first month of the StorageAds fee is free; that is not a choice here.",
    criteria: {
      launch_free_month: "One facility that is open and has room to fill: start the free month on Launch.",
      growth_free_month: "Two or three facilities with room to fill: start the free month on Growth.",
      portfolio_pilot:
        "Four or more facilities, or a manager running sites for owners: a pilot on one or two sites, then a Portfolio conversation.",
      lease_up_plan: "Under construction or opening soon: a pre-opening launch plan timed to the opening date.",
      audit_first: "Real operator but the problem or numbers are unclear: start with the free facility audit.",
      free_tools_and_nurture:
        "Full and stable, rate-focused, very small, or just looking: free tools and audit, light follow-up, no pitch.",
    },
  },
} as const;

/** At or above this, the lead sorts under the others. Nothing is hidden. */
export const LIKELY_AUTOMATED_LINE = 0.8;
