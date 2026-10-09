"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetch } from "@/hooks/use-admin-fetch";
import type { FunnelGraph } from "@/lib/funnel-graph";
import type { NodeResult, NodeState, PublishState } from "@/lib/campaign-publish/types";

/** What a function will need before it can publish (from GET /api/funnels/publish). */
export interface PreflightRow {
  state: "ready" | "needs" | "waiting";
  line?: string;
  fix?: { tool: string; label: string };
}

interface PublishPayload {
  state: PublishState | null;
  stale: boolean;
  summary: { done: number; total: number; attention: number; failed: number };
  preflight: Record<string, PreflightRow>;
}

/** The server's own words when it refused, not its JSON. */
function readError(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* not JSON */
  }
  return raw && raw.length < 200 ? raw : "Publishing couldn't start. Try again.";
}

/** How often the canvas re-reads a run in progress. */
const POLL_MS = 1800;

/**
 * A campaign's publish: what each function needs first, starting a run, and
 * following it live until it finishes. Results land on the canvas as each
 * function's state changes.
 */
export function usePublish(funnelId: string | null) {
  const [data, setData] = useState<PublishPayload | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const read = useCallback(async () => {
    if (!funnelId) return null;
    try {
      const next = await adminFetch<PublishPayload>(`/api/funnels/publish?id=${encodeURIComponent(funnelId)}`);
      setData(next);
      return next;
    } catch {
      return null;
    }
  }, [funnelId]);

  useEffect(() => {
    void read();
  }, [read]);

  const running = !!data?.state && data.state.status === "running" && !data.stale;
  useEffect(() => {
    if (!running) return;
    timer.current = window.setTimeout(() => void read(), POLL_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [running, data, read]);

  /** Save the canvas as it stands, then publish it. `retry` names unknown functions to try again. */
  const start = useCallback(
    async (graph: FunnelGraph, retry: string[] = []) => {
      if (!funnelId) return false;
      setStarting(true);
      setError(null);
      try {
        // The run reads the saved campaign, not this tab's copy: save first.
        await adminFetch("/api/funnels", { method: "PATCH", body: JSON.stringify({ id: funnelId, graph }) });
        await adminFetch("/api/funnels/publish", { method: "POST", body: JSON.stringify({ id: funnelId, retry }) });
        await read();
        return true;
      } catch (e) {
        setError(readError(e));
        return false;
      } finally {
        setStarting(false);
      }
    },
    [funnelId, read],
  );

  return {
    state: data?.state ?? null,
    stale: data?.stale ?? false,
    summary: data?.summary ?? null,
    preflight: data?.preflight ?? {},
    running,
    starting,
    error,
    start,
    refresh: read,
  };
}

/** One vocabulary for a function's publish state, on the canvas, the list, the inspector and the dialog. */
export const PUBLISH_LABEL: Record<NodeState, string> = {
  done: "Live",
  paused: "Made · paused",
  running: "Publishing…",
  needs: "Needs you",
  waiting: "Waiting on StorageAds",
  failed: "Didn't publish",
  unknown: "Check the platform",
  skipped: "Waiting on the one before",
};

/**
 * The mark beside a state. Filled means it's on its way to a renter; outlined
 * means it's waiting. Colour is never the only signal — the words carry it.
 */
export function publishMark(state: NodeState): { fill: string | null; edge: string; pulse?: boolean } {
  switch (state) {
    case "done":
      return { fill: "#2F6B3F", edge: "#2F6B3F" };
    case "paused":
      return { fill: "#1E3C74", edge: "#1E3C74" };
    case "running":
      return { fill: null, edge: "#3E5A7A", pulse: true };
    case "failed":
    case "unknown":
      return { fill: "#6B2340", edge: "#6B2340" };
    default:
      return { fill: null, edge: "var(--ic-ink)" };
  }
}

/** Results that ask something of the owner, in publish order. */
export function attention(state: PublishState | null): { id: string; result: NodeResult }[] {
  if (!state) return [];
  return state.order
    .map((id) => ({ id, result: state.nodes[id] }))
    .filter((r): r is { id: string; result: NodeResult } =>
      !!r.result && (r.result.state === "needs" || r.result.state === "failed" || r.result.state === "unknown"),
    );
}
