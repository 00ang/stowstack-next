// @vitest-environment node
// (happy-dom strips the forbidden cookie/origin/host request headers these cases need.)
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isCsrfExempt } from "@/proxy";

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://storageads.com${path}`, { headers });
}

describe("isCsrfExempt — portal login footgun guard", () => {
  // Regression: the CSRF gate silently 403s any non-exempt mutating /api POST.
  // Portal login runs pre-auth (no session/token/admin-key header yet), so it
  // CANNOT ride the header exemptions and MUST be path-exempt or login breaks.
  it("exempts the portal login-code send route", () => {
    expect(isCsrfExempt(req("/api/resend-access-code"))).toBe(true);
  });

  it("exempts the portal login-code verify route", () => {
    expect(isCsrfExempt(req("/api/client-data"))).toBe(true);
  });

  it("keeps the other public lead-capture routes exempt", () => {
    expect(isCsrfExempt(req("/api/audit-form"))).toBe(true);
    expect(isCsrfExempt(req("/api/consumer-lead"))).toBe(true);
    expect(isCsrfExempt(req("/api/diagnostic-intake"))).toBe(true);
    expect(isCsrfExempt(req("/api/facility-lookup"))).toBe(true);
    expect(isCsrfExempt(req("/api/places-suggest"))).toBe(true);
  });

  it("exempts the landing page's own form, its tour booking and the one-tap answer", () => {
    // A phone visitor's only way to ask on a campaign page; production would 403 them otherwise.
    expect(isCsrfExempt(new NextRequest("https://storageads.com/api/lead-capture", { method: "POST" }))).toBe(true);
    expect(isCsrfExempt(new NextRequest("https://storageads.com/api/tour", { method: "POST" }))).toBe(true);
    expect(isCsrfExempt(new NextRequest("https://storageads.com/api/heard", { method: "POST" }))).toBe(true);
    // The operator's side of tours (mark attended, cancel) is not public.
    expect(isCsrfExempt(new NextRequest("https://storageads.com/api/tour", { method: "PATCH" }))).toBe(false);
  });

  it("exempts session/portal routes that self-defend via verifyCsrfOrigin", () => {
    // These 403'd in prod before being exempted: the proxy token gate fired
    // before each route's own Origin check could run. They must stay exempt.
    expect(isCsrfExempt(req("/api/client-onboarding"))).toBe(true);
    expect(isCsrfExempt(req("/api/organizations"))).toBe(true);
    expect(isCsrfExempt(req("/api/create-billing-portal"))).toBe(true);
    expect(isCsrfExempt(req("/api/data-deletion"))).toBe(true);
    expect(isCsrfExempt(req("/api/client-messages"))).toBe(true);
  });

  it("exempts webhook / cron / v1 prefixes", () => {
    expect(isCsrfExempt(req("/api/webhooks/anything"))).toBe(true);
    expect(isCsrfExempt(req("/api/stripe-webhook"))).toBe(true);
    expect(isCsrfExempt(req("/api/cron/daily"))).toBe(true);
    expect(isCsrfExempt(req("/api/v1/leads"))).toBe(true);
  });

  it("exempts header-authenticated requests", () => {
    expect(isCsrfExempt(req("/api/admin-leads", { "x-admin-key": "k" }))).toBe(true);
    expect(isCsrfExempt(req("/api/partner/x", { authorization: "Bearer t" }))).toBe(true);
    expect(isCsrfExempt(req("/api/partner/x", { "x-org-token": "t" }))).toBe(true);
  });

  it("does NOT exempt an arbitrary mutating route with no auth header", () => {
    expect(isCsrfExempt(req("/api/some-random-route"))).toBe(false);
  });

  it("exempts pre-auth credential-in-body routes", () => {
    // Regression for the prod-403 cluster (audit SA-0002/3/4): these run
    // before any session exists, so they cannot ride the header exemptions.
    expect(isCsrfExempt(req("/api/walkin-attribution"))).toBe(true);
    expect(isCsrfExempt(req("/api/signup"))).toBe(true);
    expect(isCsrfExempt(req("/api/password-reset"))).toBe(true);
  });

  it("exempts routes that self-defend via verifyCsrfOrigin", () => {
    expect(isCsrfExempt(req("/api/2fa"))).toBe(true);
    expect(isCsrfExempt(req("/api/verify-email"))).toBe(true);
    expect(isCsrfExempt(req("/api/meta-capi"))).toBe(true);
    expect(isCsrfExempt(req("/api/manage/scratch"))).toBe(true);
    expect(isCsrfExempt(req("/api/manage/facility"))).toBe(true);
  });

  it("exempts public anonymous tracking beacons", () => {
    expect(isCsrfExempt(req("/api/tracking/visit"))).toBe(true);
    expect(isCsrfExempt(req("/api/tracking/event"))).toBe(true);
    expect(isCsrfExempt(req("/api/page-interactions"))).toBe(true);
  });

  it("exempts the manage-session fallback header", () => {
    // Regression: facility-auth.ts documents x-manage-token as CSRF-exempt;
    // before this it wasn't, so every owner facility-tab mutation 403'd.
    expect(isCsrfExempt(req("/api/facility-context", { "x-manage-token": "t" }))).toBe(true);
  });

  describe("facility tools (manage cookie)", () => {
    // Regression: the tools authenticate with the httpOnly sa_manage cookie,
    // which page JS can't read, so they send no x-manage-token and no
    // double-submit token. Every owner save/generate/publish 403'd here.
    const withCookie = (headers: Record<string, string> = {}) =>
      req("/api/facility-creatives", { cookie: "sa_manage=sm_x.y", ...headers });

    it("exempts a same-origin request carrying the manage cookie", () => {
      expect(isCsrfExempt(withCookie({ origin: "https://storageads.com", host: "storageads.com" }))).toBe(true);
    });

    it("does NOT exempt the cookie from another site", () => {
      expect(isCsrfExempt(withCookie({ origin: "https://evil.example", host: "storageads.com" }))).toBe(false);
    });

    it("does NOT exempt the cookie with no Origin", () => {
      expect(isCsrfExempt(withCookie({ host: "storageads.com" }))).toBe(false);
    });

    it("does NOT exempt a same-origin request without the cookie", () => {
      expect(
        isCsrfExempt(req("/api/facility-creatives", { origin: "https://storageads.com", host: "storageads.com" })),
      ).toBe(false);
    });
  });

  it("does NOT exempt prefix lookalikes", () => {
    expect(isCsrfExempt(req("/api/manage-fake"))).toBe(false);
    expect(isCsrfExempt(req("/api/trackings"))).toBe(false);
    expect(isCsrfExempt(req("/api/signup-bonus"))).toBe(false);
  });
});
