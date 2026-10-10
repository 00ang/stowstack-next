import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/with-rate-limit";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit-tiers";
import { issueChallenge } from "@/lib/human-check/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request, RATE_LIMIT_TIERS.PUBLIC_WRITE, "human-check");
  if (limited) return limited;

  try {
    const challenge = issueChallenge();
    if (!challenge) {
      return NextResponse.json({ skipped: true }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ challenge }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[human-check] could not issue a challenge:", error);
    return NextResponse.json({ error: "Couldn't start the check." }, { status: 500 });
  }
}
