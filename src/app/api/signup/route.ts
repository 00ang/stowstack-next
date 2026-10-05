import { NextRequest } from "next/server";
import crypto from "crypto";
import { promisify } from "util";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session-auth";
import {
  jsonResponse,
  errorResponse,
  getOrigin,
  corsResponse,
} from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { PLANS } from "@/lib/stripe";
import { sendVerificationEmail } from "@/lib/verification-email";

const scryptAsync = promisify(crypto.scrypt);
const SCRYPT_KEYLEN = 64;

const VALID_PLANS = ["launch", "growth", "portfolio"] as const;
type Plan = (typeof VALID_PLANS)[number];

// Canonical facility limits come from lib/stripe.ts PLANS. -1 (unlimited) is
// stored as a very large number so the DB column can remain a positive Int.
function facilityLimitFor(plan: Plan): number {
  const limit = PLANS[plan].facilityLimit;
  return limit === -1 ? 999 : limit;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateSlug(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const suffix = crypto.randomBytes(2).toString("hex"); // 4 hex chars
  return `${base}-${suffix}`;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

interface SignupBody {
  companyName?: string;
  contactName?: string;
  email?: string;
  password?: string;
  plan?: string;
  facilityCount?: number;
}

export async function OPTIONS(req: NextRequest) {
  return corsResponse(getOrigin(req));
}

export async function POST(req: NextRequest) {
  const origin = getOrigin(req);

  try {
    // Rate limit by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await checkRateLimit(`signup:${ip}`, 5, 3600);
    if (!rl.allowed) {
      return errorResponse(
        "Too many signup attempts. Please try again later.",
        429,
        origin
      );
    }

    const body = (await req.json()) as SignupBody;
    const { companyName, contactName, email, password, plan, facilityCount } =
      body;

    // Validate required fields
    if (!companyName || !companyName.trim()) {
      return errorResponse("Company name is required", 400, origin);
    }
    if (!contactName || !contactName.trim()) {
      return errorResponse("Contact name is required", 400, origin);
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return errorResponse("A valid email address is required", 400, origin);
    }
    if (!password || password.length < 8) {
      return errorResponse(
        "Password must be at least 8 characters",
        400,
        origin
      );
    }

    const selectedPlan: Plan =
      plan && VALID_PLANS.includes(plan as Plan)
        ? (plan as Plan)
        : "launch";

    // Generate slug and check uniqueness
    let slug = generateSlug(companyName);
    const existingSlugs = await db.organizations.findFirst({
      where: { slug },
    });
    if (existingSlugs) {
      // Regenerate with different random suffix
      slug = generateSlug(companyName);
    }

    // Check if email is already registered
    const existingUser = await db.org_users.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return errorResponse(
        "An account with this email already exists. Please log in instead.",
        409,
        origin
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Create organization, user, and settings atomically
    const userId = crypto.randomUUID();
    const emailVerifyToken = crypto.randomBytes(32).toString("hex");
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { org } = await db.$transaction(async (tx) => {
      const org = await tx.organizations.create({
        data: {
          name: companyName.trim(),
          slug,
          plan: selectedPlan,
          facility_limit: facilityLimitFor(selectedPlan),
          status: "active",
          subscription_status: "trialing",
          trial_ends_at: trialEndsAt,
          signup_source: "self_serve",
          contact_email: email.toLowerCase(),
        },
      });

      await tx.org_users.create({
        data: {
          id: userId,
          organization_id: org.id,
          email: email.toLowerCase(),
          name: contactName.trim(),
          role: "org_admin",
          status: "active",
          password_hash: passwordHash,
          email_verified: false,
          email_verify_token: emailVerifyToken,
          email_verify_expires_at: emailVerifyExpiresAt,
        },
      });

      // Store facility count in org settings if provided
      if (facilityCount && facilityCount > 0) {
        await tx.organizations.update({
          where: { id: org.id },
          data: {
            settings: { facilityCount },
          },
        });
      }

      return { org };
    });

    // Fire-and-forget verification email so signup response isn't blocked
    // by email delivery. User can request a resend from /verify-email.
    sendVerificationEmail({
      to: email.toLowerCase(),
      name: contactName.trim(),
      token: emailVerifyToken,
    }).catch((err) => console.error("[signup] verification email failed:", err));

    db.activity_log
      .create({
        data: {
          type: "signup",
          lead_name: contactName.trim(),
          facility_name: companyName.trim(),
          detail: `Self-serve signup: ${companyName.trim()} (${selectedPlan})`,
          meta: { orgId: org.id, plan: selectedPlan, email: email.toLowerCase() },
        },
      })
      .catch((err) => console.error("[activity_log] Fire-and-forget failed:", err));

    // Create session
    const token = await createSession(userId, req);

    return jsonResponse(
      {
        token,
        user: {
          id: userId,
          email: email.toLowerCase(),
          name: contactName.trim(),
          role: "org_admin",
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
        },
      },
      201,
      origin
    );
  } catch (err) {
    console.error("Signup error:", err);
    return errorResponse("Something went wrong. Please try again.", 500, origin);
  }
}
