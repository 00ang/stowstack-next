/**
 * Heuristic classification of a self-storage ad. Pure — no I/O.
 *
 * The library is filterable by offer, unit type, format and angle. Automated
 * sources rarely send those as structured fields, so we read them off the
 * copy. Manual rows can override any of these.
 */

import type { AdFormat, Angle, OfferType, UnitType } from "./types";

export interface Classifiable {
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  cta?: string | null;
  landing_url?: string | null;
  format?: AdFormat | null;
  publisher_platforms?: string[] | null;
}

function haystack(ad: Classifiable): string {
  return [ad.headline, ad.primary_text, ad.description, ad.cta, ad.landing_url]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function classifyOffer(ad: Classifiable): OfferType {
  const t = haystack(ad);
  if (
    /\b(first month free|1st month free|one month free|month free|free month)\b/.test(t) ||
    /\bfirst\s+\d+\s+months?\s+free\b/.test(t)
  ) {
    return "first_month_free";
  }
  if (
    /\$\s?1(\.00)?\b/.test(t) &&
    /\b(move[- ]?in|to move in|first month|1st month|gets? you in)\b/.test(t)
  ) {
    return "dollar_move_in";
  }
  if (/\b(\d{1,2})\s?%\s*(off|discount)\b/.test(t) || /\bhalf off\b/.test(t)) {
    return "percent_off";
  }
  if (/\bfree (move|moving)?\s*(truck|van|rental)\b/.test(t) || /\btruck included\b/.test(t)) {
    return "free_truck";
  }
  if (
    /\b(special|promo|promotion|offer|deal|discount|free|\$\d)\b/.test(t)
  ) {
    return "other";
  }
  return "no_offer";
}

export function classifyUnit(ad: Classifiable): UnitType {
  const t = haystack(ad);
  if (/\b(climate[- ]controlled|air[- ]conditioned|a\/c|heated and cooled)\b/.test(t)) {
    return "climate_controlled";
  }
  if (/\b(drive[- ]up|drive up|roll[- ]up|ground[- ]level)\b/.test(t)) {
    return "drive_up";
  }
  if (/\b(rv|boat|vehicle storage|car storage|parking)\b/.test(t)) {
    return "vehicle";
  }
  if (/\b(business|commercial|office|warehouse|inventory)\b/.test(t)) {
    return "business";
  }
  return "general";
}

export function classifyAngle(ad: Classifiable): Angle {
  const t = haystack(ad);
  if (/\b(\d\.\d\s?[★*]|stars?|reviews?|rated|neighbors?|families trust|trusted)\b/.test(t)) {
    return "social_proof";
  }
  if (/\b(minutes? from|near you|around the corner|no lease|easy|convenient|online reserve)\b/.test(t)) {
    return "convenience";
  }
  if (/\b(only \d+|last \d+|limited|almost full|won'?t last|act now|today only|few left)\b/.test(t)) {
    return "urgency";
  }
  if (/\b(peace of mind|reclaim|breathe|organized|clutter|fresh start|room to)\b/.test(t)) {
    return "lifestyle";
  }
  if (/\b(\$\d+|\/mo|per month|from \$|first month|%\s*off)\b/.test(t)) {
    return "price";
  }
  return "other";
}

/**
 * Format when the source did not send one. Carousel if we saw multiple
 * bodies/titles; otherwise we stay honest and say unknown rather than guess
 * image vs video from copy.
 */
export function classifyFormat(ad: Classifiable, bodyCount = 1): AdFormat {
  if (ad.format && ad.format !== "unknown") return ad.format;
  if (bodyCount > 1) return "carousel";
  const t = haystack(ad);
  if (/\b(watch|video|reel|seconds)\b/.test(t)) return "video";
  return "unknown";
}

export function classify(ad: Classifiable, bodyCount = 1): {
  offer_type: OfferType;
  unit_type: UnitType;
  angle: Angle;
  format: AdFormat;
} {
  return {
    offer_type: classifyOffer(ad),
    unit_type: classifyUnit(ad),
    angle: classifyAngle(ad),
    format: classifyFormat(ad, bodyCount),
  };
}
