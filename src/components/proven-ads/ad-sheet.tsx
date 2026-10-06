"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  Chip,
  DaysFigure,
  Eyebrow,
  KIND,
  Tag,
  ink,
  labelFor,
  landingDomain,
  shortDate,
  span,
  where,
  type ProvenAd,
} from "./shared";

function Section({ title, hue, children }: { title: string; hue?: string; children: ReactNode }) {
  return (
    <section className="border-t border-[var(--border-subtle)] py-5">
      <Eyebrow hue={hue} className="mb-2.5">
        {title}
      </Eyebrow>
      {children}
    </section>
  );
}

function runLine(ad: ProvenAd): string {
  const started = shortDate(ad.started_at);
  if (!ad.active) return `Ran ${span(ad.days_running)}, ${started} until it stopped.`;
  const seen = shortDate(ad.confirmed_through);
  return `Running ${span(ad.days_running)}. Started ${started}, last seen live ${seen}.`;
}

/**
 * Everything about one ad: the proof, the read, the structure, the playbook,
 * and the original as it ran. The action that turns it into a draft for the
 * viewer's facility is passed in (`footer`), because owners and admins pick
 * the facility differently.
 */
export function AdSheet({ ad, onClose, footer }: { ad: ProvenAd; onClose: () => void; footer: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const i = ad.insight;
  const place = where(ad);
  const scale = labelFor("scale", ad.advertiser_scale);
  const audience = labelFor("audience", ad.audience);
  const domain = landingDomain(ad.landing_url);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="pa-sheet-title">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 hidden cursor-default sm:block"
        style={{ background: "color-mix(in srgb, var(--color-dark) 38%, transparent)" }}
      />
      <div
        className="relative flex h-full w-full flex-col sm:w-[min(640px,100%)] sm:border-l sm:border-[var(--border-subtle)]"
        style={{ background: "var(--color-light)" }}
      >
        <header className="flex items-start justify-between gap-4 px-4 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0">
            <DaysFigure days={ad.days_running} size="lg" />
            <div className="mt-2 text-[13px] leading-snug" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
              {runLine(ad)}
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-[4px] p-2 text-[var(--color-dark)] hover:bg-[var(--color-dark)]/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-dark)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-7">
          <div className="pb-5">
            <h2 id="pa-sheet-title" className="text-[14px]" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
              {ad.advertiser_name}
            </h2>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
              {[scale ? `${scale} advertiser` : null, ad.family_size > 1 ? `${ad.family_size} live versions of this ad` : null, place]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {i?.summary && (
              <p className="mt-4 text-[19px] leading-[1.4]" style={{ color: "var(--color-dark)", fontWeight: 750, letterSpacing: "-0.01em" }}>
                {i.summary}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <Chip kind="offer" value={ad.offer_type} />
              <Chip kind="unit" value={ad.unit_type} />
              <Chip kind="angle" value={ad.angle} />
              <Chip kind="format" value={ad.format} />
              {audience && <Chip kind="audience" value={ad.audience} />}
            </div>
          </div>

          {i ? (
            <>
              <Section title="Why it's still running">
                <p className="text-[15px] leading-[1.6]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                  {i.why}
                </p>
                {i.hook && (
                  <p className="mt-3 text-[14px] leading-[1.55]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                    <span style={{ fontWeight: 800 }}>The hook. </span>
                    {i.hook}
                  </p>
                )}
              </Section>

              {i.creative && (
                <Section title="The creative">
                  <p className="text-[14px] leading-[1.55]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                    {i.creative}
                  </p>
                </Section>
              )}

              {i.beats.length > 0 && (
                <Section title="How it's built">
                  <ol className="space-y-0">
                    {i.beats.map((b, n) => (
                      <li key={n} className="grid grid-cols-[92px_1fr] gap-3 border-l-[1.5px] border-[var(--color-dark)] py-1.5 pl-3 sm:grid-cols-[110px_1fr]">
                        <span className="text-[12px] uppercase tracking-[0.06em]" style={{ color: ink(KIND.angle.hue), fontWeight: 800 }}>
                          {b.label}
                        </span>
                        <span className="text-[14px] leading-[1.5]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                          {b.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {i.run_it.length > 0 && (
                <Section title="Make your version" hue={KIND.offer.hue}>
                  <ol className="space-y-3">
                    {i.run_it.map((step, n) => (
                      <li key={n} className="flex gap-3">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[12px]"
                          style={{ background: "var(--color-dark)", color: "var(--color-light)", fontWeight: 800 }}
                        >
                          {n + 1}
                        </span>
                        <span className="pt-0.5 text-[15px] leading-[1.5]" style={{ color: "var(--color-dark)", fontWeight: 600 }}>
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {(i.needs.length > 0 || i.best_for.length > 0) && (
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {i.needs.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 700 }}>
                            You&apos;ll need
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {i.needs.map((n) => (
                              <Tag key={n}>{n}</Tag>
                            ))}
                          </div>
                        </div>
                      )}
                      {i.best_for.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 700 }}>
                            Fits
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {i.best_for.map((n) => (
                              <Tag key={n} hue={KIND.unit.hue}>
                                {n}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {i.watch_out && (
                    <p className="mt-5 text-[14px] leading-[1.55]" style={{ color: "var(--color-dark)", fontWeight: 550 }}>
                      <span style={{ color: "var(--accent-dim)", fontWeight: 800 }}>Watch out. </span>
                      {i.watch_out}
                    </p>
                  )}
                </Section>
              )}
            </>
          ) : (
            <Section title="The read">
              <p className="text-[14px] leading-[1.55]" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
                {ad.insight_pending
                  ? "The read on this ad is being written. The original is below."
                  : "We couldn't write a read for this one. The original is below, and it has still run long enough to count."}
              </p>
            </Section>
          )}

          <Section title="The original ad">
            <figure className="rounded-[4px] p-4" style={{ background: "color-mix(in srgb, var(--color-dark) 4%, transparent)" }}>
              {ad.headline && (
                <div className="text-[15px] leading-snug" style={{ color: "var(--color-dark)", fontWeight: 800 }}>
                  {ad.headline}
                </div>
              )}
              {ad.primary_text && (
                <blockquote
                  className="mt-2 whitespace-pre-line text-[14px] leading-[1.6]"
                  style={{ color: "var(--color-dark)", fontWeight: 500 }}
                >
                  {ad.primary_text}
                </blockquote>
              )}
              {ad.description && (
                <div className="mt-2 text-[13px] leading-snug" style={{ color: "var(--color-body-text)", fontWeight: 600 }}>
                  {ad.description}
                </div>
              )}
              <figcaption className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--color-body-text)", fontWeight: 650 }}>
                {ad.cta && <span>Button: {ad.cta}</span>}
                {domain && <span>Goes to {domain}</span>}
                {ad.publisher_platforms.length > 0 && (
                  <span>
                    On{" "}
                    {ad.publisher_platforms
                      .filter((p) => ["facebook", "instagram", "messenger", "threads", "audience_network"].includes(p))
                      .map((p) => (p === "audience_network" ? "Audience Network" : p[0].toUpperCase() + p.slice(1)))
                      .join(", ")}
                  </span>
                )}
              </figcaption>
            </figure>
            {ad.snapshot_url && (
              <a
                href={ad.snapshot_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] underline-offset-[3px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: ink(KIND.unit.hue), fontWeight: 750 }}
              >
                See it in the Meta Ad Library <ExternalLink size={13} aria-hidden />
              </a>
            )}
            <p className="mt-3 text-[12px] leading-[1.5]" style={{ color: "var(--color-body-text)", fontWeight: 550 }}>
              This is another operator&apos;s ad, shown for study. Use the structure, never their name, words or photos.
            </p>
          </Section>
        </div>

        <footer
          className="border-t border-[var(--border-subtle)] px-4 py-4 sm:px-7"
          style={{ background: "var(--color-light)", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {footer}
        </footer>
      </div>
    </div>
  );
}
