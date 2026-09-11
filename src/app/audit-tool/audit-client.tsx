"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ExitIntentPopup } from "@/components/marketing/exit-intent-popup";
import { CAL_BOOKING_URL } from "@/lib/booking";
import {
  Search,
  Loader2,
  Star,
  MapPin,
  Phone,
  Globe,
  Image as ImageIcon,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface PlacesResult {
  found: boolean;
  placeId?: string;
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  hours?: string[];
  photos?: { index: number; url: string; width: number; height: number }[];
  reviews?: { author: string; rating: number; text: string; time: string }[];
  message?: string;
}

interface AuditScore {
  overall: number;
  grade: string;
  breakdown: { label: string; score: number; maxScore: number; note: string }[];
}

function computeAuditScore(data: PlacesResult): AuditScore {
  const breakdown: AuditScore["breakdown"] = [];
  let total = 0;
  let maxTotal = 0;

  // Google rating (0-25 points)
  const ratingMax = 25;
  const ratingScore = data.rating
    ? Math.round(Math.min((data.rating / 5) * ratingMax, ratingMax))
    : 0;
  breakdown.push({
    label: "Google Rating",
    score: ratingScore,
    maxScore: ratingMax,
    note: data.rating
      ? `${data.rating} stars`
      : "No rating found",
  });
  total += ratingScore;
  maxTotal += ratingMax;

  // Review count (0-25 points)
  const reviewMax = 25;
  const reviewScore = data.reviewCount
    ? Math.round(Math.min((data.reviewCount / 200) * reviewMax, reviewMax))
    : 0;
  breakdown.push({
    label: "Review Volume",
    score: reviewScore,
    maxScore: reviewMax,
    note: data.reviewCount
      ? `${data.reviewCount} reviews`
      : "No reviews found",
  });
  total += reviewScore;
  maxTotal += reviewMax;

  // Photo count (0-15 points)
  const photoMax = 15;
  const photoCount = data.photos?.length ?? 0;
  const photoScore = Math.round(Math.min((photoCount / 8) * photoMax, photoMax));
  breakdown.push({
    label: "Photo Presence",
    score: photoScore,
    maxScore: photoMax,
    note: `${photoCount} photos on Google`,
  });
  total += photoScore;
  maxTotal += photoMax;

  // Website (0-10 points)
  const websiteMax = 10;
  const websiteScore = data.website ? websiteMax : 0;
  breakdown.push({
    label: "Website Listed",
    score: websiteScore,
    maxScore: websiteMax,
    note: data.website ? "Website found" : "No website listed",
  });
  total += websiteScore;
  maxTotal += websiteMax;

  // Phone (0-10 points)
  const phoneMax = 10;
  const phoneScore = data.phone ? phoneMax : 0;
  breakdown.push({
    label: "Phone Listed",
    score: phoneScore,
    maxScore: phoneMax,
    note: data.phone ? "Phone number found" : "No phone listed",
  });
  total += phoneScore;
  maxTotal += phoneMax;

  // Business status (0-15 points)
  const statusMax = 15;
  const statusScore = data.businessStatus === "OPERATIONAL" ? statusMax : 0;
  breakdown.push({
    label: "Business Status",
    score: statusScore,
    maxScore: statusMax,
    note:
      data.businessStatus === "OPERATIONAL"
        ? "Operational"
        : data.businessStatus || "Unknown",
  });
  total += statusScore;
  maxTotal += statusMax;

  const overall = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  const grade =
    overall >= 85
      ? "Excellent"
      : overall >= 65
        ? "Strong"
        : overall >= 45
          ? "Moderate"
          : "Needs Work";

  return { overall, grade, breakdown };
}

function gradeColor(grade: string) {
  if (grade === "Excellent") return "text-[var(--color-green)]";
  if (grade === "Strong") return "text-[var(--color-blue)]";
  // No brand amber token exists; amber is the pragmatic caution tier for the gauge.
  if (grade === "Moderate") return "text-amber-500";
  return "text-[var(--color-red)]";
}

function gradeBg(grade: string) {
  if (grade === "Excellent") return "bg-[var(--color-green)]/10 border-[var(--color-green)]/20";
  if (grade === "Strong") return "bg-[var(--color-blue)]/10 border-[var(--color-blue)]/20";
  if (grade === "Moderate") return "bg-amber-500/10 border-amber-500/20";
  return "bg-[var(--color-red)]/10 border-[var(--color-red)]/20";
}

function ScoreRing({
  score,
  grade,
}: {
  score: number;
  grade: string;
}) {
  const circumference = 327;
  const dashLength = (score / 100) * circumference;
  const strokeColor =
    grade === "Excellent"
      ? "text-[var(--color-green)]"
      : grade === "Strong"
        ? "text-[var(--color-blue)]"
        : grade === "Moderate"
          ? "text-amber-500"
          : "text-[var(--color-red)]";

  return (
    <svg viewBox="0 0 120 120" className="w-28 h-28">
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-[var(--color-light-gray)]"
      />
      <circle
        cx="60"
        cy="60"
        r="52"
        fill="none"
        strokeWidth="8"
        className={strokeColor}
        stroke="currentColor"
        strokeDasharray={`${dashLength} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        style={{ transition: "stroke-dasharray 1s ease-out" }}
      />
      <text
        x="60"
        y="55"
        textAnchor="middle"
        className="fill-[var(--text-primary)] font-semibold"
        fontSize="28"
      >
        {score}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        className="fill-[var(--text-tertiary)]"
        fontSize="11"
      >
        / 100
      </text>
    </svg>
  );
}

export default function AuditToolPage() {
  const [facilityName, setFacilityName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PlacesResult | null>(null);
  const [auditScore, setAuditScore] = useState<AuditScore | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureSubmitted, setCaptureSubmitted] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim() || !location.trim()) {
      setError("Please enter both facility name and location.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setAuditScore(null);
    setPhotoIndex(0);

    try {
      const res = await fetch("/api/facility-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityName: facilityName.trim(),
          location: location.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Lookup failed. Please try again.");
      }

      const data: PlacesResult = await res.json();
      setResult(data);

      if (data.found) {
        setAuditScore(computeAuditScore(data));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (result && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const photos = result?.photos ?? [];

  return (
    <div className="min-h-screen bg-[var(--bg-void)]">
      {result && (
        <ExitIntentPopup
          facilityName={result.name}
          auditScore={auditScore?.overall}
        />
      )}
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-5 h-14">
          <Link
            href="/"
            className="text-sm font-semibold text-[var(--text-primary)] hover:opacity-70 transition-opacity"
          >
            StorageAds
          </Link>
          <span className="text-xs text-[var(--text-tertiary)]">
            Free Audit Tool
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5 bg-[var(--color-dark)]/5 border border-[var(--border-subtle)] text-[var(--text-secondary)]">
            <BarChart3 className="w-3.5 h-3.5" />
            Self-Service Audit
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] tracking-tight mb-3">
            How does your facility show up online?
          </h1>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
            Enter your facility name and location. We will check your Google
            presence and generate a quick marketing audit score.
          </p>
        </div>

        {/* Search Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6 sm:p-8 mb-8"
        >
          <div className="grid gap-4 sm:grid-cols-2 mb-5">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Facility Name
              </label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-dark)]/30 focus:border-transparent transition-all"
                placeholder="e.g. Northline Self Storage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                City / State
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-medium)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-dark)]/30 focus:border-transparent transition-all"
                placeholder="e.g. Grand Rapids, MI"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-error)] mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-[var(--color-light)] bg-[var(--color-dark)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Looking up facility...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Run Audit
              </>
            )}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div ref={resultsRef}>
            {!result.found ? (
              <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-8 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-[var(--text-tertiary)]" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  Facility Not Found
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {result.message ||
                    "We could not find a matching facility on Google. Try a different name or check the spelling."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Audit Score */}
                {auditScore && (
                  <div
                    className={`rounded-2xl border p-6 sm:p-8 ${gradeBg(auditScore.grade)}`}
                  >
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <ScoreRing
                        score={auditScore.overall}
                        grade={auditScore.grade}
                      />
                      <div className="text-center sm:text-left flex-1">
                        <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-1">
                          Online Presence Score
                        </p>
                        <p
                          className={`text-3xl font-semibold ${gradeColor(auditScore.grade)}`}
                        >
                          {auditScore.grade}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                          {auditScore.grade === "Excellent"
                            ? "Your facility shows up well online. The next step is turning visitors into renters."
                            : auditScore.grade === "Strong"
                              ? "Good foundation. A few things to tighten up to fill more units."
                              : auditScore.grade === "Moderate"
                                ? "Your online presence needs work. You're likely losing renters to competitors."
                                : "Big gaps in your online presence. Worth fixing this month."}
                        </p>
                      </div>
                    </div>

                    {/* Score breakdown */}
                    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {auditScore.breakdown.map((item) => (
                        <div
                          key={item.label}
                          className="bg-[var(--bg-primary)]/50 rounded-xl border border-[var(--border-subtle)] p-3"
                        >
                          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                            {item.label}
                          </p>
                          <p className="text-lg font-semibold text-[var(--text-primary)]">
                            {item.score}
                            <span className="text-xs font-normal text-[var(--text-tertiary)]">
                              /{item.maxScore}
                            </span>
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                            {item.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facility Info */}
                <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    {result.name}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {result.address && (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {result.address}
                        </span>
                      </div>
                    )}
                    {result.phone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {result.phone}
                        </span>
                      </div>
                    )}
                    {result.website && (
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                        <a
                          href={result.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--color-dark)] hover:underline truncate"
                        >
                          {result.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      </div>
                    )}
                    {result.rating && (
                      <div className="flex items-center gap-2.5">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                        <span className="text-sm text-[var(--text-secondary)]">
                          {result.rating} stars ({result.reviewCount} reviews)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Photos */}
                {photos.length > 0 && (
                  <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
                        Google Photos ({photos.length})
                      </h3>
                      {photos.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setPhotoIndex((prev) =>
                                prev === 0 ? photos.length - 1 : prev - 1
                              )
                            }
                            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                            {photoIndex + 1}/{photos.length}
                          </span>
                          <button
                            onClick={() =>
                              setPhotoIndex((prev) =>
                                prev === photos.length - 1 ? 0 : prev + 1
                              )
                            }
                            className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photos[photoIndex].url}
                        alt={`${result.name} photo ${photoIndex + 1}`}
                        className="w-full h-64 sm:h-80 object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Reviews */}
                {result.reviews && result.reviews.length > 0 && (
                  <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-6">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                      Top Reviews
                    </h3>
                    <div className="space-y-4">
                      {result.reviews.map((review, i) => (
                        <div
                          key={i}
                          className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: review.rating }).map(
                                (_, j) => (
                                  <Star
                                    key={j}
                                    className="w-3 h-3 text-amber-400 fill-amber-400"
                                  />
                                )
                              )}
                            </div>
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {review.time}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                            &ldquo;{review.text}&rdquo;
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)] mt-2">
                            {review.author}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA with email capture */}
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-8 text-center">
                  <TrendingUp className="w-8 h-8 text-[var(--text-primary)] mx-auto mb-3" />
                  <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    Want the full audit?
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mb-5 max-w-md mx-auto">
                    Get vacancy cost, projections, competitor data, and what
                    to fix first.
                  </p>
                  {captureSubmitted ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center gap-2 text-[var(--color-green)] font-semibold">
                        <CheckCircle2 className="w-5 h-5" />
                        Got it. We&apos;ll review your facility and follow up.
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] max-w-md">
                        Want it faster? Book a 30-minute call and we&apos;ll walk
                        your full audit together.
                      </p>
                      <a
                        href={CAL_BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-dark)] text-[var(--color-light)] font-semibold hover:opacity-90 transition-opacity"
                      >
                        Book a call
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!captureEmail.trim()) return;
                        setCaptureLoading(true);
                        setCaptureError(false);
                        try {
                          // consumer-lead requires a session id to key the
                          // partial_lead; the audit tool has no ambient session,
                          // so mint a one-off id for this capture.
                          const sessionId =
                            typeof crypto !== "undefined" && crypto.randomUUID
                              ? `audit_${crypto.randomUUID()}`
                              : `audit_${Date.now()}_${Math.random()
                                  .toString(36)
                                  .slice(2)}`;
                          const res = await fetch("/api/consumer-lead", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId,
                              email: captureEmail.trim(),
                              facilityName: result?.name || facilityName,
                              location: result?.address || location,
                              source: "audit_tool",
                              placeId: result?.placeId,
                              auditScore: auditScore?.overall,
                            }),
                          });
                          if (!res.ok) throw new Error(`status ${res.status}`);
                          setCaptureSubmitted(true);
                        } catch {
                          setCaptureError(true);
                        } finally {
                          setCaptureLoading(false);
                        }
                      }}
                      className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
                    >
                      <input
                        type="email"
                        required
                        placeholder="Your work email"
                        value={captureEmail}
                        onChange={(e) => setCaptureEmail(e.target.value)}
                        aria-label="Your email address"
                        className="flex-1 px-4 py-3 rounded-xl border text-sm"
                        style={{
                          borderColor: "var(--border-subtle)",
                          background: "var(--bg-surface)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={captureLoading}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-dark)] text-[var(--color-light)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-70"
                      >
                        {captureLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Get Full Audit
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                  {captureError && !captureSubmitted && (
                    <p className="mt-4 text-sm text-[var(--text-secondary)]">
                      Something went wrong saving that.{" "}
                      <a
                        href={CAL_BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--color-dark)] underline"
                      >
                        Book a call
                      </a>{" "}
                      and we&apos;ll walk your audit live.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pre-search CTA */}
        {!result && !loading && (
          <div className="grid gap-4 sm:grid-cols-3 mt-8">
            {[
              {
                icon: <Star className="w-5 h-5" />,
                title: "Google Presence",
                desc: "Check your rating, review count, and photo quality.",
              },
              {
                icon: <BarChart3 className="w-5 h-5" />,
                title: "Audit Score",
                desc: "Get a 0-100 score across 6 key marketing dimensions.",
              },
              {
                icon: <CheckCircle2 className="w-5 h-5" />,
                title: "Actionable",
                desc: "See exactly where you stand and what to improve.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] p-5"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--color-dark)]/5 flex items-center justify-center text-[var(--text-primary)] mb-3">
                  {card.icon}
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {card.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-10 text-xs text-[var(--text-tertiary)]">
          Powered by{" "}
          <Link href="/" className="text-[var(--color-dark)] hover:underline">
            StorageAds
          </Link>
        </div>
      </div>
    </div>
  );
}
