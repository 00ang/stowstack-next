import { afterEach, describe, expect, it, vi } from "vitest";
import { automatedNoul, neutralSortReason, scoreIntake } from "@/lib/intake/score-lead";

describe("scoreIntake", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TYPESAFE_API_KEY;
  });

  it("no-ops when TYPESAFE_API_KEY is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.TYPESAFE_API_KEY;
    await expect(scoreIntake({ contact_name: "Pat" })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the v2 schema and returns the scores when the key is set", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    const body = {
      model: "jev-1.13.0",
      answers: { likely_automated_or_test: { type: "noul", noul: 0.12 } },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => body,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await scoreIntake({ contact_name: "Pat", answers: { role: "Owner" } });
    expect(result).toEqual(body);
    expect(automatedNoul(result)).toBe(0.12);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("jev-1.13.0");
    expect(sent.questions.likely_automated_or_test.type).toBe("noul");
    expect(sent.state.answers.role).toBe("Owner");
    expect(JSON.stringify(sent.state)).not.toContain("instructions");
  });

  it("leaves the lead unscored when Jev errors", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(scoreIntake({ contact_name: "Pat" })).resolves.toBeNull();
  });
});

describe("neutralSortReason", () => {
  it("does not call the lead a bot", () => {
    expect(neutralSortReason(false)).toBe("Sorted lower for a look.");
    expect(neutralSortReason(true)).toBe("A hidden field was filled.");
    expect(neutralSortReason(false).toLowerCase()).not.toContain("bot");
    expect(neutralSortReason(false).toLowerCase()).not.toContain("automated");
  });
});
