"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { digestFacility } from "@/lib/diagnose/digest";
import { whyChanged } from "@/lib/diagnose/changed";
import type { Digest, FacilityPicture, PictureStamps } from "@/lib/diagnose/picture";
import { suggestFunnels, type FunnelSuggestion } from "@/lib/diagnose/suggest";
import { funnelContextFromOntology } from "@/components/campaigns/context";
import type { Ontology } from "@/lib/ontology/types";

/**
 * Re-reads the facility picture whenever new data can have arrived
 * (ontology reload, a new goal) and keeps one line on why the list moved.
 * Dismiss sticks until that suggestion's evidence changes.
 */

const PREV_KEY = "sa-diagnosis-prev";
const DISMISS_KEY = "sa-suggest-dismiss";
const SHOW = 5;

interface Prev {
  fingerprint: string;
  digest: Digest;
  stamps: PictureStamps;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the list still works for this view */
  }
}

export function useDiagnosis({
  facilityId,
  authFetch,
  reloadToken,
  ontology,
  sample,
}: {
  facilityId: string;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reloadToken: string;
  ontology: Ontology | null;
  sample: boolean;
}) {
  const [picture, setPicture] = useState<FacilityPicture | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Record<string, string>>({});

  useEffect(() => {
    setDismissed(readJson<Record<string, string>>(`${DISMISS_KEY}:${facilityId}`) ?? {});
  }, [facilityId]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    authFetch(`/api/facility-diagnosis?facilityId=${encodeURIComponent(facilityId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { picture?: FacilityPicture } | null) => {
        if (cancel) return;
        const next = json?.picture;
        if (!next?.stamps) {
          setPicture(null);
          setLine(null);
          return;
        }
        const digest = digestFacility(next);
        const prev = readJson<Prev>(`${PREV_KEY}:${facilityId}`);
        const changed = whyChanged(prev?.digest ?? null, digest, prev?.stamps ?? null, next.stamps);
        if (prev?.fingerprint !== digest.fingerprint) {
          writeJson(`${PREV_KEY}:${facilityId}`, { fingerprint: digest.fingerprint, digest, stamps: next.stamps });
        }
        setPicture(next);
        setLine(changed);
      })
      .catch(() => {
        if (!cancel) {
          setPicture(null);
          setLine(null);
        }
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [authFetch, facilityId, reloadToken]);

  const ctx = useMemo(() => funnelContextFromOntology(ontology, sample), [ontology, sample]);
  const digest = useMemo(() => (picture ? digestFacility(picture) : null), [picture]);
  const suggestions = useMemo(() => {
    if (!picture || !digest) return [];
    return suggestFunnels(picture, digest, ctx)
      .filter((s) => dismissed[s.id] !== s.evidenceKey)
      .slice(0, SHOW);
  }, [picture, digest, ctx, dismissed]);

  const dismiss = useCallback(
    (id: string, evidenceKey: string) => {
      setDismissed((prev) => {
        const next = { ...prev, [id]: evidenceKey };
        writeJson(`${DISMISS_KEY}:${facilityId}`, next);
        return next;
      });
    },
    [facilityId],
  );

  return {
    suggestions,
    nudges: digest?.nudges ?? [],
    line,
    loading,
    dismiss,
  };
}

export type { FunnelSuggestion };
