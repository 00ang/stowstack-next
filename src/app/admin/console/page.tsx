"use client";

import { useMemo } from "react";
import { useFacility } from "@/lib/facility-context";
import { useAdminFetch } from "@/hooks/use-admin-fetch";
import {
  rankAttention,
  severityCounts,
  buildPortfolioPulse,
  buildFacilityPulse,
  campaignAlertsToAttention,
  pmsQueueToAttention,
  stalledLeadsToAttention,
  occupancyInsightsToAttention,
  revenueToAttention,
  conversionReportsToAttention,
  relativeTime,
  formatInt,
  type AdminFacility,
  type FounderDigest,
  type LeadAnalytics,
  type CampaignAlertsResponse,
  type PmsQueueResponse,
  type AdminLeadsResponse,
  type OccupancyIntelligence,
  type RevenueIntelligence,
  type ConversionReportsResponse,
} from "@/lib/console";
import { ConsoleSection } from "@/components/admin/console/console-section";
import { ConsolePulse } from "@/components/admin/console/console-pulse";
import { ConsoleAttention } from "@/components/admin/console/console-attention";
import { ConsoleToolkit } from "@/components/admin/console/console-toolkit";

// Stable param references so useAdminFetch doesn't re-key each render.
const PENDING_PMS = { status: "pending" } as const;
const RECENT_LEADS = { limit: "100" } as const;
const REPORTS_ATTENTION = { status: "attention" } as const;

const ATTENTION_LIMIT = 8;

function criticalMeta(critical: number): string | undefined {
  return critical > 0 ? `${formatInt(critical)} critical` : undefined;
}

/** Portfolio ("all" scope) workbench — cheap, honest portfolio-wide vitals. */
function PortfolioWorkbench({ facilities }: { facilities: AdminFacility[] }) {
  const digest = useAdminFetch<FounderDigest>("/api/admin-founder-digest");
  const analytics = useAdminFetch<LeadAnalytics>("/api/lead-analytics");
  const alerts = useAdminFetch<CampaignAlertsResponse>("/api/campaign-alerts");
  const pms = useAdminFetch<PmsQueueResponse>("/api/admin-pms-queue", PENDING_PMS);
  const leads = useAdminFetch<AdminLeadsResponse>("/api/admin-leads", RECENT_LEADS);
  const reports = useAdminFetch<ConversionReportsResponse>("/api/admin-conversion-reports", REPORTS_ATTENTION);

  const attention = useMemo(
    () =>
      rankAttention(
        [
          campaignAlertsToAttention(alerts.data),
          pmsQueueToAttention(pms.data),
          stalledLeadsToAttention(leads.data),
          conversionReportsToAttention(reports.data),
        ],
        ATTENTION_LIMIT,
      ),
    [alerts.data, pms.data, leads.data, reports.data],
  );
  const counts = useMemo(() => severityCounts(attention), [attention]);
  const metrics = useMemo(
    () =>
      buildPortfolioPulse({
        digest: digest.data,
        analytics: analytics.data,
        facilities,
        attention: counts,
      }),
    [digest.data, analytics.data, facilities, counts],
  );

  const pulseLoading = digest.loading && analytics.loading;
  const attnLoading = alerts.loading && pms.loading && leads.loading;
  const pulseMeta = digest.data?.generatedAt
    ? `updated ${relativeTime(digest.data.generatedAt)}`
    : undefined;

  return (
    <>
      <section>
        <ConsoleSection index={1} title="Portfolio pulse" meta={pulseMeta} />
        <ConsolePulse metrics={metrics} loading={pulseLoading} />
      </section>
      <section>
        <ConsoleSection index={2} title="Needs attention" count={counts.total} meta={criticalMeta(counts.critical)} />
        <ConsoleAttention items={attention} loading={attnLoading} />
      </section>
    </>
  );
}

/** Single-facility workbench — richer per-facility intelligence when scoped. */
function FacilityWorkbench({ facilityId, facilityName }: { facilityId: string; facilityName: string }) {
  const facilityParams = useMemo(() => ({ facilityId }), [facilityId]);
  const pmsParams = useMemo(() => ({ facilityId, status: "pending" }), [facilityId]);

  const occupancy = useAdminFetch<OccupancyIntelligence>("/api/occupancy-intelligence", facilityParams);
  const revenue = useAdminFetch<RevenueIntelligence>("/api/revenue-intelligence", facilityParams);
  const alerts = useAdminFetch<CampaignAlertsResponse>("/api/campaign-alerts");
  const pms = useAdminFetch<PmsQueueResponse>("/api/admin-pms-queue", pmsParams);
  const reportParams = useMemo(() => ({ facilityId, status: "attention" }), [facilityId]);
  const reports = useAdminFetch<ConversionReportsResponse>("/api/admin-conversion-reports", reportParams);

  const attention = useMemo(
    () =>
      rankAttention(
        [
          occupancyInsightsToAttention(occupancy.data, facilityName),
          revenueToAttention(revenue.data, facilityName),
          campaignAlertsToAttention(alerts.data, { facilityName }),
          pmsQueueToAttention(pms.data, { facilityName }),
          conversionReportsToAttention(reports.data, { facilityName }),
        ],
        ATTENTION_LIMIT,
      ),
    [occupancy.data, revenue.data, alerts.data, pms.data, reports.data, facilityName],
  );
  const counts = useMemo(() => severityCounts(attention), [attention]);
  const metrics = useMemo(
    () => buildFacilityPulse({ occupancy: occupancy.data, revenue: revenue.data, attention: counts }),
    [occupancy.data, revenue.data, counts],
  );

  const pulseLoading = occupancy.loading && revenue.loading;
  const attnLoading = occupancy.loading && revenue.loading && alerts.loading && pms.loading;

  return (
    <>
      <section>
        <ConsoleSection index={1} title="Pulse" meta={facilityName} />
        <ConsolePulse metrics={metrics} loading={pulseLoading} />
      </section>
      <section>
        <ConsoleSection index={2} title="Needs attention" count={counts.total} meta={criticalMeta(counts.critical)} />
        <ConsoleAttention
          items={attention}
          loading={attnLoading}
          emptyLabel={`No signals for ${facilityName} right now.`}
        />
      </section>
    </>
  );
}

export default function ConsolePage() {
  const { currentId, current, facilities } = useFacility();

  const adminFacilities = useMemo<AdminFacility[]>(
    () => facilities.map((f) => ({ id: f.id, name: f.name, status: f.status })),
    [facilities],
  );

  const facilityName = current === "all" ? "" : current.name;
  const scopeLabel = current === "all" ? "All facilities" : current.name;
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  const mastheadMeta = `${dateStr} · ${facilities.length} ${facilities.length === 1 ? "facility" : "facilities"}`;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      <ConsoleSection index={0} title="The Console" meta={mastheadMeta} />

      {currentId === "all" ? (
        <PortfolioWorkbench facilities={adminFacilities} />
      ) : (
        <FacilityWorkbench key={currentId} facilityId={currentId} facilityName={facilityName} />
      )}

      <section>
        <ConsoleSection index={3} title="Toolkit" meta={`scoped to ${scopeLabel.toLowerCase()}`} />
        <ConsoleToolkit scopeId={currentId} />
      </section>
    </div>
  );
}
