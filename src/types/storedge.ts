// storEDGE embed integration types
// This is the revenue engine — full-funnel attribution from ad click to move-in.

export interface StorEdgeConfig {
  facilityId: string;
  embedUrl: string;
  unitTypePreselect?: string;
  widgetId?: string;
}

export interface TrackingParams {
  // Standard UTM params
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Platform click IDs
  fbclid?: string;
  gclid?: string;
  /** Google's iOS app-to-web click id — arrives instead of gclid on much iPhone traffic. */
  gbraid?: string;
  /** Google's iOS web-to-app click id. */
  wbraid?: string;
  ttclid?: string;
  /** Microsoft Advertising click id. */
  msclkid?: string;
  // StorageAds internal params
  sa_landing_page?: string;
  sa_campaign_id?: string;
  sa_timestamp?: string;
  sa_device?: string;
  sa_browser?: string;
  sa_facility_id?: string;
}

export interface StorEdgeEvent {
  type:
    | 'page_view'
    | 'unit_selected'
    | 'reservation_started'
    | 'reservation_completed'
    | 'move_in';
  timestamp: string;
  facilityId: string;
  landingPageId?: string;
  trackingParams: TrackingParams;
  unitType?: string;
  unitSize?: string;
  monthlyRate?: number;
  tenantName?: string;
  moveInDate?: string;
  reservationId?: string;
}

export type StorEdgeEmbedState = 'loading' | 'loaded' | 'error' | 'timeout';

export interface StorEdgeErrorInfo {
  code: 'network_error' | 'invalid_config' | 'api_down' | 'timeout' | 'unknown';
  message: string;
  retryable: boolean;
}

// Webhook event types from storEDGE
export interface StorEdgeWebhookPayload {
  event: 'reservation.created' | 'reservation.cancelled' | 'move_in.completed' | 'move_in.cancelled';
  facility_id: string;
  reservation_id: string;
  unit_type?: string;
  unit_size?: string;
  monthly_rate?: number;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  move_in_date?: string;
  tracking_params?: TrackingParams;
  timestamp: string;
  webhook_id: string;
}
