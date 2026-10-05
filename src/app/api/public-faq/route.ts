import { NextRequest } from "next/server";
import {
  captureRouteError,
  corsResponse,
  errorResponse,
  getOrigin,
  jsonResponse,
  verifyCsrfOrigin,
} from "@/lib/api-helpers";
import { answerPublicQuestion } from "@/lib/public-faq/answer";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { applyRateLimitStrict } from "@/lib/with-rate-limit";

export const runtime = "nodejs";

const MIN_QUESTION = 3;
const MAX_QUESTION = 400;

export async function OPTIONS(request: NextRequest) {
  return corsResponse(getOrigin(request));
}

export async function POST(request: NextRequest) {
  const origin = getOrigin(request);
  const csrf = verifyCsrfOrigin(request);
  if (csrf) return csrf;

  const limited = await applyRateLimitStrict(
    request,
    RATE_LIMIT_TIERS.EXPENSIVE_API,
    "public-faq",
  );
  if (limited) return limited;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const honeypot = typeof body.company_website === "string" ? body.company_website.trim() : "";
    if (honeypot) {
      return jsonResponse(
        {
          answer: "Thanks. Check the questions below, or email blake@storageads.com.",
          sources: [],
          grounded: false,
          refused: true,
        },
        200,
        origin,
      );
    }

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (question.length < MIN_QUESTION || question.length > MAX_QUESTION) {
      return errorResponse(
        `Ask a question between ${MIN_QUESTION} and ${MAX_QUESTION} characters.`,
        400,
        origin,
      );
    }

    const result = await answerPublicQuestion(question);
    return jsonResponse(result, 200, origin);
  } catch (error) {
    captureRouteError(error, "public-faq");
    return errorResponse("Could not answer that just now.", 500, origin);
  }
}
