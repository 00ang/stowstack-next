import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { SENDERS, sendEmail, submissionNotifyRecipients } from "@/lib/email";

const WEBHOOK_SECRET = process.env.CALCOM_WEBHOOK_SECRET;

/**
 * Verify Cal.com webhook signature.
 * Cal.com signs with HMAC-SHA256 in the X-Cal-Signature-256 header.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }
  if (!signature) return false;

  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/calcom
 * Handles booking events from Cal.com to update pipeline status.
 *
 * Cal.com sends events like:
 * - BOOKING_CREATED: new booking
 * - BOOKING_CANCELLED: cancelled
 * - BOOKING_RESCHEDULED: rescheduled
 */
export async function POST(req: NextRequest) {
  const limited = await applyRateLimit(req, RATE_LIMIT_TIERS.WEBHOOK, "wh-calcom");
  if (limited) return limited;
  try {
    const rawBody = await req.text();

    const signature = req.headers.get("x-cal-signature-256");
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const { triggerEvent, payload: eventData } = payload;

    if (triggerEvent === "BOOKING_CREATED" || triggerEvent === "BOOKING_RESCHEDULED") {
      const attendeeEmail = eventData?.attendees?.[0]?.email?.toLowerCase();
      const attendeeName = eventData?.attendees?.[0]?.name;
      const bookingTitle = eventData?.title;
      const startTime = eventData?.startTime;

      if (attendeeEmail) {
        // Find facility by contact email
        const facility = await db.facilities.findFirst({
          where: { contact_email: { equals: attendeeEmail, mode: "insensitive" } },
        });

        if (facility) {
          // Update pipeline status to call_booked
          await db.facilities.update({
            where: { id: facility.id },
            data: { pipeline_status: "call_booked" },
          });

          // Log the booking
          await db.activity_log.create({
            data: {
              type: "call_booked",
              facility_id: facility.id,
              lead_name: attendeeName || facility.contact_name || "",
              facility_name: facility.name,
              detail: `Call booked: ${bookingTitle || "30-min consultation"}${startTime ? ` on ${new Date(startTime).toLocaleDateString()}` : ""}`,
              meta: {
                email: attendeeEmail,
                bookingTitle,
                startTime,
                triggerEvent,
              },
            },
          });

          // Send pre-call context email to Blake (non-blocking).
          {
            const adminEmail = submissionNotifyRecipients();
            void sendEmail({
              from: SENDERS.noreply,
              to: adminEmail,
              subject: `Call Booked: ${facility.name} — ${attendeeName || attendeeEmail}`,
              tags: [{ name: "type", value: "call_booked" }],
              html: `
                  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 500px; color: #141413;">
                    <h2 style="color: #141413; margin: 0 0 12px;">New Call Booked</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 6px 0; color: #6a6560;">Facility</td><td style="padding: 6px 0;"><strong>${facility.name}</strong></td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Contact</td><td style="padding: 6px 0;">${attendeeName || "N/A"} (${attendeeEmail})</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Phone</td><td style="padding: 6px 0;">${facility.contact_phone || "N/A"}</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Location</td><td style="padding: 6px 0;">${facility.location || "N/A"}</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Units</td><td style="padding: 6px 0;">${facility.total_units || "N/A"}</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Occupancy</td><td style="padding: 6px 0;">${facility.occupancy_range || "N/A"}</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Biggest Issue</td><td style="padding: 6px 0;">${facility.biggest_issue || "N/A"}</td></tr>
                      <tr><td style="padding: 6px 0; color: #6a6560;">Pipeline</td><td style="padding: 6px 0;">call_booked</td></tr>
                      ${startTime ? `<tr><td style="padding: 6px 0; color: #6a6560;">Call Time</td><td style="padding: 6px 0;">${new Date(startTime).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })}</td></tr>` : ""}
                    </table>
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://storageads.com"}/admin/facilities" style="display: inline-block; background: #141413; color: #faf9f5; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; margin-top: 16px;">
                      View in Admin
                    </a>
                  </div>
                `,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Cal.com webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
