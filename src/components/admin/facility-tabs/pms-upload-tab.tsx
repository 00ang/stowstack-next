"use client";

import { useState, useCallback, useRef } from "react";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Info,
} from "lucide-react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import type { PmsData } from "./pms-dashboard-types";
import { fmtDate, parseCSVLine } from "./pms-dashboard-types";
import {
  type UploadType,
  UPLOAD_TYPES,
  EXPECTED_COLUMNS,
  autoMapColumns,
  isOptionalColumn,
} from "@/lib/pms-column-mapper";

/* ── main upload component ── */

export function UploadTab({
  facilityId,
  onImported,
}: {
  facilityId: string;
  onImported: () => void;
}) {
  const [uploadType, setUploadType] = useState<UploadType>("rent_roll");
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      setResult(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) return;

        // Parse headers
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        setParsedHeaders(headers);

        // Auto-map columns
        const expected = EXPECTED_COLUMNS[uploadType];
        setColumnMap(autoMapColumns(headers, expected));

        // Parse rows (limit preview to 200)
        const dataRows: Record<string, string>[] = [];
        for (let i = 1; i < Math.min(lines.length, 201); i++) {
          const vals = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, j) => {
            row[h] = vals[j] ?? "";
          });
          dataRows.push(row);
        }
        setParsedRows(dataRows);
      };
      reader.readAsText(f);
    },
    [uploadType]
  );

  const handleImport = async () => {
    if (!parsedRows.length) return;
    setImporting(true);
    setResult(null);

    const expected = EXPECTED_COLUMNS[uploadType];
    const mappedRows = parsedRows.map((row) => {
      const out: Record<string, string> = {};
      for (const exp of expected) {
        const srcCol = columnMap[exp];
        out[exp] = srcCol ? row[srcCol] ?? "" : "";
      }
      return out;
    });

    // Read ALL rows from the file (not just preview)
    let allRows = mappedRows;
    if (file) {
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        allRows = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = parseCSVLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, j) => {
            row[h] = vals[j] ?? "";
          });
          const mapped: Record<string, string> = {};
          for (const exp of expected) {
            const srcCol = columnMap[exp];
            mapped[exp] = srcCol ? row[srcCol] ?? "" : "";
          }
          allRows.push(mapped);
        }
      } catch {
        // Fall back to preview rows
      }
    }

    try {
      const actionMap: Record<UploadType, string> = {
        rent_roll: "import_rent_roll",
        aging: "import_aging",
        revenue: "import_revenue",
      };

      const body: Record<string, unknown> = {
        action: actionMap[uploadType],
        facility_id: facilityId,
        rows: allRows,
      };
      if (uploadType !== "revenue") {
        body.snapshot_date = snapshotDate;
      }

      const res = await adminFetch<{ ok: boolean; imported?: number; upserted?: number }>(
        "/api/pms-data",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      const count = res.imported ?? res.upserted ?? allRows.length;
      setResult({
        ok: true,
        message: `Successfully imported ${count} rows.`,
      });
      onImported();
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setColumnMap({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const expected = EXPECTED_COLUMNS[uploadType];
  // Optional columns (phone/email on a rent roll) never block an import.
  const allMapped = expected.every((e) => isOptionalColumn(uploadType, e) || !!columnMap[e]);

  return (
    <div className="space-y-6">
      {/* Upload type selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {UPLOAD_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setUploadType(t.key);
              handleReset();
            }}
            className={`p-4 rounded-xl border text-left transition ${
              uploadType === t.key
                ? "bg-[var(--color-gold)]/10 border-[var(--color-gold)]/30 text-[var(--color-dark)]"
                : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--color-body-text)] hover:border-[var(--border-medium)]"
            }`}
          >
            <div className="text-sm font-medium">{t.label}</div>
            <div className="text-xs text-[var(--color-mid-gray)] mt-1">{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Date picker (for rent_roll and aging) */}
      {uploadType !== "revenue" && (
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--color-body-text)]">Snapshot Date:</label>
          <input
            type="date"
            value={snapshotDate}
            onChange={(e) => setSnapshotDate(e.target.value)}
            className="px-3 py-2 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50"
          />
        </div>
      )}

      {/* File upload */}
      <div
        className="border-2 border-dashed border-[var(--border-medium)] rounded-xl p-8 text-center hover:border-[var(--color-gold)]/30 transition cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <div className="space-y-2">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-[var(--color-gold)]" />
            <p className="text-sm text-[var(--color-dark)] font-medium">{file.name}</p>
            <p className="text-xs text-[var(--color-mid-gray)]">
              {parsedRows.length} rows parsed |{" "}
              {parsedHeaders.length} columns detected
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove file
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-[var(--color-mid-gray)]" />
            <p className="text-sm text-[var(--color-body-text)]">
              Click or drag a CSV file here
            </p>
            <p className="text-xs text-[var(--color-mid-gray)]">
              Supports .csv files
            </p>
          </div>
        )}
      </div>

      {/* Column mapping */}
      {parsedHeaders.length > 0 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
          <h3 className="text-sm font-medium text-[var(--color-dark)] mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--color-gold)]" />
            Column Mapping
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expected.map((exp) => (
              <div key={exp} className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-body-text)] w-36 shrink-0 font-mono">
                  {exp}
                  {isOptionalColumn(uploadType, exp) && (
                    <span className="ml-1 font-sans text-[10px] text-[var(--color-mid-gray)]">optional</span>
                  )}
                </span>
                <ChevronRight className="w-3 h-3 text-[var(--color-mid-gray)] shrink-0" />
                <select
                  value={columnMap[exp] ?? ""}
                  onChange={(e) =>
                    setColumnMap((m) => ({ ...m, [exp]: e.target.value }))
                  }
                  className="flex-1 px-2 py-1.5 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded text-sm text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50"
                >
                  <option value="">— select —</option>
                  {parsedHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {columnMap[exp] ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : isOptionalColumn(uploadType, exp) ? (
                  <span className="w-4 h-4 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {parsedRows.length > 0 && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
          <h3 className="text-sm font-medium text-[var(--color-dark)] mb-4">
            Preview (first {Math.min(parsedRows.length, 5)} rows)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-light-gray)]">
                  {expected.map((col) => (
                    <th
                      key={col}
                      className="px-2 py-1.5 text-left font-medium text-[var(--color-mid-gray)] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {parsedRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {expected.map((exp) => {
                      const srcCol = columnMap[exp];
                      return (
                        <td
                          key={exp}
                          className="px-2 py-1.5 text-[var(--color-body-text)] whitespace-nowrap max-w-[150px] truncate"
                        >
                          {srcCol ? row[srcCol] ?? "" : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {parsedRows.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleImport}
            disabled={importing || !allMapped}
            className="px-6 py-2.5 bg-[var(--color-gold)] text-[var(--color-light)] text-sm font-medium rounded-lg hover:bg-[var(--color-gold)]/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import {parsedRows.length} Rows
              </>
            )}
          </button>
          {!allMapped && (
            <span className="text-xs text-yellow-400">
              Map all required columns before importing
            </span>
          )}
        </div>
      )}

      {/* Result message */}
      {result && (
        <div
          className={`p-4 rounded-xl border ${
            result.ok
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {result.ok ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <span className="text-sm">{result.message}</span>
          </div>
        </div>
      )}

      {/* Recent uploads */}
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl p-6">
        <h3 className="text-sm font-medium text-[var(--color-dark)] mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[var(--color-mid-gray)]" />
          Recent PMS Report Uploads
        </h3>
        <RecentUploads facilityId={facilityId} />
      </div>
    </div>
  );
}

function RecentUploads({ facilityId }: { facilityId: string }) {
  const { data, refetch } = useAdminFetch<PmsData>("/api/pms-data", { facilityId });
  const reports = data?.pmsReports ?? [];
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const processReport = async (reportId: string) => {
    setProcessingId(reportId);
    setRowError(null);
    try {
      await adminFetch("/api/pms-data", {
        method: "POST",
        body: JSON.stringify({
          action: "process_report",
          facility_id: facilityId,
          report_id: reportId,
        }),
      });
      refetch?.();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Failed to process report");
    } finally {
      setProcessingId(null);
    }
  };

  if (reports.length === 0) {
    return (
      <p className="text-xs text-[var(--color-mid-gray)]">No uploads found.</p>
    );
  }

  return (
    <div className="space-y-2">
      {rowError && (
        <p className="text-xs text-red-400">{rowError}</p>
      )}
      {reports.map((r) => {
        const status = r.status ?? "uploaded";
        const canProcess = status === "needs_review" || status === "uploaded";
        return (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 px-3 py-2 bg-[var(--color-light-gray)] rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4 text-[var(--color-mid-gray)]" />
            <span className="text-sm text-[var(--color-dark)] flex-1 min-w-[120px]">
              {r.file_name ?? "report.csv"}
            </span>
            <span className="text-xs text-[var(--color-mid-gray)] px-2 py-0.5 bg-[var(--color-light-gray)] rounded">
              {r.report_type ?? "unknown"}
            </span>
            <StatusPill status={status} />
            <span className="text-xs text-[var(--color-mid-gray)]">
              {fmtDate(r.uploaded_at)}
            </span>
            {canProcess && (
              <button
                onClick={() => processReport(r.id)}
                disabled={processingId === r.id}
                className="text-xs px-2.5 py-1 rounded-md bg-[var(--color-dark)] text-[var(--color-light)] hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1"
              >
                {processingId === r.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {status === "needs_review" ? "Approve & Import" : "Process"}
              </button>
            )}
            {r.notes && (
              <span className="basis-full text-[11px] text-[var(--color-mid-gray)]">
                {r.notes}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    processed: "text-green-500 bg-green-500/10",
    needs_review: "text-yellow-500 bg-yellow-500/10",
    uploaded: "text-[var(--color-mid-gray)] bg-[var(--color-light-gray)]",
    error: "text-red-400 bg-red-500/10",
  };
  const cls = map[status] ?? map.uploaded;
  return (
    <span className={`text-xs px-2 py-0.5 rounded capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
