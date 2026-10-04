// Tracking parameter capture, storage, and forwarding
// Captures UTM params + platform click IDs from URL, stores in sessionStorage,
// and forwards to storEDGE embed and tracking API.

import type { TrackingParams } from '@/types/storedge';

const STORAGE_KEY = 'storageads_tracking';

/** All URL parameter keys we capture */
const TRACKED_KEYS: (keyof TrackingParams)[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'ttclid',
  'msclkid',
  'sa_landing_page',
  'sa_campaign_id',
];

/** Detect device type from user agent */
function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Detect browser name */
function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Other';
}

/** Parse tracking params from URL search params (URL-decoded) */
export function parseTrackingParams(searchParams: URLSearchParams): TrackingParams {
  const params: TrackingParams = {};

  for (const key of TRACKED_KEYS) {
    const val = searchParams.get(key);
    if (val) {
      // URLSearchParams.get() already decodes, but handle double-encoding
      try {
        params[key] = decodeURIComponent(val);
      } catch {
        params[key] = val;
      }
    }
  }

  return params;
}

/** Check if any paid tracking params are present */
export function hasPaidParams(params: TrackingParams): boolean {
  return !!(
    params.utm_source ||
    params.fbclid ||
    params.gclid ||
    params.gbraid ||
    params.wbraid ||
    params.ttclid ||
    params.msclkid
  );
}

/** Determine the traffic source */
export function getTrafficSource(
  params: TrackingParams
): 'facebook' | 'google' | 'tiktok' | 'organic' | 'direct' {
  if (params.fbclid || params.utm_source === 'facebook' || params.utm_source === 'meta') {
    return 'facebook';
  }
  if (params.gclid || params.gbraid || params.wbraid || params.utm_source === 'google') {
    return 'google';
  }
  if (params.ttclid || params.utm_source === 'tiktok') {
    return 'tiktok';
  }
  if (params.utm_source) {
    return 'organic';
  }
  return 'direct';
}

/**
 * Get or create tracking params.
 * Last-touch attribution: new URL params ALWAYS overwrite stored params.
 * Persisted in localStorage (survives browser sessions for return visitors).
 */
export function getSessionTracking(
  urlParams?: URLSearchParams,
  landingPageId?: string,
  facilityId?: string
): TrackingParams {
  const fromUrl = urlParams ? parseTrackingParams(urlParams) : {};
  const hasNewParams = hasPaidParams(fromUrl) || fromUrl.utm_source;

  // If URL has new attribution params, always overwrite (last-touch)
  if (hasNewParams) {
    const params: TrackingParams = {
      ...fromUrl,
      sa_timestamp: new Date().toISOString(),
      sa_device: detectDevice(),
      sa_browser: detectBrowser(),
    };
    if (landingPageId) params.sa_landing_page = landingPageId;
    if (facilityId) params.sa_facility_id = facilityId;

    // Persist to localStorage (durable across sessions)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    }
    return params;
  }

  // No new URL params — read from localStorage
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as TrackingParams;
      } catch {
        // corrupted, recreate
      }
    }
  }

  // No stored params either — create minimal context
  const params: TrackingParams = {
    sa_timestamp: new Date().toISOString(),
    sa_device: detectDevice(),
    sa_browser: detectBrowser(),
  };
  if (landingPageId) params.sa_landing_page = landingPageId;
  if (facilityId) params.sa_facility_id = facilityId;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  }

  return params;
}

/** Construct Meta fbc cookie value from fbclid */
export function constructFbc(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`;
}

/** Read _fbp cookie value */
export function readFbp(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/_fbp=([^;]+)/);
  return match?.[1] || undefined;
}

/** Read _fbc cookie value, or construct from stored fbclid if cookie absent */
export function readFbc(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/_fbc=([^;]+)/);
  if (match?.[1]) return match[1];

  // Fallback: construct from stored fbclid
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const params = JSON.parse(stored) as TrackingParams;
        if (params.fbclid) return constructFbc(params.fbclid);
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

/** Build a URL with tracking params appended as query parameters */
export function appendTrackingToUrl(
  baseUrl: string,
  params: TrackingParams
): string {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

/** Clear tracking data (e.g., on explicit logout) */
export function clearSessionTracking(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}
