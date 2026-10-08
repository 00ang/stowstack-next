"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToolFocus } from "@/components/ontology/tool-focus";
import { useFlow } from "./flow-context";

export interface Handoff {
  sentence: string;
  reason: string;
  label: string;
  /** Where the next step happens, usually a tool with the new object in focus. */
  href: string;
}

/**
 * A tool's next step, once it has made something. The tool says what comes
 * next; the portal's bar offers it as the one move, and the ontology is
 * re-read so the new object can be found. Outside the portal (the admin
 * facility tabs) there is no bar and this does nothing. The offer is
 * withdrawn when the tool closes, and when the tool moves on to another
 * object (following the offer to the next review, say).
 */
export function useHandoff(): (handoff: Handoff | null) => void {
  const flow = useFlow();
  const router = useRouter();
  const setOverride = flow?.setOverride;
  const refresh = flow?.refresh;

  useEffect(() => () => setOverride?.(null), [setOverride]);

  const focusAddress = useToolFocus()?.address ?? null;
  useEffect(() => {
    setOverride?.(null);
  }, [focusAddress, setOverride]);

  return useCallback(
    (handoff: Handoff | null) => {
      if (!setOverride) return;
      if (!handoff) {
        setOverride(null);
        return;
      }
      refresh?.();
      setOverride({
        sentence: handoff.sentence,
        reason: handoff.reason,
        label: handoff.label,
        // Ads Manager and the like open beside the portal; app paths navigate.
        onDo: () =>
          /^https?:\/\//.test(handoff.href) ? window.open(handoff.href, "_blank", "noopener,noreferrer") : router.push(handoff.href),
      });
    },
    [setOverride, refresh, router],
  );
}
