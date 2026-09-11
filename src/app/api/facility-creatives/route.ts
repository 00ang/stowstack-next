import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonResponse, errorResponse, getOrigin, corsResponse, requireFacilityAccess } from "@/lib/api-helpers";
import { getCreativeContext } from "@/lib/creative";
import { getBrandContextForCopy } from "@/lib/brand-doctrine";
import { getStyleDirectives } from "@/lib/style-references";
import { getMarketContextForCopy } from "@/lib/market-research";
import { getFacilityLearningsContext } from "@/lib/facility-learnings";
import { validateCompliance } from "@/lib/compliance";
import { funnelConfigToDripSteps } from "@/lib/drip-sequences";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";

export const maxDuration = 60;

/* ═══════════════════════════════════════════════════════════════
   FACILITY CONTEXT BUILDER
   ═══════════════════════════════════════════════════════════════ */

async function buildFacilityContext(facilityId: string) {
  const [facilities, onboardingRows, pmsUnits, pmsSnapshots, pmsSpecials] = await Promise.all([
    db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT f.*, pd.photos, pd.reviews
       FROM facilities f
       LEFT JOIN LATERAL (
         SELECT photos, reviews FROM places_data
         WHERE facility_id = f.id ORDER BY fetched_at DESC LIMIT 1
       ) pd ON true
       WHERE f.id = ${facilityId}::uuid
    `,
    db.$queryRaw<Array<{ steps: Record<string, unknown> }>>`
      SELECT co.steps FROM client_onboarding co
       JOIN clients c ON c.id = co.client_id
       WHERE c.facility_id = ${facilityId}::uuid
       ORDER BY co.updated_at DESC LIMIT 1
    `,
    db.facility_pms_units
      .findMany({
        where: { facility_id: facilityId },
        orderBy: { total_count: "desc" },
        select: {
          unit_type: true,
          total_count: true,
          occupied_count: true,
          street_rate: true,
          web_rate: true,
          actual_avg_rate: true,
          features: true,
        },
      })
      .catch(() => []),
    db.facility_pms_snapshots
      .findFirst({
        where: { facility_id: facilityId },
        orderBy: { snapshot_date: "desc" },
        select: {
          occupancy_pct: true,
          actual_revenue: true,
          gross_potential: true,
          delinquency_pct: true,
          move_ins_mtd: true,
          move_outs_mtd: true,
        },
      })
      .catch(() => null),
    db.facility_pms_specials
      .findMany({
        where: { facility_id: facilityId, active: true },
        select: {
          name: true,
          description: true,
          discount_type: true,
          discount_value: true,
          applies_to: true,
        },
      })
      .catch(() => []),
  ]);

  if (!facilities.length) return null;
  const f = facilities[0] as Record<string, unknown>;
  const onboarding = (onboardingRows[0]?.steps as Record<string, Record<string, unknown>>) || null;

  const lines: string[] = [`Facility: ${f.name}`, `Location: ${f.location}`];
  if (f.google_rating) lines.push(`Google Rating: ${f.google_rating} stars (${f.review_count} reviews)`);
  if (f.google_address) lines.push(`Full Address: ${f.google_address}`);
  if (f.reviews && Array.isArray(f.reviews) && f.reviews.length) {
    const snippets = f.reviews
      .slice(0, 3)
      .map((r: Record<string, string>) => `"${r.text.slice(0, 150)}"`)
      .join("\n");
    lines.push(`Top Customer Reviews:\n${snippets}`);
  }
  if (f.photos && Array.isArray(f.photos) && f.photos.length) lines.push(`Photos available: ${f.photos.length}`);
  if (f.occupancy_range) lines.push(`Current occupancy: ${f.occupancy_range}`);
  if (f.biggest_issue) lines.push(`Operator's biggest challenge: ${f.biggest_issue}`);
  if (f.total_units) lines.push(`Total units: ${f.total_units}`);
  if (f.google_phone) lines.push(`Phone: ${f.google_phone}`);
  if (f.website) lines.push(`Website: ${f.website}`);

  if (onboarding) {
    const fd = (onboarding.facilityDetails as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (fd) {
      if (fd.brandDescription) lines.push(`\nBrand Description: ${fd.brandDescription}`);
      if (Array.isArray(fd.sellingPoints) && fd.sellingPoints.filter((s: string) => s.trim()).length) {
        lines.push(`Key Selling Points: ${fd.sellingPoints.filter((s: string) => s.trim()).join(", ")}`);
      }
      if (fd.brandColors) lines.push(`Brand Colors: ${fd.brandColors}`);
    }

    const td = (onboarding.targetDemographics as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (td) {
      const parts: string[] = [];
      if (td.ageMin && td.ageMax) parts.push(`ages ${td.ageMin}-${td.ageMax}`);
      if (td.radiusMiles) parts.push(`within ${td.radiusMiles} miles`);
      if (td.incomeLevel) parts.push(`${td.incomeLevel} income`);
      if (td.renterVsOwner) parts.push(`${td.renterVsOwner}`);
      if (parts.length) lines.push(`Target Audience: ${parts.join(", ")}`);
    }

    const um = (onboarding.unitMix as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (um?.units && Array.isArray(um.units) && um.units.length) {
      const unitLines = um.units
        .filter((u: Record<string, unknown>) => u.type)
        .map((u: Record<string, unknown>) => {
          const parts: string[] = [u.type as string];
          if (u.size) parts.push(u.size as string);
          if (u.monthlyRate) parts.push(`$${u.monthlyRate}/mo`);
          if (u.availableCount) parts.push(`${u.availableCount} available`);
          return parts.join(" — ");
        });
      if (unitLines.length) lines.push(`\nUnit Mix:\n${unitLines.join("\n")}`);
      if (um.specials) lines.push(`Current Specials/Promotions: ${um.specials}`);
    }

    const ci = (onboarding.competitorIntel as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (ci?.competitors && Array.isArray(ci.competitors) && ci.competitors.length) {
      const compLines = ci.competitors
        .filter((c: Record<string, unknown>) => c.name)
        .map((c: Record<string, unknown>) => {
          const parts: string[] = [c.name as string];
          if (c.distance) parts.push(c.distance as string);
          if (c.pricingNotes) parts.push(c.pricingNotes as string);
          return parts.join(" — ");
        });
      if (compLines.length) lines.push(`\nCompetitors:\n${compLines.join("\n")}`);
      if (ci.differentiation) lines.push(`Key Differentiator: ${ci.differentiation}`);
    }

    const ap = (onboarding.adPreferences as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
    if (ap) {
      if (ap.toneOfVoice) lines.push(`\nPreferred Tone: ${ap.toneOfVoice}`);
      if (ap.primaryGoal) lines.push(`Primary Ad Goal: ${ap.primaryGoal}`);
      if (ap.monthlyBudget) lines.push(`Monthly Budget: ${ap.monthlyBudget}`);
      if (ap.pastAdExperience) lines.push(`Past Ad Experience: ${ap.pastAdExperience}`);
      if (ap.notes) lines.push(`Operator Notes: ${ap.notes}`);
    }
  }

  if (pmsUnits.length) {
    const totalUnits = pmsUnits.reduce((s, u) => s + (u.total_count || 0), 0);
    const totalOccupied = pmsUnits.reduce((s, u) => s + (u.occupied_count || 0), 0);
    const totalVacant = totalUnits - totalOccupied;
    const overallOccupancy = totalUnits > 0 ? ((totalOccupied / totalUnits) * 100).toFixed(1) : null;
    const grossPotential = pmsUnits.reduce(
      (s, u) => s + (u.total_count || 0) * (Number(u.street_rate) || 0),
      0
    );
    const actualRevenue = pmsUnits.reduce(
      (s, u) => s + (u.occupied_count || 0) * (Number(u.actual_avg_rate || u.street_rate) || 0),
      0
    );
    const revenueLost = grossPotential - actualRevenue;

    lines.push("\n═══ storEDGE PMS DATA (CANONICAL SOURCE OF TRUTH) ═══");
    lines.push(
      "CRITICAL: This data comes directly from the operator's PMS. All recommendations MUST be grounded in these numbers."
    );

    lines.push("\nUNIT INVENTORY (by type):");
    pmsUnits.forEach((u) => {
      const occPct = u.total_count && u.total_count > 0 ? (((u.occupied_count || 0) / u.total_count) * 100).toFixed(0) : "0";
      const vacantCount = (u.total_count || 0) - (u.occupied_count || 0);
      const features =
        Array.isArray(u.features) && u.features.length ? ` [${(u.features as string[]).join(", ")}]` : "";
      const revenueGap = vacantCount * (Number(u.street_rate) || 0);
      lines.push(
        `  ${u.unit_type}: ${u.occupied_count}/${u.total_count} occupied (${occPct}%), ${vacantCount} vacant, street $${u.street_rate || "?"}/mo${u.web_rate ? `, web $${u.web_rate}/mo` : ""}${u.actual_avg_rate ? `, avg actual $${u.actual_avg_rate}/mo` : ""}${features}${revenueGap > 0 ? ` → $${revenueGap.toLocaleString()}/mo revenue opportunity` : ""}`
      );
    });

    lines.push(
      `\nFACILITY SUMMARY: ${overallOccupancy}% occupied, ${totalVacant} vacant units, $${actualRevenue.toLocaleString()}/mo actual revenue, $${grossPotential.toLocaleString()}/mo gross potential, $${revenueLost.toLocaleString()}/mo revenue gap`
    );

    const occ = parseFloat(overallOccupancy || "0");
    lines.push("\n--- STRATEGIC DIRECTIVE (based on occupancy level) ---");
    if (occ < 80) {
      lines.push(
        `STRATEGY: AGGRESSIVE DEMAND GENERATION. At ${occ}% occupancy, this facility needs volume.`
      );
    } else if (occ < 90) {
      lines.push(
        `STRATEGY: TARGETED DEMAND GENERATION. At ${occ}% occupancy, focus on underperforming unit types.`
      );
      const underperforming = pmsUnits.filter(
        (u) => u.total_count && u.total_count > 0 && ((u.occupied_count || 0) / u.total_count) * 100 < 80
      );
      if (underperforming.length) {
        lines.push(
          `Priority unit types to fill: ${underperforming.map((u) => `${u.unit_type} (${(u.total_count || 0) - (u.occupied_count || 0)} vacant)`).join(", ")}`
        );
      }
    } else if (occ < 95) {
      lines.push(
        `STRATEGY: SELECTIVE + RATE OPTIMIZATION. At ${occ}% occupancy, rate optimization becomes primary.`
      );
    } else {
      lines.push(
        `STRATEGY: REVENUE MAXIMIZATION. At ${occ}% occupancy, MINIMAL OR ZERO acquisition ad spend.`
      );
    }

    lines.push("\n--- RULES (NEVER VIOLATE) ---");
    lines.push("- NEVER advertise a unit type that is at 100% occupancy");
    lines.push("- NEVER use generic 'Self Storage Near You'");
    lines.push("- All pricing in ads/landing pages MUST match current PMS rates");
    lines.push("- Every recommendation must connect to revenue impact in dollars");
  }

  if (pmsSnapshots) {
    if (pmsSnapshots.move_ins_mtd || pmsSnapshots.move_outs_mtd) {
      const netMoveIns = (pmsSnapshots.move_ins_mtd || 0) - (pmsSnapshots.move_outs_mtd || 0);
      lines.push(
        `\nMonth-to-date activity: ${pmsSnapshots.move_ins_mtd} move-ins, ${pmsSnapshots.move_outs_mtd} move-outs (net ${netMoveIns >= 0 ? "+" : ""}${netMoveIns})`
      );
    }
    if (pmsSnapshots.delinquency_pct) lines.push(`Delinquency: ${pmsSnapshots.delinquency_pct}%`);
  }

  if (pmsSpecials.length) {
    lines.push("\nACTIVE PROMOTIONS (from PMS):");
    pmsSpecials.forEach((sp) => {
      const discount =
        sp.discount_type === "percent"
          ? `${sp.discount_value}% off`
          : sp.discount_type === "months_free"
            ? `${sp.discount_value} month(s) free`
            : `$${sp.discount_value} off`;
      const appliesTo =
        sp.applies_to && Array.isArray(sp.applies_to) && sp.applies_to.length
          ? ` (applies to: ${sp.applies_to.join(", ")})`
          : "";
      lines.push(`  ${sp.name}: ${discount}${appliesTo}${sp.description ? ` — ${sp.description}` : ""}`);
    });
  }

  return { facility: f, context: lines.join("\n"), onboarding };
}

/* ═══════════════════════════════════════════════════════════════
   SYSTEM PROMPTS
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPTS: Record<string, string> = {
  meta_feed: `You are an elite Meta (Facebook/Instagram) ad copywriter. You write like the best creative agencies in the world — Chiat\\Day, Wieden+Kennedy, Droga5. Your copy is for self-storage facilities but it should be good enough to compete with the best Super Bowl ads. Not "good for storage" — good, period.

You produce exactly 4 ad variations, each with a distinct angle. Return ONLY valid JSON — no markdown, no text outside the JSON.

CREATIVE DOCTRINE:
- Write like a smart friend, not a salesperson. Confident, warm, specific, never desperate.
- Wit is welcome — in the 1980s Porsche print ad tradition. Clever, never forced. A line that makes someone smirk gets remembered.
- Lead with what the customer gets, not what the facility has.
- Specificity is credibility. "$49/mo" beats "affordable." "4.8★ from 312 reviews" beats "highly rated." Naming the actual town beats "near you."
- Pre-qualify in the ad. Price, unit size, location, offer — all visible. We optimize for FEWER, BETTER clicks. Every non-converting click is wasted spend.
- Headlines: maximum 7 words. Every word earns its place. The best headline is a complete thought.
- Write at an 8th-grade reading level. Attention is scarce and clarity converts.
- The CTA is a moment of commitment: "Reserve My Unit" > "Submit." "Lock In This Price" > "Book Now."

META ALGORITHM OPTIMIZATION:
- Primary text: 80-125 characters. First sentence does 80% of the work — if they stop reading after one line, they should still get the point.
- Headline: under 40 characters. Bold claim or specific offer. This appears below the image.
- Description: under 30 characters. Reinforces the headline, not repeats it.
- No text-heavy language that reads like ad copy — Meta's Andromeda system rewards content that feels native to the feed.
- Reference the local area in primary text — Meta rewards relevance signals.
- Write for thumb-stopping in 0.5 seconds. The copy should complement a visual, not replace one.
- Each variation should feel like content someone chose to see, not content they're being subjected to.

ANGLES TO USE (one per variation):
1. social_proof — lead with real rating/reviews/move-in counts. Frame the facility as the default local choice. "47 families trust us" activates herd behavior.
2. convenience — proximity ("5 minutes from you"), ease ("Reserve online in 60 seconds"), no friction ("No long-term lease"). Storage is a convenience purchase.
3. urgency — limited units, seasonal demand, price lock. Must be grounded in real data — never fake scarcity. Urgency without credibility is spam.
4. lifestyle — emotional relief, peace of mind, reclaim your space. Speak to the FEELING (overwhelmed → relieved, chaotic → organized) not the feature. Edward Bernays principle: connect to what they already want.

OUTPUT STRUCTURE:
{
  "variations": [
    { "angle": "social_proof", "angleLabel": "Social Proof", "primaryText": "", "headline": "", "description": "", "cta": "", "targetingNote": "" }
  ]
}`,

  google_search: `You are an expert Google Ads copywriter specializing in self-storage facilities. You write high-converting Responsive Search Ads (RSA) for independent storage operators.

You produce a SINGLE RSA ad group with 15 headlines and 4 descriptions. Return ONLY valid JSON.

OUTPUT STRUCTURE:
{
  "adGroup": {
    "name": "",
    "headlines": [{ "text": "", "pin_position": null }],
    "descriptions": [{ "text": "" }],
    "finalUrl": "/",
    "sitelinks": [{ "title": "", "description": "" }],
    "keywords": [""]
  }
}`,

  landing_page: `You are an expert landing page copywriter specializing in self-storage facilities. You write high-converting, section-based landing page content for independent storage operators.

Generate a complete set of landing page sections. Return ONLY valid JSON.

OUTPUT STRUCTURE:
{
  "sections": [
    { "section_type": "hero", "sort_order": 0, "config": {} }
  ],
  "meta_title": "",
  "meta_description": ""
}`,

  email_drip: `You are an expert email marketing copywriter specializing in self-storage follow-up sequences. You write conversion-focused nurture emails for independent storage operators.

Generate a 4-email drip sequence. Return ONLY valid JSON.

OUTPUT STRUCTURE:
{
  "sequence": [
    { "step": 1, "delayDays": 2, "subject": "", "preheader": "", "body": "", "ctaText": "", "ctaUrl": "#reserve", "label": "" }
  ]
}`,
};

/* ═══════════════════════════════════════════════════════════════
   GENERATION LOGIC
   ═══════════════════════════════════════════════════════════════ */

function parseJsonResponse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse AI response as JSON");
    return JSON.parse(match[0]);
  }
}

async function generateWithClaude(systemPrompt: string, userMessage: string, apiKey: string) {
  const client = new Anthropic({ apiKey });
  Sentry.addBreadcrumb({ category: "external_api", message: "Calling Anthropic API", level: "info" });
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return parseJsonResponse(block.text.trim());
}

async function generateMetaAds(context: string, feedback: string | null, apiKey: string, facilityId?: string) {
  const feedbackNote = feedback ? `\n\nPREVIOUS FEEDBACK FROM REVIEWER:\n${feedback}` : "";
  const [creativeDirective, brandDoctrine, styleRefs, facilityLearnings] = await Promise.all([
    getCreativeContext("meta"),
    getBrandContextForCopy(),
    getStyleDirectives(facilityId),
    facilityId ? getFacilityLearningsContext(facilityId) : Promise.resolve(""),
  ]);
  const marketIntel = getMarketContextForCopy("meta");
  const userMessage = `Generate 4 Meta ad variations for this self-storage facility.${feedbackNote}\n\n${brandDoctrine}\n\n${marketIntel}\n\n${creativeDirective}\n\n${styleRefs}\n\n${facilityLearnings}\n\n${context}\n\nReturn the JSON object with the "variations" array.`;
  return generateWithClaude(SYSTEM_PROMPTS.meta_feed, userMessage, apiKey);
}

async function generateGoogleRSA(context: string, feedback: string | null, apiKey: string, facilityId?: string) {
  const feedbackNote = feedback ? `\n\nPREVIOUS FEEDBACK FROM REVIEWER:\n${feedback}` : "";
  const [brandDoctrine, creativeDirective, styleRefs, facilityLearnings] = await Promise.all([
    getBrandContextForCopy(),
    getCreativeContext("google_search"),
    getStyleDirectives(facilityId),
    facilityId ? getFacilityLearningsContext(facilityId) : Promise.resolve(""),
  ]);
  const marketIntel = getMarketContextForCopy("google_search");
  const userMessage = `Generate a Google Responsive Search Ad for this self-storage facility.${feedbackNote}\n\n${brandDoctrine}\n\n${marketIntel}\n\n${creativeDirective}\n\n${styleRefs}\n\n${facilityLearnings}\n\n${context}\n\nReturn the JSON object with the "adGroup".`;
  return generateWithClaude(SYSTEM_PROMPTS.google_search, userMessage, apiKey);
}

async function generateLandingPageCopy(context: string, feedback: string | null, apiKey: string, facilityId?: string) {
  const feedbackNote = feedback ? `\n\nPREVIOUS FEEDBACK FROM REVIEWER:\n${feedback}` : "";
  const [brandDoctrine, styleRefs, facilityLearnings] = await Promise.all([
    getBrandContextForCopy(),
    getStyleDirectives(facilityId),
    facilityId ? getFacilityLearningsContext(facilityId) : Promise.resolve(""),
  ]);
  const marketIntel = getMarketContextForCopy();
  const userMessage = `Generate complete landing page content for this self-storage facility.${feedbackNote}\n\n${brandDoctrine}\n\n${marketIntel}\n\n${styleRefs}\n\n${facilityLearnings}\n\n${context}\n\nReturn the JSON object with the "sections" array, "meta_title", and "meta_description".`;
  return generateWithClaude(SYSTEM_PROMPTS.landing_page, userMessage, apiKey);
}

async function generateEmailDrip(context: string, feedback: string | null, apiKey: string, facilityId?: string) {
  const feedbackNote = feedback ? `\n\nPREVIOUS FEEDBACK FROM REVIEWER:\n${feedback}` : "";
  const [brandDoctrine, styleRefs, facilityLearnings] = await Promise.all([
    getBrandContextForCopy(),
    getStyleDirectives(facilityId),
    facilityId ? getFacilityLearningsContext(facilityId) : Promise.resolve(""),
  ]);
  const marketIntel = getMarketContextForCopy();
  const userMessage = `Generate a 4-email drip sequence for this self-storage facility.${feedbackNote}\n\n${brandDoctrine}\n\n${marketIntel}\n\n${styleRefs}\n\n${facilityLearnings}\n\n${context}\n\nReturn the JSON object with the "sequence" array.`;
  return generateWithClaude(SYSTEM_PROMPTS.email_drip, userMessage, apiKey);
}

/* ═══════════════════════════════════════════════════════════════
   PERSISTENCE HELPERS
   ═══════════════════════════════════════════════════════════════ */

async function getOrCreateBrief(
  facilityId: string,
  facility: Record<string, unknown>,
  context: string,
  platforms: string[]
): Promise<string> {
  const existing = await db.creative_briefs.findFirst({
    where: { facility_id: facilityId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const newBrief = await db.creative_briefs.create({
    data: {
      facility_id: facilityId,
      brief_json: { facility: facility.name, location: facility.location, context } as unknown as Prisma.InputJsonValue,
      platform_recommendation: platforms,
      status: "draft",
    },
  });
  return newBrief.id;
}

async function getNextVersion(facilityId: string): Promise<number> {
  const result = await db.ad_variations.aggregate({
    where: { facility_id: facilityId },
    _max: { version: true },
  });
  return (result._max.version || 0) + 1;
}

async function insertVariations(
  variations: Array<Record<string, unknown>>,
  facilityId: string,
  briefId: string,
  platform: string,
  format: string,
  nextVersion: number
) {
  const inserted = [];
  for (const v of variations) {
    const angle = (v.angle as string) || (v.name as string) || platform;

    // Run compliance check
    let complianceStatus: string | null = null;
    let complianceFlags: unknown = null;
    try {
      const result = await validateCompliance(v, platform);
      complianceStatus = result.status;
      complianceFlags = result.flags.length > 0 ? result.flags : null;
    } catch {
      // Non-fatal
    }

    const row = await db.ad_variations.create({
      data: {
        facility_id: facilityId,
        brief_id: briefId,
        platform,
        format,
        angle,
        content_json: v as unknown as Prisma.InputJsonValue,
        status: "draft",
        version: nextVersion,
        compliance_status: complianceStatus,
        compliance_flags: complianceFlags as unknown as Prisma.InputJsonValue,
      },
    });
    inserted.push(row);
  }
  return inserted;
}

/* ═══════════════════════════════════════════════════════════════
   HANDLER
   ═══════════════════════════════════════════════════════════════ */

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function GET(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);
  const authErr = await requireFacilityAccess(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const facilityId = url.searchParams.get("facilityId");
  if (!facilityId) return errorResponse("facilityId required", 400, origin);

  try {
    const [variations, briefs] = await Promise.all([
      db.ad_variations.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: "desc" },
      }),
      db.creative_briefs.findMany({
        where: { facility_id: facilityId },
        orderBy: { created_at: "desc" },
      }),
    ]);
    return jsonResponse({ variations, briefs }, 200, origin);
  } catch {
    return errorResponse("Failed to fetch creatives", 500, origin);
  }
}

export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.EXPENSIVE_API, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const facilityId = body?.facilityId;
    if (!facilityId) return errorResponse("facilityId required", 400, origin);

    const denied = await requireFacilityAccess(req, facilityId);
    if (denied) return denied;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return errorResponse("Missing ANTHROPIC_API_KEY", 500, origin);

    const platform = body?.platform || "meta_feed";
    const feedback = body?.feedback || null;

    const facilityData = await buildFacilityContext(facilityId);
    if (!facilityData) return errorResponse("Facility not found", 404, origin);

    const { facility, context } = facilityData;
    const resultData: {
      variations: Array<Record<string, unknown>>;
      landingPage: unknown;
      emailSequence: unknown;
    } = { variations: [], landingPage: null, emailSequence: null };

    const platforms = platform === "all"
      ? ["meta_feed", "google_search", "landing_page", "email_drip"]
      : [platform];

    const briefId = await getOrCreateBrief(facilityId, facility, context, platforms);
    const nextVersion = await getNextVersion(facilityId);

    const generators: Promise<void>[] = [];

    if (platforms.includes("meta_feed")) {
      generators.push(
        generateMetaAds(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const inserted = await insertVariations(
            parsed.variations,
            facilityId,
            briefId,
            "meta_feed",
            "static",
            nextVersion
          );
          resultData.variations.push(...inserted);
        })
      );
    }

    if (platforms.includes("google_search")) {
      generators.push(
        generateGoogleRSA(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const compliance = await validateCompliance(parsed.adGroup || parsed, "google_search").catch(() => ({ status: "passed" as const, flags: [] }));
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "google_search",
              format: "text",
              angle: "rsa",
              content_json: parsed.adGroup as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
              compliance_status: compliance.status,
              compliance_flags: compliance.flags.length > 0 ? (compliance.flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          resultData.variations.push(row);
        })
      );
    }

    if (platforms.includes("landing_page")) {
      generators.push(
        generateLandingPageCopy(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "landing_page",
              format: "sections",
              angle: "full_page",
              content_json: parsed as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
            },
          });
          resultData.variations.push(row);
          resultData.landingPage = parsed;
        })
      );
    }

    if (platforms.includes("email_drip")) {
      generators.push(
        generateEmailDrip(context, feedback, apiKey, facilityId).then(async (parsed) => {
          const compliance = await validateCompliance(parsed, "sms").catch(() => ({ status: "passed" as const, flags: [] }));
          const row = await db.ad_variations.create({
            data: {
              facility_id: facilityId,
              brief_id: briefId,
              platform: "email_drip",
              format: "email",
              angle: "nurture_sequence",
              content_json: parsed as unknown as Prisma.InputJsonValue,
              status: "draft",
              version: nextVersion,
              compliance_status: compliance.status,
              compliance_flags: compliance.flags.length > 0 ? (compliance.flags as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            },
          });
          resultData.variations.push(row);
          resultData.emailSequence = parsed;
        })
      );
    }

    await Promise.all(generators);

    await db.facilities.updateMany({
      where: { id: facilityId, status: { in: ["intake", "scraped", "briefed"] } },
      data: { status: "generating" },
    });

    return jsonResponse(
      {
        variations: resultData.variations,
        briefId,
        landingPage: resultData.landingPage,
        emailSequence: resultData.emailSequence,
        platforms,
        version: nextVersion,
      },
      200,
      origin
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Copy generation failed: ${message}`, 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { variationId, status, feedback, content_json, funnel_config, deploy } = body || {};
    if (!variationId) return errorResponse("variationId required", 400, origin);

    const existing = await db.ad_variations.findUnique({
      where: { id: variationId },
      select: { facility_id: true },
    });
    if (!existing) return errorResponse("Not found", 404, origin);
    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    const VALID = ["draft", "review", "approved", "published", "rejected"];
    if (status && !VALID.includes(status)) return errorResponse("Invalid status", 400, origin);

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (feedback !== undefined) updateData.feedback = feedback;
    if (content_json) updateData.content_json = content_json;
    if (funnel_config) updateData.funnel_config = funnel_config;

    if (!Object.keys(updateData).length && !deploy) return errorResponse("Nothing to update", 400, origin);

    let variation;
    if (Object.keys(updateData).length) {
      variation = await db.ad_variations.update({
        where: { id: variationId },
        data: updateData,
      });
      if (!variation) return errorResponse("Variation not found", 404, origin);
    } else {
      variation = await db.ad_variations.findUnique({ where: { id: variationId } });
      if (!variation) return errorResponse("Variation not found", 404, origin);
    }

    const resultData: Record<string, unknown> = { variation };

    // Sync funnel config to drip_sequence_templates for real execution
    if (funnel_config && variation.facility_id) {
      try {
        const fConfig = funnel_config as { postConversion?: { channel: 'sms' | 'email'; message: string; timing: string }[] };
        if (fConfig.postConversion?.length) {
          const dripSteps = funnelConfigToDripSteps(fConfig.postConversion);
          await db.drip_sequence_templates.upsert({
            where: {
              facility_id_variation_id: {
                facility_id: variation.facility_id,
                variation_id: variationId,
              },
            },
            create: {
              facility_id: variation.facility_id,
              variation_id: variationId,
              name: `Funnel: ${(variation.angle || 'ad')} sequence`,
              steps: dripSteps as unknown as Prisma.InputJsonValue,
            },
            update: {
              name: `Funnel: ${(variation.angle || 'ad')} sequence`,
              steps: dripSteps as unknown as Prisma.InputJsonValue,
            },
          });
        }
      } catch {
        // Non-fatal — drip template sync failure shouldn't block the save
      }
    }

    if (status === "approved" && variation.facility_id) {
      await db.$transaction(async (tx) => {
        const pending = await tx.ad_variations.count({
          where: {
            facility_id: variation.facility_id,
            status: { notIn: ["approved", "published", "rejected"] },
          },
        });
        if (pending === 0) {
          await tx.facilities.update({
            where: { id: variation.facility_id! },
            data: { status: "approved" },
          });
        } else {
          await tx.facilities.update({
            where: { id: variation.facility_id! },
            data: { status: "review" },
          });
        }
      });
    }

    if (deploy === "landing_page" && variation.platform === "landing_page") {
      const lpContent =
        typeof variation.content_json === "string"
          ? JSON.parse(variation.content_json)
          : (variation.content_json as Record<string, unknown>);
      const fac = await db.facilities.findUnique({ where: { id: variation.facility_id! } });
      if (!fac) return errorResponse("Facility not found", 404, origin);

      const baseSlug = (fac.name || "storage")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      let slug = baseSlug;
      let attempt = 0;
      while (true) {
        const exists = await db.landing_pages.findFirst({ where: { slug } });
        if (!exists) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const txResult = await db.$transaction(async (tx) => {
        const page = await tx.landing_pages.create({
          data: {
            facility_id: variation.facility_id!,
            slug,
            title: (lpContent.meta_title as string) || `${fac.name} - Self Storage`,
            meta_title: (lpContent.meta_title as string) || null,
            meta_description: (lpContent.meta_description as string) || null,
            variation_ids: [variation.id],
            storedge_widget_url: fac.website || null,
          },
        });

        const sections = (lpContent.sections as Array<Record<string, unknown>>) || [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          await tx.landing_page_sections.create({
            data: {
              landing_page_id: page.id,
              sort_order: (s.sort_order as number) ?? i,
              section_type: s.section_type as string,
              config: (s.config as object) || {},
            },
          });
        }

        await tx.ad_variations.update({
          where: { id: variation.id },
          data: { status: "published" },
        });

        return page;
      });

      variation.status = "published";
      resultData.landingPage = { id: txResult.id, slug: txResult.slug, url: `/lp/${slug}` };
    }

    if (deploy === "email_drip" && variation.platform === "email_drip") {
      const dripContent =
        typeof variation.content_json === "string"
          ? JSON.parse(variation.content_json)
          : (variation.content_json as Record<string, unknown>);
      const sequence = (dripContent.sequence as Array<Record<string, unknown>>) || [];
      if (sequence.length === 0) return errorResponse("No email sequence in variation", 400, origin);

      await db.$transaction(async (tx) => {
        const stepsJson = JSON.stringify(
            sequence.map((e, i) => ({
              step: i,
              delayDays: e.delayDays,
              subject: e.subject,
              preheader: e.preheader,
              body: e.body,
              ctaText: e.ctaText,
              ctaUrl: e.ctaUrl,
              label: e.label,
            }))
          );
        await tx.$executeRaw`
          INSERT INTO drip_sequence_templates (facility_id, variation_id, name, steps)
           VALUES (${variation.facility_id}::uuid, ${variation.id}::uuid, ${"AI-Generated Drip"}, ${stepsJson}::jsonb)
           ON CONFLICT (facility_id, variation_id) DO UPDATE SET steps = ${stepsJson}::jsonb, updated_at = NOW()
        `;

        await tx.ad_variations.update({
          where: { id: variation.id },
          data: { status: "published" },
        });
      });

      variation.status = "published";
      resultData.dripActivated = true;
    }

    return jsonResponse(resultData, 200, origin);
  } catch {
    return errorResponse("Failed to update variation", 500, origin);
  }
}

export async function DELETE(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.AUTHENTICATED, "facility-creatives");
  if (limited) return limited;

  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { variationId } = body || {};
    if (!variationId) return errorResponse("variationId required", 400, origin);

    const existing = await db.ad_variations.findUnique({
      where: { id: variationId },
      select: { facility_id: true },
    });
    if (!existing) return errorResponse("Not found", 404, origin);
    const denied = await requireFacilityAccess(req, existing.facility_id);
    if (denied) return denied;

    await db.ad_variations.delete({ where: { id: variationId } });
    return jsonResponse({ success: true }, 200, origin);
  } catch {
    return errorResponse("Failed to delete variation", 500, origin);
  }
}
