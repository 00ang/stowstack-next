"use client";

import dynamic from "next/dynamic";
import { FacilityToolPage } from "@/components/admin/facility-tool-page";
import { LeadStepBoard } from "@/components/admin/lead-step-board";

const LeadNurtureEngine = dynamic(
  () => import("@/components/admin/facility-tabs/lead-nurture-engine"),
  { ssr: false },
);

export default function ChannelsAutomationsPage() {
  return (
    <div className="space-y-8">
      <LeadStepBoard />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-dark)]">Sequences for one facility</h2>
        <FacilityToolPage
          title="Sequences"
          render={(p) => (
            <LeadNurtureEngine
              {...{ facilityId: p.facilityId, adminKey: p.adminKey, facilityName: p.facilityName }}
            />
          )}
        />
      </section>
    </div>
  );
}
