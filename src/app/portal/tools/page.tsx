"use client";

import { usePortal } from "@/components/portal/portal-shell";
import { OwnerTools } from "@/components/owner-tools/owner-tools";

/**
 * Facility tools inside the client portal. The portal login already opened
 * the tools session for this client's facilities, so there is nothing to log
 * in to here.
 */
export default function PortalToolsPage() {
  const { client } = usePortal();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <OwnerTools defaultFacilityId={client.facilityId} upgradeHref="/portal/messages" campaignsBase="/portal/campaigns" />
    </div>
  );
}
