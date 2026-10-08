import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { setManageCookie } from "@/lib/manage-session";
import { clientToolFacilityIds } from "@/lib/owner-tools";

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

/**
 * Account-manager contact shown in the portal "Your Team" / settings card.
 * For StorageAds-managed clients this is the founder; for white-label
 * management-company clients it must be THAT company's contact, never ours.
 */
export const DEFAULT_ACCOUNT_MANAGER = {
  name: "Blake",
  email: "blake@storageads.com",
  phone: "+1 (269) 929-8541",
  initial: "B",
} as const;

export interface AccountManager {
  name: string;
  email: string;
  phone: string | null;
  initial: string;
}

/**
 * Pure: pick the account-manager contact for a facility's owning org. Only a
 * white-label org with a real contact email overrides the StorageAds default —
 * a white-label org missing contact info falls back rather than showing a blank
 * card. Exported for unit testing the branch logic.
 */
export function pickAccountManager(
  org:
    | {
        name: string;
        white_label: boolean | null;
        contact_email: string | null;
        contact_phone: string | null;
      }
    | null
    | undefined
): AccountManager {
  if (org?.white_label && org.contact_email) {
    return {
      name: org.name,
      email: org.contact_email,
      phone: org.contact_phone ?? null,
      initial: (org.name.trim()[0] ?? "?").toUpperCase(),
    };
  }
  return { ...DEFAULT_ACCOUNT_MANAGER };
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { email, accessCode } = body || {};
    if (!email || !accessCode) {
      return errorResponse("Email and access code required", 400, origin);
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const trimmedCode = accessCode.trim();

    // Brute-force protection: max 5 verification attempts per 15 minutes per email
    const rl = await checkRateLimit(`portal_verify:${sanitizedEmail}`, 5, 900);
    if (!rl.allowed) {
      return errorResponse("Too many attempts. Please try again later.", 429, origin);
    }

    // Helper to build client response
    async function clientResponse(c: {
      facility_id: string;
      email: string;
      name: string;
      facility_name: string | null;
      location: string | null;
      occupancy_range: string | null;
      total_units: string | null;
      signed_at: Date | null;
      access_code: string;
      monthly_goal: number | null;
    }) {
      // White-label clients see their management company's contact, not ours.
      const facility = await db.facilities.findUnique({
        where: { id: c.facility_id },
        select: {
          organizations: {
            select: {
              name: true,
              white_label: true,
              contact_email: true,
              contact_phone: true,
            },
          },
        },
      });
      const accountManager = pickAccountManager(facility?.organizations);

      const res = jsonResponse(
        {
          client: {
            facilityId: c.facility_id,
            email: c.email,
            name: c.name,
            facilityName: c.facility_name,
            location: c.location,
            occupancyRange: c.occupancy_range,
            totalUnits: c.total_units,
            signedAt: c.signed_at,
            accessCode: c.access_code,
            monthlyGoal: c.monthly_goal || 0,
            accountManager,
          },
        },
        200,
        origin
      );

      // One login: signing in to the portal (and every portal load, which
      // re-verifies here) also opens the facility tools at /portal/tools, for
      // every facility this email is a client of. The tools never block the
      // portal: on any failure the client just has no tools session.
      try {
        setManageCookie(res, await clientToolFacilityIds(c.email), "portal");
      } catch (err) {
        console.error("[client-data] tools session not minted:", err);
      }
      return res;
    }

    // Try temporary 4-digit login code first
    if (/^\d{4,6}$/.test(trimmedCode)) {
      const loginCode = await db.portal_login_codes.findFirst({
        where: {
          email: { equals: sanitizedEmail, mode: "insensitive" },
          code: trimmedCode,
          used: false,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: "desc" },
      });

      if (loginCode) {
        // Mark code as used
        await db.portal_login_codes.update({
          where: { id: loginCode.id },
          data: { used: true },
        });

        const client = await db.clients.findFirst({
          where: { email: { equals: sanitizedEmail, mode: "insensitive" } },
        });

        if (client) {
          resetRateLimit(`portal_verify:${sanitizedEmail}`).catch((err) => console.error("[rate_limit] Fire-and-forget failed:", err));
          return await clientResponse(client);
        }
      }
    }

    // Fall back to legacy permanent access code
    const client = await db.clients.findUnique({
      where: { access_code: trimmedCode },
    });

    if (!client) {
      return errorResponse("Invalid or expired code", 401, origin);
    }

    if (client.email.toLowerCase() !== sanitizedEmail) {
      return errorResponse("Invalid credentials", 401, origin);
    }

    resetRateLimit(`portal_verify:${sanitizedEmail}`).catch((err) => console.error("[rate_limit] Fire-and-forget failed:", err));
    return await clientResponse(client);
  } catch {
    return errorResponse("Internal error", 500, origin);
  }
}

export async function PATCH(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    const body = await req.json();
    const { email, accessCode, monthlyGoal, notificationPreferences } =
      body || {};

    if (!email || !accessCode) {
      return errorResponse("Email and access code required", 400, origin);
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const trimmedCode = accessCode.trim();

    // Authenticate — same logic as POST
    let client: { id: string; email: string } | null = null;

    if (/^\d{4,6}$/.test(trimmedCode)) {
      // Check for valid UNUSED login code within expiry window
      const loginCode = await db.portal_login_codes.findFirst({
        where: {
          email: { equals: sanitizedEmail, mode: "insensitive" },
          code: trimmedCode,
          used: false,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: "desc" },
      });

      // Mark code as used immediately to prevent replay
      if (loginCode) {
        await db.portal_login_codes.update({
          where: { id: loginCode.id },
          data: { used: true },
        });
      }

      if (loginCode) {
        client = await db.clients.findFirst({
          where: { email: { equals: sanitizedEmail, mode: "insensitive" } },
          select: { id: true, email: true },
        });
      }
    }

    if (!client) {
      // Fall back to legacy access code
      const found = await db.clients.findUnique({
        where: { access_code: trimmedCode },
        select: { id: true, email: true },
      });
      if (found && found.email.toLowerCase() === sanitizedEmail) {
        client = found;
      }
    }

    if (!client) {
      return errorResponse("Invalid credentials", 401, origin);
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};
    if (typeof monthlyGoal === "number" && monthlyGoal >= 0) {
      updateData.monthly_goal = monthlyGoal;
    }
    if (notificationPreferences && typeof notificationPreferences === "object") {
      updateData.notification_preferences = notificationPreferences;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("No valid fields to update", 400, origin);
    }

    await db.clients.update({
      where: { id: client.id },
      data: updateData,
    });

    // The goal an owner sets is this month's goal too. /api/client-goals
    // snapshots each month's target when the month's row is first read, so
    // without this a goal set mid-month would not show until next month.
    if (typeof updateData.monthly_goal === "number") {
      const now = new Date();
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      await db.client_goals.upsert({
        where: { client_id_period_month: { client_id: client.id, period_month: month } },
        update: { target: updateData.monthly_goal },
        create: { client_id: client.id, period_month: month, target: updateData.monthly_goal, actual: 0 },
      });
    }

    return jsonResponse({ success: true }, 200, origin);
  } catch {
    return errorResponse("Internal error", 500, origin);
  }
}
