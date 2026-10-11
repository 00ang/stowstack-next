export const RATE_LIMIT_TIERS = {
  // Routes calling expensive external APIs (Anthropic, OpenAI, etc.)
  EXPENSIVE_API: {
    requests: 10,
    windowSeconds: 60,
  },
  // Routes creating billable resources (Stripe checkout, subscriptions)
  BILLING: {
    requests: 5,
    windowSeconds: 60,
  },
  // Standard authenticated routes
  AUTHENTICATED: {
    requests: 60,
    windowSeconds: 60,
  },
  // Public routes (contact form, lead capture)
  PUBLIC_WRITE: {
    requests: 10,
    windowSeconds: 60,
  },
  // Public read routes (blog, pricing page data)
  PUBLIC_READ: {
    requests: 120,
    windowSeconds: 60,
  },
  // Webhook routes (Stripe, Meta, etc.) — higher limit, keyed by source
  WEBHOOK: {
    requests: 200,
    windowSeconds: 60,
  },
  // Hourly limits for expensive API routes (Anthropic, Claude image analysis)
  EXPENSIVE_API_HOURLY: {
    requests: 5,
    windowSeconds: 3600,
  },
  // Hourly limits for billing routes (Stripe checkout)
  BILLING_HOURLY: {
    requests: 10,
    windowSeconds: 3600,
  },
  // Hourly limits for public write routes (signups, form submissions)
  PUBLIC_WRITE_HOURLY: {
    requests: 10,
    windowSeconds: 3600,
  },
  // Audit and contact posts. Stops a slow script that stays under the per-minute cap.
  AUDIT_FORM_HOURLY: {
    requests: 30,
    windowSeconds: 3600,
  },
  // Hourly limits for signup routes (partner + self-service)
  SIGNUP_HOURLY: {
    requests: 5,
    windowSeconds: 3600,
  },
  // Hourly limits for external API routes (Google Places)
  EXTERNAL_API_HOURLY: {
    requests: 20,
    windowSeconds: 3600,
  },
} as const;

export type RateLimitTier = (typeof RATE_LIMIT_TIERS)[keyof typeof RATE_LIMIT_TIERS];
