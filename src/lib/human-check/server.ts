import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";
import {
  canonicalChallenge,
  CHALLENGE_TTL_MS,
  DIFFICULTY_BITS,
  MAX_COUNTER,
  meetsDifficulty,
  type Challenge,
  type Proof,
} from "@/lib/human-check/shared";

export type { Challenge, Proof };

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
