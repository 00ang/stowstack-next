"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Dot, Label, MONO } from "@/components/mono";
import { CAL_BOOKING_URL } from "@/lib/booking";

/* ── Link configuration ── */
const SECTION_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Results", href: "#results" },
  { label: "Calculator", href: "#calculator" },
];

const PAGE_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Tools", href: "/tools" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Insights", href: "/insights" },
  { label: "Sign up", href: "/signup" },
];

const ALL_DESKTOP_LINKS = [...SECTION_LINKS, ...PAGE_LINKS];

const CALCOM_URL = CAL_BOOKING_URL;

/* ── Active section hook ── */
function useActiveSection(sectionIds: string[]) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(`#${id}`);
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [sectionIds]);

  return active;
}

/* ── Scroll progress hook ── */
function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight =
            document.documentElement.scrollHeight - window.innerHeight;
          setProgress(docHeight > 0 ? scrollTop / docHeight : 0);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return progress;
}

/* ── iOS-safe scroll lock ── */
function useScrollLock(locked: boolean) {
  const scrollY = useRef(0);

  useEffect(() => {
    if (locked) {
      scrollY.current = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY.current}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY.current);
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
    };
  }, [locked]);
}

/* ── Swipe-to-close hook ── */
function useSwipeToClose(
  ref: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  onClose: () => void,
) {
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const currentX = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isOpen) return;

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      touchStart.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      currentX.current = 0;
      el!.style.transition = "none";
    }

    function handleTouchMove(e: TouchEvent) {
      if (!touchStart.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;

      // Only track horizontal swipes to the right
      if (Math.abs(dy) > Math.abs(dx) && currentX.current === 0) {
        touchStart.current = null;
        return;
      }

      if (dx > 0) {
        currentX.current = dx;
        el!.style.transform = `translate3d(${dx}px, 0, 0)`;
        // Prevent vertical scroll while swiping
        e.preventDefault();
      }
    }

    function handleTouchEnd() {
      if (!touchStart.current) {
        el!.style.transition = "";
        el!.style.transform = "";
        return;
      }

      const velocity = currentX.current / (Date.now() - touchStart.current.t);
      el!.style.transition = "";

      // Close if swiped > 30% of panel width or fast enough
      if (currentX.current > el!.offsetWidth * 0.3 || velocity > 0.5) {
        onClose();
      } else {
        el!.style.transform = "translate3d(0, 0, 0)";
      }

      touchStart.current = null;
      currentX.current = 0;
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [ref, isOpen, onClose]);
}

export default function Nav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const scrollProgress = useScrollProgress();
  const activeSection = useActiveSection([
    "how-it-works",
    "results",
    "calculator",
  ]);

  useScrollLock(isMenuOpen);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    // Return focus to hamburger button on close
    hamburgerRef.current?.focus();
  }, []);

  useSwipeToClose(menuRef, isMenuOpen, closeMenu);

  /* Scroll detection */
  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 60);
          ticking = false;
        });
        ticking = true;
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* Close on escape — returns focus to hamburger via closeMenu */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isMenuOpen) closeMenu();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen, closeMenu]);

  /* Focus trap — keep Tab within the mobile menu panel */
  useEffect(() => {
    if (!isMenuOpen) return;
    const panel = menuRef.current;
    if (!panel) return;

    // Focus the first interactive element on open
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panel) return;
      const items = panel.querySelectorAll<HTMLElement>(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [isMenuOpen]);

  const handleLinkClick = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* ── Top navigation bar ── */}
      <nav
        aria-label="Main navigation"
        className="fixed top-0 left-0 right-0 transition-all duration-300"
        style={{
          zIndex: "var(--z-nav)",
          // Grow the bar by the safe-area inset so the logo row keeps its full
          // 64px on iPhones with a dynamic island / notch. With box-sizing:
          // border-box, the inner paddingTop would otherwise eat the nav.
          height: "calc(var(--nav-height) + env(safe-area-inset-top, 0px))",
          paddingTop: "env(safe-area-inset-top, 0px)",
          background: isScrolled
            ? "rgba(250, 249, 245, 0.92)"
            : "rgba(250, 249, 245, 0.6)",
          backdropFilter: isScrolled
            ? "blur(24px) saturate(180%)"
            : "blur(12px)",
          WebkitBackdropFilter: isScrolled
            ? "blur(24px) saturate(180%)"
            : "blur(12px)",
          borderBottom: isScrolled
            ? "1px solid var(--border-subtle)"
            : "1px solid transparent",
        }}
      >
        {/* Scroll progress bar — was var(--color-gold) which CLAUDE.md bans
            outside the logo "ads" letters. Charcoal at 0.6 opacity reads as
            a quiet system indicator, not a brand accent. */}
        <div
          className="absolute bottom-0 left-0 h-[2px] transition-opacity duration-300"
          style={{
            width: `${scrollProgress * 100}%`,
            background: "var(--color-dark)",
            opacity: isScrolled ? 0.6 : 0,
            willChange: "width",
          }}
        />

        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-4 sm:px-6">
          {/* Logo + LIVE tag */}
          <div className="flex items-center gap-3 relative z-10">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <span
                style={{
                  fontFamily: MONO.serif,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontSize: 18,
                  color: MONO.textAccent,
                }}
              >
                storage<span style={{ color: "var(--brand-ads)" }}>ads</span>
                <span style={{ color: MONO.textFaint, fontWeight: 400 }}>/attr</span>
              </span>
            </Link>
            <span
              className="hidden sm:inline-flex items-center gap-1.5"
              style={{
                padding: "2px 6px",
                border: `1px solid ${MONO.accent}`,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              }}
            >
              <Dot live color={MONO.accent} />
              <Label style={{ color: MONO.accent, fontWeight: 500 }}>LIVE</Label>
            </span>
          </div>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-1">
            {ALL_DESKTOP_LINKS.map((link) => {
              const isActive =
                link.href.startsWith("#") && activeSection === link.href;
              return (
                <a
                  key={link.label}
                  href={link.href}
                  className="nav-desktop-link relative px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: isActive
                      ? "var(--color-dark)"
                      : "var(--color-muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {link.label}
                  <span
                    className="nav-desktop-underline absolute bottom-0.5 left-3 right-3 h-[1.5px] origin-left transition-transform duration-200"
                    style={{
                      background: "var(--color-dark)",
                      transform: isActive ? "scaleX(1)" : "scaleX(0)",
                    }}
                  />
                </a>
              );
            })}

            <div
              className="w-px h-5 mx-2"
              style={{ background: "var(--border-medium)" }}
            />

            <a
              href={CALCOM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 14px",
                border: `1px solid ${MONO.lineHi}`,
                background: "transparent",
                color: MONO.text,
                fontFamily: MONO.mono,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 120ms",
              }}
              className="hover:[background:var(--bg-hi)]"
            >
              Book a Call
            </a>

            <a
              href="#cta"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: MONO.accent,
                color: MONO.bg,
                border: `1px solid ${MONO.accent}`,
                fontFamily: MONO.mono,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 120ms",
              }}
            >
              Request Audit →
            </a>
          </div>

          {/* ── Animated hamburger button (min 44x44 touch target) ── */}
          <button
            ref={hamburgerRef}
            className="lg:hidden relative flex items-center justify-center -mr-1"
            onClick={toggleMenu}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            style={{
              zIndex: "calc(var(--z-overlay) + 10)",
              width: "44px",
              height: "44px",
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}
          >
            <div className="relative w-[22px] h-[18px]">
              <span
                className="absolute left-0 w-full h-[2px] rounded-full"
                style={{
                  background: "var(--color-dark)",
                  top: isMenuOpen ? "50%" : "0",
                  transform: isMenuOpen
                    ? "translateY(-50%) rotate(45deg)"
                    : "translate3d(0, 0, 0) rotate(0)",
                  transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                  willChange: "transform, top",
                }}
              />
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                style={{
                  background: "var(--color-dark)",
                  width: isMenuOpen ? "0" : "100%",
                  opacity: isMenuOpen ? 0 : 1,
                  transition: "all 200ms ease",
                }}
              />
              <span
                className="absolute left-0 w-full h-[2px] rounded-full"
                style={{
                  background: "var(--color-dark)",
                  bottom: isMenuOpen ? "auto" : "0",
                  top: isMenuOpen ? "50%" : "auto",
                  transform: isMenuOpen
                    ? "translateY(-50%) rotate(-45deg)"
                    : "translate3d(0, 0, 0) rotate(0)",
                  transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                  willChange: "transform, top, bottom",
                }}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* ── Mobile menu backdrop ── */}
      <div
        className="fixed inset-0 lg:hidden"
        style={{
          zIndex: "calc(var(--z-overlay) - 1)",
          background: "rgba(20, 20, 19, 0.3)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: isMenuOpen ? 1 : 0,
          pointerEvents: isMenuOpen ? "auto" : "none",
          transition: "opacity 300ms ease",
          WebkitTapHighlightColor: "transparent",
        }}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* ── Mobile slide-in panel ── */}
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="safe-right fixed top-0 right-0 bottom-0 lg:hidden"
        style={{
          zIndex: "var(--z-overlay)",
          width: "min(88vw, 380px)",
          height: "100dvh",
          background: "var(--color-light)",
          transform: isMenuOpen
            ? "translate3d(0, 0, 0)"
            : "translate3d(100%, 0, 0)",
          transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
          boxShadow: isMenuOpen
            ? "-8px 0 30px rgba(20, 20, 19, 0.12)"
            : "none",
          overflowY: "auto",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="flex flex-col min-h-full"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
            paddingLeft: "24px",
            paddingRight: "24px",
          }}
        >
          {/* ── Section links (on-page anchors) ── */}
          <div className="mb-6">
            <p
              className="text-[11px] font-semibold uppercase mb-3"
              style={{
                color: "var(--color-mid-gray)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.1em",
              }}
            >
              On this page
            </p>
            <div className="flex flex-col gap-0.5">
              {SECTION_LINKS.map((link, i) => {
                const isActive = activeSection === link.href;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={handleLinkClick}
                    className="flex items-center gap-3 rounded-lg active:scale-[0.97]"
                    style={{
                      minHeight: "48px",
                      padding: "12px 14px",
                      background: isActive
                        ? "var(--color-light-gray)"
                        : "transparent",
                      transform: isMenuOpen
                        ? "translate3d(0, 0, 0)"
                        : "translate3d(40px, 0, 0)",
                      opacity: isMenuOpen ? 1 : 0,
                      transition: `transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${80 + i * 60}ms,
                                   opacity 400ms ease ${80 + i * 60}ms,
                                   background 200ms ease`,
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                    }}
                  >
                    <span
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0 transition-colors duration-200"
                      style={{
                        background: isActive
                          ? "var(--color-dark)"
                          : "var(--color-mid-gray)",
                      }}
                    />
                    <span
                      className="text-[17px] font-medium transition-colors duration-200"
                      style={{
                        fontFamily: "var(--font-heading)",
                        color: "var(--color-dark)",
                        fontWeight: isActive ? 700 : 500,
                      }}
                    >
                      {link.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div
            className="h-px mb-6 mx-3"
            style={{
              background: "var(--border-subtle)",
              transform: isMenuOpen ? "scaleX(1)" : "scaleX(0)",
              transformOrigin: "left",
              transition: `transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${isMenuOpen ? "250ms" : "0ms"}`,
            }}
          />

          {/* ── Page links ── */}
          <div className="mb-6">
            <p
              className="text-[11px] font-semibold uppercase mb-3"
              style={{
                color: "var(--color-mid-gray)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.1em",
              }}
            >
              Explore
            </p>
            <div className="flex flex-col gap-0.5">
              {PAGE_LINKS.map((link, i) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center justify-between rounded-lg active:scale-[0.97] group"
                  style={{
                    minHeight: "48px",
                    padding: "12px 14px",
                    transform: isMenuOpen
                      ? "translate3d(0, 0, 0)"
                      : "translate3d(40px, 0, 0)",
                    opacity: isMenuOpen ? 1 : 0,
                    transition: `transform 500ms cubic-bezier(0.16, 1, 0.3, 1) ${300 + i * 60}ms,
                                 opacity 400ms ease ${300 + i * 60}ms`,
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <span
                    className="text-[17px] font-medium"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-dark)",
                    }}
                  >
                    {link.label}
                  </span>
                  <ChevronRight
                    size={18}
                    className="transition-transform duration-200 group-active:translate-x-1"
                    style={{ color: "var(--color-mid-gray)" }}
                  />
                </Link>
              ))}
            </div>
          </div>

          {/* Spacer pushes CTAs to bottom */}
          <div className="flex-1 min-h-6" />

          {/* ── Pinned CTAs ── */}
          <div
            className="flex flex-col gap-3"
            style={{
              transform: isMenuOpen
                ? "translate3d(0, 0, 0)"
                : "translate3d(0, 24px, 0)",
              opacity: isMenuOpen ? 1 : 0,
              transition: `transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 500ms,
                           opacity 400ms ease 500ms`,
            }}
          >
            <a
              href={CALCOM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="flex items-center justify-center gap-2 rounded-lg font-medium active:scale-[0.97]"
              style={{
                minHeight: "50px",
                padding: "14px 20px",
                fontSize: "16px",
                fontFamily: "var(--font-heading)",
                color: "var(--color-dark)",
                border: "1.5px solid var(--color-dark)",
                background: "transparent",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Book a Call
            </a>

            <a
              href="#cta"
              onClick={handleLinkClick}
              className="flex items-center justify-center gap-2 rounded-lg font-semibold active:scale-[0.97]"
              style={{
                minHeight: "50px",
                padding: "14px 20px",
                fontSize: "16px",
                fontFamily: "var(--font-heading)",
                background: "var(--color-dark)",
                color: "var(--color-light)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
              }}
            >
              Request Audit
              <ArrowRight size={18} />
            </a>
          </div>

          {/* ── Footer ── */}
          <div
            className="mt-6 pt-5"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              opacity: isMenuOpen ? 1 : 0,
              transition: "opacity 400ms ease 600ms",
            }}
          >
            <p
              className="text-[11px]"
              style={{
                color: "var(--color-mid-gray)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Built by storage operators
            </p>
            <p
              className="text-[11px] mt-0.5"
              style={{
                color: "var(--color-mid-gray)",
                fontFamily: "var(--font-heading)",
              }}
            >
              storageads.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
