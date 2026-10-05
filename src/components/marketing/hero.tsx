"use client";

import { MONO, Label, Dot, Display } from "@/components/mono";
import { useClock } from "@/hooks/use-live-data";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Megaphone,
  FileText,
  Target,
  TrendingUp,
  Zap,
  MousePointerClick,
  Eye,
  DollarSign,
  Sparkles,
  Layers,
  Activity,
  ChevronDown,
  Smartphone,
  ArrowUpRight,
  LineChart,
  PieChart,
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  Star,
  Play,
  Pause,
  RotateCw,
} from "lucide-react";
import { useInView } from "./use-in-view";
import { SplitFlap as SplitFlapComponent } from "./split-flap";
import { CAL_BOOKING_URL } from "@/lib/booking";
import Cite from "./cite";
import { MagneticButton } from "./motion";

const CALCOM_URL = CAL_BOOKING_URL;

/* ═══════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════ */

function useCountUp(target: number, duration = 2000, decimals = 0, active = false) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(parseFloat((eased * target).toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration, decimals]);
  return value;
}

// Animates 0 → target on first reveal; subsequent target updates snap into
// place without re-animating. Honors prefers-reduced-motion by snapping
// immediately to the final value.
function useRevealCountUp(target: number, active: boolean, duration = 1800) {
  const [value, setValue] = useState(0);
  const animatedRef = useRef(false);
  useEffect(() => {
    if (!active) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animatedRef.current || prefersReduced) {
      animatedRef.current = true;
      setValue(target);
      return;
    }
    animatedRef.current = true;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const elapsed = now - start;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - p) * (1 - p);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return value;
}

function useFlashOnChange<T>(value: T, ms = 600) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setFlashing(true);
    const t = setTimeout(() => setFlashing(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return flashing;
}

function useTypewriter(words: string[], active: boolean, typingSpeed = 80, pauseMs = 2200) {
  // Initial state shows words[0] fully typed. Previously the typewriter
  // started at "" and the user saw a lone blinking cursor floating in a
  // void below the H1 for the first ~80ms + IntersectionObserver delay
  // (often 200-500ms). On mobile that void was ~56px of reserved height
  // and looked like a broken page. Pre-typed initial state means the first
  // paint has real text; the effect's first run sees charIdx === word.length
  // and schedules the pause → delete cycle naturally.
  const [display, setDisplay] = useState(words[0] ?? "");
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(words[0]?.length ?? 0);
  const [isDeleting, setIsDeleting] = useState(false);
  useEffect(() => {
    if (!active) return;
    const word = words[wordIdx];
    let timeout: ReturnType<typeof setTimeout>;
    if (!isDeleting && charIdx < word.length) {
      timeout = setTimeout(() => setCharIdx((c) => c + 1), typingSpeed);
    } else if (!isDeleting && charIdx === word.length) {
      timeout = setTimeout(() => setIsDeleting(true), pauseMs);
    } else if (isDeleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx((c) => c - 1), typingSpeed / 2);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false); // eslint-disable-line react-hooks/set-state-in-effect -- state machine transition
      setWordIdx((i) => (i + 1) % words.length);
    }
    setDisplay(word.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [active, charIdx, isDeleting, wordIdx, words, typingSpeed, pauseMs]);
  return display;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useMouseTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!enabled || reduced) return;
    const el = ref.current;
    if (!el) return;
    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: y * -3, y: x * 3 });
    }
    function handleLeave() { setTilt({ x: 0, y: 0 }); }
    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => { el.removeEventListener("mousemove", handleMove); el.removeEventListener("mouseleave", handleLeave); };
  }, [enabled, reduced]);
  return { ref, tilt };
}

// Smoothly interpolates between value transitions. Re-targeting mid-tween
// picks up from the current displayed value (held in a ref so the effect
// stays target-driven and we don't infinite-loop on the value dep). Honors
// prefers-reduced-motion by bypassing the tween and returning `target`
// directly — no setState-in-effect required for the reduced path.
function useTweenedNumber(target: number, durationMs = 700) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const rafRef = useRef<number>(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      // Make sure no in-flight animation overrides the snap-to value.
      cancelAnimationFrame(rafRef.current);
      valueRef.current = target;
      return;
    }
    const from = valueRef.current;
    if (from === target) return;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    function tick(now: number) {
      const elapsed = now - start;
      const p = Math.min(elapsed / durationMs, 1);
      // easeOutCubic — fast start, gentle finish
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      valueRef.current = next;
      setValue(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, reduced]);
  // Reduced-motion users skip the tween entirely; they get the latest target
  // at every render. Keeps the snap synchronous without setState-in-effect.
  return reduced ? target : value;
}

// Live boolean for whether the ref is currently in the viewport. Unlike
// useInView (one-shot, sticks at true), this flips back to false when the
// element scrolls out — used to pause demo playback when off-screen so we
// don't burn CPU and so users returning to the dashboard see a coherent
// state, not whatever frame they happened to land on.
function useLiveInViewport<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [present, setPresent] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPresent(entry.isIntersecting),
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, present };
}

function useStaggeredReveal(count: number, active: boolean, baseDelay = 0, stagger = 80) {
  const [revealed, setRevealed] = useState<boolean[]>(new Array(count).fill(false));
  useEffect(() => {
    if (!active) return;
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setRevealed((prev) => { const next = [...prev]; next[i] = true; return next; }), baseDelay + i * stagger)
    );
    return () => timers.forEach(clearTimeout);
  }, [active, count, baseDelay, stagger]);
  return revealed;
}

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */

const STATS = [
  { value: 34, prefix: "", suffix: "", label: "Move-ins, 90 days", decimals: 0, icon: TrendingUp },
  { value: 84, prefix: "", suffix: "%", label: "Occupancy, one quarter", decimals: 0, icon: DollarSign },
  { value: 8.7, prefix: "", suffix: "%", label: "Page conversion rate", decimals: 1, icon: MousePointerClick },
  { value: 35, prefix: "", suffix: "x", label: "Return on ad spend", decimals: 0, icon: BarChart3 },
];

// Ordered to mirror the funnel: see the field, run ads, convert,
// capture organic, optimize, increase per-tenant revenue. Market
// intelligence leads because that's where Blake says every audit
// actually starts.
const CAPABILITIES = [
  { icon: Search, label: "Market Intelligence", desc: "Competitor pricing, reviews, positioning, and trade area analysis. See the field before you spend a dollar.", color: "#8a70b0" },
  { icon: Sparkles, label: "Ad Creator", desc: "Generate Meta and Google ads from facility data. Copy, headlines, creative.", color: "var(--color-blue)" },
  { icon: Megaphone, label: "Ad Publishing", desc: "Publish to Meta and Google from one dashboard. Both channels, side by side.", color: "var(--color-dark)" },
  { icon: FileText, label: "Landing Pages", desc: "A page for every campaign. storEDGE rental flow embedded so the renter books on your branded page.", color: "var(--color-green)" },
  { icon: Target, label: "Organic Capture", desc: "Google Business Profile, review management, walk-in capture. The leads you already get, organized.", color: "var(--color-dark)" },
  { icon: BarChart3, label: "Reservation Follow-up", desc: "Automated follow-up that turns reservations into move-ins. Stop leaking revenue at the last step.", color: "var(--color-blue)" },
  { icon: Eye, label: "A/B Testing", desc: "Headlines, offers, and pages scored by move-ins, not clicks.", color: "var(--color-green)" },
  { icon: Activity, label: "Revenue Intelligence", desc: "Rate moves, ancillary revenue, tax advantages, occupancy modeling. Every tenant worth more.", color: "#8a70b0" },
];

const PIPELINE_STEPS = [
  { icon: Megaphone, label: "Ad", sublabel: "Meta / Google" },
  { icon: FileText, label: "Page", sublabel: "Custom LP" },
  { icon: Smartphone, label: "Reserve", sublabel: "storEDGE" },
  { icon: Target, label: "Move-in", sublabel: "Signed lease" },
];

// Mix of proof points (numbers from Blake's portfolio) and system framing
// (create / capture / recapture, REIT-grade tools, reach 100%). Keeps the
// hook from reading as a single dimension. Leads with the hardest number.
const TYPEWRITER_WORDS = [
  "34 move-ins in 90 days.",
  "71% to 84% occupancy in one quarter.",
  "Create demand. Capture demand. Recapture demand.",
  "REIT-grade tools to reach 100% occupancy.",
  "Stop leaking $72,000 a year to the REIT down the road.",
];

const FEATURE_HIGHLIGHTS = [
  { icon: Search, title: "Facility audit and market map", stat: "Map", desc: "Competitor pricing, review gaps, trade area positioning. See the field before you spend a dollar." },
  { icon: Sparkles, title: "Ad creation and publishing", stat: "Launch", desc: "Meta and Google ads built from your facility data and published from one dashboard. Creative studio included." },
  { icon: FileText, title: "Landing pages with embedded rental", stat: "Convert", desc: "A page for every campaign. storEDGE reserve flow built in. The renter never leaves your brand." },
  { icon: Layers, title: "Self-serve or fully managed", stat: "Run", desc: "Run it yourself or have us run it. Same system either way." },
];

const BEFORE_AFTER = [
  { before: "No ads running", after: "Meta and Google ads live in your trade area" },
  { before: "No idea what competitors charge", after: "Market map with pricing, reviews, and positioning" },
  { before: "Every ad dumps onto the homepage", after: "A branded page per campaign with storEDGE built in" },
  { before: "Reservations that never move in", after: "Automated follow-up from reservation to signed lease" },
];

/* ═══════════════════════════════════════════
   KEYFRAMES
   ═══════════════════════════════════════════ */

function HeroStyles() {
  return (
    <style>{`
      @keyframes hero-float-a{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes hero-float-b{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
      @keyframes hero-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
      @keyframes hero-glow-pulse{0%,100%{opacity:0.5}50%{opacity:1}}
      @keyframes hero-shimmer{0%{background-position:200% 0}50%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes hero-orb-drift{0%{transform:translate(0,0)}100%{transform:translate(30px,-20px)}}
      @keyframes hero-live-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.7)}}
      @keyframes hero-gradient-shift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
      @keyframes hero-scroll-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
      @keyframes hero-pipeline-flow{0%{width:0}100%{width:100%}}
      @keyframes hero-blur-in{0%{opacity:0;filter:blur(8px);transform:translateY(16px)}100%{opacity:1;filter:blur(0);transform:translateY(0)}}
      @keyframes hero-scale-in{0%{opacity:0;transform:scale(0.85)}100%{opacity:1;transform:scale(1)}}
      @keyframes hero-slide-right{0%{opacity:0;transform:translateX(-24px)}100%{opacity:1;transform:translateX(0)}}
      @keyframes hero-slide-left{0%{opacity:0;transform:translateX(24px)}100%{opacity:1;transform:translateX(0)}}
      @keyframes hero-rotate-in{0%{opacity:0;transform:rotate(-3deg) scale(0.95)}100%{opacity:1;transform:rotate(0) scale(1)}}
      @keyframes hero-number-pop{0%{opacity:0;transform:scale(0.6)}60%{transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
      @keyframes hero-draw-check{0%{stroke-dashoffset:24}100%{stroke-dashoffset:0}}
      @keyframes hero-bar-fill{0%{width:0}100%{width:var(--bar-width)}}
      @keyframes hero-card-lift{0%{box-shadow:0 1px 3px rgba(0,0,0,0.04)}100%{box-shadow:0 8px 24px rgba(0,0,0,0.08)}}
      @keyframes hero-ticker-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
      @keyframes hero-badge-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
      /* Tiny "value just changed" pulse — used on the demo dashboard's
         stat values so each month tick reads as a live update, not a
         silent re-render. */
      @keyframes hero-value-flash{0%{color:var(--accent);transform:translateY(-1px)}60%{transform:translateY(0)}100%{color:var(--color-dark);transform:translateY(0)}}
      @keyframes hero-cta-pulse{0%,100%{box-shadow:0 0 0 0 var(--accent-glow)}50%{box-shadow:0 0 0 6px transparent}}
      /* Facelift — headline marker, CTA glint, trust-chip reveal/hover */
      @keyframes hero-underline-draw{to{stroke-dashoffset:0}}
      @keyframes hero-sheen{0%{transform:translateX(-160%) skewX(-18deg)}100%{transform:translateX(420%) skewX(-18deg)}}
      @keyframes hero-fade-in{from{opacity:0}to{opacity:1}}
      /* Hand-drawn marker that strokes under the headline payoff on reveal.
         non-scaling-stroke keeps the line a constant weight despite the
         preserveAspectRatio:none horizontal stretch to the word width. */
      .hero-underline{position:absolute;left:-1.5%;right:-1.5%;bottom:-0.08em;width:103%;height:0.3em;pointer-events:none;overflow:visible}
      .hero-underline path{fill:none;stroke:var(--text-accent);stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke;stroke-dasharray:1;stroke-dashoffset:1}
      .hero-underline.is-in path{animation:hero-underline-draw 0.8s cubic-bezier(0.65,0,0.35,1) forwards;animation-delay:0.5s}
      /* Trust chips: opacity-only staggered fade (keyframe doesn't touch
         transform, so the :hover lift transition stays free to run). */
      .hero-trust-chip{opacity:0;transition:transform 0.22s ease,border-color 0.22s ease}
      .hero-trust-chip.is-in{animation:hero-fade-in 0.5s ease forwards;animation-delay:var(--d,0ms)}
      .hero-trust-chip:hover{transform:translateY(-2px);border-color:var(--text-faint)!important}
      /* Primary CTA: light glint sweeps across on hover + a 1px lift. */
      .hero-cta{position:relative;overflow:hidden}
      .hero-cta::after{content:"";position:absolute;top:0;bottom:0;left:0;width:45%;background:linear-gradient(100deg,transparent 0%,rgba(250,249,245,0.22) 50%,transparent 100%);transform:translateX(-160%) skewX(-18deg);pointer-events:none}
      .hero-cta:hover::after{animation:hero-sheen 0.85s ease}
      .hero-cta:hover{transform:translateY(-1px)}
      .hero-cta:active{transform:translateY(0) scale(0.98)}
      .stat-cell{padding:16px 12px 18px}
      @media (min-width:480px){.stat-cell{padding:20px 16px 22px}}
      @media (min-width:768px){.stat-cell{padding:22px 20px 24px}}
      /* Scoped reduce-motion override — kills hero's looping animations
         (float, pulse, shimmer, gradient shift, scroll bounce) while
         leaving fade-in transitions intact at a much shorter duration. */
      @media (prefers-reduced-motion: reduce) {
        #hero *, #hero *::before, #hero *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          animation-delay: 0ms !important;
        }
      }
    `}</style>
  );
}

/* ═══════════════════════════════════════════
   BACKGROUND
   ═══════════════════════════════════════════ */

function DotGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <svg className="w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hero-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>
      {/* Three infinite radial-gradient orbs. Hidden on mobile (`hidden sm:block`)
          because they're a measurable perf hit in the Facebook in-app browser
          on iPhone-class devices — three full-screen blurred gradients
          compositing 24/7 stutters the scroll on the very segment that's 80%
          of homepage traffic. Desktop keeps the ambient feel. */}
      <div className="hidden sm:block absolute w-[500px] h-[500px] rounded-full" style={{ top: "10%", left: "5%", background: "radial-gradient(circle, var(--accent-glow), transparent 70%)", animation: "hero-orb-drift 12s ease-in-out infinite alternate" }} />
      <div className="hidden sm:block absolute w-[400px] h-[400px] rounded-full" style={{ bottom: "5%", right: "0%", background: "radial-gradient(circle, var(--color-blue-light), transparent 70%)", animation: "hero-orb-drift 10s ease-in-out infinite alternate-reverse" }} />
      <div className="hidden sm:block absolute w-[200px] h-[200px] rounded-full" style={{ top: "40%", right: "20%", background: "radial-gradient(circle, var(--color-green-light), transparent 70%)", animation: "hero-orb-drift 14s ease-in-out infinite alternate" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   ANIMATED PIPELINE FLOW
   Shows: Ad → Page → Reserve → Move-in
   ═══════════════════════════════════════════ */

export function PipelineFlow({ isVisible }: { isVisible: boolean }) {
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    if (!isVisible) return;
    const timers = PIPELINE_STEPS.map((_, i) =>
      setTimeout(() => setActiveStep(i), 1200 + i * 500)
    );
    return () => timers.forEach(clearTimeout);
  }, [isVisible]);

  return (
    <div
      className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      style={{ transitionDelay: "900ms" }}
    >
      <div className="flex items-center justify-between max-w-sm mx-auto lg:mx-0 relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-[10%] right-[10%] h-[2px]" style={{ background: "var(--border-subtle)" }}>
          {/* Solid accent — inline gradients are stripped by the
              .urbit-landing [style*="linear-gradient"] kill-switch in
              globals.css, which left this progress line invisible. */}
          <div
            className="h-full rounded-full"
            style={{
              background: "var(--accent)",
              width: activeStep >= 3 ? "100%" : activeStep >= 0 ? `${(activeStep + 1) * 33}%` : "0%",
              transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>

        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = i <= activeStep;
          return (
            <div key={step.label} className="relative z-10 flex flex-col items-center" style={{ width: "25%" }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500"
                style={{
                  background: isActive ? "var(--bg-elevated)" : "var(--color-light)",
                  borderColor: isActive ? "var(--accent)" : "var(--border-subtle)",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                  boxShadow: isActive ? "0 4px 12px var(--accent-glow)" : "none",
                }}
              >
                <Icon size={16} style={{ color: isActive ? "var(--accent)" : "var(--text-tertiary)", transition: "color 0.3s" }} />
              </div>
              <span
                className="text-[11px] font-semibold mt-1.5 transition-colors duration-300"
                style={{ fontFamily: "var(--font-heading)", color: isActive ? "var(--color-dark)" : "var(--text-tertiary)" }}
              >
                {step.label}
              </span>
              <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{step.sublabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STAT COUNTER
   ═══════════════════════════════════════════ */

function StatItem({ stat, active, delay }: { stat: (typeof STATS)[0]; active: boolean; delay: number }) {
  const count = useCountUp(stat.value, 2200, stat.decimals, active);
  const Icon = stat.icon;
  return (
    <div
      className="flex items-center gap-3 transition-all duration-700"
      style={{ transitionDelay: `${delay}ms`, opacity: active ? 1 : 0, transform: active ? "translateY(0)" : "translateY(16px)" }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent-glow)", border: "1px solid var(--border-medium)" }}>
        <Icon size={18} style={{ color: "var(--accent)" }} />
      </div>
      <div>
        <div className="font-semibold leading-none" style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em", color: "var(--color-dark)" }}>
          {stat.prefix}{stat.decimals > 0 ? count.toFixed(stat.decimals) : Math.round(count)}{stat.suffix}
        </div>
        <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>{stat.label}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   DASHBOARD MOCKUP
   ═══════════════════════════════════════════ */

// Demo data — designed to match the public stats on the rest of the site so
// the numbers reconcile between hero, ROI, and funnel sections.
const DASHBOARD_ROWS = [
  { campaign: "10x10 Climate", channel: "Meta", spend: 847, clicks: 312, reservations: 14, moveIns: 9, cpm: 94, trend: "down" as const },
  { campaign: "Drive-up Units", channel: "Google", spend: 612, clicks: 198, reservations: 11, moveIns: 7, cpm: 87, trend: "down" as const },
  { campaign: "Boat / RV Storage", channel: "Meta", spend: 423, clicks: 156, reservations: 6, moveIns: 4, cpm: 106, trend: "flat" as const },
  { campaign: "Climate Retargeting", channel: "Meta", spend: 298, clicks: 89, reservations: 5, moveIns: 4, cpm: 74, trend: "down" as const },
];

// 6-month campaign progression — mirrors /demo data so the hero dashboard
// can scrub through the same story the full demo tells. Compounds month over
// month: spend climbs slowly, CPM drops as the system learns.
const HERO_DEMO_MONTHS = [
  { label: "Oct 2025", short: "Oct", spend: 1800, leads: 42, moveIns: 8,  cpm: 225, occupancy: 68, rowScale: 0.62, trend: "flat" as const, topAudience: "Lookalike 1%", topCreative: "Your Stuff Deserves Better" },
  { label: "Nov 2025", short: "Nov", spend: 2100, leads: 58, moveIns: 12, cpm: 175, occupancy: 73, rowScale: 0.74, trend: "down" as const, topAudience: "Recently Moved", topCreative: "Unit Size Guide" },
  { label: "Dec 2025", short: "Dec", spend: 2100, leads: 51, moveIns: 10, cpm: 210, occupancy: 76, rowScale: 0.81, trend: "flat" as const, topAudience: "14-Day Retarget", topCreative: "Holiday Declutter" },
  { label: "Jan 2026", short: "Jan", spend: 2400, leads: 67, moveIns: 15, cpm: 160, occupancy: 80, rowScale: 0.90, trend: "down" as const, topAudience: "Phone Call LAL", topCreative: "$1 First Month" },
  { label: "Feb 2026", short: "Feb", spend: 2400, leads: 74, moveIns: 18, cpm: 133, occupancy: 85, rowScale: 0.96, trend: "down" as const, topAudience: "Life Event", topCreative: "Move-In in 10 Minutes" },
  { label: "Mar 2026", short: "Mar", spend: 2800, leads: 89, moveIns: 22, cpm: 127, occupancy: 89, rowScale: 1.00, trend: "down" as const, topAudience: "Broad + Advantage+", topCreative: "Customer Testimonial Reel" },
];
const HERO_DEMO_STARTING_OCCUPANCY = 64;

// Mini lead feed for the "Lead activity" preview tile. We surface a sliding
// window of two leads based on the active month, so as playback advances
// the most-recent leads cycle. Names + units + sources are static; the
// recency tag and ordering shift.
const HERO_DEMO_LEADS = [
  { name: "Sarah M.",   unit: "10x10 Standard", status: "moved_in" as const },
  { name: "David K.",   unit: "10x15 Drive-up", status: "tour"     as const },
  { name: "Jennifer L.",unit: "5x10 Climate",   status: "moved_in" as const },
  { name: "Mike R.",    unit: "10x20 Drive-up", status: "new"      as const },
  { name: "Amanda T.",  unit: "10x10 Standard", status: "moved_in" as const },
  { name: "Chris B.",   unit: "10x30 Vehicle",  status: "new"      as const },
];
const HERO_DEMO_LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new:      { label: "New",      color: "var(--color-blue)" },
  tour:     { label: "Tour",     color: "#8a70b0" },
  moved_in: { label: "Move-in",  color: "var(--color-green)" },
};

const CHANNEL_DOT: Record<string, string> = {
  Meta: "var(--color-dark)",
  Google: "var(--color-blue)",
  Retargeting: "var(--color-green)",
};

// Sparkline path for the avg cost-per-move-in trend (12 points). In SVG
// y=0 is top, so a descending line starts at a small y and ends at a
// large y — i.e. cost was higher 30 days ago and is lower now.
const SPARKLINE_PATH = "M0 4 C8 5, 16 6, 24 8 S40 11, 48 13 S64 15, 72 16 S88 17, 96 18";

// Playback cadence constants — pulled out so the demo's rhythm is easy
// to tune in one place rather than hunting through JSX.
const HERO_DEMO_TICK_MS = 1400;
const HERO_DEMO_AUTOSTART_DELAY_MS = 1100;
const HERO_DEMO_LAST_INDEX = HERO_DEMO_MONTHS.length - 1;

export function DashboardMockup({ isVisible }: { isVisible: boolean }) {
  const { ref: tiltRef, tilt } = useMouseTilt(isVisible);
  // Live in-viewport signal — used to pause auto-play when the hero
  // scrolls off-screen so we don't burn CPU running a setInterval no one
  // can see, and users returning to the page get a fresh start.
  const { ref: presenceRef, present } = useLiveInViewport<HTMLDivElement>(0.2);

  // Interactive 6-month playback. Mirrors the /demo page's scrubber so the
  // hero proves the product is real — you can press play and watch the
  // metrics compound in front of you.
  //
  // Initial state is the FINAL month: SSR / no-JS / reduced-motion users see
  // the best numbers up front, the same way a typical SaaS hero shows its
  // strongest metric. Auto-play rewinds to month 0 and walks forward.
  const [activeMonth, setActiveMonth] = useState(HERO_DEMO_LAST_INDEX);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const reduced = useReducedMotion();

  // Auto-start playback the first time the hero becomes visible. Skip if
  // the user has touched the controls (don't fight them) or prefers
  // reduced motion (let them scrub manually instead).
  useEffect(() => {
    if (!isVisible || reduced || hasUserInteracted) return;
    const start = setTimeout(() => {
      setActiveMonth(0);
      setIsPlaying(true);
    }, HERO_DEMO_AUTOSTART_DELAY_MS);
    return () => clearTimeout(start);
  }, [isVisible, reduced, hasUserInteracted]);

  // Effective playback gate — combines user intent (isPlaying) with
  // courtesy pauses (hover, off-screen). Keeps state minimal and avoids
  // an explosion of "if isPlaying && !isHovered && present" checks.
  const shouldPlay = isPlaying && !isHovered && present;

  useEffect(() => {
    if (!shouldPlay) return;
    const tick = setInterval(() => {
      setActiveMonth((prev) => {
        if (prev >= HERO_DEMO_LAST_INDEX) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, HERO_DEMO_TICK_MS);
    return () => clearInterval(tick);
  }, [shouldPlay]);

  const current = HERO_DEMO_MONTHS[activeMonth];
  const cumulative = HERO_DEMO_MONTHS.slice(0, activeMonth + 1);
  const totalSpend = cumulative.reduce((s, m) => s + m.spend, 0);
  const totalMoveIns = cumulative.reduce((s, m) => s + m.moveIns, 0);
  const avgCpm = current.cpm;
  const isAtEnd = activeMonth >= HERO_DEMO_LAST_INDEX;

  // Tweened display values — animate smoothly between months so the
  // dashboard reads as a live system, not a snapping mock.
  const tSpend = useTweenedNumber(totalSpend);
  const tMoveIns = useTweenedNumber(totalMoveIns);
  const tCpm = useTweenedNumber(avgCpm);
  const tCpmDelta = useTweenedNumber(
    activeMonth > 0 ? HERO_DEMO_MONTHS[0].cpm - avgCpm : 0,
  );

  function handleTogglePlay() {
    setHasUserInteracted(true);
    if (isAtEnd && !isPlaying) {
      setActiveMonth(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => !p);
  }

  function handleScrubTo(i: number) {
    setHasUserInteracted(true);
    setIsPlaying(false);
    setActiveMonth(i);
  }

  // Keyboard scrubbing — ← / → step months, Home / End jump to bounds,
  // Space / Enter toggle play. Wired on the scrubber container so it only
  // captures when the user has focused that region.
  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        handleScrubTo(Math.max(0, activeMonth - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        handleScrubTo(Math.min(HERO_DEMO_LAST_INDEX, activeMonth + 1));
        break;
      case "Home":
        e.preventDefault();
        handleScrubTo(0);
        break;
      case "End":
        e.preventDefault();
        handleScrubTo(HERO_DEMO_LAST_INDEX);
        break;
      case " ":
      case "Enter":
        // Only intercept when focus is on the scrubber row itself, not
        // a button child (buttons already handle Space/Enter natively).
        if (e.target === e.currentTarget) {
          e.preventDefault();
          handleTogglePlay();
        }
        break;
    }
  }

  return (
    <div
      ref={presenceRef}
      className="relative w-full transition-all duration-[400ms]"
      style={{
        transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(4px)",
      }}
      role="region"
      aria-label="Interactive 6-month campaign demo for a sample storage facility"
    >
      {/* Neutral glow — replaces the old gold halo */}
      <div
        className="absolute -inset-6 rounded-3xl pointer-events-none hidden lg:block"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(20,20,19,0.05), transparent 65%)",
          filter: "blur(30px)",
        }}
        aria-hidden="true"
      />

      <div ref={tiltRef} style={{ perspective: "1400px" }}>
        <div
          className="w-full rounded-2xl overflow-hidden border bg-[var(--color-light)] transition-transform duration-300"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            borderColor: "rgba(0,0,0,0.08)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)",
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          <div className="flex">
            {/* Sidebar — shown on all breakpoints (was hidden sm:flex) so the
                mobile dashboard reads as the real app, matching desktop.
                Slightly narrower on phones to leave room for the table. */}
            <div
              className="flex flex-col items-center py-4 gap-2 flex-shrink-0 w-11 sm:w-[52px]"
              style={{ background: "var(--color-dark)" }}
              aria-hidden="true"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center mb-2"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <span className="text-[10px] font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)", color: "var(--color-light)" }}>SA</span>
              </div>
              {[LayoutDashboard, Megaphone, FileText, BarChart3, Settings].map((SideIcon, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: i === 0 ? "rgba(255,255,255,0.1)" : "transparent",
                    border: i === 0 ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                  }}
                >
                  <SideIcon size={14} style={{ color: i === 0 ? "var(--color-light)" : "rgba(255,255,255,0.35)" }} />
                </div>
              ))}
              <div className="flex-1" />
              <div className="w-7 h-7 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
            </div>

            {/* Content column */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top bar */}
              <div
                className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b"
                style={{ borderColor: "var(--border-subtle)", background: "rgba(250,249,245,0.6)" }}
              >
                <div className="h-7 w-36 sm:w-48 rounded-md flex items-center gap-2 px-2.5" style={{ background: "var(--border-subtle)" }}>
                  <Search size={11} style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-[10px] hidden sm:inline" style={{ color: "var(--text-tertiary)" }}>Search campaigns…</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--border-subtle)" }}>
                      <Bell size={11} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "var(--color-green)" }} />
                  </div>
                  <div className="w-6 h-6 rounded-full" style={{ background: "var(--color-light-gray)", border: "1px solid var(--border-subtle)" }} />
                </div>
              </div>

              {/* Header */}
              <div className="flex items-end justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
                <div>
                  <h3
                    className="text-[13px] sm:text-sm font-semibold"
                    style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}
                  >
                    Campaign performance
                  </h3>
                  <p className="text-[10px] sm:text-[11px] mt-0.5 tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    {current.label} · Month {activeMonth + 1} of {HERO_DEMO_MONTHS.length}
                  </p>
                </div>
                {/* Sparkline — progressively draws as months play. The
                    path's total length is ~140; we mask it with a dash
                    offset proportional to (1 - activeMonth/last) so each
                    tick extends the line a bit further. */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wide" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}>
                    Cost / move-in
                  </span>
                  <svg width="96" height="22" viewBox="0 0 96 22" fill="none" aria-hidden="true">
                    <path
                      d={SPARKLINE_PATH}
                      stroke="var(--color-green)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                      style={{
                        strokeDasharray: 140,
                        strokeDashoffset: isVisible
                          ? 140 -
                            140 *
                              ((activeMonth + 1) / HERO_DEMO_MONTHS.length)
                          : 140,
                        transition:
                          "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)",
                      }}
                    />
                  </svg>
                </div>
              </div>

              {/* Interactive playback — scrubber + play/restart toggle.
                  Lives between the header and the stat strip so it reads
                  as a chrome control, not chart data.

                  Keyboard: focus the row and use ← / → to scrub, Home /
                  End to jump to bounds, Space / Enter to toggle play. */}
              <div
                className="px-4 sm:px-5 mt-1 mb-2 flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-light)] rounded-md"
                tabIndex={0}
                role="group"
                aria-label="Campaign month scrubber. Use arrow keys to navigate, space to play."
                onKeyDown={handleKey}
              >
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  /* w-9 h-9 (36px) on mobile for a comfortable touch target;
                     sm:w-7 sm:h-7 keeps the original 28px on desktop. */
                  className="w-9 h-9 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-light)]"
                  style={{
                    background: "var(--color-dark)",
                    color: "var(--color-light)",
                  }}
                  aria-label={
                    isPlaying
                      ? "Pause campaign playback"
                      : isAtEnd
                      ? "Replay campaign from month 1"
                      : "Play campaign from current month"
                  }
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? (
                    <Pause size={11} />
                  ) : isAtEnd ? (
                    <RotateCw size={11} />
                  ) : (
                    <Play size={11} className="ml-px" />
                  )}
                </button>
                <div
                  className="flex-1 flex items-center gap-1"
                  role="presentation"
                >
                  {HERO_DEMO_MONTHS.map((m, i) => {
                    const isActive = i === activeMonth;
                    const isReached = i <= activeMonth;
                    return (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => handleScrubTo(i)}
                        // py-2.5 -my-2.5 expands the touch zone to ~26px tall
                        // on mobile without changing the row height; sm:py-0
                        // sm:my-0 restores the original thin desktop hit area.
                        // The visual bar lives in the inner <span> so the hit
                        // padding never paints.
                        className="flex-1 flex items-center py-2.5 -my-2.5 sm:py-0 sm:my-0 rounded-full cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-light)]"
                        aria-label={`Jump to ${m.label}`}
                        aria-current={isActive ? "true" : undefined}
                        title={m.label}
                      >
                        <span
                          className="block w-full h-1.5 rounded-full transition-all"
                          style={{
                            background: isReached
                              ? "var(--color-dark)"
                              : "var(--border-subtle)",
                            transform: isActive ? "scaleY(1.5)" : "scaleY(1)",
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                <span
                  className="text-[10px] font-semibold tabular-nums flex-shrink-0 hidden sm:inline"
                  style={{
                    color: shouldPlay ? "var(--color-dark)" : "var(--text-tertiary)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "0.04em",
                  }}
                  aria-hidden="true"
                >
                  {shouldPlay ? (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: "var(--color-green)",
                          animation: "hero-live-dot 1.2s ease-in-out infinite",
                        }}
                      />
                      LIVE
                    </span>
                  ) : isPlaying && (isHovered || !present) ? (
                    "PAUSED"
                  ) : (
                    current.short.toUpperCase()
                  )}
                </span>
              </div>

              {/* Stat strip — values drive off the active month and animate
                  smoothly between them via useTweenedNumber so the whole
                  panel reads as a live system, not a static mock.

                  aria-live="polite" lets screen reader users hear updates
                  without interrupting their flow. Numbers are rounded for
                  display because mid-tween fractional dollars would be
                  noisy ("$1,847.32 → $1,847.65"). */}
              <div
                className="grid grid-cols-3 gap-2 px-4 sm:px-5 mt-2"
                role="group"
                aria-label={`Campaign totals through ${current.label}`}
                aria-live="polite"
                aria-atomic="false"
              >
                {[
                  {
                    label: "Total spend",
                    value: `$${Math.round(tSpend).toLocaleString()}`,
                    delta: `Through ${current.short}`,
                    deltaColor: "var(--text-tertiary)",
                  },
                  {
                    label: "Move-ins",
                    value: `${Math.round(tMoveIns)}`,
                    delta: `+${current.moveIns} this month`,
                    deltaColor: "var(--color-green)",
                  },
                  {
                    label: "Avg cost / move-in",
                    value: `$${Math.round(tCpm)}`,
                    delta:
                      activeMonth > 0
                        ? `−$${Math.round(tCpmDelta)} vs Oct`
                        : "Starting point",
                    deltaColor:
                      activeMonth > 0
                        ? "var(--color-green)"
                        : "var(--text-tertiary)",
                  },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-2.5 sm:p-3 border"
                    style={{
                      borderColor: "var(--border-subtle)",
                      background: "var(--color-light)",
                      transition:
                        "opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)",
                      transitionDelay: `${200 + i * 80}ms`,
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateY(0)" : "translateY(6px)",
                    }}
                  >
                    <div
                      className="text-[9px] sm:text-[10px] uppercase tracking-wide"
                      style={{
                        color: "var(--text-tertiary)",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {s.label}
                    </div>
                    {/* key={activeMonth} forces a remount each tick, which
                        re-triggers the hero-value-flash animation — a tiny
                        "value just updated" pulse without manual timers. */}
                    <div
                      key={`${s.label}-${activeMonth}`}
                      className="text-base sm:text-lg font-semibold mt-1 tabular-nums"
                      style={{
                        color: "var(--color-dark)",
                        fontFamily: "var(--font-heading)",
                        lineHeight: 1,
                        animation: reduced
                          ? undefined
                          : "hero-value-flash 700ms ease-out",
                      }}
                    >
                      {s.value}
                    </div>
                    {s.delta && (
                      <div
                        className="text-[9px] sm:text-[10px] mt-1 font-medium"
                        style={{ color: s.deltaColor }}
                      >
                        {s.delta}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Table */}
              <div className="px-4 sm:px-5 pt-4 pb-4 sm:pb-5 flex-1 min-w-0">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
                  {/* Horizontal scroll on phones: the full 6-column table
                      can't shrink to a sub-300px content area without going
                      illegible, so on narrow screens it scrolls inside the
                      card while the card stays within the page margins.
                      sm:min-w-0 drops the floor once there's room. */}
                  <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[360px] sm:min-w-0" style={{ borderCollapse: "collapse" }}>
                    <caption className="sr-only">
                      Campaign performance for {current.label}, month{" "}
                      {activeMonth + 1} of {HERO_DEMO_MONTHS.length}
                    </caption>
                    <thead>
                      <tr style={{ background: "var(--color-light-gray)" }}>
                        {["Campaign", "Spend", "Clicks", "Res.", "Move-ins", "Cost / MI"].map((h, i) => (
                          <th
                            key={h}
                            scope="col"
                            className={`text-[9px] sm:text-[10px] uppercase tracking-wide px-2 sm:px-3 py-2 font-semibold ${i > 0 ? "text-right tabular-nums" : ""}`}
                            style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DASHBOARD_ROWS.map((row, i) => {
                        // DASHBOARD_ROWS represent the final-month state.
                        // Scale volume by rowScale and CPM inversely by the
                        // ratio of current vs. final-month CPM so earlier
                        // months show higher CPMs and lower volume.
                        const scale = current.rowScale;
                        const cpmMul =
                          current.cpm /
                          HERO_DEMO_MONTHS[HERO_DEMO_MONTHS.length - 1].cpm;
                        const dynSpend = Math.round(row.spend * scale);
                        const dynClicks = Math.round(row.clicks * scale);
                        const dynRes = Math.max(
                          1,
                          Math.round(row.reservations * scale),
                        );
                        const dynMoveIns = Math.max(
                          1,
                          Math.round(row.moveIns * scale),
                        );
                        const dynCpm = Math.round(row.cpm * cpmMul);
                        // No prior month → no trend; otherwise inherit the
                        // baked-in improving story.
                        const dynTrend = activeMonth === 0 ? "flat" : row.trend;
                        return (
                          <tr
                            key={row.campaign}
                            style={{
                              borderTop: "1px solid var(--border-subtle)",
                              transition:
                                "opacity 500ms ease-out, transform 500ms ease-out",
                              transitionDelay: `${450 + i * 70}ms`,
                              opacity: isVisible ? 1 : 0,
                              transform: isVisible
                                ? "translateY(0)"
                                : "translateY(4px)",
                            }}
                          >
                            <td
                              className="px-2 sm:px-3 py-2 text-[10px] sm:text-[11px]"
                              style={{ color: "var(--color-dark)" }}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{
                                    background:
                                      CHANNEL_DOT[row.channel] ||
                                      "var(--color-dark)",
                                  }}
                                  aria-label={`${row.channel} channel`}
                                />
                                <span className="font-medium truncate">
                                  {row.campaign}
                                </span>
                              </div>
                            </td>
                            <td
                              className="px-2 sm:px-3 py-2 text-right text-[10px] sm:text-[11px] tabular-nums transition-colors duration-500"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              ${dynSpend.toLocaleString()}
                            </td>
                            <td
                              className="px-2 sm:px-3 py-2 text-right text-[10px] sm:text-[11px] tabular-nums transition-colors duration-500"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {dynClicks}
                            </td>
                            <td
                              className="px-2 sm:px-3 py-2 text-right text-[10px] sm:text-[11px] tabular-nums transition-colors duration-500"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {dynRes}
                            </td>
                            <td
                              className="px-2 sm:px-3 py-2 text-right text-[10px] sm:text-[11px] tabular-nums font-medium transition-colors duration-500"
                              style={{ color: "var(--color-dark)" }}
                            >
                              {dynMoveIns}
                            </td>
                            <td
                              className="px-2 sm:px-3 py-2 text-right text-[10px] sm:text-[11px] tabular-nums"
                              style={{ color: "var(--color-dark)" }}
                            >
                              <span className="inline-flex items-center gap-1">
                                <span className="font-semibold">${dynCpm}</span>
                                {dynTrend === "down" && (
                                  <svg
                                    width="9"
                                    height="9"
                                    viewBox="0 0 8 8"
                                    aria-label="trending down"
                                  >
                                    <path
                                      d="M4 1V7M4 7L1.5 4.5M4 7L6.5 4.5"
                                      stroke="var(--color-green)"
                                      strokeWidth="1.3"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      fill="none"
                                    />
                                  </svg>
                                )}
                                {dynTrend === "flat" && (
                                  <span
                                    className="w-2 h-px"
                                    style={{ background: "var(--text-tertiary)" }}
                                    aria-label="flat"
                                  />
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module preview strip — three small live tiles that hint at the
          breadth of the full /demo page beyond the campaign table above.
          Each tile is driven by the same activeMonth playback state, so
          they all move in lockstep with the main dashboard. Desktop-only
          (the mobile proof panel handles the same job on small viewports).

          Each tile is a Link to /demo so a click on any module takes the
          curious user into the real thing. */}
      <DemoPreviewStrip
        activeMonth={activeMonth}
        cumulative={cumulative}
        current={current}
      />

      {/* Demo footer — small caption that turns the playback into a
          path to the full /demo page. Auto-play proves the dashboard is
          real; this link lets the curious go deeper. Left caption tells
          the user the dashboard is interactive; right link draws the eye
          (subtle accent pulse) once playback completes. */}
      <div className="mt-3 flex items-center justify-center gap-3 text-[11px]">
        <span
          className="inline-flex items-center gap-1.5"
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: shouldPlay
                ? "var(--color-green)"
                : "var(--border-medium)",
              animation: shouldPlay
                ? "hero-live-dot 1.2s ease-in-out infinite"
                : undefined,
            }}
            aria-hidden="true"
          />
          {shouldPlay
            ? "Playing · hover to pause"
            : isAtEnd
            ? "Demo complete · see the full version"
            : reduced
            ? "Interactive · use the scrubber"
            : "Interactive · press play"}
        </span>
        <span style={{ color: "var(--border-medium)" }} aria-hidden="true">
          ·
        </span>
        <Link
          href="/demo"
          className="inline-flex items-center gap-1 font-semibold rounded-md px-1.5 py-0.5 transition-all hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-light)]"
          style={{
            color: "var(--color-dark)",
            fontFamily: "var(--font-heading)",
            // Pulse only when playback has truly stopped at the end —
            // not during the final tick when isPlaying is still true.
            background:
              isAtEnd && !isPlaying && !reduced
                ? "var(--accent-glow)"
                : undefined,
            animation:
              isAtEnd && !isPlaying && !reduced
                ? "hero-cta-pulse 2.4s ease-in-out infinite"
                : undefined,
          }}
        >
          Open the full demo
          <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Floating channel pills — desktop only. Recolored to charcoal /
          blue / green / neutral purple. No gold anywhere. */}
      {[
        { label: "Meta Ads", icon: Megaphone, pos: { top: "-22px", right: "32px" }, bg: "rgba(106,155,204,0.08)", border: "rgba(106,155,204,0.25)", color: "#5a8bb8", anim: "hero-float-a", dur: "4s", ad: "0s", td: "650ms" },
        { label: "Landing Pages", icon: FileText, pos: { top: "-28px", left: "150px" }, bg: "rgba(20,20,19,0.05)", border: "rgba(20,20,19,0.18)", color: "var(--color-dark)", anim: "hero-float-b", dur: "3.5s", ad: "1s", td: "780ms" },
        { label: "Move-ins", icon: Target, pos: { bottom: "-20px", right: "110px" }, bg: "rgba(120,140,93,0.08)", border: "rgba(120,140,93,0.25)", color: "#6a7d50", anim: "hero-float-a", dur: "3.8s", ad: "1.8s", td: "910ms" },
        { label: "storEDGE", icon: Zap, pos: { bottom: "-26px", left: "64px" }, bg: "rgba(140,120,180,0.06)", border: "rgba(140,120,180,0.25)", color: "#8a70b0", anim: "hero-float-b", dur: "4.2s", ad: "0.5s", td: "1040ms" },
      ].map((pill) => {
        const PillIcon = pill.icon;
        return (
          <div
            key={pill.label}
            className="absolute hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border shadow-sm"
            style={{
              ...pill.pos,
              background: pill.bg,
              borderColor: pill.border,
              color: pill.color,
              fontFamily: "var(--font-heading)",
              animation: `${pill.anim} ${pill.dur} ease-in-out infinite`,
              animationDelay: pill.ad,
              transition: "opacity 600ms, transform 600ms",
              transitionDelay: pill.td,
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "scale(1)" : "scale(0.85)",
            }}
          >
            <PillIcon size={12} /> {pill.label}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DEMO PREVIEW STRIP
   Three live mini-modules under the main dashboard hinting at the
   breadth of the /demo page: occupancy curve, live lead feed, and
   campaign intelligence. All driven by the same playback state so the
   whole panel moves in lockstep. Click any tile to open /demo.
   ═══════════════════════════════════════════ */

type DemoPreviewStripProps = {
  activeMonth: number;
  cumulative: (typeof HERO_DEMO_MONTHS)[number][];
  current: (typeof HERO_DEMO_MONTHS)[number];
};

function DemoPreviewStrip({
  activeMonth,
  cumulative,
  current,
}: DemoPreviewStripProps) {
  // Occupancy curve points — starts at HERO_DEMO_STARTING_OCCUPANCY,
  // walks through each completed month. Mapped into a 100×30 SVG box.
  const occPoints = [
    HERO_DEMO_STARTING_OCCUPANCY,
    ...cumulative.map((m) => m.occupancy),
  ];
  const occMin = HERO_DEMO_STARTING_OCCUPANCY - 4;
  const occMax = 95;
  const occRange = occMax - occMin;
  const occW = 100;
  const occH = 30;
  const occCoords = occPoints
    .map((v, i) => {
      const x = (i / (HERO_DEMO_MONTHS.length)) * occW;
      const y = occH - ((v - occMin) / occRange) * occH;
      return [x, y];
    });
  const occLine = occCoords
    .map((c, i) => `${i === 0 ? "M" : "L"} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`)
    .join(" ");
  const lastOccCoord = occCoords[occCoords.length - 1];
  const occFill =
    occLine +
    ` L ${lastOccCoord[0].toFixed(1)} ${occH} L 0 ${occH} Z`;

  // Lead feed window — two most-recent leads cycle as months advance.
  // Modulo wraps so every month surfaces a different pair.
  const leadStart = activeMonth % HERO_DEMO_LEADS.length;
  const visibleLeads = [
    HERO_DEMO_LEADS[leadStart],
    HERO_DEMO_LEADS[(leadStart + 1) % HERO_DEMO_LEADS.length],
  ];

  const tiles = [
    {
      key: "occupancy",
      label: "Occupancy",
      sub: `${HERO_DEMO_STARTING_OCCUPANCY}% → ${current.occupancy}%`,
      visual: (
        <svg
          viewBox={`0 0 ${occW} ${occH}`}
          preserveAspectRatio="none"
          className="w-full h-7"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hero-occ-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-green)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={occFill} fill="url(#hero-occ-fill)" />
          <path
            d={occLine}
            fill="none"
            stroke="var(--color-green)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: "d 600ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          {/* Marker on the latest point */}
          {lastOccCoord && (
            <circle
              cx={lastOccCoord[0]}
              cy={lastOccCoord[1]}
              r="1.6"
              fill="var(--color-green)"
              stroke="var(--color-light)"
              strokeWidth="0.8"
            />
          )}
        </svg>
      ),
    },
    {
      key: "leads",
      label: "Live lead feed",
      sub: `${current.leads} this month`,
      visual: (
        <div className="space-y-1 pt-0.5">
          {visibleLeads.map((lead, i) => {
            const status = HERO_DEMO_LEAD_STATUS[lead.status];
            return (
              <div
                key={`${activeMonth}-${i}-${lead.name}`}
                className="flex items-center gap-1.5 text-[10px]"
                style={{
                  animation: i === 0 ? "hero-value-flash 700ms ease-out" : undefined,
                }}
              >
                <span
                  className="w-1 h-1 rounded-full flex-shrink-0"
                  style={{ background: status.color }}
                  aria-hidden="true"
                />
                <span
                  className="font-medium truncate flex-1"
                  style={{ color: "var(--color-dark)" }}
                >
                  {lead.name}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
                  style={{ color: status.color, letterSpacing: "0.04em" }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: "intel",
      label: "Campaign intelligence",
      sub: `Top: ${current.topAudience}`,
      visual: (
        <div className="pt-0.5">
          <div
            key={`intel-aud-${activeMonth}`}
            className="text-[10px] font-medium truncate"
            style={{
              color: "var(--color-dark)",
              animation: "hero-value-flash 700ms ease-out",
            }}
          >
            {current.topAudience}
          </div>
          <div
            key={`intel-cre-${activeMonth}`}
            className="text-[10px] mt-0.5 truncate"
            style={{
              color: "var(--text-secondary)",
              fontStyle: "normal",
              animation: "hero-value-flash 700ms ease-out",
            }}
          >
            “{current.topCreative}”
          </div>
        </div>
      ),
    },
  ];

  return (
    <div
      className="hidden lg:grid mt-3 grid-cols-3 gap-2"
      role="list"
      aria-label="More dashboard modules in the full demo"
    >
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          href="/demo"
          role="listitem"
          className="group block rounded-xl border bg-[var(--color-light)] p-3 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-dark)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-light)]"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[9px] uppercase tracking-wide font-semibold"
              style={{
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.06em",
              }}
            >
              {tile.label}
            </span>
            <ArrowUpRight
              size={10}
              className="opacity-30 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>
          <div className="min-h-[42px]">{tile.visual}</div>
          <div
            className="text-[10px] mt-1.5 font-medium tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {tile.sub}
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MOBILE LIVE ACTIVITY TICKER
   Visible only on mobile (below sm) so they
   don't miss the live feed hidden in dashboard
   ═══════════════════════════════════════════ */

type PublicActivityEvent = {
  id: string;
  platform: string;
  locale: string | null;
  createdAt: string;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function platformGlyph(p: string): string {
  if (p.startsWith("google")) return "↗";
  if (p.startsWith("tiktok")) return "▸";
  return "●"; // meta / default
}

export function MobileLiveTicker({ isVisible }: { isVisible: boolean }) {
  const [events, setEvents] = useState<PublicActivityEvent[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/public-activity")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d?.events) setEvents(d.events);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Need at least 3 to make a scrolling track feel populated; otherwise hide.
  if (events.length < 3) return null;

  // Double the list for seamless infinite scroll.
  const track = [...events, ...events];

  return (
    <div
      className="sm:hidden overflow-hidden rounded-xl border transition-all duration-700"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-elevated)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transitionDelay: "1200ms",
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)", animation: "hero-live-dot 2s ease-in-out infinite" }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-dark)", fontFamily: "var(--font-primary)" }}>Live</span>
      </div>
      <div className="overflow-hidden relative" style={{ height: "36px" }}>
        <div className="flex items-center gap-8 absolute left-0 whitespace-nowrap" style={{ animation: "hero-ticker-scroll 25s linear infinite" }}>
          {track.map((e, i) => (
            <span key={`${e.id}-${i}`} className="flex items-center gap-2 text-[11px]" style={{ fontFamily: "var(--font-primary)" }}>
              <span style={{ color: "var(--color-green)" }}>{platformGlyph(e.platform)}</span>
              <span style={{ color: "var(--color-dark)", fontWeight: 500 }}>
                {e.locale ? `A facility in ${e.locale}` : "A facility"} published a {e.platform} campaign
              </span>
              <span style={{ color: "var(--text-tertiary)" }}>{formatRelative(e.createdAt)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FEATURE HIGHLIGHT CARDS
   Interactive cards with hover lift + animated icons
   ═══════════════════════════════════════════ */

export function FeatureHighlights({ isVisible }: { isVisible: boolean }) {
  const revealed = useStaggeredReveal(FEATURE_HIGHLIGHTS.length, isVisible, 200, 120);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {FEATURE_HIGHLIGHTS.map((feat, i) => {
        const Icon = feat.icon;
        const isHovered = hoveredIdx === i;
        return (
          <div
            key={feat.title}
            className="relative rounded-2xl border p-5 transition-all duration-500 cursor-default group"
            style={{
              borderColor: isHovered ? "var(--line-hi)" : "var(--border-subtle)",
              background: "var(--bg-alt)",
              opacity: revealed[i] ? 1 : 0,
              transform: revealed[i]
                ? isHovered ? "translateY(-4px)" : "translateY(0)"
                : "translateY(20px) scale(0.95)",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => setHoveredIdx((prev) => (prev === i ? null : i))}
          >
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-all duration-500"
              style={{
                background: isHovered
                  ? "color-mix(in srgb, var(--text) 10%, transparent)"
                  : "color-mix(in srgb, var(--text) 5%, transparent)",
                border: "1px solid var(--border-medium)",
                transform: isHovered ? "scale(1.1) rotate(-3deg)" : "scale(1)",
              }}
            >
              <Icon size={18} style={{ color: "var(--text)" }} />
            </div>

            {/* Stat badge */}
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 transition-all duration-300"
              style={{
                background: "var(--bg-hi)",
                color: "var(--text-dim)",
                fontFamily: "var(--font-heading)",
                transform: isHovered ? "translateX(2px)" : "translateX(0)",
              }}
            >
              {feat.stat}
            </div>

            {/* Title */}
            <h3
              className="text-sm font-semibold mb-1"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-dark)" }}
            >
              {feat.title}
            </h3>

            {/* Description */}
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)", maxWidth: "none" }}>
              {feat.desc}
            </p>

            {/* Arrow — always visible on touch devices, hover-only on pointer */}
            <div
              className="absolute top-4 right-4 transition-all duration-300"
              style={{
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translate(0, 0)" : "translate(-4px, 4px)",
              }}
            >
              <ArrowUpRight size={14} style={{ color: "var(--text)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   BEFORE / AFTER COMPARISON
   Animated check reveals
   ═══════════════════════════════════════════ */

export function BeforeAfterComparison({ isVisible }: { isVisible: boolean }) {
  const revealed = useStaggeredReveal(BEFORE_AFTER.length, isVisible, 400, 150);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {BEFORE_AFTER.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border p-4 transition-all duration-600"
          style={{
            borderColor: "var(--border-subtle)",
            background: "var(--bg-elevated)",
            opacity: revealed[i] ? 1 : 0,
            transform: revealed[i] ? "translateX(0)" : i % 2 === 0 ? "translateX(-16px)" : "translateX(16px)",
          }}
        >
          <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
            {/* X icon for before */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(176,74,58,0.1)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" stroke="var(--color-red)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            {/* Arrow down */}
            <div className="w-px h-3" style={{ background: "var(--border-medium)" }} />
            {/* Check icon for after */}
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(120,140,93,0.12)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 5.5L4 7.5L8 3"
                  stroke="var(--color-green)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: 12,
                    strokeDashoffset: revealed[i] ? 0 : 12,
                    transition: "stroke-dashoffset 0.6s ease-out",
                    transitionDelay: `${600 + i * 150}ms`,
                  }}
                />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] line-through" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}>
              {item.before}
            </div>
            <div className="text-[12px] font-semibold mt-1" style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}>
              {item.after}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CAPABILITIES INTERACTIVE GRID
   ═══════════════════════════════════════════ */

export function CapabilitiesGrid({ isVisible }: { isVisible: boolean }) {
  const revealed = useStaggeredReveal(CAPABILITIES.length, isVisible, 200, 80);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // On touch devices (no hover) reveal every description by default — the
  // hover-to-expand affordance is unreachable on a phone, so mobile users
  // would otherwise never see this copy.
  const [canHover, setCanHover] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    const apply = () => setCanHover(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {CAPABILITIES.map((cap, i) => {
        const Icon = cap.icon;
        const isActive = activeIdx === i;
        const showDesc = isActive || !canHover;
        return (
          <div
            key={cap.label}
            className="relative rounded-xl border p-3 sm:p-4 transition-all duration-400 cursor-default"
            style={{
              borderColor: isActive ? "var(--line-hi)" : "var(--border-subtle)",
              background: isActive ? "var(--bg-elevated)" : "transparent",
              opacity: revealed[i] ? 1 : 0,
              transform: revealed[i]
                ? isActive ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)"
                : "translateY(12px) scale(0.95)",
              boxShadow: isActive ? "0 8px 24px rgba(0,0,0,0.06)" : "none",
            }}
            onMouseEnter={() => setActiveIdx(i)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-300"
              style={{
                background: `color-mix(in srgb, ${cap.color} 10%, transparent)`,
                transform: isActive ? "scale(1.15)" : "scale(1)",
              }}
            >
              <Icon size={15} style={{ color: cap.color, transition: "color 0.3s" }} />
            </div>
            <div className="text-[11px] sm:text-xs font-semibold" style={{ color: "var(--color-dark)", fontFamily: "var(--font-heading)" }}>
              {cap.label}
            </div>
            <div
              className="text-[11px] sm:text-[10px] mt-0.5 leading-snug transition-all duration-300 overflow-hidden"
              style={{
                color: "var(--text-tertiary)",
                // Desktop hover: 40px (original). Touch: 160px so multi-line
                // descriptions aren't clipped now that they're always shown.
                maxHeight: showDesc ? (canHover ? "40px" : "160px") : "0px",
                opacity: showDesc ? 1 : 0,
              }}
            >
              {cap.desc}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   "BECAUSE" — SPLIT-FLAP FULL SENTENCES
   ═══════════════════════════════════════════ */

const BECAUSE_MESSAGES = [
  "A SIGN ON A CHAINLINK FENCE IS NOT AN ACQUISITION STRATEGY",
  "WE'RE ON PAGE 2 OF GOOGLE IS NOT A MARKETING PLAN",
  "YOUR COMPETITOR FILLED 40 UNITS LAST MONTH AND YOU HAVE NO IDEA HOW",
  "YOU ASKED YOUR AGENCY WHICH ADS DROVE MOVE-INS AND THEY CHANGED THE SUBJECT",
  "YOU'RE PAYING $200 PER MOVE-IN AND CALLING IT BRAND AWARENESS",
  "YOUR AGENCY SENDS YOU A REPORT EVERY MONTH AND YOU DON'T UNDERSTAND A SINGLE LINE ON IT",
  "DRONE FOOTAGE OF YOUR ROOF HAS 200 VIEWS AND ZERO RESERVATIONS",
  "YOU JUST PAID GOOGLE $6 SO SOMEONE COULD CLICK YOUR AD TO PAY THEIR BILL",
  "EXTRA SPACE IS RUNNING 14 CAMPAIGNS IN YOUR ZIP CODE AND YOU'RE RUNNING VIBES",
  "YOUR BEST AD GOT 3 LIKES AND TWO WERE EMPLOYEES",
  "YOU'VE BEEN ABOUT TO LAUNCH A CAMPAIGN SINCE Q2 OF LAST YEAR",
  "YOUR GOOGLE BUSINESS LISTING IS DOING MORE WORK THAN YOUR ENTIRE MARKETING BUDGET",
  "THE MARKETING MEETING WAS YOU AND YOUR MANAGER STARING AT GOOGLE REVIEWS",
];

/** Count how many rows a message needs at a given column width (word-wrap) */
function rowsNeeded(msg: string, cols: number): number {
  const words = msg.split(" ");
  let lines = 0;
  let current = 0;
  for (const word of words) {
    if (current === 0) {
      current = word.length;
      lines = 1;
    } else if (current + 1 + word.length <= cols) {
      current += 1 + word.length;
    } else {
      lines++;
      current = word.length;
    }
  }
  return lines;
}

/** Calculate minimum rows needed so ALL messages fit at a given column width */
function minRowsForMessages(messages: string[], cols: number): number {
  let max = 1;
  for (const msg of messages) {
    const needed = rowsNeeded(msg, cols);
    if (needed > max) max = needed;
  }
  return max;
}

function ResponsiveSplitFlap({ messages, holdTime }: { messages: string[]; holdTime: number }) {
  const [layout, setLayout] = useState({ cols: 26, rows: 4 });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      let cols: number;
      if (w < 400) {
        cols = 14;
      } else if (w < 480) {
        cols = 16;
      } else if (w < 640) {
        cols = 20;
      } else if (w < 768) {
        cols = 24;
      } else if (w < 1024) {
        cols = 30;
      } else {
        cols = 36;
      }
      const rows = minRowsForMessages(messages, cols);
      setLayout({ cols, rows });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [messages]);

  return <SplitFlapComponent messages={messages} cols={layout.cols} rows={layout.rows} holdTime={holdTime} />;
}

export function BecauseLetterboard() {
  return (
    <section
      aria-label="Because (split-flap pain refrain)"
      className="relative border-t overflow-hidden"
      style={{ borderColor: "var(--border-subtle)", background: "var(--color-dark)" }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 text-center">
        {/* "storageads.com — because" label */}
        <div className="mb-4 sm:mb-6">
          <span
            className="text-sm sm:text-base font-semibold tracking-wide"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-gold)", letterSpacing: "0.05em" }}
          >
            storageads.com
          </span>
          <span
            className="mx-2 sm:mx-3 text-xs sm:text-sm uppercase tracking-[0.2em] font-medium"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-light)" }}
          >
            because...
          </span>
        </div>

        {/* Split-flap display — responsive cols/rows */}
        <ResponsiveSplitFlap messages={BECAUSE_MESSAGES} holdTime={4500} />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   ROI TEASER — quick animated value prop
   ═══════════════════════════════════════════ */

export function ROITeaser({ isVisible }: { isVisible: boolean }) {
  const adSpend = useCountUp(2400, 2000, 0, isVisible);
  const moveIns = useCountUp(34, 2200, 0, isVisible);
  const costPerMI = useCountUp(41, 2000, 0, isVisible);
  const revenue = useCountUp(27200, 2400, 0, isVisible);

  const stats = [
    { label: "Ad Spend", value: `$${adSpend.toLocaleString()}`, sub: "per month", color: "var(--color-blue)" },
    { label: "Move-ins", value: String(moveIns), sub: "this quarter", color: "var(--color-green)" },
    { label: "Cost / Move-in", value: `$${costPerMI}`, sub: "average", color: "var(--accent)" },
    { label: "Revenue", value: `$${revenue.toLocaleString()}`, sub: "90 days", color: "var(--color-green)" },
  ];

  return (
    <div
      className="relative overflow-hidden transition-all duration-700"
      style={{
        border: "2px solid var(--border-medium)",
        background: "var(--bg-elevated)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        transitionDelay: "300ms",
      }}
    >
      {/* Header bar. Uses --bg-hi (palette's "lifted cell" tone) so the
          h1–h6 forced `color: var(--text-accent) !important` contrasts
          against it on every palette. Previously used --color-dark which
          aliases to --text — making text ≈ bg on dark palettes. */}
      <div
        className="flex items-center gap-3 px-6 sm:px-8 py-4"
        style={{ background: "var(--bg-hi)", borderBottom: "2px solid var(--border-medium)" }}
      >
        <DollarSign size={18} style={{ color: "var(--text)", opacity: 0.5 }} />
        <h3
          className="text-xs sm:text-sm font-bold tracking-wider uppercase"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-inverse)", letterSpacing: "0.08em" }}
        >
          90-Day Performance Snapshot
        </h3>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {stats.map((item, i) => (
          <div
            key={item.label}
            className="relative transition-all duration-500"
            style={{
              padding: "1.25rem 1.5rem",
              borderRight: i < 3 ? "1px solid var(--border-medium)" : "none",
              borderBottom: "1px solid var(--border-medium)",
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? "translateY(0)" : "translateY(12px)",
              transitionDelay: `${500 + i * 100}ms`,
            }}
          >
            <div
              className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase mb-2"
              style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
            >
              {item.label}
            </div>
            <div
              className="text-2xl sm:text-3xl font-bold leading-none"
              style={{ fontFamily: "var(--serif)", letterSpacing: "-0.03em", color: item.color }}
            >
              {item.value}
            </div>
            <div
              className="text-[10px] sm:text-[11px] mt-1.5 font-medium"
              style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}
            >
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ROAS bar */}
      <div className="flex items-center gap-4 px-6 sm:px-8 py-4" style={{ background: "var(--bg-surface)" }}>
        <span
          className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase flex-shrink-0"
          style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)", letterSpacing: "0.06em" }}
        >
          Return on ad spend
        </span>
        <div className="flex-1 h-4 overflow-hidden" style={{ background: "var(--border-medium)" }}>
          <div
            className="h-full transition-all"
            style={{
              background: "linear-gradient(90deg, var(--accent), var(--color-green))",
              width: isVisible ? "88%" : "0%",
              transitionDuration: "1.8s",
              transitionDelay: "800ms",
              transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </div>
        <span
          className="text-lg sm:text-xl font-bold flex-shrink-0"
          style={{ color: "var(--color-green)", fontFamily: "var(--serif)", letterSpacing: "-0.03em" }}
        >
          35x
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HERO STATUS STRIP — ultra-thin ribbon between nav and hero content.
   Left: live pulse + "MARKETING INFRASTRUCTURE · BUILT FOR SELF-STORAGE".
   Right: revision date · wall clock.
   Ported from the handoff hero reference §205.
   This is the natural home for the clock — NOT crammed into the nav.
   ═══════════════════════════════════════════ */

function HeroStatusStrip() {
  const clock = useClock();
  return (
    // Sit directly under the fixed nav. Previous version used a
    // position:relative + top + negative-margin trick which offsets the box
    // visually but not in layout — that caused the H1 eyebrow below to render
    // ON TOP of the strip's bottom border on iPhone 17 Pro Max. Using plain
    // marginTop keeps layout and visual positions aligned, and adding the
    // safe-area inset ensures the strip clears the dynamic island / notch.
    <div
      style={{
        marginTop:
          "calc(var(--nav-height) + env(safe-area-inset-top, 0px))",
        borderBottom: `1px solid ${MONO.line}`,
        borderTop: `1px solid ${MONO.line}`,
      }}
    >
      <div
        className="max-w-[1320px] mx-auto px-5 sm:px-8 lg:px-14"
        style={{
          padding: "8px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <Label style={{ color: MONO.accent, fontWeight: 500 }}>
          <Dot live color={MONO.accent} style={{ marginRight: 8, verticalAlign: "middle" }} />
          {/* On mobile the right-side REV/clock/SOC2 line eats half the row,
              so we drop the second clause until sm:+ to keep the row clean. */}
          <span className="sm:hidden">MARKETING INFRASTRUCTURE</span>
          <span className="hidden sm:inline">
            MARKETING INFRASTRUCTURE · BUILT FOR SELF-STORAGE
          </span>
        </Label>
        {/* Center benchmark tile — desktop only. Surfaces the REIT-vs-independent
            occupancy gap (the central thesis) as a live read on the strip. The
            ¹ ² ref links into the SourcesNote block at the page bottom. */}
        <Label
          className="hidden lg:inline-flex"
          style={{ color: MONO.textDim, alignItems: "center", gap: 6 }}
        >
          <span style={{ color: MONO.accent }}>OCC GAP</span>
          <span style={{ color: MONO.text, fontWeight: 600 }}>5 PTS</span>
          <span>· REIT 92.6 / IND 87.2</span>
          <Cite n={[1, 2]} />
        </Label>
        <Label style={{ color: MONO.textDim }}>
          {/* Mobile: REV date only. Tablet+: full timestamp + compliance tag. */}
          <span className="sm:hidden">REV {clock.ymd}</span>
          <span className="hidden sm:inline">
            REV {clock.ymd} · {clock.hms} {clock.tz} · OPERATOR BUILT
          </span>
        </Label>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LIVE STATS STRIP — NULL//TRACE theme
   Real aggregates from /api/public-stats. Each stat is a Panel with
   eyebrow + index, big serif Display number, categorical hue, and an
   italic serif editorial caption below. LIVE tag + square Dot pulses
   because this is real live data and we want operators to see that.
   Cards auto-hide when their stat is 0 or null.
   ═══════════════════════════════════════════ */

type StatCard = {
  key: string;
  rawValue: number;
  format: "count" | "money";
  label: string;
  caption: string;
  hue: string;
  delta?: string;
  context?: string;
  // Optional suffix appended after the animated number, e.g. " pts" for the
  // REIT-vs-independent occupancy gap card. Keeps the existing animation
  // path (integer rawValue, Math.round per tick) intact.
  suffix?: string;
  // Optional source ids appended to the caption as a superscript footnote
  // ref. Wires the inline stat to the SourcesNote block at page bottom.
  cites?: number[];
};

function formatCount(n: number): string {
  if (n >= 1_000_000_000)
    return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1000)
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

function StatCell({
  card,
  index,
  isVisible,
}: {
  card: StatCard;
  index: number;
  isVisible: boolean;
}) {
  const animated = useRevealCountUp(card.rawValue, isVisible, 1800);
  const flashing = useFlashOnChange(card.rawValue);
  const display =
    (card.format === "money" ? `$${formatCount(animated)}` : formatCount(animated)) +
    (card.suffix ?? "");

  return (
    <div
      className="stat-cell"
      style={{
        background: MONO.bgAlt,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
        animation: flashing ? "mono-flash 600ms ease-out" : undefined,
      }}
    >
      <div
        style={{
          display: "block",
          minWidth: 0,
        }}
      >
        {card.context && (
          <div
            style={{
              display: "block",
              marginBottom: 4,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <Label
              style={{
                color: MONO.textFaint,
                fontSize: 9,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                maxWidth: "100%",
              }}
            >
              {card.context}
            </Label>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <Label style={{ color: MONO.textFaint, fontSize: 9, flex: "0 0 auto" }}>
            #{String(index + 1).padStart(2, "0")}
          </Label>
          <Label
            style={{
              color: MONO.textDim,
              minWidth: 0,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              flex: "1 1 auto",
            }}
          >
            {card.label}
          </Label>
        </div>
      </div>
      <Display
        size={64}
        style={{
          color: card.hue,
          fontSize: "clamp(3rem, 6.5vw, 4.5rem)",
          lineHeight: 0.95,
        }}
      >
        {display}
      </Display>
      <div style={{ height: 1, background: MONO.lineDim, marginTop: 4 }} />
      {card.delta && (
        <Label
          style={{
            color: MONO.hueC,
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: "0.08em",
          }}
        >
          {card.delta}
        </Label>
      )}
      <span
        style={{
          fontFamily: MONO.serif,
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.5,
          color: MONO.textDim,
          maxWidth: "40ch",
        }}
      >
        {card.caption}
        {card.cites && <Cite n={card.cites} />}
      </span>
    </div>
  );
}

export function LiveStatsStrip({ isVisible }: { isVisible: boolean }) {
  const clock = useClock();

  // Industry + forecast cards only. The alpha portfolio numbers don't yet
  // reflect what's actually being built behind the scenes, so showing the
  // raw platform counts (60 ads / 7 audits) was misleading. Instead the
  // strip tells the "$50B market → here's what we're building toward"
  // story via two clearly-labeled data types:
  //   INDUSTRY (public, sourced) → hueB
  //   FORECAST (year-one targets) → hueC
  const cards: StatCard[] = [
    // ─── INDUSTRY · 2025 ─────────────────────────────────────────────
    // Sourced public figures, attributed inline. Full source list lives in
    // the <SourcesNote /> block before the footer so operators can verify.
    {
      key: "asset-class",
      rawValue: 432_000_000_000,
      format: "money",
      label: "U.S. storage asset class",
      caption:
        "Total value of U.S. self-storage real estate. NOI growth has beat inflation by 190 basis points a year since 2008.",
      hue: MONO.hueB,
      context: "INDUSTRY · 2025",
      cites: [4, 9],
    },
    {
      key: "occupancy-gap",
      rawValue: 5,
      format: "count",
      suffix: " pts",
      label: "Occupancy gap",
      caption:
        "REITs run 92.6% same-store occupancy. Independents average 87.2%. The space between is the lever, and it closes with marketing, not location.",
      hue: MONO.hueB,
      context: "INDUSTRY · 2025",
      cites: [1, 2],
    },
    {
      key: "revenue-in-the-building",
      rawValue: 72_000,
      format: "money",
      label: "Revenue in the building",
      caption:
        "What a 500-unit facility leaves in the building at the typical occupancy gap, $120 a unit. Roughly $1.3M in asset value at a 5.5% cap.",
      hue: MONO.hueB,
      context: "INDUSTRY · BENCHMARK",
      cites: [3],
    },

    // ─── FORECAST · YEAR 1 ───────────────────────────────────────────
    // Placeholder targets — replace with Blake's actual year-one goals.
    {
      key: "y1-spend",
      rawValue: 10_000_000,
      format: "money",
      label: "Ad spend goal",
      caption:
        "ad spend StorageAds will put to work by EOY. Every dollar buying move-ins, not sitting in a vendor's queue.",
      hue: MONO.hueC,
      context: "FORECAST · YEAR 1",
    },
    {
      key: "y1-facilities",
      rawValue: 250,
      format: "count",
      label: "Facilities goal",
      caption:
        "operators live on the system by EOY. Partner operators carry the growth.",
      hue: MONO.hueC,
      context: "FORECAST · YEAR 1",
    },
    {
      key: "y1-moveins",
      rawValue: 10_000,
      format: "count",
      label: "Move-ins generated",
      caption:
        "signed leases generated by StorageAds campaigns. Operators pay for outcomes, not vendor reports.",
      hue: MONO.hueC,
      context: "FORECAST · YEAR 1",
    },
  ];

  // 6 cards land at 3-col × 2-row on desktop, 2-col stack on mobile.
  // Hairline seams via 1px gap on a line-colored background.
  const gridClass = "grid grid-cols-2 md:grid-cols-3";

  return (
    <div
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transition: "all 700ms",
        transitionDelay: "1600ms",
        border: `1px solid ${MONO.line}`,
        background: MONO.line, // hairline seam color showing through gaps
      }}
    >
      {/* Section header — § NN NUMBERS · LIVE ← kicker */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: `1px solid ${MONO.line}`,
          gap: 12,
          background: MONO.bgAlt,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}>
          <Label style={{ color: MONO.accent, fontWeight: 500, whiteSpace: "nowrap" }}>§ 00 · NUMBERS</Label>
          <span className="hidden sm:inline" style={{ minWidth: 0, overflow: "hidden" }}>
            <Label
              style={{ color: MONO.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", maxWidth: "100%" }}
            >
              n = {cards.length} · industry · forecast
            </Label>
          </span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <Dot live color={MONO.accent} />
          <Label style={{ color: MONO.accent, fontWeight: 500, whiteSpace: "nowrap" }}>LIVE · {clock.hms}</Label>
        </div>
      </div>

      {/* Stat cells — hairline seams via 1px gap on line-colored background */}
      <div className={gridClass} style={{ gap: 1, background: MONO.line }}>
        {cards.map((c, i) => (
          <StatCell key={c.key} card={c} index={i} isVisible={isVisible} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STATS BAR — page-level section, extracted from Hero per IA spec.
   Renders the four hero-stat counters (move-ins, cost per MI, LP CVR, ROAS).
   Consumed at slot 6 (Proof) in page.tsx.
   ═══════════════════════════════════════════ */

export function StatsBar() {
  const { ref, isVisible } = useInView(0.1);
  return (
    <section ref={ref} aria-label="Key performance stats" className="relative border-t" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-14 py-10 sm:py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {STATS.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} active={isVisible} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   HERO — Main Export (Angelo's original 2-column layout).
   H1 + typewriter + subhead + pipeline + 2 CTAs + 3 trust badges on the
   left; DashboardMockup on the right. Stats/ROI/Features/etc. that used
   to render below this in Angelo's commit are now lifted into named
   exports and consumed from page.tsx at slot 3/4/5/6 per the IA spec.
   ═══════════════════════════════════════════ */

export default function Hero() {
  const { ref, isVisible } = useInView(0.02);
  const typedText = useTypewriter(TYPEWRITER_WORDS, isVisible);
  // Subtle pointer parallax on the dashboard proof (desktop only — touch
  // devices never fire mousemove, and the hook no-ops under reduced motion).
  const { ref: dashTiltRef, tilt: dashTiltValue } = useMouseTilt(isVisible);

  return (
    <section id="hero" aria-label="StorageAds: predictable move-ins for independent storage. Ad spend in. Move-ins out." className="relative overflow-hidden" style={{ background: "var(--color-light)" }}>
      <HeroStyles />
      <DotGrid />
      <HeroStatusStrip />

      {/* ── Hero content ── */}
      {/* Mobile rhythm tuned for FB IAB on iPhone 17 Pro Max: viewport is
          ~820px raw, but the FB chrome chews ~170px so the effective
          above-the-fold is ~650px. Every reclaimed pixel pushes the trust
          line + dashboard proof higher. pt-5 (20px) is a deliberate, tight
          breathing band — the strip's bottom border already creates a clear
          edge so we don't need extra cushion. sm:+ keeps the editorial
          generosity on larger surfaces. */}
      <div ref={ref} className="relative w-full pt-5 sm:pt-12 lg:pt-20 pb-6 sm:pb-10 lg:pb-14 px-5 sm:px-8 lg:px-14">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-6 sm:gap-8 lg:gap-14 items-center max-w-[1280px] mx-auto">

          {/* ── Left column ── */}
          <div className="text-center lg:text-left max-w-xl mx-auto lg:mx-0">
            {/* Eyebrow — names the audience + outcome promise so the H1
                stays the punchy equation. SaaS hierarchy: who-it's-for first,
                hook second, explanation third. */}
            <div
              className={`flex justify-center lg:justify-start mb-3 sm:mb-4 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              <span
                className="inline-flex items-center gap-2 px-2.5 py-1.5"
                style={{
                  border: `1px solid ${MONO.line}`,
                  background: "var(--bg-alt)",
                }}
              >
                <Dot live color={MONO.accent} />
                <span
                  className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  REIT-grade marketing for independents
                </span>
              </span>
            </div>

            {/* Headline — the equation. The eyebrow above does the promise
                framing so this can stay the punchy hook. */}
            <h1
              className={`font-semibold transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{
                fontSize: "clamp(2rem, 6vw, 3.5rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                fontFamily: "var(--serif)",
                textWrap: "balance",
                transitionDelay: "100ms",
              }}
            >
              {/* Non-breaking spaces keep each side of the equation intact so
                  on narrow viewports the H1 breaks cleanly between the two
                  halves (e.g. iPhone 17 Pro Max ~440px / Safari) rather than
                  stranding the "=" or "out." on a line of their own. */}
              Ad&nbsp;spend&nbsp;in.{" "}
              <span className="whitespace-nowrap relative inline-block">
                Move-ins&nbsp;out.
                <svg
                  className={`hero-underline ${isVisible ? "is-in" : ""}`}
                  viewBox="0 0 300 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path pathLength={1} d="M3 8.5 C 70 3.5, 130 3, 185 6 S 255 9.5, 297 4.5" />
                </svg>
              </span>
            </h1>

            {/* Typewriter — reserves 2 lines on mobile because the longest
                phrases ("Create demand. Capture demand. Recapture demand.",
                "Stop leaking revenue at every step of the funnel.") wrap on
                iPhone-class widths. Previously h-7 clipped to 28px and the
                wrapped 2nd line overflowed onto the body paragraph below.
                sm:+ stays single-line where the phrases fit. */}
            <div
              className={`mt-2 sm:mt-3 min-h-7 sm:min-h-8 leading-snug transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{ transitionDelay: "200ms" }}
            >
              <span className="text-lg sm:text-xl font-semibold" style={{ color: "var(--color-dark)", fontFamily: "var(--serif)", letterSpacing: "-0.03em" }}>{typedText}</span>
              {/* Cursor: was var(--color-gold); CLAUDE.md bans sienna gold
                  everywhere. Charcoal matches the editorial monochrome palette. */}
              <span className="inline-block w-0.5 h-5 ml-0.5 align-middle rounded-full" style={{ background: "var(--color-dark)", animation: "hero-pulse 1s ease-in-out infinite" }} />
            </div>

            {/* Subheadline — operator voice. Productized REIT system, full
                funnel, demand-engine framing. No em-dashes (Blake rule).

                Unified hero: the full paragraph now renders on every
                breakpoint (was previously a 20-word mobile-only variant +
                hidden sm:block full version). Per the desktop-parity
                decision, mobile gets the same REIT framing + capability
                list as desktop. Slightly smaller type (text-[15px]) and a
                tighter top margin on mobile keep it readable without
                eating the fold. */}
            <p
              className={`mt-2 sm:mt-3 text-[15px] sm:text-base transition-all duration-1000 mx-auto lg:mx-0 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                transitionDelay: "300ms",
                maxWidth: "480px",
                textWrap: "pretty",
              }}
            >
              Public Storage and Extra Space run this exact machine to hit 92.6% occupancy<Cite n={1} />. StorageAds is that same system, built for independent operators. It maps your competitors, runs Meta and Google, builds a page for every ad, chases every reservation to a signed lease, and finds where you&apos;re leaking revenue. Run it yourself or hand the whole thing to us.
            </p>

            {/* CTAs */}
            <div className={`mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center lg:items-start gap-2 sm:gap-3 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: "400ms" }}>
              <MagneticButton
                href="#cta"
                className="btn-primary group hero-cta"
                strength={0.35}
                style={{ transition: "transform 0.35s var(--ease-dramatic), background var(--duration-fast) ease" }}
              >
                Get your free facility audit
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" />
              </MagneticButton>
              <a
                href={CALCOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary group"
              >
                Book a 30-minute walkthrough
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5 shrink-0" />
              </a>
            </div>

            {/* Reassurance + trust strip */}
            <div className={`mt-3 sm:mt-4 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "450ms" }}>
              <p
                className="text-[11px] sm:text-xs font-medium mb-2.5"
                style={{
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.02em",
                }}
              >
                No contracts.{" "}
                <span style={{ color: "var(--color-dark)", fontWeight: 700 }}>Cancel anytime.</span>
              </p>
              <div className="flex items-center gap-x-3 gap-y-1.5 sm:gap-4 justify-center lg:justify-start flex-wrap">
                {([
                  { icon: Star, text: "Built for storage, not adapted to it" },
                  { icon: Layers, text: "storEDGE rental built in" },
                  { icon: TrendingUp, text: "Ads live in your first week" },
                ] as Array<{ icon: typeof Star; text: string; cites?: number[] }>).map((badge, i) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <div
                      key={badge.text}
                      className={`hero-trust-chip flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1.5 ${isVisible ? "is-in" : ""}`}
                      style={{
                        color: "var(--text-tertiary)",
                        fontFamily: "var(--font-heading)",
                        border: `1px solid ${MONO.line}`,
                        background: "var(--bg-alt)",
                        // Staggered reveal delay consumed by the .is-in fade
                        // keyframe; kept off `transform` so :hover lift is free.
                        ["--d" as string]: `${450 + i * 90}ms`,
                      }}
                    >
                      {/* Icon: was var(--color-gold) at 0.7 opacity; CLAUDE.md
                          bans gold accents. Matching the text color keeps the
                          row reading as a quiet editorial bullet. */}
                      <BadgeIcon size={12} style={{ color: "var(--text-secondary)", opacity: 0.9 }} />
                      {badge.text}
                      {badge.cites && <Cite n={badge.cites} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Right column — Dashboard ──
              Shown on every breakpoint now (was hidden lg:block). On mobile
              it stacks under the copy/CTAs in the single-column grid. The
              full interactive panel renders — sidebar, play/scrub controls,
              and the full campaign table — per the desktop-parity decision.
              Only the decorative floating labels (Meta Ads / storEDGE …) and
              the 3 side preview tiles stay desktop-only (see hidden lg:* in
              DashboardMockup / DemoPreviewStrip): they're absolutely
              positioned and would spill into the page margins on a phone.
              This block also replaces the old condensed static mobile proof
              card, which is now redundant. */}
          <div
            ref={dashTiltRef}
            className="w-full min-w-0"
            style={{
              transform: `perspective(1600px) rotateX(${dashTiltValue.x}deg) rotateY(${dashTiltValue.y}deg)`,
              transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)",
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            <DashboardMockup isVisible={isVisible} />
          </div>
        </div>
      </div>

      {/* Scroll indicator — hidden on mobile. iPhone users in FB IAB already
          have a "swipe up to scroll" affordance built into the OS chrome,
          and the extra row eats ~40px of above-the-fold real estate without
          delivering signal that's not already implied. Desktop keeps it. */}
      <div className={`hidden sm:flex justify-center pb-3 sm:pb-4 transition-all duration-700 ${isVisible ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: "1500ms" }}>
        <a href="#how-it-works" className="flex flex-col items-center gap-1 group" aria-label="Scroll to learn more">
          <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-heading)" }}>Learn more</span>
          <ChevronDown size={16} style={{ color: "var(--text-tertiary)", animation: "hero-scroll-bounce 2s ease-in-out infinite" }} />
        </a>
      </div>
    </section>
  );
}
