import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";
import {
  canonicalChallenge,
  CHALLENGE_TTL_MS,
  DIFFICULTY_BITS,
  MAX_COUNTER,
  meetsDifficulty,
  type Challenge,
  type MathProblem,
  type Proof,
} from "@/lib/human-check/shared";

export type { Challenge, MathProblem, Proof };

const usedNonces = new Set<string>();
const USED_CAP = 5_000;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

let warnedMissingSecret = false;

export function humanCheckSecret() {
  const secret =
    process.env.SHIELD_SECRET || process.env.ADMIN_SECRET || process.env.CLERK_SECRET_KEY || "";
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error("[human-check] no server secret; form posts are not gated");
    }
    return null;
  }
  return "dev-only-storageads-human-check";
}

export function issueChallenge(now = Date.now()): Challenge | null {
  const secret = humanCheckSecret();
  if (!secret) return null;
  const nonce = randomBytes(16).toString("hex");
  const difficulty = DIFFICULTY_BITS;
  const expiresAt = now + CHALLENGE_TTL_MS;
  return {
    nonce,
    difficulty,
    expiresAt,
    signature: sign(secret, canonicalChallenge(nonce, difficulty, expiresAt)),
  };
}

export function solveChallenge(challenge: Challenge): Proof {
  for (let counter = 0; counter <= MAX_COUNTER; counter++) {
    if (meetsDifficulty(challenge.nonce, counter, challenge.difficulty)) {
      return { ...challenge, counter };
    }
  }
  throw new Error("No proof found for this challenge.");
}

export type ProofFailure =
  | "missing"
  | "malformed"
  | "signature"
  | "expired"
  | "difficulty"
  | "solution"
  | "replay";

export async function verifyHumanProof(
  proof: unknown,
  now = Date.now()
): Promise<{ ok: true } | { ok: false; reason: ProofFailure }> {
  const secret = humanCheckSecret();
  if (!secret) return { ok: true };
  if (proof == null || proof === "") return { ok: false, reason: "missing" };
  if (!isProof(proof)) return { ok: false, reason: "malformed" };
  if (
    proof.difficulty !== DIFFICULTY_BITS ||
    !Number.isInteger(proof.counter) ||
    proof.counter < 0 ||
    proof.counter > MAX_COUNTER
  ) {
    return { ok: false, reason: "difficulty" };
  }

  const expected = sign(secret, canonicalChallenge(proof.nonce, proof.difficulty, proof.expiresAt));
  if (!safeEqual(expected, proof.signature)) return { ok: false, reason: "signature" };
  if (proof.expiresAt < now) return { ok: false, reason: "expired" };
  if (!meetsDifficulty(proof.nonce, proof.counter, proof.difficulty)) {
    return { ok: false, reason: "solution" };
  }
  if (!(await claimNonce(proof.nonce))) return { ok: false, reason: "replay" };
  return { ok: true };
}

export function issueMathProblem(now = Date.now()): MathProblem | null {
  const secret = humanCheckSecret();
  if (!secret) return null;
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = now + CHALLENGE_TTL_MS;
  return {
    nonce,
    a,
    b,
    expiresAt,
    signature: sign(secret, mathMessage(nonce, a, b, expiresAt)),
  };
}

export type MathFailure = "missing" | "malformed" | "signature" | "expired" | "wrong" | "replay";

export async function verifyMathAnswer(
  problem: unknown,
  answer: unknown,
  now = Date.now()
): Promise<{ ok: true } | { ok: false; reason: MathFailure }> {
  const secret = humanCheckSecret();
  if (!secret) return { ok: false, reason: "missing" };
  if (problem == null || answer == null || answer === "") return { ok: false, reason: "missing" };
  if (!isMathProblem(problem)) return { ok: false, reason: "malformed" };

  const expectedSig = sign(secret, mathMessage(problem.nonce, problem.a, problem.b, problem.expiresAt));
  if (!safeEqual(expectedSig, problem.signature)) return { ok: false, reason: "signature" };
  if (problem.expiresAt < now) return { ok: false, reason: "expired" };
  if (!(await claimNonce(problem.nonce))) return { ok: false, reason: "replay" };

  const given = typeof answer === "number" ? String(answer) : typeof answer === "string" ? answer.trim() : "";
  if (!/^\d{1,3}$/.test(given) || Number(given) !== problem.a + problem.b) {
    return { ok: false, reason: "wrong" };
  }
  return { ok: true };
}

export function mathAnswerError(reason: MathFailure) {
  switch (reason) {
    case "wrong":
      return "That answer wasn't right. Try the new question.";
    case "expired":
      return "That question expired. Answer the new one.";
    case "replay":
      return "That question was already used. Answer the new one.";
    default:
      return "Answer the math question before sending.";
  }
}

function mathMessage(nonce: string, a: number, b: number, expiresAt: number) {
  return `math.${nonce}.${a}.${b}.${expiresAt}`;
}

function isMathProblem(value: unknown): value is MathProblem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.nonce === "string" &&
    /^[a-f0-9]{32}$/.test(record.nonce) &&
    typeof record.a === "number" &&
    typeof record.b === "number" &&
    Number.isInteger(record.a) &&
    Number.isInteger(record.b) &&
    record.a >= 2 &&
    record.a <= 9 &&
    record.b >= 2 &&
    record.b <= 9 &&
    typeof record.expiresAt === "number" &&
    Number.isFinite(record.expiresAt) &&
    typeof record.signature === "string" &&
    /^[a-f0-9]{64}$/.test(record.signature)
  );
}

export function humanProofError(reason: ProofFailure) {
  switch (reason) {
    case "missing":
      return "Confirm this browser before sending.";
    case "expired":
      return "That check expired. Send it again.";
    case "replay":
      return "That check was already used. Send it again.";
    default:
      return "That check didn't pass. Send it again.";
  }
}

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isProof(value: unknown): value is Proof {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.nonce === "string" &&
    /^[a-f0-9]{32}$/.test(record.nonce) &&
    typeof record.difficulty === "number" &&
    typeof record.expiresAt === "number" &&
    Number.isFinite(record.expiresAt) &&
    typeof record.signature === "string" &&
    /^[a-f0-9]{64}$/.test(record.signature) &&
    typeof record.counter === "number"
  );
}

function rememberLocal(nonce: string) {
  usedNonces.add(nonce);
  if (usedNonces.size > USED_CAP) {
    const oldest = usedNonces.values().next().value;
    if (oldest) usedNonces.delete(oldest);
  }
}

async function claimNonce(nonce: string): Promise<boolean> {
  const client = getRedis();
  if (client) {
    try {
      const result = await client.set(`human-check:${nonce}`, "1", { nx: true, ex: 360 });
      if (result === "OK") {
        rememberLocal(nonce);
        return true;
      }
      return false;
    } catch {
      // A Redis blip should not block a person who already solved the check.
    }
  }
  if (usedNonces.has(nonce)) return false;
  rememberLocal(nonce);
  return true;
}
