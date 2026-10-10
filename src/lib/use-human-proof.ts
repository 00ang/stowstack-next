"use client";

import { useCallback, useEffect, useRef } from "react";
import { solveChallengeInBrowser } from "@/lib/human-check/browser";
import type { Proof } from "@/lib/human-check/shared";

const FAILED = "Couldn't confirm this browser. Refresh and try again.";

/**
 * Starts the browser check as soon as the form is on screen, so submit
 * usually doesn't have to wait. Each successful solve can be sent once.
 */
export function useHumanProof(active = true) {
  const proofRef = useRef<Proof | null>(null);
  const skippedRef = useRef(false);
  const taskRef = useRef<Promise<Proof | null> | null>(null);

  const invalidate = useCallback(() => {
    proofRef.current = null;
    skippedRef.current = false;
    taskRef.current = null;
  }, []);

  const proof = useCallback(() => {
    if (skippedRef.current) return Promise.resolve(null);
    if (proofRef.current) return Promise.resolve(proofRef.current);
    if (taskRef.current) return taskRef.current;

    const task = (async () => {
      const res = await fetch("/api/human-check", { method: "GET", cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (payload?.skipped) {
        skippedRef.current = true;
        return null;
      }
      if (!res.ok || !payload?.challenge) throw new Error(FAILED);
      const solved = await solveChallengeInBrowser(payload.challenge);
      proofRef.current = solved;
      return solved;
    })();

    taskRef.current = task;
    task.catch(() => {
      if (taskRef.current === task) taskRef.current = null;
    });
    return task;
  }, []);

  useEffect(() => {
    if (!active) return;
    void proof().catch(() => {});
  }, [active, proof]);

  return { proof, invalidate };
}
