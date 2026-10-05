"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/admin-context";

// Admin-gated viewer for the internal feature + idea doc. The strategy
// content is never bundled client-side; we fetch it from /api/ideas-doc
// with the X-Admin-Key header and render it inside an isolated <iframe>
// (srcDoc) so the doc's own styles can't collide with the urbit-landing
// global CSS — and vice versa.
const FONT =
  "var(--font-manrope), 'Manrope', system-ui, -apple-system, sans-serif";

export default function IdeasGate() {
  const [html, setHtml] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  const load = useCallback(async (key: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/ideas-doc", {
        headers: { "X-Admin-Key": key },
      });
      if (res.ok) {
        setHtml(await res.text());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Try a stored admin key on mount (shared with the /admin pages).
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!stored) {
      setBooting(false);
      return;
    }
    load(stored).finally(() => setBooting(false));
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const ok = await load(password.trim());
    if (ok) {
      localStorage.setItem(STORAGE_KEY, password.trim());
    } else {
      setError("Invalid admin key");
    }
    setLoading(false);
  }

  if (html) {
    return (
      <iframe
        title="StorageAds: Features & Ideas"
        srcDoc={html}
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#faf9f5", fontFamily: FONT }}
    >
      <div
        className="w-full max-w-[340px] p-8"
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "8px",
          background: "#fff",
        }}
      >
        <div className="mb-7 text-center">
          <h1
            className="mb-1"
            style={{
              fontFamily: FONT,
              fontSize: "16px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#141413",
            }}
          >
            storage<span style={{ color: "var(--brand-slate)" }}>ads</span>
          </h1>
          <p
            style={{
              fontFamily: FONT,
              fontSize: "12px",
              fontWeight: 400,
              color: "#8a877f",
              letterSpacing: "0.02em",
            }}
          >
            features &amp; ideas · internal
          </p>
        </div>

        {booting ? (
          <p
            className="text-center"
            style={{ fontSize: "13px", color: "#8a877f" }}
          >
            Checking access…
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin key"
              autoFocus
              style={{
                width: "100%",
                fontFamily: FONT,
                fontSize: "13px",
                padding: "9px 12px",
                borderRadius: "5px",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#faf9f5",
                color: "#141413",
                marginBottom: "10px",
              }}
            />
            {error && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#B04A3A",
                  marginBottom: "10px",
                }}
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                fontFamily: FONT,
                fontSize: "13px",
                fontWeight: 600,
                background: "#141413",
                color: "#faf9f5",
                border: "none",
                borderRadius: "5px",
                padding: "9px 16px",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Opening…" : "View"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
