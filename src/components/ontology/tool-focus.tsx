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
 * the object rides along. The bar shows what you came to work on; the context
 * lets any tool read it, so a tool can start from what the system already
 * knows instead of asking again. Tools outside the provider get null and
 * behave exactly as before.
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
    <div className="mb-5 border-y-[1.5px] border-[var(--color-dark)] py-3" role="region" aria-label={`Working on ${object.name}`}>
      <div className="flex items-start gap-3">
        <ObjectMark address={object.address} type={object.type} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-body-text)]">
            Working on {def.singular.toLowerCase()} <span className="normal-case tracking-normal tabular-nums">{object.address}</span>
          </div>
          <div className="mt-0.5 text-[15px] font-bold leading-snug text-[var(--color-dark)]">{object.brief}</div>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Stop working on this"
          className="-mr-1 shrink-0 p-1.5 text-[var(--color-dark)] hover:bg-[var(--bg-alt)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:pl-11">
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
          <Link href={indexHref(object.address)} className="text-[13px] font-bold text-[var(--color-dark)] underline underline-offset-4">
            See everything it touches
          </Link>
        )}
      </div>
    </div>
  );
}
