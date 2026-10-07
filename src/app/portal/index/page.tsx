"use client";

import { usePortal } from "@/components/portal/portal-shell";
import { SectionSkeleton, ErrorState } from "@/components/portal/ui";
import { OntologyIndex } from "@/components/ontology/ontology-index";
import { useOntology } from "@/components/ontology/use-ontology";

/**
 * /portal/index: the facility ontology, browsable. Every object the tools
 * work on, in one place, each with one address.
 */
export default function PortalIndexPage() {
  const { client, authFetch } = usePortal();
  const { data, loading, error, reload } = useOntology({ kind: "portal", facilityId: client.facilityId, authFetch });

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      {loading && !data ? (
        <div className="space-y-4">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      ) : error || !data ? (
        <ErrorState message={error ?? "Couldn't load your facility index."} onRetry={reload} />
      ) : (
        <OntologyIndex ontology={data} />
      )}
    </div>
  );
}
