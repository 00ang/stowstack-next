import { afterEach, describe, expect, it, vi } from "vitest";
import { selfBaseUrl } from "@/lib/self-url";

/**
 * Server-to-server calls must never land on the per-deployment *.vercel.app URL
 * in production: it is behind Vercel deployment protection, and the 401 it
 * returns is how diagnostic audit auto-generation failed silently for weeks.
 */
describe("selfBaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  const env = (vars: Record<string, string | undefined>) => {
    for (const k of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
      vi.stubEnv(k, vars[k] ?? "");
    }
  };

  it("prefers the configured site URL, like every other self-call", () => {
    env({ NEXT_PUBLIC_SITE_URL: "https://storageads.com/", VERCEL_URL: "x-abc.vercel.app" });
    expect(selfBaseUrl()).toBe("https://storageads.com");
  });

  it("in production with nothing configured, uses the production domain, not the protected deployment URL", () => {
    env({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "storageads.com", VERCEL_URL: "x-abc.vercel.app" });
    expect(selfBaseUrl()).toBe("https://storageads.com");
  });

  it("previews fall back to their own deployment URL", () => {
    env({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "storageads.com", VERCEL_URL: "x-abc.vercel.app" });
    expect(selfBaseUrl()).toBe("https://x-abc.vercel.app");
  });

  it("local dev", () => {
    env({});
    expect(selfBaseUrl()).toBe("http://localhost:3000");
  });
});
