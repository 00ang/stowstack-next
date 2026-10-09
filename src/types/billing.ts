// Billing & subscription types for StorageAds operator billing UI

export type PlanTier = 'demand_engine' | 'conversion_layer' | 'bundle';

export interface Plan {
  id: string;
  tier: PlanTier;
  name: string;
  pricePerFacility: number;
  features: string[];
  isPopular?: boolean;
}

export interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  facilityCount: number;
  monthlyTotal: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndDate?: string;
}

export interface PaymentMethod {
  id: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover';
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'paid' | 'pending' | 'overdue' | 'failed';
  pdfUrl?: string;
}

export interface InvoiceLineItem {
  description: string;
  facilityName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export const PLANS: Plan[] = [
  {
    id: 'demand_engine',
    tier: 'demand_engine',
    name: 'Demand Engine',
    pricePerFacility: 1000,
    features: [
      'Meta & Google ad management',
      'AI-generated ad creative',
      'Campaign optimization',
      'Cost-per-move-in tracking',
      'Monthly performance reports',
    ],
  },
  {
    id: 'conversion_layer',
    tier: 'conversion_layer',
    name: 'Conversion Layer',
    pricePerFacility: 750,
    features: [
      'Custom landing pages',
      'storEDGE embed integration',
      'You mark a move-in, and the report shows the source',
      'A/B testing',
      'Lead capture forms',
    ],
  },
  {
    id: 'bundle',
    tier: 'bundle',
    name: 'Bundle',
    pricePerFacility: 2000,
    isPopular: true,
    features: [
      'Everything in Demand Engine',
      'Everything in Conversion Layer',
      'Priority support',
      'Custom reporting',
      'Dedicated account manager',
      'Multi-facility dashboard',
      'API access',
    ],
  },
];

export const SUBSCRIPTION_STATUS_CONFIG: Record<
  Subscription['status'],
  { label: string; color: string; bg: string }
> = {
  active: { label: 'Active', color: 'var(--color-green)', bg: 'rgba(120,140,93,0.15)' },
  past_due: { label: 'Past Due', color: 'var(--color-red)', bg: 'rgba(176,74,58,0.1)' },
  cancelled: { label: 'Cancelled', color: 'var(--color-mid-gray)', bg: 'var(--color-light-gray)' },
  trialing: { label: 'Trial', color: 'var(--color-gold)', bg: 'var(--color-gold-light)' },
};

export const INVOICE_STATUS_CONFIG: Record<
  Invoice['status'],
  { label: string; color: string; bg: string }
> = {
  paid: { label: 'Paid', color: 'var(--color-green)', bg: 'rgba(120,140,93,0.15)' },
  pending: { label: 'Pending', color: 'var(--color-gold)', bg: 'var(--color-gold-light)' },
  overdue: { label: 'Overdue', color: 'var(--color-red)', bg: 'rgba(176,74,58,0.1)' },
  failed: { label: 'Failed', color: 'var(--color-red)', bg: 'rgba(176,74,58,0.1)' },
};
