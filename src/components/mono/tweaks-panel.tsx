"use client";

/**
 * Floating palette switcher — bottom-right, collapsible.
 * Persists selection to localStorage so reload preserves choice.
 * Sets html[data-palette] which cascades through every token.
 */

import { useEffect, useState, useCallback } from "react";
import { DEFAULT_PALETTE_ID, PALETTES, type PaletteId, MONO } from "./index";

const STORAGE_KEY = "storageads.palette";

function applyPalette(id: PaletteId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-palette", id);
}

function readStoredPalette(): PaletteId {
  if (typeof window === "undefined") return DEFAULT_PALETTE_ID;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && PALETTES.some((p) => p.id === v)) return v as PaletteId;
  } catch {
    /* ignore */
  }
  return DEFAULT_PALETTE_ID;
}

export default function TweaksPanel() {
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE_ID);
  const [open, setOpen] = useState(false);

  // On mount: hydrate from localStorage and apply.
  useEffect(() => {
    const stored = readStoredPalette();
    setPalette(stored);
    applyPalette(stored);
  }, []);

  const selectPalette = useCallback((id: PaletteId) => {
    setPalette(id);
    applyPalette(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 1000,
        fontFamily: MONO.mono,
      }}
    >
      {open && (
        <div
          style={{
            border: `1px solid ${MONO.line}`,
            background: MONO.bg,
            marginBottom: 8,
            minWidth: 240,
            maxWidth: 300,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              borderBottom: `1px solid ${MONO.line}`,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: MONO.textFaint,
              }}
            >
              Tweaks / Palette
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close palette picker"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: MONO.textDim,
                padding: "0 4px",
                fontFamily: MONO.mono,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ padding: "4px 0" }}>
            {PALETTES.map((p) => {
              const active = p.id === palette;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPalette(p.id)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    border: "none",
                    borderLeft: `3px solid ${active ? MONO.accent : "transparent"}`,
                    background: active ? MONO.bgHi : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: MONO.mono,
                  }}
                >
                  <span style={{ display: "inline-flex", gap: 2 }}>
                    {p.swatches.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 14,
                          background: c,
                          border: `1px solid ${MONO.line}`,
                        }}
                      />
                    ))}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 11, color: MONO.text }}>{p.label}</span>
                    <span
                      style={{
                        fontSize: 9,
                        color: MONO.textFaint,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {p.sub}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: active ? MONO.accent : MONO.textFaint,
                    }}
                  >
                    {active ? "●" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: `1px solid ${MONO.line}`,
          background: MONO.bg,
          color: MONO.text,
          fontFamily: MONO.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          padding: "8px 12px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            background: MONO.accent,
          }}
        />
        {palette}
      </button>
    </div>
  );
}
