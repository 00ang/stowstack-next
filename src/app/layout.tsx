import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono, Archivo } from "next/font/google";
import ScrollProgress from "@/components/scroll-progress";
import GrainOverlay from "@/components/grain-overlay";
import Analytics from "@/components/analytics";
import PaletteSwitchBar from "@/components/palette-switch-bar";
import { PALETTE_BOOT_SCRIPT } from "@/lib/palette-boot";
import "./globals.css";

// JetBrains Mono is the primary voice across the product.
// Inter is the humanist-sans escape valve for the rare moments where
// full monospace would read too harsh or technical — the Anthropic
// principle of finding the happy medium.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Archivo — serif/display-sans for headlines under the NULL//TRACE theme.
// Used sparingly (section titles, hero display number). Mono handles everything else.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const siteDescription =
  "Stop losing units to the REIT down the road. StorageAds runs the whole marketing system for independent storage operators: ads, landing pages, and reservations that become move-ins. See which ads fill your units.";

export const metadata: Metadata = {
  title: {
    default: "StorageAds | Marketing that proves which ads fill units",
    template: "%s | StorageAds",
  },
  description: siteDescription,
  metadataBase: new URL("https://storageads.com"),
  openGraph: {
    title: "StorageAds | Marketing that proves which ads fill units",
    description: siteDescription,
    url: "https://storageads.com",
    siteName: "StorageAds",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StorageAds | Marketing that proves which ads fill units",
    description: siteDescription,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#E0E0E5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://storageads.com/#organization",
      name: "StorageAds",
      url: "https://storageads.com",
      description: siteDescription,
      telephone: "+12699298541",
      logo: {
        "@type": "ImageObject",
        url: "https://storageads.com/og-image.png",
      },
      areaServed: { "@type": "Country", name: "US" },
    },
    {
      "@type": "SoftwareApplication",
      name: "StorageAds",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://storageads.com",
      description: "The marketing system built for self-storage operators. Ads, landing pages, call tracking, and ad-to-move-in tracking on one dashboard.",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "499",
        highPrice: "2499",
        offerCount: "4",
      },
      provider: { "@id": "https://storageads.com/#organization" },
    },
    {
      "@type": "WebSite",
      "@id": "https://storageads.com/#website",
      url: "https://storageads.com",
      name: "StorageAds",
      publisher: { "@id": "https://storageads.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#141413",
          colorBackground: "#E0E0E5",
          colorInputBackground: "#ffffff",
          colorText: "#141413",
        },
      }}
    >
      <html
        lang="en"
        data-palette="cool"
        className={`${jetbrainsMono.variable} ${inter.variable} ${archivo.variable} antialiased`}
      >
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="preconnect" href="https://cal.com" />
          <link rel="dns-prefetch" href="https://maps.googleapis.com" />
          <link rel="dns-prefetch" href="https://places.googleapis.com" />
          <link rel="manifest" href="/manifest.json" />
          <script dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }} />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js');
                  });
                }
              `,
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="urbit-landing">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-dark)] focus:text-[var(--color-light)] focus:rounded-lg"
          >
            Skip to content
          </a>
          <Suspense fallback={null}>
            <Analytics />
          </Suspense>
          <ScrollProgress />
          <GrainOverlay />
          {children}
          <PaletteSwitchBar />
        </body>
      </html>
    </ClerkProvider>
  );
}
