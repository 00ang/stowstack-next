import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { VercelInsightsFilter } from "@/components/vercel-insights-filter";

type InsightWindow = Window & {
  va?: (event: string, data?: unknown) => void;
  si?: (event: string, data?: unknown) => void;
  vaq?: unknown[];
  siq?: unknown[];
};

function insightWindow(): InsightWindow {
  return window as InsightWindow;
}

afterEach(() => {
  cleanup();
  const w = insightWindow();
  w.va = undefined;
  w.si = undefined;
  w.vaq = undefined;
  w.siq = undefined;
});

describe("VercelInsightsFilter", () => {
  it("queues a beforeSend filter that drops admin and portal", () => {
    render(<VercelInsightsFilter />);

    const w = insightWindow();
    expect(typeof w.va).toBe("function");
    const seen: unknown[] = [];
    for (const entry of w.vaq ?? []) {
      const [event, data] = entry as [string, (payload: { url: string }) => unknown];
      if (event === "beforeSend") seen.push(data);
    }
    expect(seen).toHaveLength(1);
    const beforeSend = seen[0] as (payload: { url: string }) => unknown;
    expect(beforeSend({ url: "https://storageads.com/pricing" })).toEqual({
      url: "https://storageads.com/pricing",
    });
    expect(beforeSend({ url: "https://storageads.com/admin/facilities" })).toBeNull();
    expect(beforeSend({ url: "https://storageads.com/portal" })).toBeNull();

    expect(w.siq?.some((entry) => (entry as [string])[0] === "beforeSend")).toBe(true);
  });
});
