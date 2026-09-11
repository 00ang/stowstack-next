import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// React + Turbopack dev runtimes use eval() for callstack reconstruction
// and HMR. Production builds never need it. Gate 'unsafe-eval' to dev only.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://connect.facebook.net https://www.googletagmanager.com https://www.googleadservices.com https://www.google-analytics.com https://cal.com https://*.cal.com https://*.clerk.accounts.dev https://js.stripe.com https://*.sentry.io`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob: https://*.fal.media https://*.vercel-storage.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://graph.facebook.com https://www.google-analytics.com https://www.googleadservices.com https://api.resend.com https://*.clerk.com https://*.clerk.accounts.dev https://*.upstash.io https://*.sentry.io https://*.ingest.sentry.io https://cal.com https://*.cal.com https://api.stripe.com https://*.fal.media https://*.fal.run wss:",
      "frame-src 'self' https://*.storedge.com https://cal.com https://*.cal.com https://js.stripe.com https://hooks.stripe.com https://*.clerk.com https://*.clerk.accounts.dev",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "places.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.clerk.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "assets.website.storedge.com",
      },
      {
        protocol: "https",
        hostname: "images.website.storedge.com",
      },
      {
        protocol: "https",
        hostname: "replicate.delivery",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [];
  },

  async rewrites() {
    // /resume is currently hidden. Its static export moved to _archive/resume/
    // (outside public/, so nothing is served). To bring it back, git mv the
    // directory to public/resume and restore the rewrite to /resume/index.html.
    return [];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
  },
});
