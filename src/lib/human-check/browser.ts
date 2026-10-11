import {
  MAX_COUNTER,
  meetsDifficulty,
  type Challenge,
  type Proof,
} from "@/lib/human-check/shared";

const CHUNK = 2_000;

/**
 * Solve a challenge without freezing the page. The server checks the same
 * hash, so a script that skips this step is rejected before any lead is saved.
 */
export function solveChallengeInBrowser(challenge: Challenge): Promise<Proof> {
  const { nonce, difficulty } = challenge;
  let counter = 0;

  return new Promise((resolve, reject) => {
    const step = () => {
      const end = Math.min(counter + CHUNK, MAX_COUNTER);
      for (; counter <= end; counter++) {
        if (meetsDifficulty(nonce, counter, difficulty)) {
          resolve({ ...challenge, counter });
          return;
        }
      }
      if (counter > MAX_COUNTER) {
        reject(new Error("Couldn't confirm this browser. Refresh and try again."));
        return;
      }
      setTimeout(step, 0);
    };
    step();
  });
}
