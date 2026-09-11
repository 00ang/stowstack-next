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

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: 'climate-controlled-independent',
    facilityName: 'Climate-Controlled Independent',
    location: 'Paw Paw, MI',
    unitCount: 340,
    challenge: 'Occupancy stuck at 74% despite being the only climate-controlled facility in the area. Previous agency was reporting clicks, not move-ins.',
    solution: 'Launched targeted Meta campaigns with ad-specific landing pages and storEDGE embed. Full attribution from click to signed lease.',
    heroMetric: { label: 'Cost per move-in', value: '$14.20' },
    metrics: [
      { label: 'Occupancy', before: '74%', after: '91%', change: '+17%', isPositive: true },
      { label: 'Cost per move-in', before: '$89', after: '$14.20', change: '-84%', isPositive: true },
      { label: 'Monthly move-ins', before: '8', after: '34', change: '+325%', isPositive: true },
      { label: 'Monthly ad spend', before: '$2,400', after: '$1,500', change: '-38%', isPositive: true },
    ],
    quote: { text: "For the first time, I can see exactly which ads produce move-ins. Not clicks, not leads. Actual signed leases.", author: 'Blake', role: 'Owner, 340-unit independent facility' },
    timelineWeeks: 6,
    tags: ['climate-controlled', 'meta-ads', 'rural-market'],
  },
];
