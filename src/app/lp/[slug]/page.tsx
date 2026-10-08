"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTrackingParams } from "@/hooks/use-tracking-params";
import {
  Phone,
  MapPin,
  Check,
  Star,
  Shield,
  Clock,
  Truck,
  ArrowRight,
  Building2,
  ChevronDown,
  X,
  Loader2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════ */
/*  TYPES                                                  */
/* ═══════════════════════════════════════════════════════ */

interface SectionConfig {
  [key: string]: unknown;
}

interface Section {
  id: string;
  section_type: string;
  sort_order: number;
  config: SectionConfig;
}

interface LandingPage {
  id: string;
  facility_id: string;
  slug: string;
  title: string;
  status: string;
  meta_title?: string;
  meta_description?: string;
  og_image_url?: string;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
    /** Switched on by the campaign that owns the page (src/lib/campaign-publish). */
    features?: { tour?: boolean; reserve?: string };
  };
  storedge_widget_url?: string;
  sections: Section[];
}

/* ═══════════════════════════════════════════════════════ */
/*  HELPERS                                                */
/* ═══════════════════════════════════════════════════════ */

function iconForName(name: string | undefined, size = 16) {
  switch (name) {
    case "star":
      return <Star size={size} />;
    case "shield":
      return <Shield size={size} />;
    case "clock":
      return <Clock size={size} />;
    case "check":
      return <Check size={size} />;
    case "truck":
      return <Truck size={size} />;
    case "building":
      return <Building2 size={size} />;
    default:
      return <Check size={size} />;
  }
}

const ICON_LABELS: Record<string, string> = {
  star: "Top Rated",
  shield: "Secure",
  clock: "24/7 Access",
  check: "Verified",
  truck: "Drive-Up",
  building: "On-Site Staff",
};

function FadeIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  HERO                                                   */
/* ═══════════════════════════════════════════════════════ */

function HeroSplash({
  backgroundImage,
  facilityName,
  headline,
  subheadline,
  reserveUrl,
  reserveLabel,
  phone,
}: {
  backgroundImage: string;
  facilityName?: string;
  headline: string;
  subheadline?: string;
  reserveUrl: string;
  reserveLabel: string;
  phone: string | null;
}) {
  const isExternal = reserveUrl.startsWith("http");
  const telUrl = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "";
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-[#E0E0E5]" aria-hidden />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: backgroundImage
            ? "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.5))"
            : "none",
        }}
        aria-hidden
      />

      <div className="relative z-10 h-full flex flex-col px-5 md:px-14 py-6 md:py-12">
        <header>
          <span
            className={`text-[10px] md:text-[11px] tracking-[0.22em] uppercase ${
              backgroundImage ? "text-white/80" : "text-[#6a6560]"
            }`}
          >
            {facilityName || "Self Storage"}
          </span>
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-3xl">
          <h1
            className={`text-[28px] leading-[1.1] sm:text-4xl md:text-6xl lg:text-7xl font-semibold md:leading-[1.05] tracking-tight ${
              backgroundImage ? "text-white" : "text-[#141413]"
            }`}
          >
            {headline}
          </h1>
          {subheadline && (
            <p
              className={`mt-3 md:mt-5 text-[15px] md:text-xl max-w-2xl leading-relaxed ${
                backgroundImage ? "text-white/85" : "text-[#6a6560]"
              }`}
            >
              {subheadline}
            </p>
          )}

          <div className="mt-7 md:mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4">
            {/* Mobile: call if phone available and no external URL */}
            {!isExternal && telUrl && (
              <a
                href={telUrl}
                className={`sm:hidden inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-semibold transition-colors ${
                  backgroundImage
                    ? "bg-white text-[#141413] hover:bg-white/90"
                    : "bg-[#141413] text-[#E0E0E5] hover:bg-[#141413]/90"
                }`}
              >
                <Phone size={16} /> Call to Reserve
              </a>
            )}
            {/* Desktop (or mobile with external URL / no phone) */}
            <a
              href={isExternal ? reserveUrl : telUrl || "#cta"}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              className={`${!isExternal && telUrl ? "hidden sm:inline-flex" : "inline-flex"} items-center justify-center gap-2 px-7 py-3.5 md:px-8 md:py-4 rounded-full text-[15px] md:text-base font-semibold transition-colors ${
                backgroundImage
                  ? "bg-white text-[#141413] hover:bg-white/90"
                  : "bg-[#141413] text-[#E0E0E5] hover:bg-[#141413]/90"
              }`}
            >
              {reserveLabel} <ArrowRight size={16} />
            </a>
          </div>
        </div>

        <div className="mt-auto flex justify-center">
          <ChevronDown
            size={18}
            className={`animate-bounce ${
              backgroundImage ? "text-white/50" : "text-[#141413]/30"
            }`}
          />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  CHAPTERS (all light backgrounds)                       */
/* ═══════════════════════════════════════════════════════ */

function TrustBarChapter({
  items,
}: {
  items: { icon?: string; text?: string }[];
}) {
  const rendered = items
    .slice(0, 4)
    .map((item) => ({
      icon: item.icon,
      label: item.text || ICON_LABELS[item.icon || ""] || "",
    }))
    .filter((i) => i.label);
  if (rendered.length === 0) return null;
  return (
    <section className="bg-white border-b border-[#141413]/8 py-6 md:py-10">
      <div className="max-w-5xl mx-auto px-5 md:px-14 grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-x-6 md:gap-x-12 gap-y-3 md:gap-y-4">
        {rendered.map((item, i) => (
          <FadeIn key={i}>
            <span className="inline-flex items-center gap-2 md:gap-2.5 text-[11px] md:text-sm tracking-[0.1em] md:tracking-[0.15em] uppercase text-[#141413]/70">
              <span className="text-[#141413]">
                {iconForName(item.icon, 16)}
              </span>
              {item.label}
            </span>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function FeaturesChapter({
  headline,
  items,
}: {
  headline?: string;
  items: { icon?: string; title?: string; desc?: string }[];
}) {
  const filtered = items.filter((i) => i.title);
  if (filtered.length === 0) return null;
  return (
    <section className="bg-[#E0E0E5] py-14 md:py-28">
      <div className="max-w-5xl mx-auto px-5 md:px-14">
        {headline && (
          <FadeIn>
            <h2 className="text-2xl md:text-5xl font-semibold leading-snug md:leading-tight tracking-tight text-[#141413] mb-10 md:mb-20 max-w-xl">
              {headline}
            </h2>
          </FadeIn>
        )}
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-8 md:gap-y-16">
          {filtered.map((feature, i) => (
            <FadeIn key={i}>
              <div className="flex gap-4 md:gap-5">
                <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#141413]/[0.06] flex items-center justify-center text-[#141413]">
                  {iconForName(feature.icon, 16)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base md:text-xl font-semibold text-[#141413] tracking-tight">
                    {feature.title}
                  </h3>
                  {feature.desc && (
                    <p className="mt-1.5 md:mt-2 text-[14px] md:text-[15px] text-[#6a6560] leading-relaxed">
                      {feature.desc}
                    </p>
                  )}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function UnitTypesChapter({
  headline,
  units,
}: {
  headline?: string;
  units: {
    name?: string;
    size?: string;
    price?: string;
    features?: string[];
  }[];
}) {
  const filtered = units.filter((u) => u.name || u.size);
  if (filtered.length === 0) return null;
  return (
    <section className="bg-white py-14 md:py-28 overflow-hidden border-t border-[#141413]/8">
      <div className="max-w-5xl mx-auto px-5 md:px-14 mb-8 md:mb-14">
        <FadeIn>
          <span className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-[#6a6560]">
            Available
          </span>
          <h2 className="mt-2 text-2xl md:text-5xl font-semibold leading-snug md:leading-tight tracking-tight text-[#141413]">
            {headline || "Units"}
          </h2>
        </FadeIn>
      </div>
      <div className="flex gap-4 md:gap-5 pl-5 md:pl-14 pr-5 overflow-x-auto snap-x snap-mandatory pb-4 -webkit-overflow-scrolling-touch">
        {filtered.map((unit, i) => (
          <FadeIn key={i}>
            <div className="snap-start shrink-0 w-[75vw] sm:w-[70vw] md:w-[400px] border border-[#141413]/10 rounded-xl p-5 md:p-9 flex flex-col justify-between min-h-[320px] md:min-h-[380px] bg-[#E0E0E5]">
              <div>
                <span className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-[#6a6560]">
                  {unit.name || `Unit ${i + 1}`}
                </span>
                <h3 className="mt-2 md:mt-3 text-3xl md:text-5xl font-semibold leading-none tracking-tight text-[#141413]">
                  {unit.size}
                </h3>
                {unit.price && (
                  <p className="mt-4 text-xl text-[#6a6560]">
                    from{" "}
                    <span className="text-[#141413] font-semibold">
                      {unit.price}
                    </span>
                    /mo
                  </p>
                )}
              </div>
              {Array.isArray(unit.features) && unit.features.length > 0 && (
                <ul className="mt-8 space-y-2 text-sm text-[#6a6560]">
                  {unit.features
                    .filter((f) => f)
                    .map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2">
                        <Check size={14} className="text-[#141413]/50" /> {f}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function GalleryChapter({
  images,
}: {
  images: { url?: string; alt?: string }[];
}) {
  const valid = images.filter((im) => im.url);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (valid.length < 2) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % valid.length);
    }, 5500);
    return () => clearInterval(id);
  }, [valid.length]);
  if (valid.length === 0) return null;
  return (
    <section className="relative h-[50vh] md:h-[75vh] w-full overflow-hidden bg-[#E0E0E5]">
      {valid.map((img, i) => (
        <div
          key={i}
          className="absolute inset-2 md:inset-8 rounded-lg md:rounded-xl overflow-hidden transition-opacity duration-[1500ms]"
          style={{
            opacity: i === active ? 1 : 0,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${img.url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              animation:
                i === active
                  ? "lp-kenburns 12s ease-in-out infinite alternate"
                  : undefined,
            }}
            aria-hidden
          />
        </div>
      ))}
      <div className="absolute inset-2 md:inset-8 rounded-lg md:rounded-xl bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      {valid[active]?.alt && (
        <div className="absolute bottom-6 md:bottom-14 left-6 md:left-14 text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-white/90">
          {valid[active].alt}
        </div>
      )}
      {valid.length > 1 && (
        <div className="absolute bottom-6 md:bottom-14 right-6 md:right-14 flex gap-2">
          {valid.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`w-8 h-0.5 rounded-full transition-colors ${
                i === active ? "bg-white" : "bg-white/40"
              }`}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TestimonialsChapter({
  items,
}: {
  items: { name?: string; text?: string; role?: string; metric?: string }[];
}) {
  const filtered = items.filter((t) => t.text);
  if (filtered.length === 0) return null;
  return (
    <section className="bg-[#E0E0E5] py-14 md:py-28 border-t border-[#141413]/8">
      <div className="max-w-4xl mx-auto px-5 md:px-14 space-y-14 md:space-y-28">
        {filtered.map((t, i) => (
          <FadeIn key={i}>
            <div className="text-center">
              <span className="text-4xl md:text-7xl leading-none text-[#141413]/15 font-serif select-none">
                &ldquo;
              </span>
              <blockquote className="mt-1 md:mt-2 text-xl md:text-4xl font-semibold leading-snug tracking-tight text-[#141413] max-w-3xl mx-auto">
                {t.text}
              </blockquote>
              <div className="mt-5 md:mt-8 flex flex-wrap items-baseline justify-center gap-x-3 md:gap-x-4 gap-y-1">
                {t.name && (
                  <span className="text-xs md:text-sm font-medium tracking-[0.08em] uppercase text-[#141413]">
                    {t.name}
                  </span>
                )}
                {t.role && (
                  <span className="text-[10px] md:text-xs tracking-[0.08em] uppercase text-[#6a6560]">
                    {t.role}
                  </span>
                )}
                {t.metric && (
                  <span className="text-[10px] md:text-xs tracking-[0.08em] uppercase text-[#6a6560]">
                    · {t.metric}
                  </span>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}

function FAQChapter({
  headline,
  items,
}: {
  headline?: string;
  items: { q?: string; a?: string }[];
}) {
  const filtered = items.filter((it) => it.q && it.a);
  const [openIdx, setOpenIdx] = useState<number | null>(
    filtered.length > 0 ? 0 : null
  );
  if (filtered.length === 0) return null;
  return (
    <section className="bg-white py-14 md:py-28 border-t border-[#141413]/8">
      <div className="max-w-3xl mx-auto px-5 md:px-14">
        <FadeIn>
          <h2 className="text-2xl md:text-5xl font-semibold leading-snug md:leading-tight tracking-tight text-[#141413] mb-8 md:mb-16">
            {headline || "Frequently Asked"}
          </h2>
        </FadeIn>
        <div>
          {filtered.map((item, i) => {
            const open = openIdx === i;
            return (
              <FadeIn key={i}>
                <div className="border-t border-[#141413]/10 last:border-b py-6">
                  <button
                    onClick={() => setOpenIdx(open ? null : i)}
                    className="w-full flex items-center justify-between gap-6 text-left group"
                  >
                    <span className="text-lg md:text-xl font-medium tracking-tight text-[#141413] group-hover:text-[#141413]/80 transition-colors">
                      {item.q}
                    </span>
                    <span className="shrink-0 text-[#141413]/40 text-2xl leading-none font-light">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <p className="mt-4 text-[15px] text-[#6a6560] leading-relaxed max-w-2xl">
                      {item.a}
                    </p>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function LocationChapter({
  headline,
  address,
  directions,
}: {
  headline?: string;
  address?: string;
  directions?: string;
}) {
  if (!address) return null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <section className="bg-[#E0E0E5] py-14 md:py-28 border-t border-[#141413]/8">
      <div className="max-w-5xl mx-auto px-5 md:px-14 grid md:grid-cols-12 gap-6 md:gap-10">
        <div className="md:col-span-5">
          <FadeIn>
            <span className="text-[10px] md:text-[11px] tracking-[0.22em] uppercase text-[#6a6560]">
              Visit
            </span>
            <h2 className="mt-2 text-2xl md:text-5xl font-semibold leading-snug md:leading-tight tracking-tight text-[#141413]">
              {headline || "Find us"}
            </h2>
          </FadeIn>
        </div>
        <div className="md:col-span-7 flex flex-col gap-4 md:gap-5">
          <FadeIn>
            <p className="text-lg md:text-2xl font-medium leading-snug tracking-tight text-[#141413] whitespace-pre-line">
              {address}
            </p>
            {directions && (
              <p className="text-sm text-[#6a6560] max-w-md leading-relaxed whitespace-pre-line mt-2">
                {directions}
              </p>
            )}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-[#141413]/70 hover:text-[#141413] transition-colors w-fit mt-4"
            >
              <MapPin size={12} /> Get directions
            </a>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function CTAChapter({
  headline,
  subheadline,
  phone,
  reserveUrl,
  reserveLabel,
}: {
  headline?: string;
  subheadline?: string;
  phone?: string;
  reserveUrl: string;
  reserveLabel: string;
}) {
  return (
    <section id="cta" className="bg-white py-14 md:py-28 border-t border-[#141413]/8">
      <div className="max-w-3xl mx-auto px-5 md:px-14 text-center">
        <FadeIn>
          <h2 className="text-2xl md:text-5xl font-semibold leading-snug md:leading-tight tracking-tight text-[#141413]">
            {headline}
          </h2>
          {subheadline && (
            <p className="mt-3 md:mt-4 text-[15px] md:text-lg text-[#6a6560] leading-relaxed max-w-xl mx-auto">
              {subheadline}
            </p>
          )}
          <div className="mt-7 md:mt-10 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 md:gap-4">
            <a
              href={reserveUrl || "#"}
              target={reserveUrl && reserveUrl.startsWith("http") ? "_blank" : undefined}
              rel={reserveUrl && reserveUrl.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 md:px-8 md:py-4 bg-[#141413] text-[#E0E0E5] rounded-full text-[15px] md:text-base font-semibold hover:bg-[#141413]/90 transition-colors"
            >
              {reserveLabel} <ArrowRight size={16} />
            </a>
            {phone && (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 md:px-6 md:py-4 border border-[#141413]/20 rounded-full text-sm font-medium text-[#141413] hover:bg-[#141413]/5 transition-colors"
              >
                <Phone size={15} /> {phone}
              </a>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  ASK — the on-page lead form                            */
/* ═══════════════════════════════════════════════════════ */

const WHEN: [string, string][] = [
  ["this_week", "This week"],
  ["this_month", "This month"],
  ["just_looking", "Just looking"],
];

/**
 * The way to ask without leaving the page, on every screen. Before this the
 * only capture was a desktop exit popup, so a phone visitor who wasn't ready to
 * reserve left nothing behind. A lead from here is answered by text within a
 * minute (speed-to-lead), joins its campaign's follow-up, and is tied to the
 * visit that brought it.
 */
function AskChapter({
  page,
  facilityName,
  sizes,
  hasReserve,
}: {
  page: LandingPage;
  facilityName?: string;
  sizes: string[];
  hasReserve: boolean;
}) {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [size, setSize] = useState("");
  const [when, setWhen] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const tour = !!page.theme?.features?.tour;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          unitSize: size || undefined,
          timeline: WHEN.find(([k]) => k === when)?.[1],
          facilityId: page.facility_id,
          landingPageId: page.id,
          sessionId: sessionStorage.getItem("storageads_session_id") || undefined,
          utmSource: searchParams.get("utm_source") || undefined,
          utmMedium: searchParams.get("utm_medium") || undefined,
          utmCampaign: searchParams.get("utm_campaign") || undefined,
          utmContent: searchParams.get("utm_content") || undefined,
          referrer: document.referrer || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { leadId?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "That didn't go through. Please try again.");
      setLeadId(data.leadId ?? null);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const first = name.trim().split(/\s+/)[0];
  const field =
    "w-full px-4 py-3.5 rounded-xl border border-[#141413]/20 bg-[#E0E0E5] text-[16px] font-medium text-[#141413] placeholder:text-[#141413]/45 focus:outline-none focus:ring-2 focus:ring-[#141413]/35";
  const label = "block text-[13px] font-semibold text-[#141413] mb-1.5";

  return (
    <section id="ask" className="bg-white py-14 md:py-24 border-t border-[#141413]/8">
      <div className="max-w-xl mx-auto px-5 md:px-8">
        {sent ? (
          <div>
            <h2 className="text-2xl md:text-4xl font-bold leading-snug tracking-tight text-[#141413]">
              Thanks{first ? `, ${first}` : ""}.
            </h2>
            <p className="mt-2 text-[16px] font-medium text-[#141413]/80">
              {facilityName || "We"} {facilityName ? "has" : "have"} your number and will be in touch shortly.
            </p>
            {tour && <TourPicker page={page} name={name} phone={phone} size={size} leadId={leadId} />}
          </div>
        ) : (
          <form onSubmit={submit} noValidate={false}>
            <span className="text-[11px] tracking-[0.22em] uppercase font-semibold text-[#6a6560]">
              {hasReserve ? "Not ready to reserve?" : "Ask about a unit"}
            </span>
            <h2 className="mt-2 text-2xl md:text-4xl font-bold leading-snug tracking-tight text-[#141413]">
              Leave your number. We&apos;ll get back to you.
            </h2>
            <div className="mt-6 grid gap-4">
              <div>
                <label htmlFor="ask-name" className={label}>Name</label>
                <input id="ask-name" className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ask-phone" className={label}>Phone</label>
                  <input id="ask-phone" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" required />
                </div>
                <div>
                  <label htmlFor="ask-email" className={label}>Email</label>
                  <input id="ask-email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
                </div>
              </div>
              {sizes.length > 0 && (
                <div>
                  <label htmlFor="ask-size" className={label}>Size</label>
                  <select id="ask-size" className={field} value={size} onChange={(e) => setSize(e.target.value)}>
                    <option value="">Not sure yet</option>
                    {sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
              <fieldset>
                <legend className={label}>When do you need it?</legend>
                <div className="flex flex-wrap gap-2">
                  {WHEN.map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setWhen(when === k ? "" : k)}
                      aria-pressed={when === k}
                      className={`px-4 py-2.5 rounded-full border text-[15px] font-semibold transition-colors ${
                        when === k
                          ? "bg-[#1E3C74] border-[#1E3C74] text-white"
                          : "bg-white border-[#141413]/25 text-[#141413] hover:border-[#141413]/50"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            {error && (
              <p role="alert" className="mt-4 border-l-4 border-[#A12A2A] pl-3 text-[15px] font-semibold text-[#141413]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 bg-[#141413] text-[#E0E0E5] rounded-full text-[16px] font-bold hover:bg-[#141413]/90 transition-colors disabled:opacity-60"
            >
              {sending ? <Loader2 size={17} className="animate-spin" /> : null}
              {sending ? "Sending" : "Ask about a unit"}
            </button>
            <p className="mt-3 text-[13px] font-medium text-[#6a6560]">
              By sending this you agree to a text or call about storage. Reply STOP to opt out.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

/** After someone asks: book a time to see it, confirmed by text. */
function TourPicker({
  page,
  name,
  phone,
  size,
  leadId,
}: {
  page: LandingPage;
  name: string;
  phone: string;
  size: string;
  leadId: string | null;
}) {
  const [at, setAt] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "booked">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!at) return;
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: page.facility_id,
          phone,
          name,
          sizeLabel: size || undefined,
          leadId: leadId || undefined,
          scheduledAt: new Date(at).toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { booked?: boolean; message?: string; confirmationSent?: boolean; error?: string };
      if (!data.booked) {
        setState("idle");
        setMessage(data.message || data.error || "That time couldn't be booked. Please pick another.");
        return;
      }
      setState("booked");
      setMessage(data.confirmationSent ? "We've texted you a confirmation." : "See you then.");
    } catch {
      setState("idle");
      setMessage("That didn't go through. Please try again.");
    }
  };

  if (state === "booked") {
    return (
      <p className="mt-6 border-l-4 border-[#2F6B3F] pl-3 text-[16px] font-semibold text-[#141413]">
        Booked for {new Date(at).toLocaleString([], { weekday: "long", hour: "numeric", minute: "2-digit" })}. {message}
      </p>
    );
  }
  return (
    <form onSubmit={book} className="mt-8 border-t border-[#141413]/10 pt-6">
      <h3 className="text-xl font-bold text-[#141413]">Want to see it first?</h3>
      <label htmlFor="tour-at" className="mt-3 block text-[13px] font-semibold text-[#141413] mb-1.5">
        Pick a time
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="tour-at"
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          className="flex-1 px-4 py-3.5 rounded-xl border border-[#141413]/20 bg-[#E0E0E5] text-[16px] font-medium text-[#141413] focus:outline-none focus:ring-2 focus:ring-[#141413]/35"
          required
        />
        <button
          type="submit"
          disabled={state === "sending" || !at}
          className="inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-[#2F6B3F] text-white text-[16px] font-bold disabled:opacity-60"
        >
          {state === "sending" ? "Booking" : "Book a tour"}
        </button>
      </div>
      {message && (
        <p role="alert" className="mt-3 border-l-4 border-[#A12A2A] pl-3 text-[15px] font-semibold text-[#141413]">
          {message}
        </p>
      )}
    </form>
  );
}

function PageFooter() {
  return (
    <footer className="bg-[#E0E0E5] border-t border-[#141413]/8 py-10 md:py-12">
      <div className="max-w-5xl mx-auto px-6 md:px-14 text-center">
        <a
          href="https://storageads.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] tracking-[0.25em] uppercase text-[#6a6560] hover:text-[#141413] transition-colors"
        >
          Powered by <span className="text-[#141413] font-medium">storageads</span>
        </a>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  EXIT INTENT POPUP                                      */
/* ═══════════════════════════════════════════════════════ */

function ExitIntentPopup({
  show,
  onDismiss,
  onSubmit,
  facilityName,
}: {
  show: boolean;
  onDismiss: () => void;
  onSubmit: (email: string) => void;
  facilityName?: string;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onSubmit(email);
      setSubmitted(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-[#6a6560] hover:text-[#141413] hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-6 pt-8 text-center">
          {submitted ? (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#141413]/[0.06]">
                <Check size={24} className="text-[#141413]" />
              </div>
              <h3 className="text-xl font-semibold text-[#141413] mb-2">
                You are all set!
              </h3>
              <p className="text-sm text-[#6a6560]">
                We will send you availability updates
                {facilityName ? ` for ${facilityName}` : ""}. Check your inbox.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold text-[#141413] mb-2">
                Wait, don&apos;t lose your spot!
              </h3>
              <p className="text-sm text-[#6a6560] mb-5">
                Enter your email and we will save your progress. Plus, we will
                let you know if availability changes
                {facilityName ? ` at ${facilityName}` : ""}.
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-3 rounded-xl border border-[#141413]/10 text-sm text-[#141413] bg-[#E0E0E5] focus:outline-none focus:ring-2 focus:ring-[#141413]/20 focus:border-transparent"
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  className="px-5 py-3 rounded-xl text-sm font-semibold text-[#E0E0E5] bg-[#141413] hover:bg-[#141413]/90 transition-colors"
                >
                  Save My Spot
                </button>
              </form>
              <p className="text-xs text-[#6a6560] mt-3">
                No spam. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                         */
/* ═══════════════════════════════════════════════════════ */

export default function LandingPageRoute() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<LandingPage | null>(null);
  const [trackingPhone, setTrackingPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const pageTrackerInitialized = useRef(false);

  useTrackingParams(page?.id, page?.facility_id);

  useEffect(() => {
    const fbclid = searchParams.get("fbclid");
    const gclid = searchParams.get("gclid");
    if (fbclid) sessionStorage.setItem("storageads_fbclid", fbclid);
    if (gclid) sessionStorage.setItem("storageads_gclid", gclid);

    if (!sessionStorage.getItem("storageads_session_id")) {
      sessionStorage.setItem(
        "storageads_session_id",
        `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      );
    }
  }, [searchParams]);

  useEffect(() => {
    if (!page || sessionStorage.getItem("storageads_exit_dismissed")) return;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !showExitPopup) setShowExitPopup(true);
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [page, showExitPopup]);

  const handleExitDismiss = useCallback(() => {
    setShowExitPopup(false);
    sessionStorage.setItem("storageads_exit_dismissed", "1");
  }, []);

  const handleExitSubmit = useCallback(
    (email: string) => {
      const sessionId = sessionStorage.getItem("storageads_session_id");
      if (sessionId && page) {
        fetch("/api/consumer-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            email,
            facilityId: page.facility_id,
            landingPageId: page.id,
            fbclid: sessionStorage.getItem("storageads_fbclid") || undefined,
            gclid: sessionStorage.getItem("storageads_gclid") || undefined,
          }),
          keepalive: true,
        }).catch(() => {});
      }
      setTimeout(() => {
        setShowExitPopup(false);
        sessionStorage.setItem("storageads_exit_dismissed", "1");
      }, 2000);
    },
    [page]
  );

  useEffect(() => {
    async function fetchPage() {
      try {
        const isPreview = searchParams.get("preview") === "1";
        const adminKey =
          typeof window !== "undefined"
            ? localStorage.getItem("storageads_admin_key") || ""
            : "";
        const headers: Record<string, string> = {};
        if (isPreview && adminKey) headers["X-Admin-Key"] = adminKey;
        const qs = isPreview
          ? `slug=${encodeURIComponent(slug)}&preview=1`
          : `slug=${encodeURIComponent(slug)}`;
        const res = await fetch(`/api/landing-pages?${qs}`, { headers });
        if (res.status === 404) {
          setError("Page not found");
          return;
        }
        if (!res.ok) throw new Error("Failed to load page");
        const data = await res.json();
        const pageData = data.page;
        setPage(pageData);

        if (pageData?.id) {
          try {
            const tnRes = await fetch(
              `/api/call-tracking?landingPageId=${pageData.id}`
            );
            if (tnRes.ok) {
              const tnData = await tnRes.json();
              if (tnData.trackingPhone) setTrackingPhone(tnData.trackingPhone);
            }
          } catch {
            /* fall back to default phone */
          }
        }

        if (pageData?.meta_title) document.title = pageData.meta_title;
        else if (pageData?.title) document.title = pageData.title;

        const metaDesc = document.querySelector('meta[name="description"]');
        if (pageData?.meta_description && metaDesc) {
          metaDesc.setAttribute("content", pageData.meta_description);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
  }, [slug, searchParams]);

  useEffect(() => {
    if (!page || pageTrackerInitialized.current) return;
    pageTrackerInitialized.current = true;

    const w = window as unknown as Record<string, unknown>;
    const capiEventId = crypto.randomUUID();

    if (typeof w.fbq === "function")
      (w.fbq as (...args: unknown[]) => void)(
        "track",
        "PageView",
        {},
        { eventID: capiEventId }
      );
    if (typeof w.gtag === "function")
      (w.gtag as (...args: unknown[]) => void)("event", "page_view", {
        page_title: page.title,
        page_location: window.location.href,
      });

    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid") || undefined;
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: capiEventId,
        event_source_url: window.location.href,
        action_source: "website",
        user_data: {
          fbc: fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined,
          fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1] || undefined,
          client_user_agent: navigator.userAgent,
        },
        custom_data: {
          content_name: page.title,
          content_type: "landing_page",
        },
      }),
      keepalive: true,
    }).catch(() => {});

    const sessionId = sessionStorage.getItem("storageads_session_id");
    let maxScroll = 0;
    const startTime = Date.now();

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) *
          100
      );
      if (scrollPercent > maxScroll) maxScroll = scrollPercent;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const sendInteraction = () => {
      const timeOnPage = Math.round((Date.now() - startTime) / 1000);
      fetch("/api/page-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landingPageId: page.id,
          facilityId: page.facility_id,
          sessionId,
          scrollDepth: maxScroll,
          timeOnPage,
        }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", sendInteraction);
    const interval = setInterval(sendInteraction, 30000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", sendInteraction);
      clearInterval(interval);
      sendInteraction();
    };
  }, [page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#E0E0E5]">
        <Loader2 className="w-8 h-8 text-[#141413] animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#E0E0E5] px-5">
        <h1 className="text-2xl font-semibold text-[#141413] mb-2">
          Page Not Found
        </h1>
        <p className="text-[#6a6560] mb-6">
          This landing page doesn&apos;t exist or hasn&apos;t been published
          yet.
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-[#141413] underline underline-offset-4 hover:text-[#6a6560]"
        >
          Go to homepage
        </Link>
      </div>
    );
  }

  /* ── Extract section data ── */
  const sectionByType = (t: string) =>
    page.sections.find((s) => s.section_type === t);
  const hero = sectionByType("hero")?.config ?? {};
  const trustBar = sectionByType("trust_bar")?.config ?? {};
  const features = sectionByType("features")?.config ?? {};
  const cta = sectionByType("cta")?.config ?? {};
  const gallery = sectionByType("gallery")?.config ?? {};
  const units = sectionByType("unit_types")?.config ?? {};
  const testimonials = sectionByType("testimonials")?.config ?? {};
  const faq = sectionByType("faq")?.config ?? {};
  const location = sectionByType("location_map")?.config ?? {};

  const galleryImages = Array.isArray(gallery.images)
    ? (gallery.images as { url?: string; alt?: string }[])
    : [];
  const firstGalleryUrl = galleryImages.find((im) => im.url)?.url;
  const backgroundImage =
    (hero.backgroundImage as string) || firstGalleryUrl || "";

  const headline =
    (hero.headline as string) || page.title || "Reserve Your Unit";
  const subheadline = (hero.subheadline as string) || "";

  const externalUrl =
    page.storedge_widget_url ||
    (
      (cta.ctaUrl as string) && (cta.ctaUrl as string).startsWith("http")
        ? (cta.ctaUrl as string)
        : ""
    ) ||
    (
      (hero.ctaUrl as string) && (hero.ctaUrl as string).startsWith("http")
        ? (hero.ctaUrl as string)
        : ""
    );
  // Without a reservation link, every "reserve" button leads to the form.
  const reserveUrl = externalUrl || "#ask";
  const reserveLabel =
    (cta.ctaText as string) || (hero.ctaText as string) || "Reserve Unit";

  const trustItems = Array.isArray(trustBar.items)
    ? (trustBar.items as { icon?: string; text?: string }[])
    : [];
  const featureItems = Array.isArray(features.items)
    ? (features.items as {
        icon?: string;
        title?: string;
        desc?: string;
      }[])
    : [];
  const unitItems = Array.isArray(units.units)
    ? (units.units as {
        name?: string;
        size?: string;
        price?: string;
        features?: string[];
      }[])
    : [];
  const testimonialItems = Array.isArray(testimonials.items)
    ? (testimonials.items as {
        name?: string;
        text?: string;
        role?: string;
        metric?: string;
      }[])
    : [];
  const faqItems = Array.isArray(faq.items)
    ? (faq.items as { q?: string; a?: string }[])
    : [];
  const address = (location.address as string) || "";
  const directions = (location.directions as string) || "";
  const facilityName = (hero.facilityName as string) || undefined;

  return (
    <div className="bg-[#E0E0E5]">
      <HeroSplash
        backgroundImage={backgroundImage}
        facilityName={facilityName}
        headline={headline}
        subheadline={subheadline}
        reserveUrl={reserveUrl}
        reserveLabel={reserveLabel}
        phone={trackingPhone || (cta.phone as string) || (hero.phone as string) || null}
      />

      {sectionByType("trust_bar") && <TrustBarChapter items={trustItems} />}
      <AskChapter
        page={page}
        facilityName={facilityName}
        sizes={unitItems.map((u) => u.size || u.name || "").filter(Boolean)}
        hasReserve={!!externalUrl}
      />
      {sectionByType("features") && (
        <FeaturesChapter
          headline={features.headline as string | undefined}
          items={featureItems}
        />
      )}
      {sectionByType("unit_types") && (
        <UnitTypesChapter
          headline={units.headline as string | undefined}
          units={unitItems}
        />
      )}
      {sectionByType("gallery") && <GalleryChapter images={galleryImages} />}
      {sectionByType("testimonials") && (
        <TestimonialsChapter items={testimonialItems} />
      )}
      {sectionByType("faq") && (
        <FAQChapter
          headline={faq.headline as string | undefined}
          items={faqItems}
        />
      )}
      {sectionByType("location_map") && (
        <LocationChapter
          headline={location.headline as string | undefined}
          address={address}
          directions={directions}
        />
      )}
      <CTAChapter
          headline={(cta.headline as string) || "Ready to reserve?"}
          subheadline={cta.subheadline as string | undefined}
          phone={
            trackingPhone || (cta.phone as string | undefined) || undefined
          }
          reserveUrl={reserveUrl}
          reserveLabel={reserveLabel}
        />

      <PageFooter />

      <ExitIntentPopup
        show={showExitPopup}
        onDismiss={handleExitDismiss}
        onSubmit={handleExitSubmit}
        facilityName={facilityName}
      />
    </div>
  );
}
