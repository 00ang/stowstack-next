import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { corsResponse, getOrigin } from "@/lib/api-helpers";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { isValidEmail, sanitizeString, escapeHtml } from "@/lib/validation";
import { SENDERS, sendEmail } from "@/lib/email";
import { normalisePhone } from "@/lib/messaging/types";

const HOMEPAGE_SOURCES = new Set(["homepage_popup", "contact"]);

export async function OPTIONS(request: NextRequest) {
  return corsResponse(getOrigin(request));
}

export async function POST(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "audit-form");
  if (limited) return limited;

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

    // Honeypot: bots fill hidden fields. Fake success so they don't iterate.
    const honeypot = typeof body.website_url === "string" ? body.website_url.trim() : "";
    if (honeypot) {
      return NextResponse.json({ success: true });
    }

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
    const e164 = cleanPhone ? normalisePhone(cleanPhone) : null;

    if (source === "homepage_popup") {
      if (!name || !cleanPhone) {
        return NextResponse.json(
          { error: "Name and phone are required" },
          { status: 400 }
        );
      }
      if (!e164) {
        return NextResponse.json(
          { error: "Enter a valid US phone number" },
          { status: 400 }
        );
      }
      if (consent !== true) {
        return NextResponse.json(
          { error: "Consent is required to contact you" },
          { status: 400 }
        );
      }
      if (email && !isValidEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    } else if (source === "contact") {
      if (!name || !email) {
        return NextResponse.json(
          { error: "Name and email are required" },
          { status: 400 }
        );
      }
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
      if (cleanPhone && !e164) {
        return NextResponse.json(
          { error: "Enter a valid US phone number" },
          { status: 400 }
        );
      }
    } else {
      if (!name || !email || !facilityName || !location) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    const resolvedFacilityName =
      facilityName ||
      (source === "homepage_popup" ? "Homepage inquiry" : "Contact form");
    const resolvedLocation = location || "Not provided";

    const offerNote =
      source === "homepage_popup"
        ? // TODO(pricing): FAQ still says "month four is free"
          // (src/components/marketing/faq.tsx). This path offers first month
          // free per go-live request. Do not invent a reconciled offer.
          "Offer: first month free. Source: homepage popup."
        : source === "contact"
          ? `Source: contact page.${message ? ` Message: ${message}` : ""}`
          : howHeard
            ? `How heard: ${howHeard}`
            : null;

    const facility = await db.facilities.create({
      data: {
        name: resolvedFacilityName,
        location: resolvedLocation,
        contact_name: name,
        contact_email: email || null,
        contact_phone: e164 || cleanPhone || null,
        total_units: totalUnits || null,
        occupancy_range: occupancyRange || null,
        biggest_issue: biggestChallenge || null,
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
      },
    });

    db.activity_log
      .create({
        data: {
          type: "lead_created",
          facility_id: facility.id,
          lead_name: name,
          facility_name: resolvedFacilityName,
          detail:
            source === "homepage_popup"
              ? `Homepage lead (first month free): ${name}`
              : source === "contact"
                ? `Contact form: ${name}`
                : `Audit request: ${resolvedFacilityName}`,
          meta: { source, email: email || null, phone: e164 || cleanPhone || null },
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    const subject =
      source === "homepage_popup"
        ? `Homepage lead (first month free): ${escapeHtml(name)}`
        : source === "contact"
          ? `Contact form: ${escapeHtml(name)}`
          : `New Audit Request: ${escapeHtml(resolvedFacilityName)} (${escapeHtml(resolvedLocation)})`;

    await sendEmail({
      from: SENDERS.noreply,
      to: [process.env.ADMIN_EMAIL || "blake@storageads.com"],
      subject,
      tags: [{ name: "type", value: source === "audit_form" ? "audit_request" : source }],
      html: `
              <h2>${source === "homepage_popup" ? "Homepage lead — first month free" : source === "contact" ? "Contact form" : "New Facility Audit Request"}</h2>
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
              ${source === "homepage_popup" ? "<p><strong>Offer claimed:</strong> first month free</p>" : ""}
            `,
    });

    return NextResponse.json({
      success: true,
      facilityId: facility.id,
    });
  } catch (error) {
    console.error("Audit form error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
