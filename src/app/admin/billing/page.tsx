"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import {
  DollarSign,
  TrendingUp,
  FileText,
  Users,
  Share2,
  Plus,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Calendar,
  Building,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ResponsiveChart } from "@/components/ui/responsive-chart";

interface RevenueData {
  mrr: number;
  arr: number;
  avg_contract_value: number;
  renewal_rate: number;
  trend: { month: string; revenue: number }[];
  top_clients: { name: string; revenue: number }[];
}

interface Invoice {
  id: string;
  date: string;
  client: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
  facilityName: string | null;
}

interface Organization {
  id: string;
  name: string;
  plan_tier: string;
  status: string;
  facility_count: number;
  contact_name: string;
  contact_email: string;
  billing_email: string;
  access_code: string;
  mrr: number;
}

interface Referral {
  id: string;
  referrer: string;
  referred: string;
  status: string;
  commission: number;
  referral_code: string;
}


const TABS = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "clients", label: "Client Accounts", icon: Users },
  { key: "referrals", label: "Referrals", icon: Share2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  paid: { bg: "rgba(34,197,94,0.1)", text: "#22C55E" },
  pending: { bg: "rgba(171,85,5,0.1)", text: "#AB5505" },
  overdue: { bg: "rgba(239,68,68,0.1)", text: "#EF4444" },
  active: { bg: "rgba(34,197,94,0.1)", text: "#22C55E" },
  inactive: { bg: "rgba(107,114,128,0.1)", text: "#6B7280" },
};

function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border p-5 animate-pulse"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <div className="h-3 w-24 rounded bg-[var(--color-dark)]/5 mb-3" />
          <div className="h-8 w-20 rounded bg-[var(--color-dark)]/5" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg animate-pulse"
          style={{ backgroundColor: "var(--bg-elevated)" }}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span
      className="text-xs font-medium px-2 py-1 rounded-full"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-[var(--color-dark)]/5 transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check size={14} style={{ color: "#22C55E" }} />
      ) : (
        <Copy size={14} style={{ color: "var(--color-mid-gray)" }} />
      )}
    </button>
  );
}

function OverviewTab() {
  const { data: rawData, loading, error } = useAdminFetch<{ success: boolean; data: Record<string, unknown>[] }>("/api/client-invoices", {
    summary: "true",
  });

  if (error) {
    return (
      <div
        className="rounded-lg border p-4 text-sm"
        style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}
      >
        Failed to load revenue data: {error}
      </div>
    );
  }

  if (loading || !rawData) return <CardSkeleton />;

  // The API returns activity log rows, not computed revenue metrics.
  // Derive what we can from the raw data; default missing fields to 0.
  const rows = rawData.data ?? [];
  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const data: RevenueData = {
    mrr: totalRevenue,
    arr: totalRevenue * 12,
    avg_contract_value: rows.length > 0 ? totalRevenue / rows.length : 0,
    renewal_rate: 0,
    trend: [],
    top_clients: [],
  };

  const kpis = [
    { label: "MRR", value: `$${data.mrr.toLocaleString()}`, icon: DollarSign, color: "#22C55E" },
    { label: "ARR", value: `$${data.arr.toLocaleString()}`, icon: TrendingUp, color: "var(--color-gold)" },
    { label: "Avg Contract Value", value: `$${data.avg_contract_value.toLocaleString()}`, icon: CreditCard, color: "#AB5505" },
    { label: "Renewal Rate", value: `${data.renewal_rate.toFixed(1)}%`, icon: Calendar, color: "#8B5CF6" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border p-5"
              style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} style={{ color: kpi.color }} />
                <span className="text-xs font-medium" style={{ color: "var(--color-mid-gray)" }}>{kpi.label}</span>
              </div>
              <p className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {data.trend && data.trend.length > 0 && (
        <div
          className="rounded-xl border p-6"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-dark)" }}>Revenue Trend</h3>
          <ResponsiveChart mobileHeight={220} desktopHeight={256}>
            <AreaChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="month" tick={{ fill: "var(--color-mid-gray)", fontSize: 11 }} axisLine={{ stroke: "var(--border-subtle)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--color-mid-gray)", fontSize: 11 }} axisLine={{ stroke: "var(--border-subtle)" }} width={40} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--color-light-gray)", border: "1px solid var(--border-medium)", borderRadius: "8px", color: "var(--color-dark)" }}
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-gold)" fill="rgba(68,99,134,0.1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveChart>
        </div>
      )}

      {data.top_clients && data.top_clients.length > 0 && (
        <div
          className="rounded-xl border p-6"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--color-dark)" }}>Top Clients by Revenue</h3>
          <div className="space-y-3">
            {data.top_clients.map((client, idx) => (
              <div key={client.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono w-5" style={{ color: "var(--color-mid-gray)" }}>{idx + 1}</span>
                  <span className="text-sm" style={{ color: "var(--color-dark)" }}>{client.name}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: "#22C55E" }}>
                  ${client.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoicesTab() {
  const { data: rawData, loading, error, refetch } = useAdminFetch<{ success: boolean; data: Invoice[] }>("/api/client-invoices");
  const invoices = rawData?.data ?? [];
  const { data: clientsData } = useAdminFetch<{ clients: ClientOption[] }>("/api/admin-clients");
  const clientOptions = clientsData?.clients ?? [];
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ clientId: "", adSpend: "", lineItems: "", stripeInvoiceId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Each non-empty "Description: amount" line becomes a structured add-on item
  // for the route (which requires both); lines without a numeric amount are skipped.
  const parseLineItems = (raw: string) =>
    raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const idx = l.lastIndexOf(":");
        if (idx === -1) return null;
        const description = l.slice(0, idx).trim();
        const amount = parseFloat(l.slice(idx + 1).replace(/[^0-9.]/g, ""));
        return description && Number.isFinite(amount) ? { description, amount } : null;
      })
      .filter((x): x is { description: string; amount: number } => x !== null);

  const handleCreate = async () => {
    if (!formData.clientId) {
      setFormError("Select a client.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      // Contract matches /api/client-invoices POST: the route auto-computes the
      // plan-based total + due date; we supply the client, ad-spend pass-through,
      // any add-on items, and an optional Stripe link for M5 webhook auto-sync.
      await adminFetch("/api/client-invoices", {
        method: "POST",
        body: JSON.stringify({
          clientId: formData.clientId,
          adSpend: formData.adSpend ? parseFloat(formData.adSpend) : 0,
          additionalItems: parseLineItems(formData.lineItems),
          ...(formData.stripeInvoiceId.trim()
            ? { stripeInvoiceId: formData.stripeInvoiceId.trim() }
            : {}),
        }),
      });
      setFormData({ clientId: "", adSpend: "", lineItems: "", stripeInvoiceId: "" });
      setShowForm(false);
      refetch();
    } catch {
      setFormError("Could not create the invoice. Check the fields and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "var(--color-red-light)", borderColor: "var(--color-red)", color: "var(--color-red)" }}>
        Failed to load invoices: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-dark)" }}>Invoices</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--color-dark)", color: "var(--color-light)" }}
        >
          <Plus size={14} />
          New Invoice
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border p-5 space-y-4" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-mid-gray)" }}>
              Client
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
              >
                <option value="">Select a client</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.facilityName ? `${c.facilityName} (${c.email})` : c.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-mid-gray)" }}>
              Ad spend (pass-through, optional)
              <input
                type="number"
                min={0}
                placeholder="0"
                value={formData.adSpend}
                onChange={(e) => setFormData({ ...formData, adSpend: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-mid-gray)" }}>
            Additional line items (one per line, &quot;Description: amount&quot;)
            <textarea
              placeholder={"Setup fee: 250\nExtra creative: 100"}
              value={formData.lineItems}
              onChange={(e) => setFormData({ ...formData, lineItems: e.target.value })}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--color-mid-gray)" }}>
            Stripe invoice ID (optional, links the invoice so payment auto-syncs)
            <input
              type="text"
              placeholder="in_1AbC..."
              value={formData.stripeInvoiceId}
              onChange={(e) => setFormData({ ...formData, stripeInvoiceId: e.target.value })}
              className="rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: "var(--color-light)", borderColor: "var(--border-subtle)", color: "var(--color-dark)" }}
            />
          </label>
          <p className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
            The plan fee and due date are set automatically from the client&apos;s subscription.
          </p>
          {formError && (
            <p className="text-xs" style={{ color: "var(--color-red)" }}>{formError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowForm(false);
                setFormError("");
              }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-dark)]/5"
              style={{ color: "var(--color-body-text)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !formData.clientId}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--color-dark)", color: "var(--color-light)" }}
            >
              {submitting ? "Creating..." : "Create & email invoice"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : invoices && invoices.length > 0 ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Date</th>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Client</th>
                <th className="text-right text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Amount</th>
                <th className="text-right text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t transition-colors hover:bg-[var(--color-light-gray)]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>
                    {new Date(inv.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--color-dark)" }}>{inv.client}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--color-dark)" }}>
                    ${inv.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
          <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>No invoices yet</p>
        </div>
      )}
    </div>
  );
}

function ClientAccountsTab() {
  const { data: rawOrgs, loading, error } = useAdminFetch<{ organizations: Organization[] }>("/api/organizations");
  const orgs = rawOrgs?.organizations ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
        Failed to load organizations: {error}
      </div>
    );
  }

  if (loading) return <TableSkeleton />;

  if (!orgs || orgs.length === 0) {
    return (
      <div className="text-center py-12">
        <Building size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
        <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>No client accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orgs.map((org) => (
        <div
          key={org.id}
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={() => setExpandedId(expandedId === org.id ? null : org.id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--color-light-gray)] transition-colors"
          >
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium" style={{ color: "var(--color-dark)" }}>{org.name}</span>
              <StatusBadge status={org.status} />
              <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>{org.plan_tier}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs" style={{ color: "var(--color-mid-gray)" }}>
                {org.facility_count} {org.facility_count === 1 ? "facility" : "facilities"}
              </span>
              {expandedId === org.id ? (
                <ChevronDown size={16} style={{ color: "var(--color-mid-gray)" }} />
              ) : (
                <ChevronRight size={16} style={{ color: "var(--color-mid-gray)" }} />
              )}
            </div>
          </button>
          {expandedId === org.id && (
            <div className="px-4 pb-4 border-t space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
                <div>
                  <span style={{ color: "var(--color-mid-gray)" }}>Contact</span>
                  <p style={{ color: "var(--color-dark)" }}>{org.contact_name || "N/A"}</p>
                </div>
                <div>
                  <span style={{ color: "var(--color-mid-gray)" }}>Billing Email</span>
                  <p style={{ color: "var(--color-dark)" }}>{org.billing_email || "N/A"}</p>
                </div>
                <div>
                  <span style={{ color: "var(--color-mid-gray)" }}>Access Code</span>
                  <div className="flex items-center gap-1">
                    <code className="font-mono text-sm" style={{ color: "var(--color-dark)" }}>
                      {org.access_code || "N/A"}
                    </code>
                    {org.access_code && <CopyButton text={org.access_code} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ReferralsTab() {
  const { data: rawData, loading, error } = useAdminFetch<{ codes: { code: string; referrer: string; referred: string; status: string; commission: number; id: string }[] }>("/api/referrals");

  if (error) {
    return (
      <div className="rounded-lg border p-4 text-sm" style={{ backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}>
        Failed to load referrals: {error}
      </div>
    );
  }

  if (loading || !rawData) return <TableSkeleton />;

  const codes = rawData.codes ?? [];
  // Extract a referral code from the first entry if available
  const referralCode = codes.length > 0 ? (codes[0].code || "") : "";
  // Map codes to referral entries
  const referrals: Referral[] = codes.map((c) => ({
    id: c.id || c.code,
    referrer: c.referrer || "",
    referred: c.referred || "",
    status: c.status || "pending",
    commission: c.commission || 0,
    referral_code: c.code || "",
  }));

  return (
    <div className="space-y-6">
      {referralCode && (
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
        >
          <p className="text-xs font-medium mb-2" style={{ color: "var(--color-mid-gray)" }}>Your Referral Code</p>
          <div className="flex items-center gap-2">
            <code className="text-lg font-mono font-semibold" style={{ color: "var(--color-gold)" }}>
              {referralCode}
            </code>
            <CopyButton text={referralCode} />
          </div>
        </div>
      )}

      {referrals.length > 0 ? (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-elevated)" }}>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Referrer</th>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Referred</th>
                <th className="text-left text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Status</th>
                <th className="text-right text-xs font-medium px-4 py-3" style={{ color: "var(--color-mid-gray)" }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((ref) => (
                <tr key={ref.id} className="border-t hover:bg-[var(--color-light-gray)]" style={{ borderColor: "var(--border-subtle)" }}>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--color-dark)" }}>{ref.referrer}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--color-body-text)" }}>{ref.referred}</td>
                  <td className="px-4 py-3"><StatusBadge status={ref.status} /></td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: "#22C55E" }}>
                    ${ref.commission.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Share2 size={32} className="mx-auto mb-3" style={{ color: "var(--color-mid-gray)" }} />
          <p className="text-sm" style={{ color: "var(--color-mid-gray)" }}>No referrals yet</p>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabKey) || "overview";

  const setTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/admin/billing?${params.toString()}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-dark)" }}>
          Billing & Invoices
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-mid-gray)" }}>
          Revenue, invoices, and client management
        </p>
      </div>

      <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--bg-elevated)" }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md transition-colors"
              style={{
                backgroundColor: isActive ? "var(--color-gold)" : "transparent",
                color: isActive ? "var(--color-light)" : "var(--color-mid-gray)",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "invoices" && <InvoicesTab />}
      {activeTab === "clients" && <ClientAccountsTab />}
      {activeTab === "referrals" && <ReferralsTab />}
    </div>
  );
}
