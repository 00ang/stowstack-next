import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { PortalShell } from "@/components/portal/portal-shell";
import "@/components/design/dl003/dl003.css";

export const metadata: Metadata = {
  // Root layout already appends " | StorageAds".
  title: "Client Portal",
  description:
    "Access your StorageAds dashboard: attribution, campaign performance, and facility analytics.",
};

// Manrope is the StorageAds face, but the root layout never loads it: every
// "Manrope" in globals.css points at `--font-manrope`, which nothing defines,
// so the site falls back to each visitor's system font. The portal loads it
// here and re-points the site's face tokens at it, inside the portal only.
// IBM Plex Mono carries the mono-caps labels (`.ic-label`, library entry 008).
const manrope = Manrope({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

const face = 'var(--font-manrope), "Manrope", system-ui, sans-serif';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${manrope.variable} ${plexMono.variable} contents`}
      style={{ "--mono": face, "--serif": face, fontFamily: face } as React.CSSProperties}
    >
      <PortalShell>{children}</PortalShell>
    </div>
  );
}
