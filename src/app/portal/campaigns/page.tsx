"use client";

import { usePortal } from "@/components/portal/portal-shell";
import { CampaignsHome } from "@/components/campaigns/campaigns-home";
import { CampaignPerformance } from "@/components/portal/campaign-performance";

/**
 * Campaigns: build one from the month's goal or open one as a path of
 * functions, then how they are performing (spend, leads, move-ins).
 */
export default function CampaignsPage() {
  const { client } = usePortal();
  return (
    <>
      <CampaignsHome facilityId={client.facilityId} />
      <CampaignPerformance />
    </>
  );
}
