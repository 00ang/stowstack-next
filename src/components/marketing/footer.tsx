import { Mail } from "lucide-react";
import { CAL_BOOKING_URL } from "@/lib/booking";

const FOOTER_LINKS: Array<{ label: string; href: string; external?: boolean }> = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Tools", href: "/tools" },
  { label: "Free Diagnostic", href: "/diagnostic" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Insights", href: "/insights" },
  { label: "Demo", href: "/demo" },
  { label: "Sign up", href: "/signup" },
  { label: "Contact", href: "/contact" },
  { label: "Book a Call", href: CAL_BOOKING_URL, external: true },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Data Deletion", href: "/data-deletion" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: "var(--color-light)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div className="section-content px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <p className="text-lg mb-2" style={{ fontFamily: "var(--font-heading)", fontWeight: 700, letterSpacing: "-0.5px" }}>
              <span style={{ color: "var(--color-dark)" }}>storage</span><span style={{ color: "var(--brand-ads)" }}>ads</span>
            </p>
            <p
              className="text-sm"
              style={{ color: "var(--text-tertiary)" }}
            >
              REIT-grade marketing infrastructure for independent operators.
            </p>
            <p
              className="text-xs mt-4 italic"
              style={{ color: "var(--text-tertiary)" }}
            >
              Built for independent operators, not for agencies.
            </p>
          </div>

          {/* Links */}
          <div>
            <p
              className="text-xs font-semibold uppercase mb-4"
              style={{
                color: "var(--text-tertiary)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              Navigation
            </p>
            <nav aria-label="Footer navigation" className="space-y-2">
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...(link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="block text-sm transition-colors"
                  style={{ color: "var(--text-dim)" }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          {/* Contact & Legal */}
          <div>
            <p
              className="text-xs font-semibold uppercase mb-4"
              style={{
                color: "var(--text-tertiary)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              Contact
            </p>
            <a
              href="mailto:blake@storageads.com"
              className="flex items-center gap-2 text-sm mb-6"
              style={{ color: "var(--text-secondary)" }}
            >
              <Mail size={14} />
              blake@storageads.com
            </a>

            <p
              className="text-xs font-semibold uppercase mb-4"
              style={{
                color: "var(--text-tertiary)",
                letterSpacing: "var(--tracking-wide)",
              }}
            >
              Legal
            </p>
            <div className="space-y-2">
              {LEGAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mt-12 pt-8 text-center text-xs"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: "var(--text-tertiary)",
          }}
        >
          &copy; {new Date().getFullYear()} StorageAds. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
