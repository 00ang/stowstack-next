import { describe, expect, it } from "vitest";
import {
  ADAPT_SYSTEM_PROMPT,
  bannedPhrases,
  buildAdaptUserMessage,
  containsBanned,
  fallbackAdapt,
  isVerbatimCopy,
  mapCta,
  ngramOverlap,
  parseAdaptedJson,
  scrubAdapted,
} from "../adapt";
import type { FacilitySnapshot } from "../types";
import type { SourceCopy } from "../adapt";

const facility: FacilitySnapshot = {
  id: "fac-1",
  name: "Northside Storage",
  location: "Columbus, OH",
  city: "Columbus",
  state: "OH",
  address: "100 High St, Columbus, OH",
  website: "https://northside.example",
  phone: "6145550100",
  rating: 4.8,
  reviewCount: 212,
  fromRate: 49,
  vacantUnits: 14,
  specials: ["First month $1"],
  openUnitTypes: ["10x10 Climate"],
};

const source: SourceCopy = {
  advertiser_name: "Public Storage, Inc.",
  headline: "First month free at Public Storage",
  primary_text:
    "Public Storage in Dallas has climate units from $1 move-in. Reserve a unit online today before they fill.",
  description: "Limited time offer",
  cta: "Reserve Now",
  city: "Dallas",
  angle: "price",
  offer_type: "dollar_move_in",
  format: "image",
  platform: "meta",
};

describe("bannedPhrases", () => {
  it("includes the other facility's name and a stripped Inc. form", () => {
    const banned = bannedPhrases(source, facility);
    expect(banned).toContain("Public Storage, Inc.");
    expect(banned).toContain("Public Storage");
    expect(banned).toContain("Dallas");
  });

  it("does not ban the city when it is also the target city", () => {
    const sameCity = bannedPhrases({ ...source, city: "Columbus" }, facility);
    expect(sameCity).not.toContain("Columbus");
  });
});

describe("ngramOverlap / verbatim", () => {
  it("finds a 6-word lift from the source", () => {
    expect(
      ngramOverlap(
        "climate units from $1 move-in reserve extra words here",
        source.primary_text || "",
        6
      )
    ).not.toBeNull();
  });

  it("flags a copied headline", () => {
    expect(
      isVerbatimCopy(
        {
          angle: "price",
          angleLabel: "Price",
          headline: "First month free at Public Storage",
          primaryText: "Something original about Northside.",
          description: "See rates",
          cta: "Learn More",
          targetingNote: "",
        },
        source
      )
    ).toBeTruthy();
  });
});

describe("fallbackAdapt", () => {
  it("uses the target name and city, never the source advertiser", () => {
    const copy = fallbackAdapt(source, facility);
    const blob = `${copy.headline} ${copy.primaryText} ${copy.description}`;
    expect(blob.toLowerCase()).toContain("northside");
    expect(blob.toLowerCase()).toContain("columbus");
    expect(containsBanned(blob, bannedPhrases(source, facility))).toBeNull();
    expect(isVerbatimCopy(copy, source)).toBeNull();
    expect(scrubAdapted(copy, source, facility)).toEqual({ ok: true });
  });

  it("keeps the source angle", () => {
    expect(fallbackAdapt({ ...source, angle: "lifestyle" }, facility).angle).toBe("lifestyle");
    expect(fallbackAdapt({ ...source, angle: "social_proof" }, facility).headline).toMatch(/4\.8/);
  });

  it("maps a reserve-style CTA onto a Meta CTA", () => {
    expect(mapCta("Reserve Now")).toBe("Book Now");
    expect(mapCta("Learn More")).toBe("Learn More");
  });
});

describe("scrubAdapted", () => {
  it("rejects copy that still names the source advertiser", () => {
    const bad = fallbackAdapt(source, facility);
    bad.primaryText = "Try Public Storage this week in Columbus.";
    const r = scrubAdapted(bad, source, facility);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Public Storage/);
  });
});

describe("adapt prompt", () => {
  it("hands the model the read when the library has one", () => {
    const msg = buildAdaptUserMessage(
      { ...source, read: { why: "Price first, then proof.", beats: [{ label: "Offer", text: "Leads with a $1 month." }] } },
      facility
    );
    expect(msg).toMatch(/why_it_works \(keep this mechanism\): Price first/);
    expect(msg).toMatch(/Offer: Leads with a \$1 month/);
    expect(buildAdaptUserMessage(source, facility)).not.toMatch(/why_it_works/);
  });

  it("writes fallback copy without dashes", () => {
    for (const angle of ["social_proof", "convenience", "urgency", "lifestyle", "price", "other"]) {
      const c = fallbackAdapt({ ...source, angle }, facility);
      expect(`${c.headline} ${c.primaryText} ${c.description}`).not.toMatch(/[\u2014\u2013]/);
    }
  });

  it("tells the model not to reuse source words or names", () => {
    expect(ADAPT_SYSTEM_PROMPT).toMatch(/Do not reuse the source headline/);
    expect(ADAPT_SYSTEM_PROMPT).toMatch(/Do not use the source advertiser's name/);
    const msg = buildAdaptUserMessage(source, facility);
    expect(msg).toMatch(/DO NOT REUSE/);
    expect(msg).toMatch(/Northside Storage/);
    expect(msg).toMatch(/First month \$1/);
  });

  it("parses a well-formed model payload", () => {
    const parsed = parseAdaptedJson({
      angle: "price",
      angleLabel: "Price",
      primaryText: "Northside Storage in Columbus from $49/mo.",
      headline: "$1 first month",
      description: "Lock this rate",
      cta: "Book Now",
    });
    expect(parsed?.headline).toBe("$1 first month");
    expect(parseAdaptedJson({ headline: "only" })).toBeNull();
  });
});
