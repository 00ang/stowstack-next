import { ImageResponse } from "next/og";

/* ──────────────────────────────────────────────────────────────────────────
   Shared Open Graph / Twitter card generator for the operator tools.

   Each tool route exports a thin `opengraph-image.tsx` that calls this with its
   own title + subtitle, so a shared link (built by the in-tool Share button)
   previews with the tool's name instead of the generic site card. Matches the
   light-only design system: cream ground, charcoal type, the sanctioned gold
   logo accent. Satori (next/og) only understands inline styles, so every colour
   is a literal hex here, mirroring src/app/opengraph-image.tsx.
   ────────────────────────────────────────────────────────────────────────── */

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

/** Standard alt text for a tool card. */
export function ogAlt(title: string): string {
  return `${title}: a free StorageAds calculator for self-storage operators`;
}

export function toolOgImage({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#E0E0E5",
          padding: "72px",
          position: "relative",
        }}
      >
        {/* Slate accent bar (matches the logo "ads") */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            backgroundColor: "#446386",
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "#8a887f",
          }}
        >
          Free operator tool
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              color: "#141413",
              letterSpacing: "-3px",
              lineHeight: 1.05,
              maxWidth: "1000px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              color: "#54534c",
              letterSpacing: "-0.5px",
              lineHeight: 1.3,
              maxWidth: "900px",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: "-1px" }}>
            <div style={{ display: "flex", color: "#141413" }}>storage</div>
            <div style={{ display: "flex", color: "#446386" }}>ads</div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#8a887f" }}>
            storageads.com/tools
          </div>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
