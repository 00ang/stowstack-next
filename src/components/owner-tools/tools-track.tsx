"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ActionFill } from "@/components/ontology/action-fill";
import { useFlow } from "@/components/flow/flow-context";
import { typeHue } from "@/lib/ontology/registry";
import type { ObjectTypeKey, Ontology } from "@/lib/ontology/types";
import type { ToolKey } from "@/lib/ontology/types";
import { SkyBand } from "@/components/design/dl003/ui";
import {
  stationAhead,
  stationInputs,
  trackSuggestion,
  type StationStatus,
  type ToolTrack,
  type TrackChoice,
  type TrackStation,
} from "@/lib/tools-track/build";

/**
 * The Tools track. A sentence ("I want to fill 10×10 drive-up by Oct 31")
 * and the stations that get there. The open station's own tool sits in the
 * drawer; on a phone the drawer is a sheet. The portal's next-move bar
 * carries the one hand-off.
 */

/** So a late cleanup from a replaced render can't wipe the move the new one just set. */
let trackOverrideGen = 0;

const STATUS_WORD: Record<StationStatus, string> = {
  done: "Done",
  now: "Now",
  next: "Next",
  ready: "Ready",
  waiting: "Waiting",
  gap: "Gap",
  counts: "Counts",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Swatch({ type }: { type: ObjectTypeKey }) {
  return <i aria-hidden className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: typeHue(type) }} />;
}

function Pill({ status }: { status: StationStatus }) {
  const tone: Record<StationStatus, string> = {
    done: "border-[#AFAFB9] text-[var(--ic-secondary)]",
    now: "border-[var(--ic-selected)] bg-[var(--ic-selected)] text-white",
    next: "border-[var(--ic-ink)] bg-[var(--ic-pane)]",
    ready: "border-[var(--ic-ink)] bg-[var(--act-5)]",
    waiting: "border-[var(--ic-ink)] bg-[var(--act-2)]",
    gap: "border-[var(--ic-ink)] bg-[var(--ic-pane)]",
    counts: "border-[#AFAFB9] text-[var(--ic-secondary)]",
  };
  return <span className={`ic-label border px-1 py-px text-[9.5px] ${tone[status]}`}>{STATUS_WORD[status]}</span>;
}

function stationClass(station: TrackStation, outlined: boolean): string {
  const done = station.status === "done" ? " bg-[#F4F4F6]" : " bg-[var(--ic-pane)]";
  const waiting = station.status === "waiting" ? " shadow-[inset_0_-4px_0_var(--act-2)]" : "";
  const outline = outlined ? " outline outline-[3px] -outline-offset-[3px] outline-[var(--ic-selected)]" : "";
  return `relative border border-[var(--ic-ink)] text-left${done}${waiting}${outline}`;
}

function HandOff({
  n,
  href,
  onClick,
  title,
  detail,
}: {
  n: number;
  href?: string;
  onClick?: () => void;
  title: string;
  detail: string;
}) {
  const cls = "act-fill flex w-full flex-col items-start px-3 py-2 text-left text-[14px] font-extrabold leading-tight";
  const body = (
    <>
      <span>{title}</span>
      <span className="mt-0.5 text-[12px] font-semibold">{detail}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} data-fill={String((n % 6) + 1)} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" data-fill={String((n % 6) + 1)} onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function publishNote(station: TrackStation): string {
  if (station.tool === "ad-publisher" && station.state === "gap" && station.handoff === "nothing to run yet") {
    return "Created paused once there's an ad. Nothing spends until you switch it on.";
  }
  return station.handoff;
}

export function ToolsTrack({
  track,
  ontology,
  openTool,
  sample,
  choices,
  campaignsBase,
  onSelectFocus,
  onOpen,
  onClose,
  onAllTools,
  onFullTool,
  toolPane,
}: {
  track: ToolTrack;
  ontology: Ontology;
  /** Station whose drawer is open, or null when the operator closed it. */
  openTool: ToolKey | null;
  sample: boolean;
  choices: TrackChoice[];
  campaignsBase?: string;
  onSelectFocus: (address: string) => void;
  onOpen: (tool: ToolKey) => void;
  onClose: () => void;
  onAllTools: () => void;
  onFullTool: () => void;
  toolPane: ReactNode;
}) {
  const narrow = useNarrow();
  const flow = useFlow();
  const setOverride = flow?.setOverride;
  const suggestion = trackSuggestion(track, openTool);
  const suggestionKey = `${suggestion.sentence}|${suggestion.reason}|${suggestion.label}|${suggestion.tool ?? ""}`;

  useEffect(() => {
    if (!setOverride) return;
    const mine = ++trackOverrideGen;
    setOverride({
      sentence: suggestion.sentence,
      reason: suggestion.reason,
      label: suggestion.label,
      onDo: () => {
        if (suggestion.tool) onOpen(suggestion.tool);
        else window.location.assign("/portal/upload");
      },
    });
    return () => {
      if (trackOverrideGen === mine) setOverride(null);
    };
    // suggestionKey stands for the suggestion; onOpen is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestionKey, setOverride]);

  useEffect(() => {
    if (!openTool) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTool, onClose]);

  if (!track.stations.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 bg-[var(--ic-ground)] px-4 py-6 text-[var(--ic-ink)]">
        <h2 className="text-[22px] font-extrabold">{track.intent.sentence}</h2>
        <p className="max-w-md text-[14px] font-semibold text-[var(--ic-secondary)]">Every station reads from your unit mix.</p>
        <div className="flex flex-wrap gap-2">
          <ActionFill href="/portal/upload" n={0}>
            Upload the unit mix
          </ActionFill>
          <button type="button" onClick={onAllTools} className="h-10 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 text-[13px] font-extrabold">
            All tools
          </button>
        </div>
      </div>
    );
  }

  const options =
    track.focus && !choices.some((c) => c.address === track.focus)
      ? [{ address: track.focus, label: track.intent.object }, ...choices]
      : choices;
  const open = openTool ? track.stations.find((s) => s.tool === openTool) ?? null : null;
  const inputs = open ? stationInputs(track, open.tool, ontology) : [];
  const ahead = open ? stationAhead(track, open.tool) : [];
  const next = open ? track.stations.find((s) => s.n === open.n + 1) ?? null : null;
  const campaignHref = track.savesInto && campaignsBase ? `${campaignsBase}/${encodeURIComponent(track.savesInto.id)}` : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ic-ground)] text-[var(--ic-ink)]">
      {sample && <SkyBand variant="strip" label="003 · A sky · thin strip · stations stay white" />}
      <div className={`shrink-0 px-3 pb-2 pt-3 sm:px-4${sample ? " d3-sage-band" : ""}`}>
        {sample && <div className="d3-kicker mb-2">003 · sage band · one question, the intent</div>}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <span className="text-[22px] font-extrabold leading-none">I want to</span>
          <select
            aria-label="What you want to do"
            value={track.focus ?? ""}
            onChange={(e) => onSelectFocus(e.target.value)}
            className="h-10 max-w-[22rem] border-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2 text-[18px] font-extrabold"
          >
            {options.map((c) => (
              <option key={c.address} value={c.address}>
                {c.address === track.focus ? `${track.intent.verb} ${track.intent.object}` : `fill ${c.label}`}
              </option>
            ))}
          </select>
          {track.intent.by && (
            <>
              <span className="text-[22px] font-extrabold leading-none">by</span>
              <span className="inline-flex h-10 items-center border-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] px-3 text-[18px] font-extrabold">
                {track.intent.by}
              </span>
            </>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {track.savesInto && (
              <>
                <span className="ic-label text-[10px] text-[var(--ic-instruction)]">Saves into</span>
                {campaignHref ? (
                  <Link
                    href={campaignHref}
                    className="inline-flex h-8 items-center gap-1.5 border px-2 text-[13px] font-extrabold"
                    style={{ borderColor: "var(--onto-campaigns)" }}
                  >
                    <Swatch type="campaigns" />
                    {track.savesInto.name}
                  </Link>
                ) : (
                  <span className="inline-flex h-8 items-center gap-1.5 border border-[var(--ic-ink)] px-2 text-[13px] font-extrabold">
                    <Swatch type="campaigns" />
                    {track.savesInto.name}
                  </span>
                )}
                {sample && <span className="ic-label border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-1.5 py-1 text-[10px]">Sample</span>}
                {campaignHref && (
                  <ActionFill href={campaignHref} n={2} className="h-8 min-h-0 px-2.5 text-[12.5px] font-extrabold">
                    See it on the canvas
                  </ActionFill>
                )}
              </>
            )}
            <button type="button" onClick={onAllTools} className="h-8 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2.5 text-[13px] font-extrabold">
              All tools
            </button>
          </div>
        </div>

        <div className="border-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] p-3 md:hidden">
          <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">I want to</div>
          <div className="text-[20px] font-extrabold leading-snug">
            <span className="capitalize">{track.intent.verb}</span>{" "}
            <select
              aria-label="What you want to do"
              value={track.focus ?? ""}
              onChange={(e) => onSelectFocus(e.target.value)}
              className="max-w-[14rem] appearance-none border-b-[3px] border-[var(--ic-selected)] bg-transparent font-extrabold"
            >
              {options.map((c) => (
                <option key={c.address} value={c.address}>
                  {c.label}
                </option>
              ))}
            </select>
            {track.intent.by && (
              <>
                {" "}
                by <span className="border-b-[3px] border-[var(--ic-selected)]">{track.intent.by}</span>
              </>
            )}
          </div>
          {track.savesInto && (
            <div className="ic-label mt-1.5 text-[10.5px] normal-case tracking-normal" style={{ color: "var(--onto-campaigns)" }}>
              Track = {track.savesInto.name}
              {sample ? " · sample" : ""}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 sm:px-4">
        <ol aria-label="Stations" className="relative hidden grid-cols-7 gap-x-5 md:grid">
          <span aria-hidden className="pointer-events-none absolute left-6 right-6 top-1/2 border-t-2 border-[var(--ic-ink)]" />
          {track.stations.map((station) => {
            const outlined = open ? station.tool === open.tool : station.status === "now";
            return (
              <li key={station.tool} className="relative z-[1]">
                <button
                  type="button"
                  onClick={() => onOpen(station.tool)}
                  aria-current={outlined ? "true" : undefined}
                  title={station.why ?? undefined}
                  className={`${stationClass(station, outlined)} w-full px-2.5 py-2`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="ic-label text-[10px] text-[var(--ic-instruction)]">{pad(station.n)}</span>
                    <Pill status={station.status} />
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[15px] font-extrabold leading-tight">
                    <Swatch type={station.hue} />
                    <span className="min-w-0">{station.label}</span>
                  </span>
                  <span className="mt-1.5 block">
                    <span className="ic-label block text-[9.5px] text-[var(--ic-instruction)]">{station.verb}</span>
                    <span className="block text-[12.5px] font-bold leading-snug">{station.handoff}</span>
                  </span>
                </button>
                {station.n < track.stations.length && (
                  <span aria-hidden className="absolute -right-3.5 top-1/2 z-[2] -translate-y-1/2 text-[14px] leading-none">
                    ▸
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <ol aria-label="Stations" className="relative ml-2 border-l-2 border-[var(--ic-ink)] pl-4 md:hidden">
          {track.stations.map((station) => {
            const outlined = open ? station.tool === open.tool : station.status === "now";
            const filled = station.status === "done" || station.status === "now";
            return (
              <li key={station.tool} className="relative mb-1.5">
                <span
                  aria-hidden
                  className="absolute -left-[22px] top-3.5 h-2.5 w-2.5 border-2 border-[var(--ic-ink)]"
                  style={{ background: filled ? (station.status === "now" ? "var(--ic-selected)" : "var(--ic-ink)") : "var(--ic-pane)", borderColor: station.status === "now" ? "var(--ic-selected)" : "var(--ic-ink)" }}
                />
                <button
                  type="button"
                  onClick={() => onOpen(station.tool)}
                  aria-current={outlined ? "true" : undefined}
                  className={`${stationClass(station, outlined)} w-full px-2.5 py-2`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold">
                      <Swatch type={station.hue} />
                      <span className="truncate">{station.label}</span>
                    </span>
                    <Pill status={station.status} />
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-semibold text-[var(--ic-secondary)]">
                    {station.state === "done" || station.state === "ready" || station.state === "counts"
                      ? `${station.verb.toLowerCase()} ${station.handoff}`
                      : station.handoff}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {open && !narrow && (
        <section
          role="dialog"
          aria-label={`${open.label} station`}
          className="mx-3 mb-3 mt-3 hidden min-h-0 flex-1 flex-col border-2 border-[var(--ic-ink)] bg-[var(--ic-pane)] md:mx-4 md:flex"
        >
          <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--ic-ink)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Station {pad(open.n)} · open here</div>
              <h2 className="mt-0.5 flex flex-wrap items-center gap-2 text-[22px] font-extrabold leading-tight">
                {open.label}
                {track.focus && track.focusType && (
                  <>
                    <span className="text-[16px] font-semibold text-[var(--ic-secondary)]">on</span>
                    <span className="px-1.5 py-0.5 text-[12px] font-bold text-white" style={{ background: typeHue(track.focusType) }}>
                      {track.focus}
                    </span>
                  </>
                )}
              </h2>
            </div>
            <button type="button" onClick={onFullTool} className="h-8 border border-[var(--ic-ink)] bg-[var(--ic-pane)] px-2.5 text-[12.5px] font-extrabold">
              Open full tool
            </button>
            <ActionFill n={3} onClick={onClose} className="h-8 min-h-0 px-2.5 text-[12.5px] font-extrabold">
              Close
            </ActionFill>
          </header>
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(180px,270px)_minmax(0,1fr)_minmax(180px,260px)]">
            <div className="overflow-y-auto border-r border-[#D4D4DC] px-4 py-3">
              <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Came in from the stations before</div>
              <ul className="mt-1">
                {inputs.map((row) => (
                  <li key={`${row.detail}-${row.title}`} className="flex gap-2 border-b border-[#E4E4EA] py-2">
                    <Swatch type={row.hue} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-extrabold leading-snug">{row.title}</span>
                      <span className="block text-[12px] font-semibold text-[var(--ic-secondary)]">{row.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {open.why && <p className="mt-3 text-[13px] font-semibold leading-snug text-[var(--ic-secondary)]">{open.why}</p>}
            </div>
            <div className="flex min-h-0 flex-col bg-[var(--ic-soft)]">
              <div className="min-h-0 flex-1 overflow-auto p-3">{toolPane}</div>
              {ahead.length > 0 && (
                <div className="shrink-0 border-t border-[#C9C9D1] px-3 py-2.5">
                  <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">After the hand-off, down the track</div>
                  <ul className="mt-1.5 grid grid-cols-3 gap-2">
                    {ahead.map((s) => (
                      <li key={s.n} className="border border-[#AFAFB9] bg-[var(--ic-pane)] px-2 py-1.5 text-[12.5px] font-semibold leading-snug">
                        <b className="ic-label mr-1 text-[10px]">{pad(s.n)}</b>
                        {s.label} · {s.handoff}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 overflow-y-auto border-l border-[#D4D4DC] px-4 py-3">
              <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Hand off to</div>
              {next && (
                <HandOff n={0} onClick={() => onOpen(next.tool)} title={`${pad(next.n)} · ${next.label}`} detail={publishNote(next)} />
              )}
              {track.savesInto && campaignHref && (
                <HandOff n={1} href={campaignHref} title={track.savesInto.name} detail="Back to the campaign" />
              )}
              <HandOff
                n={2}
                onClick={onClose}
                title={open.tool === "creative-studio" ? "Keep as drafts" : "Close"}
                detail={open.tool === "creative-studio" ? "In Creative Studio, nothing runs" : "Stay on the track"}
              />
              {sample && <p className="ic-label mt-2 text-[10px] text-[var(--ic-instruction)]">Sample numbers</p>}
            </div>
          </div>
        </section>
      )}

      {open && narrow && (
        <div className="md:hidden">
          <button type="button" aria-label="Close the station" onClick={onClose} className="fixed inset-0 z-30 bg-[rgba(18,18,20,0.28)]" />
          <section
            role="dialog"
            aria-label={`${open.label} station`}
            className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] top-24 z-40 flex flex-col border-t-2 border-[var(--ic-ink)] bg-[var(--ic-pane)]"
          >
            <div aria-hidden className="mx-auto mt-2 h-1 w-11 shrink-0 bg-[var(--ic-ink)]" />
            <div className="shrink-0 px-3 pb-1 pt-2">
              <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">
                Station {pad(open.n)} · {open.label}
                {track.focus && track.focusType && (
                  <>
                    {" "}
                    on{" "}
                    <span className="px-1 py-px text-[10px] font-bold normal-case tracking-normal text-white" style={{ background: typeHue(track.focusType) }}>
                      {track.focus}
                    </span>
                  </>
                )}
              </div>
              <h2 className="mt-0.5 text-[20px] font-extrabold leading-tight">{open.why ?? open.handoff}</h2>
              {inputs.length > 0 && (
                <p className="mt-1 text-[12.5px] font-semibold text-[var(--ic-secondary)]">in: {inputs.map((i) => i.title).join(" · ")}</p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3">{toolPane}</div>
            <div className="shrink-0 space-y-1.5 border-t border-[var(--ic-ink)] px-3 py-2.5">
              <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Hand off to</div>
              {next && <HandOff n={0} onClick={() => onOpen(next.tool)} title={`${pad(next.n)} · ${next.label}`} detail={publishNote(next)} />}
              {track.savesInto && campaignHref && <HandOff n={1} href={campaignHref} title={track.savesInto.name} detail="Back to the campaign" />}
              <HandOff
                n={4}
                onClick={onClose}
                title={open.tool === "creative-studio" ? "Keep as drafts" : "Close"}
                detail={open.tool === "creative-studio" ? "Nothing runs" : "Stay on the track"}
              />
            </div>
          </section>
        </div>
      )}

      {!open && (
        <div className="px-3 py-3 md:hidden">
          {track.now && (
            <ActionFill n={0} onClick={() => onOpen(track.now!)} className="w-full">
              Open {track.stations.find((s) => s.tool === track.now)?.label}
            </ActionFill>
          )}
        </div>
      )}
    </div>
  );
}
