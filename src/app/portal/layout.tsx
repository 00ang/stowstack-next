import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { PortalShell } from "@/components/portal/portal-shell";

export const metadata: Metadata = {
  title: "Client Portal | StorageAds",
  description:
    "Access your StorageAds dashboard: attribution, campaign performance, and facility analytics.",
};

// Instrument Calm labels (mono caps). Scoped to the portal: the rest of the
// site stays Manrope-only. Read through `.ic-label` in globals.css.
const plexMono = IBM_Plex_Mono({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${plexMono.variable} contents`}>
      <PortalShell>{children}</PortalShell>
    </div>
  );
}
