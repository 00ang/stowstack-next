"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Building2, TrendingUp, DollarSign, Users,
  ArrowLeft, Target, Zap, ArrowUpRight,
  MapPin, Calendar, Play, Pause,
  ChevronRight, Eye, Megaphone,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell,
} from "recharts";
import { ResponsiveChart } from "@/components/ui/responsive-chart";

const FACILITY = {
  name: "Lakeview Self Storage",
  location: "Midwest Metro",
  totalUnits: 214,
  startingOccupancy: 64,
  unitMix: [
    { type: "5x5 Climate", count: 32, rate: 65, vacancy: 8 },
    { type: "5x10 Climate", count: 40, rate: 95, vacancy: 12 },
    { type: "10x10 Standard", count: 52, rate: 120, vacancy: 14 },
    { type: "10x15 Drive-Up", count: 36, rate: 165, vacancy: 9 },
    { type: "10x20 Drive-Up", count: 30, rate: 195, vacancy: 7 },
    { type: "10x30 Vehicle", count: 24, rate: 275, vacancy: 5 },
  ],
};

const MONTHS = [
  { month: "Oct 2025", spend: 1800, leads: 42, moveIns: 8, cpl: 42.86, costPerMoveIn: 225, roas: 2.1, occupancy: 68, topAudience: "Lookalike 1% – Move-In Converters", topCreative: 'Video: "Your Stuff Deserves Better"' },
  { month: "Nov 2025", spend: 2100, leads: 58, moveIns: 12, cpl: 36.21, costPerMoveIn: 175, roas: 2.8, occupancy: 73, topAudience: "Life Event – Recently Moved", topCreative: "Carousel: Unit Size Guide" },
  { month: "Dec 2025", spend: 2100, leads: 51, moveIns: 10, cpl: 41.18, costPerMoveIn: 210, roas: 2.4, occupancy: 76, topAudience: "Retargeting – 14-Day Website Visitors", topCreative: "Video: Holiday Declutter" },
  { month: "Jan 2026", spend: 2400, leads: 67, moveIns: 15, cpl: 35.82, costPerMoveIn: 160, roas: 3.1, occupancy: 80, topAudience: "Lookalike 3% – Phone Call Converters", topCreative: 'Static: "$1 First Month" Promo' },
  { month: "Feb 2026", spend: 2400, leads: 74, moveIns: 18, cpl: 32.43, costPerMoveIn: 133.33, roas: 3.6, occupancy: 85, topAudience: "Life Event – Newly Divorced/Separated", topCreative: 'Video: "Move-In in 10 Minutes"' },
  { month: "Mar 2026", spend: 2800, leads: 89, moveIns: 22, cpl: 31.46, costPerMoveIn: 127.27, roas: 4.1, occupancy: 89, topAudience: "Broad + Advantage+ Optimization", topCreative: "UGC: Customer Testimonial Reel" },
];

const LEAD_FEED = [
  { time: "2 min ago", name: "Sarah M.", action: "Submitted lead form", unit: "10x10 Standard", source: "Meta – Lookalike", status: "new" },
  { time: "18 min ago", name: "David K.", action: "Scheduled tour via phone", unit: "10x15 Drive-Up", source: "Meta – Retargeting", status: "tour" },
  { time: "1 hr ago", name: "Jennifer L.", action: "Moved in today", unit: "5x10 Climate", source: "Meta – Life Event", status: "moved_in" },
  { time: "2 hrs ago", name: "Mike R.", action: "Callback completed (< 3 min)", unit: "10x20 Drive-Up", source: "Meta – Broad", status: "contacted" },
  { time: "3 hrs ago", name: "Amanda T.", action: "Moved in today", unit: "10x10 Standard", source: "Meta – Lookalike", status: "moved_in" },
  { time: "5 hrs ago", name: "Chris B.", action: "Submitted lead form", unit: "10x30 Vehicle", source: "Meta – Life Event", status: "new" },
  { time: "Yesterday", name: "Lisa W.", action: "Signed lease online", unit: "5x5 Climate", source: "Meta – Retargeting", status: "moved_in" },
  { time: "Yesterday", name: "Robert H.", action: "Missed call → SMS sent → replied", unit: "10x15 Drive-Up", source: "Meta – Lookalike", status: "contacted" },
];

function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(undefined);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return value;
}

function KpiCard({ icon: Icon, label, value, prefix = "", suffix = "", change, isAccent }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; value: number; prefix?: string; suffix?: string; change?: string; isAccent?: boolean;
}) {
  const animated = useAnimatedNumber(value);
  const display = Number.isInteger(value) ? Math.round(animated) : animated.toFixed(2);

  return (
    <div className="rounded-lg p-4 sm:p-5" style={{
      background: isAccent ? "var(--accent-glow)" : "var(--bg-elevated)",
      border: isAccent ? "1px solid rgba(68,99,134,0.3)" : "1px solid var(--border-subtle)",
    }}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-surface)" }}>
          <Icon size={18} className={isAccent ? "text-[var(--color-blue)]" : "text-[var(--color-mid-gray)]"} />
        </div>
        {change && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
            {change}
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: isAccent ? "var(--accent)" : "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        {prefix}{display}{suffix}
      </p>
      <p className="text-xs mt-1 uppercase font-medium" style={{ color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>{label}</p>
    </div>
  );
}

export default function DemoDashboardClient() {
  const [activeMonth, setActiveMonth] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setActiveMonth((prev) => {
        if (prev >= MONTHS.length - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const visibleData = MONTHS.slice(0, activeMonth + 1);
  const current = MONTHS[activeMonth];
  const totalSpend = visibleData.reduce((s, m) => s + m.spend, 0);
  const totalLeads = visibleData.reduce((s, m) => s + m.leads, 0);
  const totalMoveIns = visibleData.reduce((s, m) => s + m.moveIns, 0);

  const statusStyles: Record<string, { color: string; label: string }> = {
    new: { color: "var(--accent)", label: "New Lead" },
    contacted: { color: "rgba(171,85,5,0.8)", label: "Contacted" },
    tour: { color: "rgba(168,85,247,0.8)", label: "Tour Booked" },
    moved_in: { color: "rgba(34,197,94,0.8)", label: "Moved In" },
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-void)", color: "var(--text-primary)" }}>
      {/* Demo Banner */}
      <div className="text-center py-2 px-4" style={{ background: "var(--accent)" }}>
        <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: "var(--text-inverse)" }}>
          <Eye size={14} />
          <span>You are viewing a <strong>live demo</strong> with simulated data for a fictional facility.</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-[100] border-b" style={{ background: "var(--bg-void)", borderColor: "var(--border-subtle)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 -ml-2 transition-colors" style={{ color: "var(--text-tertiary)" }}>
              <ArrowLeft size={20} />
            </Link>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent)" }}>
              <Building2 size={16} style={{ color: "var(--text-inverse)" }} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{FACILITY.name}</h1>
              <div className="flex items-center gap-2 -mt-0.5">
                <MapPin size={10} style={{ color: "var(--text-tertiary)" }} />
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{FACILITY.location}</p>
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>·</span>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{FACILITY.totalUnits} units</p>
              </div>
            </div>
          </div>
          <Link href="/#cta" className="hidden sm:flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors" style={{ background: "var(--accent)", color: "var(--text-inverse)" }}>
            Get this for your facility <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Welcome Banner */}
        <div className="rounded-xl p-6 mb-6 relative overflow-hidden" style={{ background: "var(--accent)" }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-dark)]/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="relative" style={{ color: "var(--text-inverse)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} style={{ opacity: 0.7 }} />
              <span className="text-xs font-medium" style={{ opacity: 0.7 }}>6-Month Campaign Summary</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-1">
              From {FACILITY.startingOccupancy}% to {MONTHS[MONTHS.length - 1].occupancy}% occupancy
            </h2>
            <p className="text-sm" style={{ opacity: 0.8 }}>
              {MONTHS.reduce((s, m) => s + m.moveIns, 0)} move-ins generated at ${(MONTHS.reduce((s, m) => s + m.spend, 0) / MONTHS.reduce((s, m) => s + m.moveIns, 0)).toFixed(0)} per move-in. Watch the campaign compound month over month.
            </p>
          </div>
        </div>

        {/* Playback */}
        <div className="rounded-lg p-4 flex items-center gap-4 mb-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <button onClick={() => { setIsPlaying(!isPlaying); if (!isPlaying && activeMonth >= 5) setActiveMonth(0); }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {MONTHS.map((m, i) => (
                <button key={m.month}
                  onClick={() => { setActiveMonth(i); setIsPlaying(false); }}
                  className="flex-1 h-2 rounded-full transition-all cursor-pointer"
                  style={{ background: i <= activeMonth ? "var(--accent)" : "var(--bg-surface)" }}
                  title={m.month} />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Month {activeMonth + 1} of 6</span>
              <span className="text-sm font-semibold">{MONTHS[activeMonth].month}</span>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={DollarSign} label="Total Ad Spend" value={totalSpend} prefix="$" change={`Month ${activeMonth + 1}`} />
          <KpiCard icon={Users} label="Total Leads" value={totalLeads} change={`${current.leads} this month`} />
          <KpiCard icon={Target} label="Total Move-Ins" value={totalMoveIns} change={`${current.moveIns} this month`} isAccent />
          <KpiCard icon={TrendingUp} label="Current ROAS" value={current.roas} suffix="x" change={current.roas >= 3 ? "Strong" : "Building"} isAccent />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Occupancy */}
          <div className="rounded-lg p-5 sm:p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">Occupancy trend</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                +{visibleData[visibleData.length - 1].occupancy - FACILITY.startingOccupancy}% from start
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Starting at {FACILITY.startingOccupancy}% → currently {visibleData[visibleData.length - 1].occupancy}%
            </p>
            <ResponsiveChart mobileHeight={180} desktopHeight={220}>
              <AreaChart data={[{ month: "Sep (Start)", occupancy: FACILITY.startingOccupancy }, ...visibleData]} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} />
                <YAxis domain={[55, 100]} tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => [`${v}%`, "Occupancy"]} contentStyle={{ borderRadius: "8px", background: "var(--color-light-gray)", border: "1px solid var(--border-medium)", fontSize: "12px", color: "var(--color-dark)" }} />
                <Area type="monotone" dataKey="occupancy" stroke="var(--color-gold)" strokeWidth={2.5} fill="url(#occGrad)" dot={{ r: 4, fill: "var(--color-gold)", strokeWidth: 2, stroke: "var(--color-light)" }} />
              </AreaChart>
            </ResponsiveChart>
          </div>

          {/* CPL */}
          <div className="rounded-lg p-5 sm:p-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">Cost per lead trend</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                -${(visibleData[0].cpl - visibleData[visibleData.length - 1].cpl).toFixed(0)} reduction
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Cost per lead drops as the system learns who actually moves in</p>
            <ResponsiveChart mobileHeight={180} desktopHeight={220}>
              <BarChart data={visibleData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={40} />
                <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, "CPL"]} contentStyle={{ borderRadius: "8px", background: "var(--color-light-gray)", border: "1px solid var(--border-medium)", fontSize: "12px", color: "var(--color-dark)" }} />
                <Bar dataKey="cpl" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {visibleData.map((_, i) => (
                    <Cell key={i} fill={i === visibleData.length - 1 ? "var(--color-gold)" : "var(--color-mid-gray)"} opacity={0.4 + (i / visibleData.length) * 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveChart>
          </div>
        </div>

        {/* Leads vs Move-Ins */}
        <div className="rounded-lg p-5 sm:p-6 mb-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Leads vs. move-ins</h3>
            <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Avg conversion: {((visibleData.reduce((s, d) => s + d.moveIns, 0) / visibleData.reduce((s, d) => s + d.leads, 0)) * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>Lead volume and move-in conversions by month</p>
          <ResponsiveChart mobileHeight={180} desktopHeight={220}>
            <BarChart data={visibleData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-mid-gray)" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: "8px", background: "var(--color-light-gray)", border: "1px solid var(--border-medium)", fontSize: "12px", color: "var(--color-dark)" }} />
              <Bar dataKey="leads" name="Leads" fill="var(--color-mid-gray)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="moveIns" name="Move-Ins" fill="var(--color-gold)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveChart>
        </div>

        {/* Campaign Intelligence */}
        <div className="rounded-lg p-5 sm:p-6 mb-6" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} style={{ color: "var(--accent)" }} />
            <h3 className="font-semibold">Campaign intelligence: {current.month}</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "Top Performing Audience", value: current.topAudience },
              { label: "Top Creative Asset", value: current.topCreative },
              { label: "Avg. Speed-to-Lead", value: "3.2 minutes", sub: "Industry avg: 47 minutes" },
              { label: "Missed Call Recovery Rate", value: "38%", sub: "12 recovered leads this month" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg p-4" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
                <p className="text-xs uppercase mb-1" style={{ color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
                {item.sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{item.sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Lead Feed & Unit Mix */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Lead Feed */}
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <h3 className="font-semibold">Lead activity feed</h3>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Real-time lead flow (simulated)</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--accent)" }} />
                Live
              </div>
            </div>
            <div>
              {LEAD_FEED.map((lead, i) => {
                const s = statusStyles[lead.status];
                return (
                  <div key={i} className="px-5 py-3.5 transition-colors" style={{ borderBottom: i < LEAD_FEED.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm">{lead.name}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--bg-surface)", color: s.color }}>{s.label}</span>
                        </div>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{lead.action}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{lead.unit}</span>
                          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>via {lead.source}</span>
                        </div>
                      </div>
                      <span className="text-xs whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>{lead.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unit Mix */}
          <div className="rounded-lg overflow-hidden" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 className="font-semibold">Unit mix performance</h3>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Campaign performance segmented by unit type</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-surface)" }}>
                    {["Unit Type", "Rate", "Vacant", "Filled", "MRR"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium text-xs uppercase text-left" style={{ color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FACILITY.unitMix.map((u, i) => {
                    const filled = Math.min(u.vacancy, Math.round(u.vacancy * 0.78 + i * 0.5));
                    const mrr = filled * u.rate;
                    return (
                      <tr key={u.type} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                        <td className="px-4 py-3 font-medium">{u.type}</td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>${u.rate}/mo</td>
                        <td className="px-4 py-3" style={{ color: "rgba(239,68,68,0.8)" }}>{u.vacancy}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--accent)" }}>{filled}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--accent)" }}>+${mrr.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="rounded-lg overflow-hidden mb-6" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="font-semibold">Monthly campaign performance</h3>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Full metrics by month. The numbers that matter</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-surface)" }}>
                  {["Month", "Ad Spend", "Leads", "CPL", "Move-Ins", "Cost/Move-In", "ROAS", "Occupancy"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium text-xs uppercase text-right first:text-left" style={{ color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleData.map((m) => (
                  <tr key={m.month} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <td className="px-4 py-3 font-medium">{m.month}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>${m.spend.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>{m.leads}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>${m.cpl.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--accent)" }}>{m.moveIns}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--text-secondary)" }}>${m.costPerMoveIn.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: m.roas >= 3.5 ? "var(--accent)" : "var(--text-secondary)" }}>{m.roas}x</td>
                    <td className="px-4 py-3 text-right font-medium">{m.occupancy}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold" style={{ borderTop: "2px solid var(--border-medium)", background: "var(--bg-surface)" }}>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">${totalSpend.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{totalLeads}</td>
                  <td className="px-4 py-3 text-right">${(totalSpend / totalLeads).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: "var(--accent)" }}>{totalMoveIns}</td>
                  <td className="px-4 py-3 text-right">${(totalSpend / totalMoveIns).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right">—</td>
                  <td className="px-4 py-3 text-right">{visibleData[visibleData.length - 1].occupancy}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--bg-primary)", border: "1px solid var(--border-subtle)" }}>
          <Megaphone size={32} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-xl sm:text-2xl font-semibold mb-2">Ready to see these numbers for your facility?</h3>
          <p className="max-w-lg mx-auto mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            Every facility is different. Our free audit analyzes your specific market, unit mix, and competition to project what campaigns could deliver for you.
          </p>
          <Link href="/#cta" className="btn-primary inline-flex items-center gap-2">
            Get a Free Facility Audit <ArrowUpRight size={16} />
          </Link>
        </div>

        <p className="text-center text-xs mt-6 mb-8" style={{ color: "var(--text-tertiary)" }}>
          This is a demonstration dashboard with simulated data. Actual results vary by facility, market, and ad spend. All metrics shown are illustrative of typical campaign performance patterns.
        </p>
      </div>
    </div>
  );
}
