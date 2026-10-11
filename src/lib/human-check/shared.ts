import { leadingZeroBits, sha256 } from "@/lib/human-check/sha256";

/** ~1 in 16,000 hashes. A browser finishes this while the person types. */
export const DIFFICULTY_BITS = 14;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_COUNTER = 5_000_000;

export type Challenge = {
  nonce: string;
  difficulty: number;
  expiresAt: number;
  signature: string;
};

export type Proof = Challenge & {
  counter: number;
};

/** Addition problem. The answer is not included; the signature covers both numbers. */
export type MathProblem = {
  nonce: string;
  a: number;
  b: number;
  expiresAt: number;
  signature: string;
};

export function proofMessage(nonce: string, counter: number) {
  return `${nonce}:${counter}`;
}

export function canonicalChallenge(nonce: string, difficulty: number, expiresAt: number) {
  return `${nonce}.${difficulty}.${expiresAt}`;
}

export function meetsDifficulty(nonce: string, counter: number, difficulty: number) {
  return leadingZeroBits(sha256(proofMessage(nonce, counter)), difficulty);
}
