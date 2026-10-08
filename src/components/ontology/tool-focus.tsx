"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { TYPE_DEFS } from "@/lib/ontology/registry";
import type { OntologyObject } from "@/lib/ontology/types";
import { ObjectMark } from "./object-mark";
import { ActionFill } from "./action-fill";
import { indexHref } from "./use-ontology";

/**
 * Tools in focus: when a tool is opened from an object (?focus=units/10x10),
 * the object rides along. The bar shows what you came to work on, in the
 * "Looking at" grammar of library entry 008; the context lets any tool read
 * it, so a tool starts from what the system already knows instead of asking
 * again. Tools outside the provider get null and behave exactly as before.
 */

const ToolFocusCtx = createContext<OntologyObject | null>(null);

export function ToolFocusProvider({ object, children }: { object: OntologyObject | null; children: ReactNode }) {
  return <ToolFocusCtx.Provider value={object}>{children}</ToolFocusCtx.Provider>;
}

/** The object this tool was opened for, or null. */
export function useToolFocus(): OntologyObject | null {
  return useContext(ToolFocusCtx);
}

export function FocusBar({ object, onClear, showIndexLink = true }: { object: OntologyObject; onClear: () => void; showIndexLink?: boolean }) {
  const [copied, setCopied] = useState(false);
  const def = TYPE_DEFS[object.type];
  return (
    <div
      className="mb-5 border border-[var(--ic-ink)] bg-[var(--ic-pane)] p-4 text-[var(--ic-ink)] sm:p-5"
      role="region"
      aria-label={`Looking at ${object.name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="ic-label text-[10.5px] text-[var(--ic-instruction)]">Looking at · {def.singular}</div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Stop looking at this"
          className="-mr-1.5 -mt-1.5 shrink-0 p-1.5 text-[var(--ic-ink)] hover:bg-[var(--ic-soft)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1 border-b border-[var(--ic-ink)]/20 pb-3 text-[24px] font-extrabold leading-tight tracking-tight">{object.name}</div>
      <div className="mt-3 flex items-start gap-3">
        <ObjectMark address={object.address} type={object.type} size={48} />
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-snug">{object.brief}</div>
          <div className="ic-label mt-1 text-[10.5px] normal-case tracking-[0.02em] text-[var(--ic-instruction)]">{object.address}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <ActionFill
          n={0}
          onClick={() => {
            navigator.clipboard?.writeText(object.brief).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? "Copied" : "Copy the facts"}
        </ActionFill>
        {showIndexLink && (
          <Link href={indexHref(object.address)} className="text-[13px] font-bold underline underline-offset-4">
            See everything it touches
          </Link>
        )}
      </div>
      <div className="ic-label mt-3 text-[10px] text-[var(--ic-instruction)]">Nothing changes until you save in the tool.</div>
    </div>
  );
}
