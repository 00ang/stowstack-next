import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#141413",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#446386",
    paddingBottom: 12,
  },
  logo: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  logoAds: {
    color: "#446386",
  },
  subtitle: {
    fontSize: 11,
    color: "#6a6560",
    marginTop: 4,
  },
  dateRange: {
    fontSize: 9,
    color: "#b0aea5",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 8,
    color: "#141413",
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  kpiLabel: {
    width: "50%",
    fontSize: 10,
    color: "#6a6560",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e8e6dc",
  },
  kpiValue: {
    width: "50%",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e8e6dc",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#faf9f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e6dc",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6a6560",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e6dc",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 9,
    color: "#141413",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#b0aea5",
    borderTopWidth: 1,
    borderTopColor: "#e8e6dc",
    paddingTop: 8,
  },
});

interface SummaryData {
  facilityName: string;
  period: { start: string; end: string };
  totalSpend: string;
  totalImpressions: number;
  totalClicks: number;
  ctr: string;
  totalLeads: number;
  totalCalls: number;
  qualifiedCalls: number;
  costPerLead: string;
}

interface CampaignRow {
  date?: string;
  campaign: string;
  platform?: string;
  spend: string;
  impressions: number;
  clicks: number;
  ctr?: string;
  avgDailySpend?: string;
}

interface ReportPDFProps {
  type: string;
  summary?: SummaryData;
  campaigns?: CampaignRow[];
  baselineOccupancy?: number | null;
  baselineDate?: string | null;
}

function ReportPDF({ type, summary, campaigns, baselineOccupancy, baselineDate }: ReportPDFProps) {
  const title =
    type === "monthly_performance"
      ? "Monthly Performance Report"
      : type === "campaign_detail"
        ? "Campaign Detail Report"
        : type === "attribution"
          ? "Move-in Attribution Report"
          : "Report";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>
            storage<Text style={styles.logoAds}>ads</Text>
          </Text>
          <Text style={styles.subtitle}>{title}</Text>
          {summary && (
            <>
              <Text style={styles.subtitle}>{summary.facilityName}</Text>
              <Text style={styles.dateRange}>
                {summary.period.start} — {summary.period.end}
              </Text>
            </>
          )}
        </View>

        {/* KPI Summary */}
        {summary && (
          <View>
            <Text style={styles.sectionTitle}>Key Metrics</Text>
            {[
              ["Ad Spend", `$${summary.totalSpend}`],
              ["Impressions", String(summary.totalImpressions)],
              ["Clicks", String(summary.totalClicks)],
              ["CTR", `${summary.ctr}%`],
              ["Leads", String(summary.totalLeads)],
              ["Total Calls", String(summary.totalCalls)],
              ["Qualified Calls (30s+)", String(summary.qualifiedCalls)],
              ["Cost per Lead", summary.costPerLead === "N/A" ? "N/A" : `$${summary.costPerLead}`],
            ].map(([label, value]) => (
              <View style={styles.kpiRow} key={label}>
                <Text style={styles.kpiLabel}>{label}</Text>
                <Text style={styles.kpiValue}>{value}</Text>
              </View>
            ))}

            {/* Baseline comparison */}
            {baselineOccupancy != null && baselineDate && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.sectionTitle, { fontSize: 11 }]}>Baseline Comparison</Text>
                <View style={styles.kpiRow}>
                  <Text style={styles.kpiLabel}>Pre-StorageAds Occupancy ({baselineDate})</Text>
                  <Text style={styles.kpiValue}>{baselineOccupancy.toFixed(1)}%</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Campaign Table */}
        {campaigns && campaigns.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>Campaign Breakdown</Text>
            <View style={styles.tableHeader}>
              {campaigns[0].date && <Text style={[styles.tableHeaderCell, { width: "15%" }]}>Date</Text>}
              <Text style={[styles.tableHeaderCell, { width: campaigns[0].date ? "25%" : "35%" }]}>Campaign</Text>
              {campaigns[0].platform && <Text style={[styles.tableHeaderCell, { width: "12%" }]}>Platform</Text>}
              <Text style={[styles.tableHeaderCell, { width: "12%", textAlign: "right" }]}>Spend</Text>
              <Text style={[styles.tableHeaderCell, { width: "13%", textAlign: "right" }]}>Impr.</Text>
              <Text style={[styles.tableHeaderCell, { width: "11%", textAlign: "right" }]}>Clicks</Text>
              {campaigns[0].ctr && <Text style={[styles.tableHeaderCell, { width: "10%", textAlign: "right" }]}>CTR</Text>}
            </View>
            {campaigns.slice(0, 50).map((c, i) => (
              <View style={styles.tableRow} key={i}>
                {c.date && <Text style={[styles.tableCell, { width: "15%" }]}>{c.date}</Text>}
                <Text style={[styles.tableCell, { width: c.date ? "25%" : "35%" }]}>{c.campaign}</Text>
                {c.platform && <Text style={[styles.tableCell, { width: "12%" }]}>{c.platform}</Text>}
                <Text style={[styles.tableCell, { width: "12%", textAlign: "right" }]}>${c.spend}</Text>
                <Text style={[styles.tableCell, { width: "13%", textAlign: "right" }]}>{c.impressions}</Text>
                <Text style={[styles.tableCell, { width: "11%", textAlign: "right" }]}>{c.clicks}</Text>
                {c.ctr && <Text style={[styles.tableCell, { width: "10%", textAlign: "right" }]}>{c.ctr}%</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by StorageAds.com — storageads.com
        </Text>
      </Page>
    </Document>
  );
}

export async function generatePdfReport(props: ReportPDFProps): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReportPDF {...props} />);
  return Buffer.from(buffer);
}
