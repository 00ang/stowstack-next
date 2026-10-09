// Case study types

export interface CaseStudyMetric {
  label: string;
  before: string;
  after: string;
  change: string; // "+42%" or "-$12"
  isPositive: boolean;
}

export interface CaseStudy {
  slug: string;
  facilityName: string;
  location: string;
  unitCount: number;
  challenge: string;
  solution: string;
  heroMetric: { label: string; value: string };
  metrics: CaseStudyMetric[];
  quote: { text: string; author: string; role: string };
  timelineWeeks: number;
  tags: string[];
}

// No published client results. Do not add a study until the founders have verified it.
export const CASE_STUDIES: CaseStudy[] = [];
