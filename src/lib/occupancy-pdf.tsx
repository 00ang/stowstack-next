import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/**
 * Occupancy / PMS report PDF (M8) for self-serve download from /portal/reports.
 * Mirrors the on-screen report (snapshot KPIs + unit mix). Distinct from
 * src/lib/pdf-report.tsx, which renders the campaign/attribution report.
 */

export interface OccupancyPdfProps {
  facilityName: string;
  generatedAt: string; // ISO
  signedAt?: string | null;
  occupancy: {
    total_units: number;
    occupied_units: number;
    occupancy_pct: number;
    move_ins_mtd: number;
    move_outs_mtd: number;
    delinquency_pct: number | null;
  } | null;
  unitMix: Array<{
    type: string;
    size: string;
    total: number;
    occupied: number;
    rate: number;
  }>;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#141413" },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#446386",
    paddingBottom: 12,
  },
  logo: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  logoAds: { color: "#446386" },
  subtitle: { fontSize: 11, color: "#6a6560", marginTop: 4 },
  meta: { fontSize: 9, color: "#b0aea5", marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 20,
    marginBottom: 8,
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiCard: {
    width: "33.33%",
    paddingVertical: 8,
    paddingRight: 10,
  },
  kpiLabel: { fontSize: 8, color: "#6a6560", textTransform: "uppercase" },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e6df",
    paddingBottom: 5,
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0eee8",
  },
  cell: { flex: 1, fontSize: 9 },
  cellRight: { flex: 1, fontSize: 9, textAlign: "right" },
  th: { fontSize: 8, color: "#6a6560", textTransform: "uppercase" },
  thRight: { fontSize: 8, color: "#6a6560", textTransform: "uppercase", textAlign: "right" },
  empty: { fontSize: 10, color: "#6a6560", marginTop: 6 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#b0aea5",
    borderTopWidth: 1,
    borderTopColor: "#e8e6df",
    paddingTop: 8,
  },
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function money(n: number) {
  return "$" + Number(n || 0).toLocaleString("en-US");
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function ReportDoc(props: OccupancyPdfProps) {
  const { facilityName, generatedAt, signedAt, occupancy, unitMix } = props;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            storage<Text style={styles.logoAds}>ads</Text>
          </Text>
          <Text style={styles.subtitle}>Occupancy & Performance Report</Text>
          <Text style={styles.meta}>
            {facilityName} &middot; Generated {fmtDate(generatedAt)}
            {signedAt ? ` · StorageAds since ${fmtDate(signedAt)}` : ""}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Occupancy Snapshot</Text>
        {occupancy ? (
          <View style={styles.kpiGrid}>
            <Kpi label="Occupancy" value={`${occupancy.occupancy_pct.toFixed(1)}%`} />
            <Kpi label="Total Units" value={String(occupancy.total_units)} />
            <Kpi label="Occupied Units" value={String(occupancy.occupied_units)} />
            <Kpi label="Move-Ins (MTD)" value={String(occupancy.move_ins_mtd)} />
            <Kpi label="Move-Outs (MTD)" value={String(occupancy.move_outs_mtd)} />
            {occupancy.delinquency_pct != null && (
              <Kpi label="Delinquency" value={`${occupancy.delinquency_pct.toFixed(1)}%`} />
            )}
          </View>
        ) : (
          <Text style={styles.empty}>
            No PMS data available yet. Data appears once your management report is uploaded.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Unit Mix</Text>
        {unitMix.length > 0 ? (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.th]}>Type</Text>
              <Text style={[styles.cell, styles.th]}>Size</Text>
              <Text style={[styles.cellRight, styles.thRight]}>Total</Text>
              <Text style={[styles.cellRight, styles.thRight]}>Occupied</Text>
              <Text style={[styles.cellRight, styles.thRight]}>Occ %</Text>
              <Text style={[styles.cellRight, styles.thRight]}>Rate</Text>
            </View>
            {unitMix.map((u, i) => {
              const pct = u.total > 0 ? (u.occupied / u.total) * 100 : 0;
              return (
                <View style={styles.row} key={i}>
                  <Text style={styles.cell}>{u.type}</Text>
                  <Text style={styles.cell}>{u.size || "—"}</Text>
                  <Text style={styles.cellRight}>{u.total}</Text>
                  <Text style={styles.cellRight}>{u.occupied}</Text>
                  <Text style={styles.cellRight}>{pct.toFixed(0)}%</Text>
                  <Text style={styles.cellRight}>{money(u.rate)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>No unit mix data available yet.</Text>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `StorageAds · storageads.com · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

export async function generateOccupancyPdf(props: OccupancyPdfProps): Promise<Buffer> {
  return renderToBuffer(<ReportDoc {...props} />);
}
