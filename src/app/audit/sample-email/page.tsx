import { operatorAuditEmail } from "@/lib/audit-email";

export const metadata = {
  title: "Sample diagnostic email | StorageAds",
  robots: { index: false, follow: false },
};

export default function SampleEmailPage() {
  const html = operatorAuditEmail({
    facilityName: "Sample Facility (not a real lead)",
    summary:
      "This is a sample for a facility that does not exist. Occupancy in the 70s, 200 to 349 units, move-outs matching move-ins. No street rate was given, so there is no dollar loss in this note.",
    auditUrl: "https://storageads.com/audit/sample-intake",
    score: 0,
    grade: "",
    dollarsKnown: false,
  });

  return (
    <div style={{ background: "#E0E0E5", minHeight: "100vh", padding: 24 }}>
      <p style={{ fontFamily: "Manrope, sans-serif", color: "#16161A", margin: "0 0 16px", fontSize: 14 }}>
        Sample email. Nothing was sent. Sample Facility is not a real lead.
      </p>
      <div style={{ maxWidth: 640, margin: "0 auto", background: "#fff" }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
