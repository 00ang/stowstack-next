import { db } from "@/lib/db";
import { SENDERS, sendEmail } from "@/lib/email";

export type ProvisionPortalResult =
  | { ok: true; code: string; email: string; created: boolean }
  | { ok: false; error: string };

/**
 * Provision client-portal access for a facility — the single source of truth
 * for turning a facility into a portal client.
 *
 * Idempotent: if a client row already exists for the facility, it returns the
 * existing access code without creating a duplicate or re-sending the welcome
 * email.
 *
 * This is called both when a lead is marked `client_signed` (CRM kanban) and
 * from the explicit admin "grant portal access" action, so portal access is no
 * longer coupled to the pipeline stage — any facility with a contact email can
 * be granted a login.
 */
export async function provisionPortalAccess(
  facilityId: string,
  opts: { sendWelcomeEmail?: boolean } = {}
): Promise<ProvisionPortalResult> {
  const facility = await db.facilities.findUnique({ where: { id: facilityId } });
  if (!facility) return { ok: false, error: "Facility not found" };

  const email = (facility.contact_email || "").trim();
  if (!email) {
    return {
      ok: false,
      error: "Add a contact email to this facility before granting portal access",
    };
  }

  // Idempotent — reuse the existing client login if one already exists.
  const existing = await db.clients.findFirst({
    where: { facility_id: facilityId },
    select: { access_code: true, email: true },
  });
  if (existing) {
    return { ok: true, code: existing.access_code, email: existing.email, created: false };
  }

  // Reuse the facility's access code if it has one, otherwise mint a new one
  // and keep the facility in sync (clients.access_code mirrors it).
  let code = facility.access_code;
  if (!code) {
    const { randomBytes } = await import("crypto");
    code = randomBytes(4).toString("hex").toUpperCase();
    await db.facilities.update({ where: { id: facilityId }, data: { access_code: code } });
  }

  await db.clients.create({
    data: {
      facility_id: facilityId,
      email,
      name: facility.contact_name || "",
      facility_name: facility.name || "",
      location: facility.location || "",
      occupancy_range: facility.occupancy_range || "",
      total_units: facility.total_units || "",
      access_code: code,
    },
  });

  if (opts.sendWelcomeEmail) {
    await sendWelcomeEmail(email, facility.contact_name || "", facility.name || "");
  }

  return { ok: true, code, email, created: true };
}

/**
 * Welcome email with portal login instructions. Failures are logged but never
 * throw — provisioning succeeds regardless of email deliverability, and the
 * client can always request a login code from /portal.
 */
async function sendWelcomeEmail(
  email: string,
  name: string,
  facilityName: string
): Promise<void> {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || "https://storageads.com";

  const result = await sendEmail({
    from: SENDERS.noreply,
    to: email,
    subject: `Welcome to StorageAds: Your ${facilityName || "Facility"} Portal is Ready`,
    tags: [{ name: "type", value: "portal_welcome" }],
    html: `
          <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; background: #faf9f5; color: #141413;">
            <div style="background: #141413; padding: 28px 24px; border-radius: 12px 12px 0 0;">
              <h1 style="color: #faf9f5; margin: 0; font-size: 22px;">Welcome to StorageAds</h1>
              <p style="color: rgba(250,249,245,0.85); margin: 8px 0 0; font-size: 14px;">Your client portal is ready</p>
            </div>
            <div style="padding: 28px 24px; border: 1px solid #e8e6dc; border-top: 0; border-radius: 0 0 12px 12px; background: #ffffff;">
              <p style="color: #6a6560; font-size: 15px; margin: 0 0 16px;">Hi ${name || "there"},</p>
              <p style="color: #6a6560; font-size: 15px; margin: 0 0 20px;">Your StorageAds portal for <strong>${facilityName || "your facility"}</strong> is set up and ready. You can log in to track campaigns, view reports, and message our team.</p>
              <p style="color: #6a6560; font-size: 15px; margin: 0 0 20px;">Your facility tools are in there too, under <strong>Facility Tools</strong>: make ads, build landing pages, and manage your Google listing. Same login, nothing extra to set up.</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${portalUrl}/portal" style="display: inline-block; background: #141413; color: #faf9f5; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                  Open Your Portal
                </a>
              </div>
              <p style="color: #6a6560; font-size: 14px; margin: 20px 0 8px;">To log in, go to <strong>${portalUrl}/portal</strong> and enter your email. We'll send a one-time login code.</p>
              <hr style="border: none; border-top: 1px solid #e8e6dc; margin: 24px 0;" />
              <p style="color: #6a6560; font-size: 14px; margin: 0 0 4px;"><strong>What happens next:</strong></p>
              <ol style="color: #6a6560; font-size: 14px; padding-left: 20px; margin: 8px 0;">
                <li style="margin-bottom: 6px;">Complete the onboarding wizard (5-10 minutes)</li>
                <li style="margin-bottom: 6px;">We build your campaigns (within 48 hours)</li>
                <li style="margin-bottom: 6px;">Ads go live and you start seeing results</li>
              </ol>
              <p style="color: #b0aea5; font-size: 12px; margin-top: 24px;">Questions? Reply to this email or reach Blake at blake@storageads.com.</p>
            </div>
          </div>
        `,
  });

  if (!result.ok && !result.skipped) {
    console.error(`[portal-provisioning] welcome email failed: ${result.error}`);
  }
}
