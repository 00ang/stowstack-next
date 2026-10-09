'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getSessionTracking,
  hasPaidParams,
  getTrafficSource,
} from '@/lib/tracking-params';
import type { TrackingParams } from '@/types/storedge';

interface UseTrackingParamsReturn {
  params: TrackingParams;
  isOrganic: boolean;
  source: 'facebook' | 'google' | 'tiktok' | 'organic' | 'direct';
  capturedAt: Date;
}

/**
 * Hook to capture and persist tracking parameters.
 * Last-touch attribution — new URL params always overwrite stored values.
 * Fires a visit tracking event on first mount for paid/landing-page traffic.
 *
 * The params kept here are a convenience for the storEDGE embed. The durable
 * history is server-side: each visit beacon becomes a touch row keyed to the
 * `sa_vid` visitor cookie (MISSION.md s12), so first touch is never lost to an
 * overwrite or to Safari clearing this storage.
 */
export function useTrackingParams(
  landingPageId?: string,
  facilityId?: string
): UseTrackingParamsReturn {
  const searchParams = useSearchParams();
  const firedRef = useRef(false);

  const [result] = useState<UseTrackingParamsReturn>(() => {
    const params = getSessionTracking(searchParams, landingPageId, facilityId);
    return {
      params,
      isOrganic: !hasPaidParams(params),
      source: getTrafficSource(params),
      capturedAt: new Date(params.sa_timestamp || Date.now()),
    };
  });

  // Fire visit tracking event once
  useEffect(() => {
    if (firedRef.current) return;
    // Wait for the page. A beacon sent before the page has loaded carries no
    // page or facility, so the visit is stored unattached and never counts
    // toward its campaign — paid clicks, which used to fire at once, most of all.
    if (!landingPageId) return;
    firedRef.current = true;

    // Fire-and-forget tracking event
    fetch('/api/tracking/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_params: result.params,
        landing_page_id: landingPageId,
        facility_id: facilityId,
        url: typeof window !== 'undefined' ? window.location.href : '',
        // The server classifies the arrival from url + referrer (MISSION.md s12).
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      }),
    }).catch(() => {
      // Tracking failure should never break the page
    });
  }, [result.params, landingPageId, facilityId]);

  return result;
}
