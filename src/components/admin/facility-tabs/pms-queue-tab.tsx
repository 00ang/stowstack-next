"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  Info,
  Zap,
  Upload,
  X,
  MessageSquare,
} from "lucide-react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import {
  type UploadType,
  UPLOAD_TYPES,
  EXPECTED_COLUMNS,
  parseCSVText,
  autoMapColumns,
  mapRows,
  isOptionalColumn,
} from "@/lib/pms-column-mapper";

/* ── types ── */

interface QueueReport {
  id: string;
  facility_id: string;
  facility_name: string | null;
  email: string | null;
  report_type: string | null;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  notes: string | null;
  processed_at: string | null;
  processed_by: string | null;
  uploaded_at: string | null;
}

/* ── helpers ── */

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isCSV(mime: string | null, name: string | null) {
  return mime === "text/csv" || name?.toLowerCase().endsWith(".csv");
}

function statusColor(status: string) {
  switch (status) {
    case "uploaded":
      return "bg-[var(--color-light-gray)] text-[var(--color-body-text)]";
    case "processing":
      return "bg-[var(--color-gold-light)] text-[var(--color-gold)]";
    case "processed":
      return "bg-[var(--color-green)]/10 text-[var(--color-green)]";
    case "error":
      return "bg-[var(--color-red)]/10 text-[var(--color-red)]";
    default:
      return "bg-[var(--color-light-gray)] text-[var(--color-body-text)]";
  }
}

/* ── main component ── */

export function PmsQueueTab({
  facilityId,
  onImported,
}: {
  facilityId: string;
  onImported: () => void;
}) {
  const { data, loading, refetch } = useAdminFetch<{ reports: QueueReport[] }>(
    "/api/admin-pms-queue",
    { facilityId }
  );

  const [processing, setProcessing] = useState<string | null>(null); // report id being processed
  const [notesInput, setNotesInput] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const reports = data?.reports ?? [];

  const updateStatus = async (id: string, status: string, notes?: string) => {
    setUpdating(id);
    try {
      await adminFetch("/api/admin-pms-queue", {
        method: "PATCH",
        body: JSON.stringify({ id, status, notes, processed_by: "admin" }),
      });
      refetch();
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-gold)]" />
        <span className="ml-2 text-sm text-[var(--color-body-text)]">Loading queue...</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <Upload className="w-8 h-8 mx-auto mb-3 text-[var(--color-mid-gray)]" />
        <p className="text-sm text-[var(--color-body-text)]">
          No client uploads for this facility yet.
        </p>
        <p className="text-xs text-[var(--color-mid-gray)] mt-1">
          Uploads from the client portal will appear here for processing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-[var(--color-mid-gray)]">
        <span>{reports.length} upload{reports.length !== 1 ? "s" : ""}</span>
        <span>{reports.filter((r) => r.status === "uploaded").length} pending</span>
        <span>{reports.filter((r) => r.status === "processed").length} processed</span>
      </div>

      {/* Report list */}
      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-xl overflow-hidden"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {isCSV(report.mime_type, report.file_name) ? (
                <FileSpreadsheet className="w-5 h-5 text-[var(--color-green)] shrink-0" />
              ) : (
                <FileText className="w-5 h-5 text-[var(--color-blue)] shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-dark)] truncate">
                  {report.file_name ?? "report"}
                </p>
                <p className="text-xs text-[var(--color-mid-gray)]">
                  {fmtSize(report.file_size)} &middot; {fmtDate(report.uploaded_at)}
                  {report.email && <> &middot; {report.email}</>}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize shrink-0 ${statusColor(report.status)}`}
              >
                {report.status}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {report.file_url && (
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[var(--color-mid-gray)] hover:text-[var(--color-dark)] transition"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}

                {isCSV(report.mime_type, report.file_name) &&
                  report.file_url &&
                  report.status !== "processed" && (
                    <button
                      onClick={() =>
                        setProcessing(processing === report.id ? null : report.id)
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-[var(--color-gold)] text-[var(--color-light)] rounded-lg hover:bg-[var(--color-gold-hover)] transition"
                    >
                      Process CSV
                    </button>
                  )}

                {report.status === "uploaded" && (
                  <button
                    onClick={() =>
                      updateStatus(
                        report.id,
                        "processed",
                        notesInput[report.id] || undefined,
                      )
                    }
                    disabled={updating === report.id}
                    className="px-3 py-1.5 text-xs font-medium border border-[var(--color-green)]/30 text-[var(--color-green)] rounded-lg hover:bg-[var(--color-green)]/10 transition disabled:opacity-50"
                  >
                    {updating === report.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Mark Done"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Notes input for pending reports */}
            {report.status !== "processed" && (
              <div className="flex items-center gap-2 px-4 pb-3">
                <MessageSquare className="w-3.5 h-3.5 text-[var(--color-mid-gray)] shrink-0" />
                <input
                  type="text"
                  placeholder="Add processing notes..."
                  value={notesInput[report.id] ?? report.notes ?? ""}
                  onChange={(e) =>
                    setNotesInput((prev) => ({
                      ...prev,
                      [report.id]: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    const val = notesInput[report.id];
                    if (val !== undefined && val !== (report.notes ?? "")) {
                      updateStatus(report.id, report.status, val);
                    }
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-transparent border-b border-[var(--border-subtle)] text-[var(--color-body-text)] focus:outline-none focus:border-[var(--color-gold)]/50"
                />
              </div>
            )}

            {/* Processed notes */}
            {report.status === "processed" && report.notes && (
              <div className="px-4 pb-3 text-xs text-[var(--color-body-text)]">
                <span className="text-[var(--color-mid-gray)]">Notes:</span> {report.notes}
              </div>
            )}

            {/* CSV Processing Panel */}
            {processing === report.id && report.file_url && (
              <CSVProcessor
                reportId={report.id}
                fileUrl={report.file_url}
                facilityId={facilityId}
                onDone={() => {
                  setProcessing(null);
                  updateStatus(report.id, "processed", notesInput[report.id] || "Auto-processed from CSV");
                  onImported();
                }}
                onCancel={() => setProcessing(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── CSV Processor ── */

function CSVProcessor({
  fileUrl,
  facilityId,
  onDone,
  onCancel,
}: {
  reportId: string;
  fileUrl: string;
  facilityId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [uploadType, setUploadType] = useState<UploadType>("rent_roll");
  const [snapshotDate, setSnapshotDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [fetchingCSV, setFetchingCSV] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const csvTextRef = useRef<string>("");

  /* Fetch and parse CSV */
  const fetchCSV = useCallback(async () => {
    setFetchingCSV(true);
    setResult(null);
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error("Failed to fetch file");
      const text = await res.text();
      csvTextRef.current = text;

      const { headers: h, rows: r } = parseCSVText(text);
      setHeaders(h);
      setRows(r.slice(0, 200)); // preview limit

      // Auto-map
      const expected = EXPECTED_COLUMNS[uploadType];
      setColumnMap(autoMapColumns(h, expected));
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to load CSV",
      });
    } finally {
      setFetchingCSV(false);
    }
  }, [fileUrl, uploadType]);

  useEffect(() => {
    fetchCSV();
  }, [fetchCSV]);

  /* Auto-process: try importing with auto-mapped columns */
  const autoProcess = async () => {
    const expected = EXPECTED_COLUMNS[uploadType];
    const allMapped = expected.every((e) => isOptionalColumn(uploadType, e) || !!columnMap[e]);
    if (!allMapped) {
      setResult({ ok: false, message: "Cannot auto-process: not all columns could be mapped automatically." });
      return;
    }
    await handleImport();
  };

  /* Import */
  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    const expected = EXPECTED_COLUMNS[uploadType];

    // Re-read all rows from full CSV
    let allRows: Record<string, string>[];
    try {
      const { rows: fullRows } = parseCSVText(csvTextRef.current);
      allRows = mapRows(fullRows, columnMap, expected);
    } catch {
      allRows = mapRows(rows, columnMap, expected);
    }

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

    try {
      const res = await adminFetch<{ ok: boolean; imported?: number; upserted?: number }>(
        "/api/pms-data",
        { method: "POST", body: JSON.stringify(body) }
      );
      const count = res.imported ?? res.upserted ?? allRows.length;
      setResult({ ok: true, message: `Imported ${count} rows successfully.` });
      setTimeout(onDone, 1500);
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setImporting(false);
    }
  };

  const expected = EXPECTED_COLUMNS[uploadType];
  const allMapped = expected.every((e) => isOptionalColumn(uploadType, e) || !!columnMap[e]);

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--color-light-gray)]/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--color-dark)] flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[var(--color-gold)]" />
          Process CSV
        </h4>
        <button
          onClick={onCancel}
          className="p-1 text-[var(--color-mid-gray)] hover:text-[var(--color-dark)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {fetchingCSV ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-gold)]" />
          <span className="text-sm text-[var(--color-body-text)]">Loading CSV...</span>
        </div>
      ) : (
        <>
          {/* Report type selector */}
          <div className="grid grid-cols-3 gap-2">
            {UPLOAD_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setUploadType(t.key)}
                className={`p-3 rounded-lg border text-left text-xs transition ${
                  uploadType === t.key
                    ? "bg-[var(--color-gold)]/10 border-[var(--color-gold)]/30 text-[var(--color-dark)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--color-body-text)] hover:border-[var(--border-medium)]"
                }`}
              >
                <span className="font-medium">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Snapshot date */}
          {uploadType !== "revenue" && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--color-body-text)]">
                Snapshot Date:
              </label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="px-2 py-1 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded text-xs text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50"
              />
            </div>
          )}

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4">
              <h5 className="text-xs font-medium text-[var(--color-dark)] mb-3 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                Column Mapping ({expected.filter((e) => !!columnMap[e]).length}/{expected.length} mapped)
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {expected.map((exp) => (
                  <div key={exp} className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--color-body-text)] w-32 shrink-0 font-mono">
                      {exp}
                    </span>
                    <ChevronRight className="w-3 h-3 text-[var(--color-mid-gray)] shrink-0" />
                    <select
                      value={columnMap[exp] ?? ""}
                      onChange={(e) =>
                        setColumnMap((m) => ({ ...m, [exp]: e.target.value }))
                      }
                      className="flex-1 px-1.5 py-1 bg-[var(--color-light)] border border-[var(--border-subtle)] rounded text-xs text-[var(--color-dark)] focus:outline-none focus:border-[var(--color-gold)]/50"
                    >
                      <option value="">— select —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {columnMap[exp] ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {rows.length > 0 && (
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4">
              <h5 className="text-xs font-medium text-[var(--color-dark)] mb-2">
                Preview (first 5 of {rows.length} rows)
              </h5>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--color-light-gray)]">
                      {expected.map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 text-left font-medium text-[var(--color-mid-gray)] whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {expected.map((exp) => {
                          const srcCol = columnMap[exp];
                          return (
                            <td
                              key={exp}
                              className="px-2 py-1 text-[var(--color-body-text)] whitespace-nowrap max-w-[120px] truncate"
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

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={autoProcess}
              disabled={importing || !allMapped}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[var(--color-gold)] text-[var(--color-light)] rounded-lg hover:bg-[var(--color-gold-hover)] transition disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              Auto-Process
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !allMapped}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[var(--color-gold)]/30 text-[var(--color-gold)] rounded-lg hover:bg-[var(--color-gold)]/10 transition disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Import {rows.length} Rows
                </>
              )}
            </button>
            {!allMapped && headers.length > 0 && (
              <span className="text-[11px] text-yellow-400">
                Map all columns before importing
              </span>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                result.ok
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {result.message}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
