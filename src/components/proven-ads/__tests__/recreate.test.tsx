import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProvenAdsLibrary } from "../proven-ads-library";
import type { ProvenAd } from "../shared";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  sp: new URLSearchParams(),
  pathname: "/admin/studio/proven-ads",
}));

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useSearchParams: () => nav.sp,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  usePathname: () => nav.pathname,
}));

vi.mock("@/hooks/use-admin-fetch", () => ({
  adminFetch: (...args: unknown[]) => fetchMock(...args),
}));

const AD: ProvenAd = {
  id: "ad-1",
  source: "meta_ad_library",
  platform: "meta",
  publisher_platforms: ["facebook"],
  advertiser_name: "Public Storage",
  advertiser_url: null,
  format: "image",
  headline: "First month $1",
  primary_text: "Climate units in Dallas from a dollar.",
  description: "Limited time",
  cta: "Book Now",
  landing_url: "https://example.com/dallas",
  snapshot_url: "https://www.facebook.com/ads/library/?id=1",
  country: "US",
  state: "TX",
  city: "Dallas",
  offer_type: "dollar_move_in",
  unit_type: "climate",
  angle: "price",
  audience: null,
  advertiser_scale: null,
  family_size: 1,
  study_value: null,
  started_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-04-01T00:00:00.000Z",
  confirmed_through: "2026-04-01T00:00:00.000Z",
  ended_at: null,
  active: true,
  notes: null,
  days_running: 90,
  proven: true,
  why_flagged: "Running 90 days.",
  insight: null,
  insight_pending: false,
};

const LIBRARY = {
  ads: [AD],
  total: 1,
  offset: 0,
  limit: 24,
  sort: "study",
  patterns: null,
  states: [],
  sources: [],
};

function draftResponse() {
  return {
    studioUrl: "/admin/studio/ad-generator?variation=var-9",
    via: "fallback",
    variationId: "var-9",
  };
}

beforeEach(() => {
  nav.sp = new URLSearchParams();
  nav.push.mockClear();
  nav.replace.mockClear();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (path: string) => {
    if (String(path).includes("/duplicate")) return draftResponse();
    return LIBRARY;
  });
});

afterEach(cleanup);

async function openAd() {
  fireEvent.click(await screen.findByRole("button", { name: /Public Storage, 90 days running/ }));
  return screen.getByRole("dialog");
}

describe("Proven Ads recreate", () => {
  it("recreates the open ad and opens the Ad Studio draft", async () => {
    render(
      <ProvenAdsLibrary
        mode="admin"
        facilities={[{ id: "fac-r", name: "Riverside", location: "Paw Paw, MI" }]}
        defaultTargetId="fac-r"
      />
    );
    const dialog = await openAd();
    expect(within(dialog).getByText("First month $1")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Recreate this ad" }));

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith(
        "/admin/studio/ad-generator?variation=var-9&facility=fac-r"
      );
    });

    const duplicateCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/duplicate"));
    expect(duplicateCall?.[0]).toBe("/api/proven-ads/ad-1/duplicate");
    expect(JSON.parse(String((duplicateCall?.[1] as RequestInit).body))).toEqual({
      facilityId: "fac-r",
    });
    expect((duplicateCall?.[1] as RequestInit).method).toBe("POST");
  });

  it("asks which facility, then opens that draft", async () => {
    render(
      <ProvenAdsLibrary
        mode="admin"
        facilities={[
          { id: "fac-r", name: "Riverside", location: "Paw Paw, MI" },
          { id: "fac-l", name: "Lakeside", location: "Kalamazoo, MI" },
        ]}
      />
    );
    const dialog = await openAd();
    const recreate = within(dialog).getByRole("button", { name: "Recreate this ad" });
    expect((recreate as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(within(dialog).getByRole("combobox", { name: "Facility" }), {
      target: { value: "fac-l" },
    });
    fireEvent.click(recreate);

    await waitFor(() => {
      expect(nav.push).toHaveBeenCalledWith(
        "/admin/studio/ad-generator?variation=var-9&facility=fac-l"
      );
    });
  });

  it("opens the owner's Ad Generator on the new draft", async () => {
    const onOpenDraft = vi.fn();
    render(
      <ProvenAdsLibrary
        mode="owner"
        facility={{ id: "fac-r", name: "Riverside", state: "MI" }}
        onOpenDraft={onOpenDraft}
      />
    );
    const dialog = await openAd();
    fireEvent.click(within(dialog).getByRole("button", { name: "Recreate this ad" }));

    await waitFor(() => {
      expect(onOpenDraft).toHaveBeenCalledWith("var-9");
    });
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("shows the error and stays on the ad when recreate fails", async () => {
    fetchMock.mockImplementation(async (path: string) => {
      if (String(path).includes("/duplicate")) throw new Error("Adaptation failed");
      return LIBRARY;
    });
    render(
      <ProvenAdsLibrary
        mode="admin"
        facilities={[{ id: "fac-r", name: "Riverside", location: "Paw Paw, MI" }]}
        defaultTargetId="fac-r"
      />
    );
    const dialog = await openAd();
    fireEvent.click(within(dialog).getByRole("button", { name: "Recreate this ad" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Adaptation failed");
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
