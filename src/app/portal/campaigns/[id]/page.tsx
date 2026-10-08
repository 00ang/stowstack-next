"use client";

import { useParams, useRouter } from "next/navigation";
import { usePortal } from "@/components/portal/portal-shell";
import { CampaignStage } from "@/components/campaigns/campaign-stage";

/**
 * One campaign's builder, given the whole window: the palette of functions,
 * the canvas, and the inspector. Its next move rides the portal's bar.
 */
export default function CampaignBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { client } = usePortal();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CampaignStage facilityId={client.facilityId} funnelId={id} onBack={() => router.push("/portal/campaigns")} fill />
    </div>
  );
}
