"use client";

import Link from "next/link";
import { usePortal } from "@/components/portal/portal-shell";
import { SectionSkeleton, ErrorState } from "@/components/portal/ui";
import { FacilityInstrument } from "./facility-instrument";
import { NextMoves } from "./next-moves";
import { useOntology } from "./use-ontology";
import { useFlow } from "@/components/flow/flow-context";

/**
 * The ontology on the portal dashboard, in Instrument Calm (library entry 008):
 * what needs you, then the facility as an instrument. Both read the same
 * object graph the index and the tools use.
 *
 * Note: the site-wide `.urbit-landing` scope paints every <section> with the
 * page ground and sets every <p> to weight 300 (globals.css). These panels take
 * the same padding as the portal's cards, and text blocks are divs so the
 * weights set here are the weights you see.
 */
export function PortalFacilitySection() {
  const { client, authFetch } = usePortal();
  const { data, loading, error, reload } = useOntology({ kind: "portal", facilityId: client.facilityId, authFetch });
  const shownId = useFlow()?.shown?.id ?? null;

  if (loading && !data) return <SectionSkeleton />;
  if (error || !data) return <ErrorState message={error ?? "Couldn't load your facility index."} onRetry={reload} />;

  return (
    <>
      <section aria-labelledby="next-heading" className="p-5">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="next-heading" className="text-base font-extrabold text-[var(--ic-ink)]">
            Needs you
          </h2>
          <span
            className="text-[28px] font-extrabold leading-none tabular-nums text-[var(--ic-selected)]"
            aria-label={`${data.moves.length} ${data.moves.length === 1 ? "thing" : "things"}`}
          >
            {data.moves.length}
          </span>
        </div>
        <NextMoves ontology={data} skipId={shownId} />
      </section>

      <section aria-labelledby="facility-heading" className="px-3 py-5 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="facility-heading" className="text-base font-extrabold text-[var(--ic-ink)]">
            Your facility
          </h2>
          <Link href="/portal/index" className="text-[13px] font-bold text-[var(--ic-ink)] underline underline-offset-4">
            Open the index
          </Link>
        </div>
        <FacilityInstrument summaries={data.summaries} />
        <div className="ic-label mt-4 border-t-2 border-[var(--ic-ink)] pt-2 text-[10.5px] text-[var(--ic-instruction)]">
          {data.facility.name} · {data.objects.length} things, one address each
        </div>
      </section>
    </>
  );
}
