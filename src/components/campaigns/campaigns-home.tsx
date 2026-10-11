"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { adminFetch, useAdminFetch } from "@/hooks/use-admin-fetch";
import { ActionFill } from "@/components/ontology/action-fill";
import { ObjectMark, TypeGlyph } from "@/components/ontology/object-mark";
import { useFlow } from "@/components/flow/flow-context";
import { campaignHref, type Pace } from "@/lib/flow";
import type { Ontology } from "@/lib/ontology/types";
import {
  CATALOG,
  TEMPLATE_KEYS,
  buildTemplate,
  pathToMoveIn,
  readGraph,
  readyCount,
  suggestTemplate,
  templateBlurb,
  templateMeta,
  type FunnelContext,
  type FunnelGraph,
  type TemplateKey,
} from "@/lib/funnel-graph";
import { isPortalDemo } from "@/lib/portal-demo/demo-mode";
import { CampaignLiveCard, SkyBand } from "@/components/design/dl003/ui";
import { funnelContextFromOntology } from "./context";
import { NodeIcon } from "./icons";

/**
 * Regions here are divs, not <section>s: the site-wide .urbit-landing rule
 * repaints every section with the page ground.
 *
 * Campaigns, as the operator meets them: start from the month's goal, or open
 * a campaign that is already a path from an ad to a move-in. The suggestion is
 * chosen from the facility's own facts (suggestTemplate) and says which facts
 * chose it. Opening one goes to its builder, /portal/campaigns/[id].
 */

interface FunnelRow {
  id: string;
  name: string;
  status: string;
  archetype: string | null;
  config?: unknown;
  ad_variations: { id: string }[];
  landing_pages: { id: string }[];
  _count: { partial_leads: number };
}

/** The funnel rules' facts, with the month's goal as the campaign goal. */
export function useGoalContext(ontology: Ontology | null, pace: Pace | null, sample: boolean): FunnelContext {
  return useMemo(() => {
    const base = funnelContextFromOntology(ontology, sample);
    if (pace && pace.target > 0) base.goal = { moveIns: pace.target, month: pace.monthName };
    return base;
  }, [ontology, pace, sample]);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The template's functions in order, as a line of glyphs and names. */
function PathLine({ graph }: { graph: FunnelGraph }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5" aria-label="Functions, in order">
      {graph.nodes.map((node, i) => {
        const def = CATALOG[node.type];
        return (
          <li key={node.id} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight aria-hidden className="h-3 w-3 text-[var(--ic-instruction)]" />}
            <span className="inline-flex items-center gap-1 border border-[var(--ic-ink)]/25 bg-[var(--ic-pane)] px-1.5 py-0.5 text-[12px] font-bold text-[var(--ic-ink)]">
              <NodeIcon name={def.icon} className="h-3.5 w-3.5" color={def.hue} />
              {def.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function GoalPanel({
  onStart,
  creating,
  error,
  compact,
}: {
  onStart: (key: TemplateKey) => void;
  creating: TemplateKey | null;
  error: string | null;
  compact: boolean;
}) {
  const flow = useFlow();
  const sample = isPortalDemo();
  const ctx = useGoalContext(flow?.ontology ?? null, flow?.pace ?? null, sample);
  const suggestion = suggestTemplate(ctx);
  const preview = useMemo(() => buildTemplate(suggestion.key, ctx), [suggestion.key, ctx]);
  const others = TEMPLATE_KEYS.filter((k) => k !== suggestion.key);

  return (
    <div role="region" aria-labelledby="goal-build-heading" className="border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
      <div className="border-b border-[var(--ic-ink)] px-5 py-4">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">
          Build from your goal{flow?.pace && flow.pace.target > 0 ? ` · ${flow.pace.line}` : ""}
        </div>
        <h2 id="goal-build-heading" className="mt-1 text-[22px] font-extrabold leading-tight text-[var(--ic-ink)]">
          {templateMeta(suggestion.key).name}
        </h2>
        <ul className="mt-2 space-y-0.5">
          {suggestion.because.map((line) => (
            <li key={line} className="text-[14px] font-semibold leading-snug text-[var(--ic-secondary)]">
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <PathLine graph={preview} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ActionFill n={0} onClick={() => onStart(suggestion.key)}>
            {creating === suggestion.key ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Building…
              </span>
            ) : (
              "Build it"
            )}
          </ActionFill>
          <span className="text-[13px] font-semibold text-[var(--ic-secondary)]">
            Opens as a draft. Nothing goes live until you publish.
          </span>
        </div>
        {sample && (
          <div className="ic-label mt-3 text-[10px] text-[var(--ic-instruction)]">Sample facility · counts are sample</div>
        )}
        {error && (
          <div role="alert" className="mt-3 border-l-2 border-[var(--color-red)] pl-3 text-[13px] font-semibold text-[var(--ic-ink)]">
            {error}
          </div>
        )}
      </div>
      {!compact && (
        <ul>
          {others.map((key) => (
            <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--ic-ink)]/15 px-5 py-3 last:border-b-0">
              <div className="min-w-0 flex-1 basis-64">
                <div className="text-[15px] font-extrabold text-[var(--ic-ink)]">{templateMeta(key).name}</div>
                <div className="text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">{templateBlurb(key, ctx)}</div>
              </div>
              <button
                type="button"
                onClick={() => onStart(key)}
                className="shrink-0 text-[13px] font-extrabold text-[var(--ic-ink)] underline underline-offset-4"
              >
                {creating === key ? "Building…" : "Build this instead"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignRow({ row }: { row: FunnelRow }) {
  const flow = useFlow();
  const graph = readGraph(row.config);
  const counts = graph ? readyCount(graph) : null;
  const closed = graph ? pathToMoveIn(graph) : null;
  const object = flow?.ontology?.objects.find((o) => o.type === "campaigns" && o.id === row.id);
  const working = flow?.working?.id === row.id;

  return (
    <li>
      <Link
        href={campaignHref(row.id)}
        className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--ic-ink)]/15 px-5 py-4 hover:bg-[var(--ic-soft)]"
      >
        {object ? <ObjectMark address={object.address} type="campaigns" size={32} /> : <TypeGlyph type="campaigns" className="h-8 w-8" />}
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[16px] font-extrabold text-[var(--ic-ink)] group-hover:underline group-hover:underline-offset-4">{row.name}</span>
            <span className="ic-label text-[10.5px] text-[var(--ic-secondary)]">{row.status}</span>
            {working && <span className="ic-label text-[10.5px] text-[var(--ic-selected)]">· working on</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-[var(--ic-secondary)]">
            <span className="inline-flex items-center gap-1">
              <TypeGlyph type="ads" className="h-3.5 w-3.5" />
              {plural(row.ad_variations.length, "ad")}
            </span>
            <ArrowRight aria-hidden className="h-3 w-3" />
            <span className="inline-flex items-center gap-1">
              <TypeGlyph type="pages" className="h-3.5 w-3.5" />
              {plural(row.landing_pages.length, "page")}
            </span>
            <ArrowRight aria-hidden className="h-3 w-3" />
            <span className="inline-flex items-center gap-1">
              <TypeGlyph type="leads" className="h-3.5 w-3.5" />
              {plural(row._count.partial_leads, "lead")}
            </span>
          </div>
        </div>
        {counts && counts.total > 0 ? (
          <div className="ic-label shrink-0 text-right text-[10.5px] leading-snug text-[var(--ic-secondary)]">
            <b className="mr-1 font-sans text-[18px] font-extrabold normal-case tracking-normal text-[var(--ic-selected)]">{counts.ready}</b>
            of {counts.total} ready
            <br />
            path to move-in: {closed ? "closed" : "open"}
          </div>
        ) : (
          <div className="ic-label shrink-0 text-[10.5px] text-[var(--ic-secondary)]">Open to draw its path</div>
        )}
      </Link>
    </li>
  );
}

/**
 * Build a campaign from a template and open its builder. The new campaign is
 * the one being worked on from then on. `before` runs first (onboarding
 * finishes itself there), so a failure stops before anything is created.
 */
export function useStartCampaign(facilityId: string) {
  const router = useRouter();
  const flow = useFlow();
  const [creating, setCreating] = useState<TemplateKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = useCallback(
    async (key: TemplateKey, ctx: FunnelContext, before?: () => Promise<void>) => {
      setCreating(key);
      setError(null);
      try {
        if (before) await before();
        const graph = buildTemplate(key, ctx);
        const created = await adminFetch<{ id: string }>("/api/funnels", {
          method: "POST",
          body: JSON.stringify({ facilityId, name: graph.name, archetype: "custom", config: { graph } }),
        });
        if (!created?.id) throw new Error("no id");
        flow?.setWorking({ id: created.id, name: graph.name ?? templateMeta(key).name, status: "draft", move: null });
        router.push(campaignHref(created.id));
      } catch (err) {
        setError(
          before && err instanceof Error && err.message
            ? err.message
            : "Couldn't start that campaign. Nothing was saved; try again.",
        );
        setCreating(null);
      }
    },
    [facilityId, flow, router],
  );
  return { start, creating, error };
}

export function CampaignsHome({ facilityId }: { facilityId: string }) {
  const flow = useFlow();
  const sample = isPortalDemo();
  const params = useMemo(() => ({ facilityId }), [facilityId]);
  const { data: rows, loading, error, refetch } = useAdminFetch<FunnelRow[]>("/api/funnels", params);
  const { start, creating, error: createError } = useStartCampaign(facilityId);
  // ?new=goal (the bar's "Start from your goal") opens the goal panel. Read
  // through the router so an in-app link sees its own URL, not the last page's.
  const askedForNew = useSearchParams().get("new") === "goal";
  const [panelOpenByHand, setPanelOpen] = useState(false);
  const panelOpen = panelOpenByHand || askedForNew;

  const ctx = useGoalContext(flow?.ontology ?? null, flow?.pace ?? null, sample);
  const suggestion = suggestTemplate(ctx);


  // With nothing being built, the bar's move on this page is the goal-first build.
  const startRef = useRef((key: TemplateKey) => start(key, ctx));
  useEffect(() => {
    startRef.current = (key: TemplateKey) => start(key, ctx);
  });
  const setOverride = flow?.setOverride;
  const working = flow?.working ?? null;
  const reason = suggestion.because.join(" ");
  useEffect(() => {
    if (!setOverride) return;
    if (working) {
      setOverride(null);
      return;
    }
    setOverride({
      sentence: `Build "${templateMeta(suggestion.key).name}".`,
      reason,
      label: "Build it",
      onDo: () => void startRef.current(suggestion.key),
    });
  }, [setOverride, working, suggestion.key, reason]);
  useEffect(() => () => setOverride?.(null), [setOverride]);

  const hasRows = !!rows && rows.length > 0;

  return (
    <div className="pb-16">
      {sample && (
        <div data-dl003="campaigns">
          <SkyBand variant="hero" short label="003 · A sky · hero band · list stays white" />
          <div className="mx-auto w-full max-w-5xl px-4 md:px-6">
            <CampaignLiveCard />
          </div>
        </div>
      )}
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Campaigns</div>
          <h2 className="text-[24px] font-extrabold leading-tight text-[var(--ic-ink)]">From an ad to a move-in</h2>
          <div className="mt-1 text-[14px] font-semibold text-[var(--ic-secondary)]">
            Each campaign is a path of functions you can see, change and connect.
          </div>
        </div>
        {hasRows && !panelOpen && (
          <ActionFill n={2} onClick={() => setPanelOpen(true)}>
            New campaign
          </ActionFill>
        )}
      </header>

      {loading && !rows ? (
        <div className="flex items-center gap-2 py-10 text-[14px] font-semibold text-[var(--ic-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading your campaigns…
        </div>
      ) : error ? (
        <div role="alert" className="border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-5 py-4">
          <div className="text-[15px] font-extrabold text-[var(--ic-ink)]">Couldn&apos;t read your campaigns.</div>
          <button type="button" onClick={refetch} className="mt-1 text-[13px] font-extrabold underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : (
        <>
          {(!hasRows || panelOpen) && (
            <GoalPanel onStart={(k) => void start(k, ctx)} creating={creating} error={createError} compact={false} />
          )}
          {hasRows && (
            <div role="region" aria-labelledby="campaign-list-heading">
              <h3 id="campaign-list-heading" className="mb-2 text-[15px] font-extrabold text-[var(--ic-ink)]">
                Your campaigns
              </h3>
              <ul className="border border-[var(--ic-ink)] bg-[var(--ic-pane)] [&>li:last-child>a]:border-b-0">
                {rows.map((row) => (
                  <CampaignRow key={row.id} row={row} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}
