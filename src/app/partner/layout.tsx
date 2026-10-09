import { PartnerShell } from "@/components/partner/partner-shell";

export const metadata = {
  // Root layout already appends " | StorageAds".
  title: "Partner Dashboard",
  robots: { index: false, follow: false },
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PartnerShell>{children}</PartnerShell>;
}
