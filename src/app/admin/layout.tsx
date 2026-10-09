import { AdminShell } from "@/components/admin/admin-shell";

export const metadata = {
  // Root layout already appends " | StorageAds".
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
