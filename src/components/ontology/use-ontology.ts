"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectAction, Ontology } from "@/lib/ontology/types";

/**
 * Loads the facility ontology. Two doors in, the same data out:
 *  - "portal": the client portal's own credentials (authFetch adds them);
 *  - "manage": the facility-tools cookie, for a facility id (the tools' focus bar).
 *
 * Cached per facility for a minute so moving between the dashboard, the index
 * and a tool doesn't refetch what was just read.
 */

type Source =
  | { kind: "portal"; facilityId: string; authFetch: (url: string, init?: RequestInit) => Promise<Response> }
  | { kind: "manage"; facilityId: string };

const TTL = 60_000;
const cache = new Map<string, { at: number; data: Ontology }>();

export function useOntology(source: Source | null) {
  const key = source ? `${source.kind}:${source.facilityId}` : null;
  // Data is held with the key it was loaded for, so a facility switch never
  // shows the previous facility's objects (both may have a units/10x10).
  const [held, setHeld] = useState<{ key: string; data: Ontology } | null>(() => {
    const hit = key ? fresh(key) : null;
    return key && hit ? { key, data: hit } : null;
  });
  const data = held && held.key === key ? held.data : null;
  const [loading, setLoading] = useState(!data && !!source);
  const [error, setError] = useState<string | null>(null);

  // Callers rebuild `source` every render; the key is what identifies it, and
  // the ref hands the loader the latest one without re-running it.
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  const load = useCallback(async (force = false) => {
    const source = sourceRef.current;
    if (!source || !key) return;
    const hit = force ? null : fresh(key);
    if (hit) {
      setHeld({ key, data: hit });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res =
        source.kind === "portal"
          ? await source.authFetch("/api/portal-ontology")
          : await fetch(`/api/portal-ontology?facilityId=${encodeURIComponent(source.facilityId)}`, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Ontology;
      cache.set(key, { at: Date.now(), data: json });
      setHeld({ key, data: json });
    } catch {
      setError("Couldn't load your facility index.");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: () => load(true) };
}

function fresh(key: string): Ontology | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < TTL ? hit.data : null;
}

/** Drop every cached ontology (sign-out, or leaving the sample portal). */
export function clearOntologyCache() {
  cache.clear();
}

/* ─── where an action goes ─── */

/** Addresses are [a-z0-9-/] by construction, so they travel unencoded and stay readable. */
function q(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2F/g, "/")}`)
    .join("&");
}

export function actionHref(action: ObjectAction, address: string | null, toolsBase = "/portal/tools"): string {
  if (action.href) return action.href;
  const params: Record<string, string> = { tool: action.tool ?? "overview" };
  if (address && address.includes("/")) params.focus = address;
  Object.assign(params, action.params ?? {});
  return `${toolsBase}?${q(params)}`;
}

export function indexHref(address?: string | null, type?: string | null): string {
  if (address) return `/portal/index?${q({ o: address })}`;
  if (type) return `/portal/index?${q({ t: type })}`;
  return "/portal/index";
}
