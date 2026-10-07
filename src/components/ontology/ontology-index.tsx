"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import { LANES, TYPE_DEFS, TYPE_ORDER, typeOfAddress } from "@/lib/ontology/registry";
import type { ObjectTypeKey, Ontology, OntologyObject } from "@/lib/ontology/types";
import { FacilityInstrument } from "./facility-instrument";
import { ObjectMark, TypeGlyph } from "./object-mark";
import { IcButton } from "./ic-button";
import { actionHref } from "./use-ontology";

/**
 * The index: every object at the facility, by kind, each with its address,
 * its facts, what it is linked to, and what can be done with it. Following a
 * link walks the graph: open a unit, see the leads who asked for that size,
 * open one of them, see the page they came from.
 *
 * State lives in the URL (?t=units, ?o=units/10x10-climate) so any object can
 * be linked to, and the back button behaves. Drawn in Instrument Calm (library
 * entry 008): white panes, ink, mono-caps labels, navy for what's selected.
 */
export function OntologyIndex({ ontology, toolsBase = "/portal/tools" }: { ontology: Ontology; toolsBase?: string }) {
  const byAddress = useMemo(() => new Map(ontology.objects.map((o) => [o.address, o])), [ontology]);
  const [type, setType] = useState<ObjectTypeKey>("units");
  const [open, setOpen] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Read ?o= / ?t= once, on arrival.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const o = params.get("o");
    const t = params.get("t") as ObjectTypeKey | null;
    if (o && byAddress.has(o)) {
      setType(typeOfAddress(o) ?? "units"); // eslint-disable-line react-hooks/set-state-in-effect -- URL is external state
      setOpen(o);
      requestAnimationFrame(() => document.getElementById(rowId(o))?.scrollIntoView({ block: "center" }));
    } else if (t && (TYPE_ORDER as string[]).includes(t)) {
      setType(t);
    } else {
      // Arrive on the first kind that has anything in it.
      const first = TYPE_ORDER.find((k) => ontology.summaries.find((s) => s.type === k)?.count);
      if (first) setType(first);
    }
  }, [byAddress, ontology.summaries]);

  const writeUrl = (next: { t?: ObjectTypeKey; o?: string | null }) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("t");
    url.searchParams.delete("o");
    if (next.o) url.searchParams.set("o", next.o);
    else if (next.t) url.searchParams.set("t", next.t);
    window.history.replaceState(null, "", url.toString().replace(/%2F/g, "/"));
  };

  const selectType = useCallback((t: ObjectTypeKey) => {
    setType(t);
    setOpen(null);
    writeUrl({ t });
    listRef.current?.focus({ preventScroll: true });
  }, []);

  const goTo = useCallback(
    (address: string) => {
      const t = typeOfAddress(address);
      if (!t || !byAddress.has(address)) return;
      setType(t);
      setOpen(address);
      writeUrl({ o: address });
      requestAnimationFrame(() => document.getElementById(rowId(address))?.scrollIntoView({ block: "start", behavior: "smooth" }));
    },
    [byAddress],
  );

  const toggle = (address: string) => {
    const next = open === address ? null : address;
    setOpen(next);
    writeUrl(next ? { o: next } : { t: type });
  };

  const def = TYPE_DEFS[type];
  const lane = LANES.find((l) => l.key === def.lane)!;
  const summary = ontology.summaries.find((s) => s.type === type)!;
  const objects = ontology.objects.filter((o) => o.type === type);

  return (
    <div className="space-y-8">
      <header className="border-b-2 border-[var(--ic-ink)] pb-4">
        <div className="ic-label text-[11px] text-[var(--ic-instruction)]">Index</div>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight text-[var(--ic-ink)]">{ontology.facility.name}</h1>
        <div className="mt-1 text-[15px] font-semibold text-[var(--ic-secondary)]">
          Every unit, offer, ad, lead and review here, each with one address and everything it touches.
        </div>
      </header>

      <FacilityInstrument summaries={ontology.summaries} selected={type} onSelect={selectType} />

      <section aria-labelledby="index-type" ref={listRef} tabIndex={-1} className="outline-none">
        <div className="ic-label text-[11px] text-[var(--ic-instruction)]">
          {lane.label} <span aria-hidden="true">·</span> {lane.definition}
        </div>
        <div className="mt-2 flex items-start gap-3 border-b-2 border-[var(--ic-ink)] pb-3">
          <TypeGlyph type={type} className="mt-1 h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <h2 id="index-type" className="text-[22px] font-extrabold leading-tight text-[var(--ic-ink)]">
              {def.plural} <span className="tabular-nums text-[var(--ic-selected)]">{summary.count}</span>
            </h2>
            <div className="mt-1 text-[14px] font-semibold text-[var(--ic-secondary)]">
              {def.definition} {summary.reading.value} {summary.reading.unit}: {summary.reading.definition.charAt(0).toLowerCase() + summary.reading.definition.slice(1)}
            </div>
          </div>
        </div>

        {objects.length === 0 ? (
          <EmptyKind type={type} toolsBase={toolsBase} />
        ) : (
          <ul className="mt-4 border border-[var(--ic-ink)] bg-[var(--ic-pane)]">
            {objects.map((o) => (
              <ObjectRow
                key={o.address}
                object={o}
                open={open === o.address}
                onToggle={() => toggle(o.address)}
                byAddress={byAddress}
                moves={ontology.moves.filter((m) => m.subject === o.address)}
                goTo={goTo}
                toolsBase={toolsBase}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const rowId = (address: string) => `obj-${address.replace(/[^a-z0-9]+/gi, "-")}`;

function EmptyKind({ type, toolsBase }: { type: ObjectTypeKey; toolsBase: string }) {
  const def = TYPE_DEFS[type];
  const action =
    type === "units"
      ? { label: "Upload your unit mix", href: "/portal/upload" }
      : def.tool
        ? { label: `Open ${toolLabel(def.tool)}`, href: actionHref({ label: "", tool: def.tool }, null, toolsBase) }
        : null;
  return (
    <div className="py-8">
      <div className="text-[15px] font-semibold text-[var(--ic-secondary)]">No {def.plural.toLowerCase()} yet.</div>
      {action && (
        <IcButton href={action.href} className="mt-3">
          {action.label}
        </IcButton>
      )}
    </div>
  );
}

function toolLabel(tool: string): string {
  const labels: Record<string, string> = {
    occupancy: "Occupancy",
    revenue: "Revenue",
    funnels: "Campaign Builder",
    "ad-studio": "Ad Generator",
    "landing-pages": "Landing Pages",
    "utm-links": "Tracking Links",
    gbp: "Google Business",
    "lead-nurture": "Lead Follow-Up",
    tenants: "Tenants",
    "market-intel": "Competitors",
  };
  return labels[tool] ?? "the tools";
}

function ObjectRow({
  object,
  open,
  onToggle,
  byAddress,
  moves,
  goTo,
  toolsBase,
}: {
  object: OntologyObject;
  open: boolean;
  onToggle: () => void;
  byAddress: Map<string, OntologyObject>;
  moves: Ontology["moves"];
  goTo: (address: string) => void;
  toolsBase: string;
}) {
  const id = rowId(object.address);
  return (
    <li id={id} className={`scroll-mt-20 border-b border-[var(--ic-ink)]/20 last:border-b-0 ${open ? "outline outline-[3px] -outline-offset-[3px] outline-[var(--ic-selected)]" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-detail`}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-[240ms] hover:bg-[var(--ic-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ic-selected)] sm:px-4"
      >
        <ObjectMark address={object.address} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-[var(--ic-ink)]">{object.name}</span>
          <span className="ic-label block truncate text-[10.5px] normal-case tracking-[0.02em] text-[var(--ic-instruction)]">{object.address}</span>
        </span>
        {moves.length > 0 && (
          <span className="ic-label shrink-0 text-[10.5px] text-[var(--ic-selected)]">Needs you</span>
        )}
        {object.status && moves.length === 0 && (
          <span className="ic-label hidden shrink-0 text-[10.5px] text-[var(--ic-instruction)] sm:inline">{object.status.replace(/_/g, " ")}</span>
        )}
        <span className="ic-label hidden shrink-0 text-[10.5px] text-[var(--ic-instruction)] sm:inline">
          {object.links.length} {object.links.length === 1 ? "link" : "links"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--ic-ink)] transition-transform duration-[240ms] ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={`${id}-detail`} className="space-y-5 px-3 pb-5 sm:px-4 sm:pl-[3.75rem]">
          {moves.length > 0 && (
            <div>
              <div className="ic-label mb-1.5 text-[10.5px] text-[var(--ic-selected)]">Needs you</div>
              <ul className="space-y-1.5">
                {moves.map((m, i) => (
                  <li key={m.id} className="flex gap-2">
                    <span aria-hidden="true" className="ic-label shrink-0 text-[13px] text-[var(--ic-instruction)]">
                      {i === moves.length - 1 ? "└" : "├"}
                    </span>
                    <span>
                      <span className="block text-[14px] font-bold text-[var(--ic-ink)]">{m.sentence}</span>
                      <span className="block text-[13px] font-semibold text-[var(--ic-secondary)]">{m.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {object.facts.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
              {object.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="ic-label text-[10.5px] text-[var(--ic-instruction)] sm:pt-1">{f.label}</dt>
                  <dd className="-mt-1.5 text-[14px] font-semibold text-[var(--ic-ink)] sm:mt-0">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <Links object={object} byAddress={byAddress} goTo={goTo} />

          <div className="flex flex-wrap items-center gap-2.5">
            {object.actions.map((a, i) => (
              <IcButton key={a.label} href={actionHref(a, object.address, toolsBase)} variant={i === 0 ? "primary" : "secondary"}>
                {a.label}
              </IcButton>
            ))}
            <CopyAddress address={object.address} />
          </div>
        </div>
      )}
    </li>
  );
}

function Links({
  object,
  byAddress,
  goTo,
}: {
  object: OntologyObject;
  byAddress: Map<string, OntologyObject>;
  goTo: (address: string) => void;
}) {
  if (object.links.length === 0) {
    return <div className="text-[13px] font-semibold text-[var(--ic-secondary)]">Not linked to anything yet.</div>;
  }
  const groups = TYPE_ORDER.map((t) => ({
    type: t,
    items: object.links.map((a) => byAddress.get(a)).filter((o): o is OntologyObject => !!o && o.type === t),
  })).filter((g) => g.items.length);
  return (
    <div className="space-y-3">
      <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Linked to</div>
      {groups.map((g) => (
        <div key={g.type}>
          <div className="mb-1 text-[13px] font-extrabold text-[var(--ic-ink)]">{TYPE_DEFS[g.type].plural}</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {g.items.slice(0, 12).map((o) => (
              <li key={o.address}>
                <button
                  type="button"
                  onClick={() => goTo(o.address)}
                  className="inline-flex max-w-[16rem] items-center gap-2 text-left text-[13px] font-bold text-[var(--ic-ink)] underline decoration-[var(--ic-ink)]/30 underline-offset-4 hover:decoration-[var(--ic-ink)]"
                >
                  <ObjectMark address={o.address} size={20} />
                  <span className="truncate">{o.name}</span>
                </button>
              </li>
            ))}
            {g.items.length > 12 && (
              <li className="text-[13px] font-semibold text-[var(--ic-secondary)]">and {g.items.length - 12} more</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(address).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        });
      }}
      className="inline-flex min-h-10 items-center gap-1.5 px-1 text-[13px] font-bold text-[var(--ic-ink)] underline underline-offset-4"
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? "Copied" : "Copy address"}
    </button>
  );
}
