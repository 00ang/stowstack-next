"use client";

import { useCallback, useState } from "react";
import { useFacility } from "@/lib/facility-context";
import { ProvenAdsAdminTools } from "@/components/proven-ads/admin-tools";
import { ProvenAdsLibrary } from "@/components/proven-ads/proven-ads-library";

/**
 * Admin view of the Proven Ads library: the same library owners see in their
 * tools, plus the controls that feed it.
 */
export default function ProvenAdsPage() {
  const { facilities, currentId } = useFacility();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <ProvenAdsLibrary
      mode="admin"
      facilities={facilities.map((f) => ({ id: f.id, name: f.name, location: f.location }))}
      defaultTargetId={currentId !== "all" ? currentId : undefined}
      adminSlot={<ProvenAdsAdminTools onChanged={reload} />}
      reloadKey={reloadKey}
    />
  );
}
