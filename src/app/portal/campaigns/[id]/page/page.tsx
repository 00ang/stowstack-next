"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { PageStudio } from "@/components/campaigns/page-editor/page-studio";

/**
 * The campaign's landing page: create one, or edit the one this
 * campaign already points at. Drafts autosave. Publish is separate
 * from the campaign's Publish, and also runs as that Publish's page step.
 */
export default function CampaignPageEditorRoute() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="p-4 text-[14px] font-semibold">Opening the page…</div>}>
        <PageStudio funnelId={id} />
      </Suspense>
    </div>
  );
}
