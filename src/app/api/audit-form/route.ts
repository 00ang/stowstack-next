import { randomBytes } from "crypto";
import { checkBotId } from "botid/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, getOrigin } from "@/lib/api-helpers";
import { applyRateLimitStrict } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidEmail, sanitizeString, escapeHtml } from "@/lib/validation";
import { SENDERS, sendEmail, submissionNotifyRecipients } from "@/lib/email";
import { humanProofError, mathAnswerError, verifyHumanProof, verifyMathAnswer } from "@/lib/human-check/server";
import { leadTextIsAutomated } from "@/lib/spam-text";
import { answersJson, mergeIntakeAnswers } from "@/lib/intake/merge-answers";
import { intakePhone, PHONE_SERVER_ERROR } from "@/lib/intake/phone";
import { applyAnswerProgress, withAuditStarted } from "@/lib/intake/progress";
import { scoreAndStore } from "@/lib/intake/score-lead";

const HOMEPAGE_SOURCES = new Set(["homepage_popup", "contact"]);

const OFFER_NOTE =
  "Offer: first month of StorageAds fee free from ads going live; operator pays ad spend. Source: homepage popup.";

export async function OPTIONS(request: NextRequest) {
  return corsResponse(getOrigin(request));
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimitStrict(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "audit-form");
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token || token.length > 64) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const facility = await db.facilities.findUnique({
    where: { intake_token: token },
    select: {
      id: true,
      contact_name: true,
      contact_email: true,
      contact_phone: true,
      name: true,
      location: true,
      intake_answers: true,
    },
  });
  if (!facility) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Opening the token link is the audit start. Stamp it once. Older
  // answers stay as they are. A failed write still returns the saved answers.
  const stamped = withAuditStarted(facility.intake_answers, new Date());
  let answers: unknown = facility.intake_answers || {};
  if (stamped.changed) {
    try {
      await db.facilities.update({
        where: { id: facility.id },
        data: { intake_answers: answersJson(stamped.answers) },
      });
      answers = stamped.answers;
    } catch (err) {
      console.error("[audit-form] audit start stamp failed:", err);
    }
  }

  return NextResponse.json({
    facilityId: facility.id,
    contactName: facility.contact_name,
    email: facility.contact_email,
    phone: facility.contact_phone,
    facilityName: facility.name,
    location: facility.location,
    answers,
  });
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimitStrict(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "audit-form");
  if (limited) return limited;
  const hourly = await applyRateLimitStrict(request, RATE_LIMIT_TIERS.AUDIT_FORM_HOURLY, "audit-form-hour");
  if (hourly) return hourly;

  try {
    const body = await request.json();
    const {
      phone,
      totalUnits,
      occupancyRange,
      runningAds,
      biggestChallenge,
      howHeard,
      source: rawSource,
      consent,
    } = body;

    const honeypot = typeof body.website_url === "string" ? body.website_url.trim() : "";

    const source =
      typeof rawSource === "string" && HOMEPAGE_SOURCES.has(rawSource)
        ? rawSource
        : "audit_form";

    const name = sanitizeString(body.name, 200);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const facilityName = sanitizeString(body.facilityName, 200);
    const location = sanitizeString(body.location, 500);
    const message = sanitizeString(body.message, 2000);
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    const e164 = cleanPhone ? intakePhone(cleanPhone) : null;

    if (source === "homepage_popup") {
      if (!name || !cleanPhone) {
        return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
      }
      if (!e164) {
        return NextResponse.json({ error: PHONE_SERVER_ERROR }, { status: 400 });
      }
      if (consent !== true) {
        return NextResponse.json({ error: "Consent is required to contact you" }, { status: 400 });
      }
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    } else if (source === "contact") {
      if (!name || !email) {
        return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
      if (cleanPhone && !e164) {
        return NextResponse.json({ error: PHONE_SERVER_ERROR }, { status: 400 });
      }
    } else {
      if (!name || !email || !facilityName || !location) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
      }
    }

    if (honeypot) {
      return NextResponse.json({ error: "That request was not accepted." }, { status: 400 });
    }

    const botRejected = await rejectAutomatedClient();
    if (botRejected) return botRejected;

    const math = await verifyMathAnswer(body.mathProblem, body.mathAnswer);
    if (!math.ok) {
      return NextResponse.json({ error: mathAnswerError(math.reason) }, { status: 403 });
    }

    const proof = await verifyHumanProof(body.humanProof);
    if (!proof.ok) {
      return NextResponse.json({ error: humanProofError(proof.reason) }, { status: 403 });
    }

    // A correct math answer can still be scripted. Random tokens are not a
    // facility, and they are rejected before a row or an email exists.
    if (leadTextIsAutomated({ name, facilityName, location })) {
      console.info("[audit-form] rejected random field text");
      return NextResponse.json(
        { error: "Use the real facility name and city." },
        { status: 400 }
      );
    }

    const resolvedFacilityName =
      facilityName || (source === "homepage_popup" ? "Homepage inquiry" : "Contact form");
    const resolvedLocation = location || "Not provided";

    const offerNote =
      source === "homepage_popup"
        ? OFFER_NOTE
        : source === "contact"
          ? `Source: contact page.${message ? ` Message: ${message}` : ""}`
          : howHeard
            ? `How heard: ${howHeard}`
            : null;

    const intakeToken = source === "homepage_popup" ? randomBytes(24).toString("hex") : null;

    const facility = await db.facilities.create({
      data: {
        name: resolvedFacilityName,
        location: resolvedLocation,
        contact_name: name,
        contact_email: email || null,
        contact_phone: e164 || cleanPhone || null,
        total_units: source === "homepage_popup" ? null : totalUnits || null,
        occupancy_range: source === "homepage_popup" ? null : occupancyRange || null,
        biggest_issue: source === "homepage_popup" ? null : biggestChallenge || null,
        notes: offerNote,
        form_notes: runningAds
          ? `Running ads: ${runningAds}`
          : source === "homepage_popup"
            ? "homepage_popup:first_month_free"
            : source === "contact"
              ? "contact_page"
              : null,
        status: "intake",
        pipeline_status: "submitted",
        ...(intakeToken
          ? {
              intake_token: intakeToken,
              intake_answers: answersJson({
                source: "homepage_popup",
                consent: true,
                ...(typeof body.elapsedSeconds === "number"
                  ? { seconds_to_complete: body.elapsedSeconds }
                  : {}),
              }),
            }
          : {}),
      },
    });

    if (source === "homepage_popup") {
      void scoreAndStore(facility.id).catch((err) =>
        console.error("[jev] score after create failed:", err)
      );
    }

    db.activity_log
      .create({
        data: {
          type: "lead_created",
          facility_id: facility.id,
          lead_name: name,
          facility_name: resolvedFacilityName,
          detail:
            source === "homepage_popup"
              ? `Homepage lead (first month of StorageAds free): ${name}`
              : source === "contact"
                ? `Contact form: ${name}`
                : `Audit request: ${resolvedFacilityName}`,
          meta: { source, email: email || null, phone: e164 || cleanPhone || null },
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    {
      const subject =
        source === "homepage_popup"
          ? `Homepage lead (first month of StorageAds free): ${escapeHtml(name)}`
          : source === "contact"
            ? `Contact form: ${escapeHtml(name)}`
            : `New Audit Request: ${escapeHtml(resolvedFacilityName)} (${escapeHtml(resolvedLocation)})`;

      await sendEmail({
        from: SENDERS.noreply,
        to: submissionNotifyRecipients(),
        subject,
        tags: [{ name: "type", value: source === "audit_form" ? "audit_request" : source }],
        html: `
              <h2>${source === "homepage_popup" ? "Homepage lead — first month of StorageAds free" : source === "contact" ? "Contact form" : "New Facility Audit Request"}</h2>
              <p><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p><strong>Email:</strong> ${escapeHtml(email || "N/A")}</p>
              <p><strong>Phone:</strong> ${escapeHtml(e164 || cleanPhone || "N/A")}</p>
              <p><strong>Facility:</strong> ${escapeHtml(resolvedFacilityName)}</p>
              <p><strong>Location:</strong> ${escapeHtml(resolvedLocation)}</p>
              <p><strong>Units:</strong> ${escapeHtml(String(totalUnits || "N/A"))}</p>
              <p><strong>Occupancy:</strong> ${escapeHtml(occupancyRange || "N/A")}</p>
              <p><strong>Running Ads:</strong> ${escapeHtml(runningAds || "N/A")}</p>
              <p><strong>Biggest Challenge:</strong> ${escapeHtml(biggestChallenge || "N/A")}</p>
              <p><strong>How Heard:</strong> ${escapeHtml(howHeard || "N/A")}</p>
              ${message ? `<p><strong>Message:</strong> ${escapeHtml(message)}</p>` : ""}
              ${source === "homepage_popup" ? "<p><strong>Offer claimed:</strong> first month of StorageAds free, from ads going live. Operator pays ad spend.</p>" : ""}
            `,
      });
    }

    return NextResponse.json({
      success: true,
      facilityId: facility.id,
      ...(intakeToken ? { intakeToken } : {}),
    });
  } catch (error) {
    console.error("Audit form error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Vercel BotID, with the deep check enabled in the project firewall.
 * A request that did not come from the page is rejected before a lead exists.
 */
async function rejectAutomatedClient() {
  try {
    const verification = await checkBotId({
      advancedOptions: { checkLevel: "deepAnalysis" },
    });
    if (verification.isBot) {
      return NextResponse.json({ error: "That request was not accepted." }, { status: 403 });
    }
    return null;
  } catch (error) {
    console.error("[audit-form] bot check failed:", error);
    return NextResponse.json({ error: "That request was not accepted." }, { status: 403 });
  }
}

/**
 * Save one qualifier answer onto the lead created at step 1.
 * Unknown keys are ignored. A skip clears that answer and does not
 * invent a value for the ones still blank.
 */
export async function PATCH(request: NextRequest) {
  const limited = await applyRateLimitStrict(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "audit-form");
  if (limited) return limited;
  const hourly = await applyRateLimitStrict(request, RATE_LIMIT_TIERS.AUDIT_FORM_HOURLY, "audit-form-hour");
  if (hourly) return hourly;

  try {
    const body = await request.json();
    const facilityId = typeof body.facilityId === "string" ? body.facilityId : "";
    const intakeToken = typeof body.intakeToken === "string" ? body.intakeToken : "";
    const patch =
      body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
        ? (body.answers as Record<string, unknown>)
        : null;

    if (!facilityId || !intakeToken || !patch) {
      return NextResponse.json({ error: "Missing lead" }, { status: 400 });
    }

    // Same browser check as the first save. The intake token is the lead.
    // A new math problem is not required on each question, or the popup
    // could not move to the next screen.
    const botRejected = await rejectAutomatedClient();
    if (botRejected) return botRejected;

    const facility = await db.facilities.findFirst({
      where: { id: facilityId, intake_token: intakeToken },
      select: { id: true, intake_answers: true },
    });
    if (!facility) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const merged = mergeIntakeAnswers(facility.intake_answers, patch);
    if (typeof body.elapsedSeconds === "number" && body.elapsedSeconds >= 0 && body.elapsedSeconds < 3600) {
      merged.intake_answers.seconds_to_complete = Math.round(body.elapsedSeconds);
    }
    const intake_answers = applyAnswerProgress(
      facility.intake_answers,
      merged.intake_answers,
      patch,
      new Date()
    );

    await db.facilities.update({
      where: { id: facility.id },
      data: {
        intake_answers: answersJson(intake_answers),
        ...merged.columns,
      },
    });

    void scoreAndStore(facility.id).catch((err) =>
      console.error("[jev] score after answer failed:", err)
    );

    return NextResponse.json({ success: true, answers: intake_answers });
  } catch (error) {
    console.error("Audit form update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
