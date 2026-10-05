/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers";

vi.mock("@/lib/with-rate-limit", () => ({
  applyRateLimitStrict: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/public-faq/answer", () => ({
  answerPublicQuestion: vi.fn(async () => ({
    answer: "Launch costs $750 per month per facility.",
    sources: [{ title: "Pricing", href: "/pricing" }],
    grounded: true,
    refused: false,
  })),
}));

import { answerPublicQuestion } from "@/lib/public-faq/answer";
import { POST } from "../route";

const answerMock = vi.mocked(answerPublicQuestion);

describe("POST /api/public-faq", () => {
  beforeEach(() => {
    answerMock.mockClear();
  });

  it("rejects a missing question", async () => {
    const res = await POST(
      createMockRequest("http://localhost:3000/api/public-faq", {
        method: "POST",
        body: { question: "no" },
      }),
    );
    expect(res.status).toBe(400);
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("returns a grounded answer for a real question", async () => {
    const res = await POST(
      createMockRequest("http://localhost:3000/api/public-faq", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: { question: "How much does Launch cost?" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toMatch(/\$750/);
    expect(body.sources[0].href).toBe("/pricing");
    expect(answerMock).toHaveBeenCalledWith("How much does Launch cost?");
  });

  it("does not call the answerer when the honeypot is filled", async () => {
    const res = await POST(
      createMockRequest("http://localhost:3000/api/public-faq", {
        method: "POST",
        body: { question: "How much does Launch cost?", company_website: "https://spam.test" },
      }),
    );
    expect(res.status).toBe(200);
    expect(answerMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-site origin", async () => {
    const req = new NextRequest("http://localhost:3000/api/public-faq", {
      method: "POST",
      headers: [
        ["origin", "https://evil.example"],
        ["host", "localhost:3000"],
        ["content-type", "application/json"],
      ],
      body: JSON.stringify({ question: "How much does Launch cost?" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(answerMock).not.toHaveBeenCalled();
  });
});
