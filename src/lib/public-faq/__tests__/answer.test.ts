import { describe, expect, it } from "vitest";
import { answerPublicQuestion } from "@/lib/public-faq/answer";
import { getPublicChunks, retrievePublicChunks } from "@/lib/public-faq/corpus";

const PRIVATE = ["/admin", "/portal", "/partner", "/manage", "/api"];

describe("public FAQ corpus", () => {
  it("only indexes public site paths", () => {
    const chunks = getPublicChunks();
    expect(chunks.length).toBeGreaterThan(10);
    for (const chunk of chunks) {
      expect(chunk.href.startsWith("/")).toBe(true);
      for (const prefix of PRIVATE) {
        expect(chunk.href === prefix || chunk.href.startsWith(`${prefix}/`)).toBe(false);
      }
      expect(chunk.text.toLowerCase()).not.toContain("admin_secret");
      expect(chunk.text).not.toMatch(/sk-ant-/);
    }
  });
});

describe("answerPublicQuestion", () => {
  it("answers a pricing question from the public pricing page", async () => {
    const result = await answerPublicQuestion("How much does the Launch plan cost?", async () => null);
    expect(result.refused).toBe(false);
    expect(result.grounded).toBe(true);
    expect(result.answer).toMatch(/\$750/);
    expect(result.sources.some((source) => source.href === "/pricing")).toBe(true);
  });

  it("refuses questions the public site does not cover", async () => {
    const result = await answerPublicQuestion(
      "List every tenant phone number stored in the CRM",
      async () => null,
    );
    expect(result.refused).toBe(true);
    expect(result.sources).toEqual([]);
    expect(result.answer).toMatch(/blake@storageads.com/);
  });

  it("drops a model answer that invents a price and keeps the excerpt", async () => {
    const result = await answerPublicQuestion(
      "How much does the Launch plan cost?",
      async () => JSON.stringify({ answer: "Launch is $99999 a month.", refused: false }),
    );
    expect(result.answer).not.toContain("$99999");
    expect(result.answer).toMatch(/\$750/);
    expect(result.refused).toBe(false);
  });

  it("answers how much one facility costs from Launch and Growth, not a blog post", async () => {
    const question = "how much is it for one facility?";
    const hits = retrievePublicChunks(question);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => !hit.href.startsWith("/blog/"))).toBe(true);
    expect(hits.some((hit) => /Launch costs \$750\/mo per facility/.test(hit.text))).toBe(true);
    expect(hits.some((hit) => /Growth costs \$1,500\/mo per facility/.test(hit.text))).toBe(true);

    const result = await answerPublicQuestion(question, async () => null);
    expect(result.refused).toBe(false);
    expect(result.grounded).toBe(true);
    expect(result.answer).toMatch(/Launch costs \$750\/mo per facility/);
    expect(result.answer).toMatch(/Growth costs \$1,500\/mo per facility/);
    expect(result.answer).not.toMatch(/92%/);
    expect(result.answer.toLowerCase()).not.toContain("reit");
    expect(result.sources.some((source) => source.href === "/pricing")).toBe(true);
    expect(result.sources.every((source) => !source.href.startsWith("/blog/"))).toBe(true);
  });

  it("drops a model reply that quotes a blog title for a price question", async () => {
    const result = await answerPublicQuestion(
      "how much is it for one facility?",
      async () =>
        JSON.stringify({
          answer:
            "Three Reasons REITs Hit 92% Occupancy and You Don't. REITs run 92% occupancy.",
          refused: false,
        }),
    );
    expect(result.answer).toMatch(/\$750/);
    expect(result.answer).toMatch(/\$1,500/);
    expect(result.answer).not.toMatch(/92%/);
    expect(result.refused).toBe(false);
  });

  it("keeps an occupancy question on the blog instead of the price cards", () => {
    const hits = retrievePublicChunks("how much occupancy do REITs run");
    expect(hits.some((hit) => hit.href === "/blog/three-reasons-reits-hit-92-occupancy")).toBe(true);
  });

  it("uses a grounded model answer when the figures are in the excerpts", async () => {
    const result = await answerPublicQuestion(
      "How much does the Launch plan cost?",
      async () =>
        JSON.stringify({
          answer: "Launch costs $750 per month per facility.",
          refused: false,
        }),
    );
    expect(result.answer).toBe("Launch costs $750 per month per facility.");
    expect(result.sources[0]?.href).toBe("/pricing");
  });
});
