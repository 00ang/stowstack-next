"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearOntologyCache, useOntology } from "@/components/ontology/use-ontology";
import { goalPace, type FlowMove, type GoalState, type Pace, type Where, type WorkingOn } from "@/lib/flow";
import type { Ontology } from "@/lib/ontology/types";

/**
 * The thread through the portal: the facility's ontology, the month's goal and
 * pace, the campaign being built, and where the operator is. Every page reads
 * the same thread, so the next move follows them instead of each page starting
 * blank. Mounted once, by PortalShell.
 *
 * The campaign being built lives in sessionStorage (per tab, per facility), so
 * it survives page changes and reloads but never leaks between tabs or people.
 */

/**
 * A page or tool that knows the next step better than the facility does hands
 * it to the bar: the builder's own move, or a tool's handoff after it made
 * something ("Make a tracking link for this page").
 */
export interface FlowOverride {
  sentence: string;
  reason: string;
  label: string;
  /** Readiness, when the override is a campaign's. */
  ready?: number;
  total?: number;
  pathClosed?: boolean;
  onDo: () => void;
}

interface FlowValue {
  facilityId: string;
  ontology: Ontology | null;
  ontologyLoading: boolean;
  goal: GoalState | null;
  pace: Pace | null;
  working: WorkingOn | null;
  setWorking: (working: WorkingOn | null) => void;
  override: FlowOverride | null;
  setOverride: (override: FlowOverride | null) => void;
  where: Where;
  setWhere: (where: Where) => void;
  /** The move the bar is showing, so a list beside it can leave it out. */
  shown: FlowMove | null;
  setShown: (move: FlowMove | null) => void;
  /** Re-read the ontology now (a tool just made an object the next move should see). */
  refresh: () => void;
}

const FlowCtx = createContext<FlowValue | null>(null);

/** The thread, or null outside the portal (the admin reuses the same tools without it). */
export function useFlow(): FlowValue | null {
  return useContext(FlowCtx);
}

const WORKING_KEY = "storageads_flow_working";

function readWorking(facilityId: string): WorkingOn | null {
  try {
    const raw = sessionStorage.getItem(`${WORKING_KEY}:${facilityId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkingOn>;
    if (typeof parsed.id !== "string" || typeof parsed.name !== "string") return null;
    return {
      id: parsed.id,
      name: parsed.name,
      status: parsed.status === "published" ? "published" : "draft",
      move: parsed.move ?? null,
    };
  } catch {
    return null;
  }
}

function writeWorking(facilityId: string, working: WorkingOn | null) {
  try {
    const key = `${WORKING_KEY}:${facilityId}`;
    if (working) sessionStorage.setItem(key, JSON.stringify(working));
    else sessionStorage.removeItem(key);
  } catch {
    /* storage blocked: the thread still holds for this page view */
  }
}

/** Forget every facility's working campaign in this tab (sign-out, leaving the sample). */
export function clearFlowSession() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(WORKING_KEY)) sessionStorage.removeItem(key);
    }
  } catch {
    /* nothing stored */
  }
}

function sameWorking(a: WorkingOn | null, b: WorkingOn | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function FlowProvider({
  facilityId,
  authFetch,
  initialWhere,
  children,
}: {
  facilityId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  initialWhere: Where;
  children: ReactNode;
}) {
  const ontology = useOntology({ kind: "portal", facilityId, authFetch });
  const [goal, setGoal] = useState<GoalState | null>(null);
  const [working, setWorkingState] = useState<WorkingOn | null>(null);
  const [override, setOverride] = useState<FlowOverride | null>(null);
  const [where, setWhere] = useState<Where>(initialWhere);
  const [shown, setShown] = useState<FlowMove | null>(null);

  // The working campaign is per tab: read it after mount (sessionStorage is client-only).
  useEffect(() => {
    setWorkingState(readWorking(facilityId));
  }, [facilityId]);

  useEffect(() => {
    let cancel = false;
    authFetch("/api/client-goals")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { current?: { month?: string; target?: number; actual?: number } } | null) => {
        if (cancel) return;
        const c = json?.current;
        if (c && typeof c.month === "string" && typeof c.target === "number" && typeof c.actual === "number") {
          setGoal({ month: c.month, target: c.target, actual: c.actual });
        } else {
          setGoal(null);
        }
      })
      .catch(() => {
        if (!cancel) setGoal(null);
      });
    return () => {
      cancel = true;
    };
  }, [authFetch, facilityId]);

  const setWorking = useCallback(
    (next: WorkingOn | null) => {
      setWorkingState((prev) => {
        if (sameWorking(prev, next)) return prev;
        writeWorking(facilityId, next);
        return next;
      });
    },
    [facilityId],
  );

  // Pace changes by the day, not the render.
  const reloadOntology = ontology.reload;
  const refresh = useCallback(() => {
    clearOntologyCache();
    void reloadOntology();
  }, [reloadOntology]);

  const today = new Date().toISOString().slice(0, 10);
  const pace = useMemo(() => goalPace(goal, new Date(`${today}T12:00:00Z`)), [goal, today]);

  const value = useMemo<FlowValue>(
    () => ({
      facilityId,
      ontology: ontology.data,
      ontologyLoading: ontology.loading,
      goal,
      pace,
      working,
      setWorking,
      override,
      setOverride,
      where,
      setWhere,
      shown,
      setShown,
      refresh,
    }),
    [facilityId, ontology.data, ontology.loading, goal, pace, working, setWorking, override, where, shown, refresh],
  );

  return <FlowCtx.Provider value={value}>{children}</FlowCtx.Provider>;
}
