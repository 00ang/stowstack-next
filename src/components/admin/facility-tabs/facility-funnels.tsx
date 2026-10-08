"use client";

import { useMemo, useState, useCallback } from "react";
import { useAdminFetch, adminFetch } from "@/hooks/use-admin-fetch";
import { useOntology } from "@/components/ontology/use-ontology";
import { emptyGraph, nextMove, buildTemplate, TEMPLATE_KEYS, templateBlurb, templateMeta, type TemplateKey } from "@/lib/funnel-graph";
import { funnelContextFromOntology } from "@/components/campaigns/context";
import { NextMoveBar } from "@/components/campaigns/next-move-bar";
import { CampaignStage } from "@/components/campaigns/campaign-stage";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import {
  GitBranch,
  Plus,
  ChevronRight,
  Eye,
  FileText,
  MousePointerClick,
  Users,
  Loader2,
  Sparkles,
  Mail,
  Smartphone,
  ExternalLink,
} from "lucide-react";

interface FunnelSummary {
  id: string;
  name: string;
  archetype: string | null;
  status: string;
  created_at: string;
  published_at: string | null;
  ad_variations: { id: string; status: string; platform: string; angle: string }[];
  landing_pages: { id: string; slug: string; status: string }[];
  _count: { partial_leads: number };
}

const ARCHETYPE_LABELS: Record<string, string> = {
  social_proof: "Trusted Choice",
  convenience: "Easy Move",
  urgency: "Last Chance",
  lifestyle: "Fresh Start",
  custom: "Custom",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-[var(--color-light-gray)] text-[var(--color-body-text)]",
  testing: "bg-blue-50 text-[var(--color-blue)]",
  live: "bg-green-50 text-[var(--color-green)]",
  paused: "bg-amber-50 text-amber-700",
  archived: "bg-gray-100 text-gray-500",
};

export default function FacilityFunnels({
  facilityId,
  adminKey,
  facilityName,
}: {
  facilityId: string;
  adminKey: string;
  facilityName: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: funnels, loading, refetch } = useAdminFetch<FunnelSummary[]>(
    "/api/funnels",
    { facilityId }
  );

  const handleGenerate = useCallback(
    async (archetype: string) => {
      setGenerating(true);
      try {
        await adminFetch("/api/funnels/generate", {
          method: "POST",
          body: JSON.stringify({ facilityId, archetype }),
        });
        refetch();
        setShowCreate(false);
      } catch (err) {
        console.error("Failed to generate funnel:", err);
      } finally {
        setGenerating(false);
      }
    },
    [facilityId, refetch]
  );

  const open = funnels?.find((f) => f.id === openId) ?? null;
  const sample = isPortalDemo();
  const ontology = useOntology(openId ? null : { kind: "manage", facilityId });
  const ctx = useMemo(() => funnelContextFromOntology(ontology.data, sample), [ontology.data, sample]);
  const listMove = nextMove(emptyGraph({ goal: ctx.goal ?? null }), ctx);

  const startTemplate = useCallback(
    async (key: TemplateKey) => {
      const graph = buildTemplate(key, ctx);
      const created = await adminFetch<{ id: string }>("/api/funnels", {
        method: "POST",
        body: JSON.stringify({ facilityId, name: graph.name, archetype: "custom", config: { graph } }),
      });
      setShowCreate(false);
      setOpenId(created.id);
      refetch();
    },
    [ctx, facilityId, refetch],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[var(--color-mid-gray)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--color-dark)]">Campaigns</h2>
          <p className="text-sm text-[var(--color-body-text)] break-words">
            Ad-to-move-in paths for {facilityName}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--color-dark)] text-[var(--color-light)] rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">New campaign</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {open ? (
        <CampaignStage facilityId={facilityId} funnelId={open.id} onBack={() => setOpenId(null)} />
      ) : !funnels?.length ? (
        <div className="rounded-xl border border-black/[0.08] bg-[var(--color-light)] p-10 text-center">
          <GitBranch size={36} className="mx-auto text-[var(--color-mid-gray)] mb-3" />
          <p className="text-[var(--color-dark)] font-medium mb-1">No campaigns yet</p>
          <p className="text-sm text-[var(--color-body-text)] mb-4">
            Start one from a goal. An ad, a page, and a follow-up come with it.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-dark)] text-[var(--color-light)] rounded-lg"
          >
            <Sparkles size={14} />
            New campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {funnels.map((funnel) => (
            <button
              key={funnel.id}
              type="button"
              onClick={() => setOpenId(funnel.id)}
              className="group block w-full rounded-xl border border-black/[0.08] bg-white p-4 text-left hover:border-black/[0.16] transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <GitBranch size={18} className="text-[var(--color-dark)] shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-[var(--color-dark)] truncate">{funnel.name}</h3>
                    <p className="text-xs text-[var(--color-body-text)]">
                      {ARCHETYPE_LABELS[funnel.archetype || "custom"]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[funnel.status] || STATUS_STYLES.draft}`}>
                    {funnel.status}
                  </span>
                  <ChevronRight size={16} className="text-[var(--color-mid-gray)] group-hover:text-[var(--color-dark)] transition-colors" />
                </div>
              </div>

              {/* Mini funnel path */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-light-gray)]">
                  <Eye size={10} /> {funnel.ad_variations.length} ad{funnel.ad_variations.length !== 1 ? "s" : ""}
                </span>
                <ChevronRight size={10} className="text-[var(--color-mid-gray)]" />
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-light-gray)]">
                  <FileText size={10} /> {funnel.landing_pages.length} page{funnel.landing_pages.length !== 1 ? "s" : ""}
                </span>
                <ChevronRight size={10} className="text-[var(--color-mid-gray)]" />
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-light-gray)]">
                  <Users size={10} /> {funnel._count.partial_leads} lead{funnel._count.partial_leads !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!open && (
        <>
          {showTemplates && (
            <div className="space-y-2">
              {TEMPLATE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setShowTemplates(false);
                    void startTemplate(key).catch(() => {});
                  }}
                  className="block w-full border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 py-2 text-left"
                >
                  <span className="font-extrabold text-[var(--ic-ink)]">{templateMeta(key).name}</span>
                  <span className="mt-1 block text-[13px] font-semibold text-[var(--ic-secondary)]">{templateBlurb(key, ctx)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="sticky bottom-0 z-10 -mx-4 mt-4 md:-mx-6">
            <NextMoveBar move={listMove} onDo={() => setShowTemplates(true)} />
          </div>
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-[var(--color-dark)] mb-1 break-words">
              New campaign for {facilityName}
            </h2>
            <p className="text-sm text-[var(--color-body-text)] mb-5">
              Pick an archetype. We generate the ad, landing page, drip sequence, and recovery flow.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "social_proof", label: "Trusted Choice", desc: "Lead with trust signals and reviews" },
                { key: "convenience", label: "Easy Move", desc: "Proximity, speed, zero friction" },
                { key: "urgency", label: "Last Chance", desc: "Scarcity-backed inventory pressure" },
                { key: "lifestyle", label: "Fresh Start", desc: "Emotional hook, nurture over 2 weeks" },
              ].map((arch) => (
                <button
                  key={arch.key}
                  onClick={() => handleGenerate(arch.key)}
                  disabled={generating}
                  className="rounded-xl border border-black/[0.08] p-4 text-left hover:border-black/[0.2] transition-colors disabled:opacity-50"
                >
                  <p className="font-medium text-sm text-[var(--color-dark)]">{arch.label}</p>
                  <p className="text-xs text-[var(--color-body-text)] mt-1">{arch.desc}</p>
                </button>
              ))}
            </div>

            {generating && (
              <div className="flex items-center justify-center gap-2 mt-4 py-3 rounded-lg bg-[var(--color-light)]">
                <Loader2 size={16} className="animate-spin text-[var(--color-dark)]" />
                <span className="text-sm text-[var(--color-dark)]">Generating complete funnel...</span>
              </div>
            )}

            <button
              onClick={() => setShowCreate(false)}
              disabled={generating}
              className="mt-4 w-full py-2 text-sm text-[var(--color-body-text)] hover:text-[var(--color-dark)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
