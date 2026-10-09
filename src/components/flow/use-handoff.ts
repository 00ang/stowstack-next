"use client";

import { useCallback, useEffect, useRef } from "react";
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
  // Only withdraw an offer this tool made. A parent (the tools track) may
  // already be showing a move; mounting the tool must not wipe it.
  const owned = useRef(false);

  useEffect(
    () => () => {
      if (owned.current) setOverride?.(null);
    },
    [setOverride],
  );

  const focusAddress = useToolFocus()?.address ?? null;
  const prevFocus = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevFocus.current === undefined) {
      prevFocus.current = focusAddress;
      return;
    }
    if (prevFocus.current === focusAddress) return;
    prevFocus.current = focusAddress;
    if (owned.current) {
      owned.current = false;
      setOverride?.(null);
    }
  }, [focusAddress, setOverride]);

  return useCallback(
    (handoff: Handoff | null) => {
      if (!setOverride) return;
      if (!handoff) {
        if (owned.current) {
          owned.current = false;
          setOverride(null);
        }
        return;
      }
      owned.current = true;
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
