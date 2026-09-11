// Facility types for multi-facility support

export interface Facility {
  id: string;
  name: string;
  location: string; // "Columbus, OH"
  status: string; // "active", "intake", etc.
  organizationId?: string;
  googleRating?: number;
  reviewCount?: number;
  totalUnits?: string;
  occupancyRange?: string;
}

export interface FacilityStats {
  facilityId: string;
  facilityName: string;
  location: string;
  moveIns: number;
  costPerMoveIn: number;
  totalSpend: number;
  roas: number;
  occupancyRate: number;
  occupancyChange: number; // vs previous period (percentage points)
  activeCampaigns: number;
  activeLandingPages: number;
}

export type FacilitySelection = Facility | 'all';
