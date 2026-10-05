'use client';

import { useState } from 'react';
import { X, Sun, Snowflake, Leaf } from 'lucide-react';

type Season = 'peak' | 'shoulder' | 'slow';

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 5 && month <= 9) return 'peak';
  if (month >= 3 && month <= 4 || month === 10) return 'shoulder';
  return 'slow';
}

const SEASON_CONFIG: Record<Season, { icon: typeof Sun; label: string; message: string; suggestion: string }> = {
  peak: {
    icon: Sun,
    label: 'Peak Season',
    message: "It's peak moving season (May–September). Demand is highest. Focus on conversion efficiency over volume.",
    suggestion: 'Optimize for cost per move-in, not impressions. Pull back promotions on high-demand unit types.',
  },
  shoulder: {
    icon: Leaf,
    label: 'Shoulder Season',
    message: "Spring and fall are shoulder months. Demand is building or tapering, a good time for targeted campaigns.",
    suggestion: 'Consider spring cleaning promotions or back-to-school campaigns. Start ramping ad spend 3-4 weeks before peak.',
  },
  slow: {
    icon: Snowflake,
    label: 'Slow Season',
    message: "November–February is typically slower for self-storage. Cost per move-in often rises 15-20%. This is normal.",
    suggestion: "Focus on retention and rate optimization. It's a good time for first-month-free promotions to fill winter vacancies.",
  },
};

/**
 * Dashboard card that provides seasonal context.
 * Helps operators understand that seasonal fluctuations are normal,
 * preventing churn during slow months.
 */
export function SeasonalContextCard() {
  const [dismissed, setDismissed] = useState(false);
  const season = getCurrentSeason();
  const config = SEASON_CONFIG[season];
  const Icon = config.icon;

  // Check localStorage for dismissal
  if (dismissed) return null;
  if (typeof window !== 'undefined') {
    const key = `storageads_seasonal_dismissed_${season}`;
    if (localStorage.getItem(key) === 'true') return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`storageads_seasonal_dismissed_${season}`, 'true');
    }
  };

  return (
    <div
      className="rounded-xl p-4 mb-4 flex items-start gap-3"
      style={{
        backgroundColor: 'var(--color-gold-light)',
        border: '1px solid rgba(68, 99, 134, 0.15)',
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'rgba(68, 99, 134, 0.15)' }}
      >
        <Icon className="h-4 w-4" style={{ color: 'var(--color-gold)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-xs font-medium uppercase tracking-wider mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-gold)' }}
        >
          {config.label}
        </p>
        <p
          className="text-sm mb-1.5"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-dark)', lineHeight: 1.5 }}
        >
          {config.message}
        </p>
        <p
          className="text-xs"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--color-body-text)' }}
        >
          {config.suggestion}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0"
        style={{ color: 'var(--color-mid-gray)' }}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
