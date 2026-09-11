"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Copy,
  Check,
  Lock,
  Building2,
  Users,
  Phone,
  FileText,
  BarChart3,
  Globe,
  Webhook,
  Key,
  Activity,
  Tag,
  Package,
  ArrowLeft,
} from "lucide-react";

/* ─── Data ─── */

interface Endpoint {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  scope: string;
  params?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description: string;
  }>;
  body?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description: string;
  }>;
  responseExample?: string;
}

interface ApiSection {
  title: string;
  slug: string;
  icon: React.ReactNode;
  description: string;
  endpoints: Endpoint[];
}

const SECTIONS: ApiSection[] = [
  {
    title: "Facilities",
    slug: "facilities",
    icon: <Building2 className="h-4 w-4" />,
    description: "Manage self-storage facilities. Create, update, and list facilities within your organization.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/facilities",
        description: "List all facilities for your organization. Returns paginated results with full facility details.",
        scope: "facilities:read",
        params: [
          { name: "id", type: "string", description: "Fetch a single facility by ID" },
          { name: "limit", type: "number", description: "Results per page (default: 50, max: 100)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        responseExample: `{
  "data": [{
    "id": "fac_abc123",
    "name": "Lakeview Self Storage",
    "location": "Columbus, OH",
    "occupancy_range": "75-85",
    "total_units": "100-300",
    "status": "active"
  }],
  "total": 1,
  "limit": 50,
  "offset": 0
}`,
      },
      {
        method: "POST",
        path: "/api/v1/facilities",
        description: "Create a new facility.",
        scope: "facilities:write",
        body: [
          { name: "name", type: "string", required: true, description: "Facility name" },
          { name: "location", type: "string", required: true, description: "Full address" },
          { name: "website", type: "string", description: "Facility website URL" },
          { name: "contact_email", type: "string", description: "Primary contact email" },
          { name: "total_units", type: "string", description: "Unit count range (e.g. '100-300')" },
        ],
      },
      {
        method: "PATCH",
        path: "/api/v1/facilities",
        description: "Update an existing facility.",
        scope: "facilities:write",
        body: [
          { name: "id", type: "string", required: true, description: "Facility ID to update" },
          { name: "name", type: "string", description: "Updated name" },
          { name: "location", type: "string", description: "Updated address" },
          { name: "occupancy_range", type: "string", description: "Occupancy range" },
        ],
      },
    ],
  },
  {
    title: "Leads",
    slug: "leads",
    icon: <Users className="h-4 w-4" />,
    description: "Track and manage inbound leads from landing pages, forms, calls, and walk-ins.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/leads",
        description: "List leads with filtering and pagination.",
        scope: "leads:read",
        params: [
          { name: "facilityId", type: "string", description: "Filter by facility" },
          { name: "status", type: "string", description: "Filter by status (new, contacted, tour, moved_in, lost)" },
          { name: "since", type: "string", description: "ISO date — only return leads created after this date" },
          { name: "limit", type: "number", description: "Results per page (default: 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
      },
      {
        method: "POST",
        path: "/api/v1/leads",
        description: "Create a new lead (e.g. from external form, PMS webhook).",
        scope: "leads:write",
        body: [
          { name: "facilityId", type: "string", required: true, description: "Facility this lead is for" },
          { name: "name", type: "string", description: "Lead's full name" },
          { name: "email", type: "string", description: "Email address" },
          { name: "phone", type: "string", description: "Phone number" },
          { name: "source", type: "string", description: "Lead source (google, meta, organic, walkin, referral)" },
          { name: "unit_interest", type: "string", description: "Unit type or size they're interested in" },
        ],
      },
      {
        method: "PATCH",
        path: "/api/v1/leads",
        description: "Update a lead's status or details.",
        scope: "leads:write",
        body: [
          { name: "id", type: "string", required: true, description: "Lead ID" },
          { name: "status", type: "string", description: "New status" },
          { name: "notes", type: "string", description: "Notes to append" },
        ],
      },
    ],
  },
  {
    title: "Tenants",
    slug: "tenants",
    icon: <Key className="h-4 w-4" />,
    description: "Manage current and past tenants. Import from PMS, track payments, and manage delinquency.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/tenants",
        description: "List tenants for a facility with optional filters.",
        scope: "tenants:read",
        params: [
          { name: "facilityId", type: "string", required: true, description: "Filter by facility" },
          { name: "status", type: "string", description: "Filter by status (active, moved_out, delinquent)" },
          { name: "limit", type: "number", description: "Results per page" },
        ],
      },
      {
        method: "POST",
        path: "/api/v1/tenants",
        description: "Bulk import or create tenants. Supports upsert by PMS ID.",
        scope: "tenants:write",
        body: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
          { name: "tenants", type: "array", required: true, description: "Array of tenant objects to import" },
        ],
      },
    ],
  },
  {
    title: "Units",
    slug: "units",
    icon: <Package className="h-4 w-4" />,
    description: "Manage unit types, sizes, and rates. Supports bulk updates for rate changes.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/facility-units",
        description: "Get unit types and current rates for a facility.",
        scope: "units:read",
        params: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/v1/facility-units",
        description: "Create or update unit types with rates.",
        scope: "units:write",
        body: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
          { name: "units", type: "array", required: true, description: "Array of unit type objects" },
        ],
      },
    ],
  },
  {
    title: "Availability",
    slug: "availability",
    icon: <Globe className="h-4 w-4" />,
    description: "Get real-time unit availability with active specials and discounts applied.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/facility-availability",
        description: "Get available units for a facility with pricing and active promotions.",
        scope: "units:read",
        params: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
        ],
        responseExample: `{
  "facility": "Lakeview Self Storage",
  "availableUnits": [{
    "type": "10x10 Standard",
    "rate": 120.00,
    "discountedRate": 1.00,
    "special": "$1 First Month",
    "available": 14
  }],
  "totalAvailable": 55
}`,
      },
    ],
  },
  {
    title: "Specials & Promotions",
    slug: "specials",
    icon: <Tag className="h-4 w-4" />,
    description: "Create and manage facility promotions, discounts, and special offers.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/facility-specials",
        description: "List active specials for a facility.",
        scope: "units:read",
        params: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
        ],
      },
      {
        method: "POST",
        path: "/api/v1/facility-specials",
        description: "Create or update a promotion.",
        scope: "units:write",
        body: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
          { name: "name", type: "string", required: true, description: "Promotion name" },
          { name: "discount_type", type: "string", required: true, description: "fixed, percentage, or first_month" },
          { name: "discount_value", type: "number", required: true, description: "Discount amount" },
        ],
      },
    ],
  },
  {
    title: "Call Logs",
    slug: "call-logs",
    icon: <Phone className="h-4 w-4" />,
    description: "Access call tracking data. View inbound calls with attribution and recording metadata.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/call-logs",
        description: "List call logs with attribution data, summary stats, and optional detail mode.",
        scope: "calls:read",
        params: [
          { name: "facilityId", type: "string", description: "Filter by facility" },
          { name: "since", type: "string", description: "ISO date — calls after this date" },
          { name: "mode", type: "string", description: "'summary' for stats only, 'detail' for full logs" },
          { name: "limit", type: "number", description: "Results per page" },
        ],
      },
    ],
  },
  {
    title: "Landing Pages",
    slug: "landing-pages",
    icon: <FileText className="h-4 w-4" />,
    description: "Retrieve landing page configurations and UTM tracking data.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/landing-pages",
        description: "Get landing pages with sections and UTM links.",
        scope: "pages:read",
        params: [
          { name: "id", type: "string", description: "Fetch by ID" },
          { name: "slug", type: "string", description: "Fetch by slug" },
          { name: "facilityId", type: "string", description: "List by facility" },
        ],
      },
    ],
  },
  {
    title: "Occupancy Snapshots",
    slug: "snapshots",
    icon: <BarChart3 className="h-4 w-4" />,
    description: "Store and retrieve historical occupancy and delinquency snapshots for trend analysis.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/facility-snapshots",
        description: "Get historical occupancy snapshots for a facility.",
        scope: "facilities:read",
        params: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
          { name: "days", type: "number", description: "Lookback window in days (default: 90)" },
        ],
      },
      {
        method: "POST",
        path: "/api/v1/facility-snapshots",
        description: "Record an occupancy snapshot (upsert by date).",
        scope: "facilities:write",
        body: [
          { name: "facilityId", type: "string", required: true, description: "Facility ID" },
          { name: "date", type: "string", description: "Snapshot date (default: today)" },
          { name: "total_units", type: "number", required: true, description: "Total unit count" },
          { name: "occupied_units", type: "number", required: true, description: "Occupied units" },
          { name: "delinquent_units", type: "number", description: "Units with delinquent tenants" },
        ],
      },
    ],
  },
  {
    title: "Webhooks",
    slug: "webhooks",
    icon: <Webhook className="h-4 w-4" />,
    description: "Configure webhooks to receive real-time notifications for leads, move-ins, calls, and more.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/webhooks",
        description: "List configured webhooks.",
        scope: "webhooks:manage",
      },
      {
        method: "POST",
        path: "/api/v1/webhooks",
        description: "Create a new webhook subscription.",
        scope: "webhooks:manage",
        body: [
          { name: "url", type: "string", required: true, description: "HTTPS webhook URL" },
          { name: "events", type: "string[]", required: true, description: "Events to subscribe to (lead.created, lead.converted, call.received, tenant.moved_in, tenant.moved_out, snapshot.created)" },
          { name: "secret", type: "string", description: "Signing secret for webhook verification" },
        ],
      },
      {
        method: "PATCH",
        path: "/api/v1/webhooks",
        description: "Update or test a webhook.",
        scope: "webhooks:manage",
        body: [
          { name: "id", type: "string", required: true, description: "Webhook ID" },
          { name: "action", type: "string", description: "'test' to send a test event" },
          { name: "active", type: "boolean", description: "Enable or disable" },
        ],
      },
      {
        method: "DELETE",
        path: "/api/v1/webhooks",
        description: "Delete a webhook subscription.",
        scope: "webhooks:manage",
        body: [
          { name: "id", type: "string", required: true, description: "Webhook ID to delete" },
        ],
      },
    ],
  },
  {
    title: "API Keys",
    slug: "api-keys",
    icon: <Lock className="h-4 w-4" />,
    description: "Manage API keys for your organization. Keys are scoped and rate-limited.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/api-keys",
        description: "List your API keys (keys are masked).",
        scope: "—",
      },
      {
        method: "POST",
        path: "/api/v1/api-keys",
        description: "Create a new API key with specific scopes. Requires admin auth.",
        scope: "Admin only",
        body: [
          { name: "name", type: "string", required: true, description: "Key name/label" },
          { name: "scopes", type: "string[]", required: true, description: "Scopes to grant (e.g. ['facilities:read', 'leads:write'])" },
          { name: "rate_limit", type: "number", description: "Requests per minute (default: 60)" },
        ],
      },
    ],
  },
  {
    title: "Usage Analytics",
    slug: "usage",
    icon: <Activity className="h-4 w-4" />,
    description: "Monitor your API usage, request counts, and error rates.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/usage",
        description: "Get usage statistics broken down by day, endpoint, and key.",
        scope: "—",
        params: [
          { name: "days", type: "number", description: "Lookback window (default: 30, max: 90)" },
          { name: "groupBy", type: "string", description: "Group by: day, endpoint, or key" },
        ],
        responseExample: `{
  "period": { "start": "2026-02-18", "end": "2026-03-20" },
  "totalRequests": 12847,
  "totalErrors": 23,
  "byDay": [
    { "date": "2026-03-20", "requests": 487, "errors": 1 }
  ]
}`,
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  POST: "bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/20",
  PATCH: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};

/* ─── Components ─── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded p-1.5 text-[var(--color-mid-gray)] transition-colors hover:bg-[var(--border-subtle)] hover:text-[var(--color-body-text)]"
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider ${
            METHOD_COLORS[endpoint.method]
          }`}
        >
          {endpoint.method}
        </span>
        <code className="flex-1 text-sm font-medium text-[var(--color-dark)]">{endpoint.path}</code>
        <span className="text-xs text-[var(--color-mid-gray)]">{endpoint.scope}</span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-[var(--color-mid-gray)] transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-4">
          <p className="text-sm text-[var(--color-body-text)]">{endpoint.description}</p>

          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
                Query Parameters
              </h4>
              <div className="space-y-1.5">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-xs text-[var(--color-dark)]">
                      {p.name}
                    </code>
                    <span className="text-[10px] text-[var(--color-mid-gray)] mt-0.5">{p.type}</span>
                    {p.required && (
                      <span className="text-[10px] font-medium text-red-400 mt-0.5">required</span>
                    )}
                    <span className="text-xs text-[var(--color-body-text)]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.body && endpoint.body.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
                Request Body (JSON)
              </h4>
              <div className="space-y-1.5">
                {endpoint.body.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-xs text-[var(--color-dark)]">
                      {p.name}
                    </code>
                    <span className="text-[10px] text-[var(--color-mid-gray)] mt-0.5">{p.type}</span>
                    {p.required && (
                      <span className="text-[10px] font-medium text-red-400 mt-0.5">required</span>
                    )}
                    <span className="text-xs text-[var(--color-body-text)]">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.responseExample && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mid-gray)]">
                  Response Example
                </h4>
                <CopyButton text={endpoint.responseExample} />
              </div>
              <pre className="overflow-x-auto rounded-lg bg-[var(--color-light)] p-4 text-xs leading-relaxed text-[var(--color-body-text)]">
                {endpoint.responseExample}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main ─── */

export function DocsClient() {
  const [activeSection, setActiveSection] = useState("facilities");

  const section = SECTIONS.find((s) => s.slug === activeSection);

  return (
    <div className="min-h-screen bg-[var(--color-light)] text-[var(--color-dark)]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--color-light)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-[var(--color-mid-gray)] transition-colors hover:text-[var(--color-dark)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-gold)]">
              <span className="text-sm font-semibold text-[var(--color-light)]">S</span>
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">StorageAds API</h1>
              <p className="text-[10px] text-[var(--color-mid-gray)]">v1 — REST API Documentation</p>
            </div>
          </div>
          <div className="ml-auto">
            <Link
              href="/pricing"
              className="rounded-lg bg-[var(--color-gold)] px-4 py-2 text-xs font-semibold text-[var(--color-light)] transition-colors hover:bg-[var(--color-gold-hover)]"
            >
              Get API Access
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] lg:block">
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-6 px-4">
            <div className="mb-6">
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-mid-gray)]">
                Getting Started
              </h3>
              <div className="space-y-1 text-sm">
                <button
                  type="button"
                  onClick={() => setActiveSection("auth")}
                  className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                    activeSection === "auth"
                      ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                      : "text-[var(--color-body-text)] hover:bg-white/[0.04] hover:text-[var(--color-dark)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Authentication
                  </div>
                </button>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-mid-gray)]">
                Endpoints
              </h3>
              <div className="space-y-0.5 text-sm">
                {SECTIONS.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => setActiveSection(s.slug)}
                    className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      activeSection === s.slug
                        ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                        : "text-[var(--color-body-text)] hover:bg-white/[0.04] hover:text-[var(--color-dark)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {s.icon}
                      {s.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {/* Mobile nav */}
          <div className="mb-6 overflow-x-auto lg:hidden">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveSection("auth")}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeSection === "auth"
                    ? "bg-[var(--color-gold)] text-[var(--color-light)]"
                    : "bg-white/[0.04] text-[var(--color-body-text)]"
                }`}
              >
                Auth
              </button>
              {SECTIONS.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setActiveSection(s.slug)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeSection === s.slug
                      ? "bg-[var(--color-gold)] text-[var(--color-light)]"
                      : "bg-white/[0.04] text-[var(--color-body-text)]"
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {activeSection === "auth" ? (
            <div className="max-w-3xl space-y-8">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Authentication</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-body-text)]">
                  All API requests require a Bearer token in the Authorization header.
                  API keys are scoped — each key has specific permissions that control
                  which endpoints it can access.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <h3 className="mb-3 text-sm font-semibold">Making Requests</h3>
                <div className="flex items-center justify-between rounded-lg bg-[var(--color-light)] px-4 py-3">
                  <code className="text-xs text-[var(--color-body-text)]">
                    Authorization: Bearer sk_live_your_api_key_here
                  </code>
                  <CopyButton text="Authorization: Bearer sk_live_your_api_key_here" />
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <h3 className="mb-3 text-sm font-semibold">Example Request</h3>
                <pre className="overflow-x-auto rounded-lg bg-[var(--color-light)] p-4 text-xs leading-relaxed text-[var(--color-body-text)]">
{`curl https://storageads.com/api/v1/facilities \\
  -H "Authorization: Bearer sk_live_abc123" \\
  -H "Content-Type: application/json"`}
                </pre>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <h3 className="mb-3 text-sm font-semibold">Available Scopes</h3>
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {[
                    "facilities:read",
                    "facilities:write",
                    "leads:read",
                    "leads:write",
                    "tenants:read",
                    "tenants:write",
                    "units:read",
                    "units:write",
                    "calls:read",
                    "pages:read",
                    "webhooks:manage",
                  ].map((scope) => (
                    <div
                      key={scope}
                      className="rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[var(--color-body-text)]"
                    >
                      {scope}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
                <h3 className="mb-3 text-sm font-semibold">Rate Limiting</h3>
                <p className="text-xs text-[var(--color-body-text)] leading-relaxed">
                  Default rate limit is <strong className="text-[var(--color-dark)]">60 requests/minute</strong> per API key.
                  Rate limit headers are included in every response:
                </p>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex gap-3">
                    <code className="text-[var(--color-mid-gray)]">X-RateLimit-Limit</code>
                    <span className="text-[var(--color-body-text)]">Maximum requests per window</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-[var(--color-mid-gray)]">X-RateLimit-Remaining</code>
                    <span className="text-[var(--color-body-text)]">Requests remaining</span>
                  </div>
                  <div className="flex gap-3">
                    <code className="text-[var(--color-mid-gray)]">X-RateLimit-Reset</code>
                    <span className="text-[var(--color-body-text)]">Seconds until window resets</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
                <h3 className="mb-2 text-sm font-semibold text-amber-400">Error Responses</h3>
                <p className="text-xs text-[var(--color-body-text)] leading-relaxed mb-3">
                  All errors return a consistent JSON format:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-[var(--color-light)] p-4 text-xs leading-relaxed text-[var(--color-body-text)]">
{`{
  "error": "Descriptive error message",
  "code": "INVALID_API_KEY",
  "status": 401
}`}
                </pre>
              </div>
            </div>
          ) : section ? (
            <div className="max-w-3xl space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[var(--color-gold)]">
                  {section.icon}
                  <span className="text-xs font-medium uppercase tracking-wider">
                    {section.title}
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
                <p className="mt-2 text-sm text-[var(--color-body-text)]">{section.description}</p>
              </div>
              <div className="space-y-3">
                {section.endpoints.map((ep, i) => (
                  <EndpointCard key={i} endpoint={ep} />
                ))}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
