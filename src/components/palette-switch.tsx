"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_PALETTE_ID,
  PALETTE_STORAGE_KEY,
  PALETTES,
  normalizePaletteId,
  type PaletteId,
} from "@/components/mono";

const CHANGE_EVENT = "storageads-palette-change";

function applyPalette(id: PaletteId) {
  document.documentElement.setAttribute("data-palette", id);
}

function readStoredPalette(): PaletteId {
  try {
    return normalizePaletteId(window.localStorage.getItem(PALETTE_STORAGE_KEY));
  } catch {
    return DEFAULT_PALETTE_ID;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/**
 * Three-way theme control. Sits in the nav and footer, in normal flow.
 * It does not float over the page.
 */
export default function PaletteSwitch() {
  const palette = useSyncExternalStore(
    subscribe,
    readStoredPalette,
    () => DEFAULT_PALETTE_ID,
  );

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  const selectPalette = useCallback((id: PaletteId) => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      /* private mode */
    }
    applyPalette(id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex max-w-full"
      style={{
        border: "1px solid var(--line)",
        background: "var(--bg)",
      }}
    >
      {PALETTES.map((p, i) => {
        const active = p.id === palette;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => selectPalette(p.id)}
            className="inline-flex items-center justify-center gap-2"
            style={{
              minHeight: 44,
              minWidth: 44,
              padding: "0 12px",
              border: "none",
              borderRight: i === PALETTES.length - 1 ? "none" : "1px solid var(--line)",
              background: active ? "var(--text)" : "transparent",
              color: active ? "var(--bg)" : "var(--text)",
              fontFamily: "var(--font-heading)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                background: p.swatches[0],
                border: "1px solid var(--line)",
                flexShrink: 0,
              }}
            />
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
