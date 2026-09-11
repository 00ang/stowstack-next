"use client";

import {
  Truck,
  Heart,
  Home,
  Package,
  Hammer,
  Building2,
  GraduationCap,
  Car,
  Calendar,
} from "lucide-react";
import { useInView } from "./use-in-view";
import Cite from "./cite";
import { RevealText } from "./motion";

const TRIGGERS = [
  {
    icon: Truck,
    title: "Moving & Relocation",
    body: "Local and long-distance moves. We know this demand from running U-Haul dealerships and a moving company.",
  },
  {
    icon: Heart,
    title: "Divorce & Life Disruption",
    body: "Someone needs their stuff out of the house this week. They rent fast, and the first facility in front of them usually wins.",
  },
  {
    icon: Home,
    title: "Downsizing",
    body: "Moving to a smaller place means the overflow has to go somewhere. These tenants stay for years.",
  },
  {
    icon: Package,
    title: "Estate Cleanouts",
    body: "Sorting a family member's belongings takes months. Big units, real urgency. Agencies miss this demand because they've never run a facility.",
  },
  {
    icon: Hammer,
    title: "Remodeling & Renovation",
    body: "Clearing rooms for a home project. Predictable and seasonal, so we run the campaigns before the season hits.",
  },
  {
    icon: Building2,
    title: "Business Overflow",
    body: "Contractors, e-commerce sellers, and small businesses that need somewhere to stage inventory. Commercial tenants stay longer and pay on time.",
  },
  {
    icon: GraduationCap,
    title: "College Transitions",
    body: "Students cycling in and out between semesters. Repeatable annual demand we build campaign calendars around.",
  },
  {
    icon: Car,
    title: "Vehicle / RV / Boat Storage",
    body: "Seasonal vehicle storage at premium rates. We built and operate heated indoor vehicle storage ourselves.",
  },
  {
    icon: Calendar,
    title: "Seasonal & Overflow",
    body: "Holiday items, sports gear, off-season belongings. Consistent base demand that fills standard units year-round.",
  },
];

export default function DemandTriggers() {
  const { ref, isVisible } = useInView(0.08);

  return (
    <section
      ref={ref}
      id="demand-triggers"
      aria-label="Storage demand triggers we target with Meta ads"
      className="section"
      style={{ background: "var(--color-light)" }}
    >
      <div className="section-content">
        {/* Heading */}
        <div
          className={`max-w-3xl mx-auto text-center mb-14 sm:mb-16 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <h2
            className="font-semibold"
            style={{
              fontSize: "var(--text-section-head)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            <RevealText>These are the triggers that send someone looking for a unit.</RevealText>
          </h2>
          <p
            className="mt-5 mx-auto"
            style={{
              color: "var(--text-secondary)",
              fontSize: "var(--text-body)",
              lineHeight: "var(--leading-normal)",
              maxWidth: "62ch",
            }}
          >
            These are the reasons people rent a unit. Every one of them
            starts long before someone opens Google. Meta puts your facility in
            front of these renters while they&apos;re still deciding.
          </p>
        </div>

        {/* Demand mix strip — sourced from SSA Demand Study. Multi-select
            responses, which is why the numbers sum to more than 100%. Anchors
            the trigger grid below in real renter-reported reasons, not
            persona work. */}
        <div
          className={`mb-10 sm:mb-14 transition-all duration-700 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
          style={{
            border: "1px solid var(--border-subtle)",
            background: "var(--color-light-gray)",
            transitionDelay: "120ms",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--color-light)",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase"
              style={{
                color: "var(--color-dark)",
                letterSpacing: "var(--tracking-wide)",
                fontFamily: "var(--font-heading)",
              }}
            >
              Why renters get a unit
            </p>
            <p
              className="text-[10px]"
              style={{
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-heading)",
                letterSpacing: "0.04em",
              }}
            >
              Multi-select · n = 6 · SSA Demand Study<Cite n={5} />
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {[
              { pct: "57%", label: "Not enough space at home" },
              { pct: "45%", label: "Downsizing or decluttering" },
              { pct: "34%", label: "During a move" },
              { pct: "30%", label: "Change in household size" },
              { pct: "15%", label: "Home renovation" },
              { pct: "5%", label: "Business and e-commerce" },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className="px-4 py-4"
                style={{
                  borderRight:
                    i < arr.length - 1
                      ? "1px solid var(--border-subtle)"
                      : undefined,
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <p
                  className="text-xl sm:text-2xl font-semibold"
                  style={{
                    color: "var(--color-dark)",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {row.pct}
                </p>
                <p
                  className="text-[11px] mt-1 leading-snug"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  {row.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {TRIGGERS.map((trigger, i) => {
            const Icon = trigger.icon;
            return (
              <div
                key={trigger.title}
                className={`group relative rounded-2xl border p-6 transition-all duration-500 hover:-translate-y-0.5 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
                style={{
                  borderColor: "var(--border-subtle)",
                  background: "var(--color-light-gray)",
                  transitionDelay: `${150 + i * 60}ms`,
                }}
              >
                {/* Icon tile */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--color-green) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-green) 25%, transparent)",
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    style={{ color: "var(--color-green)" }}
                  />
                </div>

                {/* Title */}
                <h3
                  className="font-semibold mb-2"
                  style={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-heading)",
                    fontSize: "1.0625rem",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.3,
                  }}
                >
                  {trigger.title}
                </h3>

                {/* Body */}
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                  }}
                >
                  {trigger.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
