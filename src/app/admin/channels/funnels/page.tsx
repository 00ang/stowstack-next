"use client";

import dynamic from "next/dynamic";
import { FacilityToolPage } from "@/components/admin/facility-tool-page";

const FacilityFunnels = dynamic(
  () => import("@/components/admin/facility-tabs/facility-funnels"),
  { ssr: false },
);

export default function ChannelsFunnelsPage() {
  return (
    <FacilityToolPage
      title="Campaigns"
      render={(p) => (
        <FacilityFunnels
          {...{ facilityId: p.facilityId, adminKey: p.adminKey, facilityName: p.facilityName }}
        />
      )}
    />
  );
}
