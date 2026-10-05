"use client";

/**
 * StickyMobileCTA
 *
 * Always-visible bottom CTA on mobile only. Built for the 80% of homepage
 * traffic that hits us via the Facebook in-app browser on iPhone-class
 * devices, where:
 *   - the FB chrome chews ~80px off the bottom of the visual viewport
 *   - users rarely scroll back up after passing the hero
 *   - the in-app browser sometimes drops external-link new-tab behavior,
 *     so the in-page `#cta` anchor (audit form) is the safe destination
 *
 * Visibility rules:
 *   1. Hidden until user has scrolled past the hero's primary CTA, so we
 *      don't double-render the same action on the same screen.
 *   2. Hidden again once the bottom CTASection (#cta) enters the viewport,
 *      because the real form is now on-screen and a floating button on top
 *      would just block fields.
 *   3. Hidden on >=md (sm tier is still mobile in our breakpoints; lg+ is
 *      the desktop layout that already shows the dashboard mockup).
 *
 * Safe-area inset:
 *   bottom uses `max(env(safe-area-inset-bottom), 12px)` so the bar sits
 *   above the iPhone home-bar AND above the FB IAB's bottom toolbar (the
 *   IAB shrinks visualViewport.height to exclude the toolbar, so `bottom:0`
 *   already clears it — the extra 12px is just visual breathing room).
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);
  const sentinelHeroRef = useRef<HTMLDivElement | null>(null);
  const sentinelFooterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Wait until the hero CTA exists; the sentinel sits just below it.
    const heroCta = document.querySelector<HTMLAnchorElement>(
      "section#hero a.btn-primary",
    );
    const ctaSection = document.querySelector<HTMLElement>("section#cta");
    if (!heroCta || !ctaSection) return;

    // Track whether each "boundary" is currently below/above the fold.
    let pastHero = false;
    let footerInView = false;

    const update = () => {
      // Show only when:
      //   - user scrolled past the hero CTA (so we're not duplicating UI)
      //   - the in-page CTA form is not yet in view (so we're not blocking it)
      setVisible(pastHero && !footerInView);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        // Entry intersecting === hero CTA still visible. Once it leaves the
        // viewport (scrolled past), we flip pastHero to true.
        pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        update();
      },
      { threshold: 0 },
    );
    heroObserver.observe(heroCta);

    const ctaObserver = new IntersectionObserver(
      ([entry]) => {
        footerInView = entry.isIntersecting;
        update();
      },
      { threshold: 0.05 },
    );
    ctaObserver.observe(ctaSection);

    return () => {
      heroObserver.disconnect();
      ctaObserver.disconnect();
    };
  }, []);

  return (
    <>
      {/* Invisible sentinels keep the refs valid for future use without
          forcing a layout change. The IntersectionObserver targets the
          real elements in the DOM. */}
      <div ref={sentinelHeroRef} aria-hidden="true" />
      <div ref={sentinelFooterRef} aria-hidden="true" />

      <div
        aria-hidden={!visible}
        className="lg:hidden fixed left-0 right-0 z-40"
        style={{
          // FB IAB shrinks visualViewport.height to exclude the bottom
          // toolbar, so bottom:0 already clears it. The safe-area inset
          // floor (12px) just keeps the bar off the iPhone home indicator.
          bottom: 0,
          paddingBottom:
            "max(env(safe-area-inset-bottom, 0px), 12px)",
          paddingLeft: "max(env(safe-area-inset-left, 0px), 12px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 12px)",
          paddingTop: 10,
          transform: visible ? "translateY(0)" : "translateY(120%)",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "transform 280ms ease, opacity 200ms ease",
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <a
          href="#cta"
          className="btn-primary"
          style={{
            width: "100%",
            // Slightly taller than the inline mobile button so the bar
            // reads as a deliberate, always-on conversion target rather
            // than a duplicate of the hero CTA.
            padding: "16px 24px",
            fontSize: 15,
            fontWeight: 600,
          }}
          data-analytics="sticky-mobile-cta"
        >
          Get your free facility audit
          <ArrowRight size={16} className="shrink-0" />
        </a>
      </div>
    </>
  );
}
