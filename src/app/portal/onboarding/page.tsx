"use client";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

/**
 * Setup: the goal, the facility, the units, then the facility as StorageAds
 * sees it with a campaign built for the goal. The detailed brand form lives
 * at /portal/onboarding/details.
 */
export default function OnboardingPage() {
  return <OnboardingFlow />;
}
