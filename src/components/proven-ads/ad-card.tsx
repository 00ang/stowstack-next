"use client";

import { ArrowUpRight } from "lucide-react";
import { Chip, DaysFigure, type ProvenAd, labelFor, originalLine, where } from "./shared";

/**
 * One ad in the grid. Built to scan: the proof (days running), who ran it,
 * the read in one sentence, then the facts. The whole card opens the sheet.
 */
export function AdCard({ ad, onOpen }: { ad: ProvenAd; onOpen: (ad: ProvenAd) => void }) {
  const scale = labelFor("scale", ad.advertiser_scale);
  const place = where(ad);
  const meta = [scale, ad.family_size > 1 ? `${ad.family_size} live versions` : null, place]
    .filter(Boolean)
    .join(" · ");
  const read = ad.insight?.summary || null;
  const original = originalLine(ad);

  return (
    <article className="group relative flex min-w-0 flex-col rounded-[4px] border border-[var(--border-subtle)] transition-colors hover:border-[var(--color-dark)]/30">
      <button
        type="button"
        onClick={() => onOpen(ad)}
        className="flex h-full w-full flex-col p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-dark)] sm:p-5"
        aria-label={`${ad.advertiser_name}, ${ad.days_running} days running. Open the read.`}
      >
        <div className="flex items-start justify-between gap-3">
          <DaysFigure days={ad.days_running} />
          <ArrowUpRight
            aria-hidden
            size={16}
            className="mt-1 shrink-0 text-[var(--color-body-text)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>

        <div className="mt-3 truncate text-[13px]" style={{ color: "var(--color-dark)", fontWeight: 750 }}>
          {ad.advertiser_name}
        </div>
        {meta && (
          <div className="mt-0.5 truncate text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
            {meta}
          </div>
        )}

        {read ? (
          <div className="mt-3 text-[15px] leading-[1.45]" style={{ color: "var(--color-dark)", fontWeight: 650 }}>
            {read}
          </div>
        ) : original ? (
          <div
            className="mt-3 line-clamp-3 text-[14px] leading-[1.5]"
            style={{ color: "var(--color-dark)", fontWeight: 550 }}
          >
            <span style={{ color: "var(--color-body-text)", fontWeight: 650 }}>The ad: </span>
            {original}
          </div>
        ) : null}

        {ad.insight_pending && (
          <div className="mt-2 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
            The read on this one is being written.
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          <Chip kind="offer" value={ad.offer_type} />
          <Chip kind="unit" value={ad.unit_type} />
          <Chip kind="angle" value={ad.angle} />
          <Chip kind="format" value={ad.format} />
        </div>
      </button>
    </article>
  );
}
