"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { PageStudio } from "@/components/campaigns/page-editor/page-studio";

/**
 * Mock alias for the landing-page editor.
 * The product route is /portal/campaigns/[id]/page. In this Next build a
 * segment named "page" sits beside [id]/page.tsx and is not registered, so
 * the same PageStudio is mounted here for the 003 screenshots.
 */
export default function CampaignPageEditorMockRoute() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="p-4 text-[14px] font-semibold">Opening the page…</div>}>
        <PageStudio funnelId={id} />
      </Suspense>
    </div>
  );
}
