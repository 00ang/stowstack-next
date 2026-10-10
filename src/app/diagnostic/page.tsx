import type { Metadata } from "next";
import { DiagnosticForm } from "./diagnostic-form";

export const metadata: Metadata = {
  title: "Free Facility Diagnostic | StorageAds",
  description:
    "A full diagnostic of your self-storage facility. Occupancy, marketing, digital presence, revenue. Free, confidential, in your inbox in minutes.",
  openGraph: {
    title: "Free Facility Diagnostic | StorageAds",
    description:
      "A full diagnostic of your self-storage facility. Free and confidential.",
    type: "website",
  },
};

export default function DiagnosticPage() {
  return (
    <div className="min-h-screen bg-white text-[#16161A]">
      <DiagnosticForm />
    </div>
  );
}
