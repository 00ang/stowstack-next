"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { solveChallengeInBrowser } from "@/lib/human-check/browser";
import type { MathProblem, Proof } from "@/lib/human-check/shared";

const FAILED = "Couldn't confirm this browser. Refresh and try again.";

export type HumanGate = {
  humanProof: Proof;
  math: MathProblem;
};

/**
 * Loads a math question and solves the background browser check while the
 * person is filling the form. Both have to be sent with the post.
 */
export function useHumanProof(active = true) {
  const proofRef = useRef<Proof | null>(null);
  const mathRef = useRef<MathProblem | null>(null);
  const taskRef = useRef<Promise<HumanGate> | null>(null);
  const [math, setMath] = useState<MathProblem | null>(null);

  const load = useCallback(() => {
    if (proofRef.current && mathRef.current) {
      return Promise.resolve({ humanProof: proofRef.current, math: mathRef.current });
    }
    if (taskRef.current) return taskRef.current;

    const task = (async () => {
      const res = await fetch("/api/human-check", { method: "GET", cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.challenge || !payload?.math) throw new Error(FAILED);
      const solved = await solveChallengeInBrowser(payload.challenge);
      proofRef.current = solved;
      mathRef.current = payload.math;
      setMath(payload.math);
      return { humanProof: solved, math: payload.math as MathProblem };
    })();

    taskRef.current = task;
    task.catch(() => {
      if (taskRef.current === task) taskRef.current = null;
    });
    return task;
  }, []);

  const refresh = useCallback(() => {
    proofRef.current = null;
    mathRef.current = null;
    taskRef.current = null;
    setMath(null);
    return load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    void load().catch(() => {});
  }, [active, load]);

  return { math, load, refresh };
}
