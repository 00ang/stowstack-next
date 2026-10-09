"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  ShieldAlert,
  TrendingUp,
  DollarSign,
  CreditCard,
  RefreshCw,
  UserPlus,
  X,
  CheckCircle2,
  XCircle,
  Upload,
  Zap,
  Target,
} from "lucide-react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import { useToolFocus } from "@/components/ontology/tool-focus";
import { FocusScopeToggle } from "@/components/ontology/focus-scope";
import { textNamesFocus } from "@/lib/tools-track/focus-match";
import type {
  Tenant,
  TenantStats,
  TenantResponse,
  SortField,
  SortDir,
  StatusFilter,
  ViewMode,
} from "./tenant-management-types";
import { TenantDetail } from "./tenant-detail";
import { ChurnDashboard } from "./tenant-churn-dashboard";
import { RetentionDashboard } from "./tenant-retention-dashboard";
import { AddTenantModal, ImportCSVModal } from "./tenant-modals";
import { KPICard, SortableHeader, TenantRow, LoadingSkeleton } from "./tenant-helpers";

/* ── props ── */

interface Props {
  facilityId: string;
  adminKey: string;
}

/* ── main component ── */

export default function TenantManagement({ facilityId, adminKey: _adminKey }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const focus = useToolFocus();
  const unitFocus = focus?.type === "units" ? focus : null;
  const [scope, setScope] = useState<{ address: string | null; showAll: boolean }>({ address: null, showAll: false });
  const showAll = scope.address === (focus?.address ?? null) && scope.showAll;

  const pageSize = 25;

  /* ── data fetch ── */

  const { data, loading, error, refetch } = useAdminFetch<TenantResponse>(
    "/api/tenants",
    { facilityId, includeAnalytics: "true" }
  );

  const tenants = useMemo(() => data?.tenants || [], [data?.tenants]);
  const stats: TenantStats = useMemo(() => {
    if (!data?.stats) return { total: 0, active: 0, delinquent: 0, movedOut: 0, totalRevenue: 0, avgRate: 0, collectionRate: 0, autopayRate: 0 };
    const s = data.stats;
    return {
      total: s.total,
      active: s.active,
      delinquent: s.delinquent,
      movedOut: s.moved_out,
      totalRevenue: s.total_monthly_revenue,
      avgRate: s.avg_rate,
      collectionRate: s.collection_rate,
      autopayRate: s.autopay_pct,
    };
  }, [data]);

  /* ── filtering / sorting / pagination ── */

  const filtered = useMemo(() => {
    let result = [...tenants];

    if (statusFilter === "active") result = result.filter(t => t.status === "active" && (!t.days_delinquent || t.days_delinquent === 0));
    else if (statusFilter === "delinquent") result = result.filter(t => (t.days_delinquent || 0) > 0 && t.status !== "moved_out");
    else if (statusFilter === "moved_out") result = result.filter(t => t.status === "moved_out");
    else if (statusFilter === "notice") result = result.filter(t => t.delinquency_escalations?.length);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.unit_number.toLowerCase().includes(q) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q))
      );
    }

    if (unitFocus && !showAll) {
      result = result.filter((t) => textNamesFocus(unitFocus, `${t.unit_size ?? ""} ${t.unit_type ?? ""} ${t.unit_number}`));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "unit_number": cmp = a.unit_number.localeCompare(b.unit_number, undefined, { numeric: true }); break;
        case "monthly_rate": cmp = (Number(a.monthly_rate) || 0) - (Number(b.monthly_rate) || 0); break;
        case "balance": cmp = (Number(a.balance) || 0) - (Number(b.balance) || 0); break;
        case "days_delinquent": cmp = (a.days_delinquent || 0) - (b.days_delinquent || 0); break;
        case "move_in_date": cmp = new Date(a.move_in_date).getTime() - new Date(b.move_in_date).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tenants, statusFilter, searchQuery, sortField, sortDir, unitFocus, showAll]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [statusFilter, searchQuery, sortField, sortDir]); // eslint-disable-line react-hooks/set-state-in-effect -- derived state reset

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const openDetail = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode("detail");
  };

  /* ── actions ── */

  const runChurnScoring = async () => {
    setActionLoading("churn");
    try {
      await adminFetch("/api/churn-predictions", {
        method: "POST",
        body: JSON.stringify({ facilityId }),
      });
      refetch();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const recordPayment = async (tenantId: string, amount: number, method: string) => {
    setActionLoading(tenantId);
    try {
      await adminFetch("/api/tenants", {
        method: "PATCH",
        body: JSON.stringify({
          id: tenantId,
          action: "record_payment",
          amount,
          method,
          payment_date: new Date().toISOString().split("T")[0],
        }),
      });
      refetch();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const escalateTenant = async (tenantId: string) => {
    setActionLoading(tenantId);
    try {
      await adminFetch("/api/tenants", {
        method: "PATCH",
        body: JSON.stringify({ id: tenantId, action: "escalate" }),
      });
      refetch();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  const moveOutTenant = async (tenantId: string, reason: string) => {
    setActionLoading(tenantId);
    try {
      await adminFetch("/api/tenants", {
        method: "PATCH",
        body: JSON.stringify({
          id: tenantId,
          action: "move_out",
          moved_out_date: new Date().toISOString().split("T")[0],
          move_out_reason: reason,
        }),
      });
      refetch();
    } catch { /* ignore */ }
    setActionLoading(null);
  };

  /* ── render ── */

  if (loading) return <LoadingSkeleton />;
  if (error) return (
    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
      <XCircle className="h-5 w-5 text-red-400" />
      <p className="flex-1 text-sm text-red-300">Failed to load tenants</p>
      <button onClick={refetch} className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    </div>
  );

  if (viewMode === "detail" && selectedTenant) {
    return (
      <TenantDetail
        tenant={selectedTenant}
        onBack={() => { setViewMode("list"); setSelectedTenant(null); }}
        onRecordPayment={recordPayment}
        onEscalate={escalateTenant}
        onMoveOut={moveOutTenant}
        actionLoading={actionLoading}
        refetch={refetch}
        facilityId={facilityId}
      />
    );
  }

  if (viewMode === "churn") {
    return <ChurnDashboard facilityId={facilityId} onBack={() => setViewMode("list")} />;
  }

  if (viewMode === "retention") {
    return <RetentionDashboard facilityId={facilityId} onBack={() => setViewMode("list")} />;
  }

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--color-light)] p-1">
        {[
          { key: "list" as ViewMode, label: "Tenants", icon: <Users className="h-3.5 w-3.5" /> },
          { key: "churn" as ViewMode, label: "Churn Risk", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
          { key: "retention" as ViewMode, label: "Retention", icon: <Target className="h-3.5 w-3.5" /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              viewMode === tab.key ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)]" : "text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)]"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Total Tenants" value={stats.total} icon={<Users className="h-4 w-4" />} />
        <KPICard label="Active" value={stats.active} icon={<CheckCircle2 className="h-4 w-4" />} color="text-emerald-400" />
        <KPICard label="Delinquent" value={stats.delinquent} icon={<AlertTriangle className="h-4 w-4" />} color="text-amber-400" />
        <KPICard label="Monthly Revenue" value={`$${(stats.totalRevenue || 0).toLocaleString()}`} icon={<DollarSign className="h-4 w-4" />} color="text-[var(--color-gold)]" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Avg Rate" value={`$${Math.round(stats.avgRate || 0)}`} icon={<TrendingUp className="h-4 w-4" />} />
        <KPICard label="Collection Rate" value={`${Math.round(stats.collectionRate || 0)}%`} icon={<CreditCard className="h-4 w-4" />} color={stats.collectionRate >= 90 ? "text-emerald-400" : "text-amber-400"} />
        <KPICard label="AutoPay Rate" value={`${Math.round(stats.autopayRate || 0)}%`} icon={<Zap className="h-4 w-4" />} />
        <KPICard label="Moved Out" value={stats.movedOut} icon={<XCircle className="h-4 w-4" />} color="text-[var(--color-mid-gray)]" />
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-mid-gray)]" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] py-2 pl-10 pr-4 text-sm text-[var(--color-dark)] placeholder-[var(--color-mid-gray)] focus:border-[var(--color-gold)]/50 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {(["all", "active", "delinquent", "moved_out", "notice"] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)]"
                  : "text-[var(--color-mid-gray)] hover:text-[var(--color-body-text)]"
              }`}
            >
              {s === "moved_out" ? "Moved Out" : s === "notice" ? "On Notice" : s}
            </button>
          ))}
        </div>

        <button
          onClick={runChurnScoring}
          disabled={actionLoading === "churn"}
          className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
        >
          {actionLoading === "churn" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Score Churn Risk
        </button>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-gold)]/20 px-3 py-2 text-xs font-medium text-[var(--color-gold)] hover:bg-[var(--color-gold)]/30"
        >
          <UserPlus className="h-3.5 w-3.5" /> Add Tenant
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-light-gray)] px-3 py-2 text-xs font-medium text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
        >
          <Upload className="h-3.5 w-3.5" /> Import CSV
        </button>
      </div>

      {unitFocus && (
        <FocusScopeToggle
          name={unitFocus.name}
          named={tenants.filter((t) => textNamesFocus(unitFocus, `${t.unit_size ?? ""} ${t.unit_type ?? ""} ${t.unit_number}`)).length}
          total={tenants.length}
          showAll={showAll}
          onToggle={() => setScope({ address: unitFocus.address, showAll: !showAll })}
        />
      )}

      <div className="flex items-center justify-between text-xs text-[var(--color-mid-gray)]">
        <span>{filtered.length} tenant{filtered.length !== 1 ? "s" : ""} found</span>
        <span>Page {page} of {totalPages || 1}</span>
      </div>

      {/* Tenant Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <SortableHeader label="Name" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Unit" field="unit_number" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Rate" field="monthly_rate" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Balance" field="balance" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Days Late" field="days_delinquent" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-mid-gray)]">Risk</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-mid-gray)]">Status</th>
              <SortableHeader label="Move-In" field="move_in_date" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-mid-gray)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-[var(--color-mid-gray)]">
                  {searchQuery || statusFilter !== "all" ? "No tenants match your filters" : "No tenants yet -- add one or import a CSV"}
                </td>
              </tr>
            ) : (
              paginated.map(tenant => (
                <TenantRow
                  key={tenant.id}
                  tenant={tenant}
                  onClick={() => openDetail(tenant)}
                  onEscalate={() => escalateTenant(tenant.id)}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-lg text-xs font-medium ${
                  p === page ? "bg-[var(--color-gold)] text-[var(--color-light)]" : "border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)]"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[var(--color-body-text)] hover:bg-[var(--color-light-gray)] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddTenantModal
          facilityId={facilityId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); refetch(); }}
        />
      )}

      {showImportModal && (
        <ImportCSVModal
          facilityId={facilityId}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); refetch(); }}
        />
      )}
    </div>
  );
}
