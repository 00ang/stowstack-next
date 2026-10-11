// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { getMiddlewareMatchers } from "next/dist/build/analysis/get-page-static-info";
import { getMiddlewareRouteMatcher } from "next/dist/shared/lib/router/utils/middleware-route-matcher";
import proxy, { config, isVercelObservabilityPath } from "@/proxy";

const matchesProxy = getMiddlewareRouteMatcher(
  getMiddlewareMatchers(config.matcher, {}),
);

describe("Vercel observability paths", () => {
  it("recognizes analytics and speed-insights paths only", () => {
    expect(isVercelObservabilityPath("/_vercel/insights")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/insights/script.js")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/insights/view")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/insights/event")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/speed-insights")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/speed-insights/script.js")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/speed-insights/vitals")).toBe(true);
    expect(isVercelObservabilityPath("/_vercel/insights-other")).toBe(false);
    expect(isVercelObservabilityPath("/admin")).toBe(false);
    expect(isVercelObservabilityPath("/api/audit-form")).toBe(false);
  });

  it("does not match them in the proxy matcher", () => {
    expect(matchesProxy("/_vercel/insights/view", {}, {})).toBe(false);
    expect(matchesProxy("/_vercel/insights/event", {}, {})).toBe(false);
    expect(matchesProxy("/_vercel/insights/script.js", {}, {})).toBe(false);
    expect(matchesProxy("/_vercel/speed-insights/vitals", {}, {})).toBe(false);
    expect(matchesProxy("/_vercel/speed-insights/script.js", {}, {})).toBe(false);
    expect(matchesProxy("/pricing", {}, {})).toBe(true);
    expect(matchesProxy("/admin", {}, {})).toBe(true);
    expect(matchesProxy("/portal/billing", {}, {})).toBe(true);
    expect(matchesProxy("/api/audit-form", {}, {})).toBe(true);
  });

  it("passes beacons through without a redirect or CSRF cookie", async () => {
    for (const path of ["/_vercel/insights/view", "/_vercel/speed-insights/vitals"]) {
      const res = await proxy(
        new NextRequest(`https://storageads.com${path}`, { method: "POST" }),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("set-cookie") ?? "").not.toContain("__csrf_token");
    }
  });

  it("still sets the CSRF cookie on an ordinary page", async () => {
    const res = await proxy(new NextRequest("https://storageads.com/pricing"));
    expect(res.headers.get("set-cookie") ?? "").toContain("__csrf_token");
  });
});

describe("CSP allows the Vercel insights script host", () => {
  const host = "https://va.vercel-scripts.com";

  it.each([
    ["next.config.ts", "next.config.ts"],
    ["src/proxy.ts", "src/proxy.ts"],
  ])("%s allows it on script-src and connect-src", (_label, file) => {
    const source = readFileSync(file, "utf8");
    const scriptSrc = source.split("\n").find((line) => line.includes("script-src"));
    const connectSrc = source.split("\n").find((line) => line.includes("connect-src"));
    expect(scriptSrc).toContain(host);
    expect(connectSrc).toContain(host);
  });
});
