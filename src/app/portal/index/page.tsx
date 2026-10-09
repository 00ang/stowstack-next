"use client";

import { usePortal } from "@/components/portal/portal-shell";
import { SectionSkeleton, ErrorState } from "@/components/portal/ui";
import { OntologyIndex } from "@/components/ontology/ontology-index";
import { useOntology } from "@/components/ontology/use-ontology";
import { Question, SkyBand } from "@/components/design/dl003/ui";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";

/**
 * /portal/index: the facility ontology, browsable. Every object the tools
 * work on, in one place, each with one address.
 */
export default function PortalIndexPage() {
  const { client, authFetch } = usePortal();
  const { data, loading, error, reload } = useOntology({ kind: "portal", facilityId: client.facilityId, authFetch });

  const sample = isPortalDemo();

  return (
    <div className="pb-24">
      {sample && (
        <div data-dl003="index">
          <SkyBand variant="strip" label="003 · A sky · thin strip · list stays white" />
          <div className="mx-auto max-w-3xl px-4 pt-4">
            <Question
              kicker="003 · one question · no sky under the rows"
              q="Where is everything at this facility?"
              a="Each row is one object you can open. Addresses stay on white."
            />
          </div>
        </div>
      )}
      <div className="mx-auto max-w-3xl px-4 pt-6">
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
    </div>
  );
}
