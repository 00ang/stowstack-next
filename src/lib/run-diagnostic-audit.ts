import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { POST as generateDiagnosticPost } from "@/app/api/audit-generate-diagnostic/route";

/**
 * Run audit generation in this process. A fetch back to the deployment URL
 * hits Vercel protection and 401s, which is why audits never landed.
 */
export async function generateAuditInProcess(
  facilityId: string,
  diagnosticJson: unknown
): Promise<void> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !process.env.ANTHROPIC_API_KEY) {
    const detail = "Audit not started: ADMIN_SECRET or ANTHROPIC_API_KEY is unset";
    await db.facilities
      .update({
        where: { id: facilityId },
        data: { pipeline_status: "audit_not_delivered", audit_delivery_error: detail },
      })
      .catch((err) => console.error("[audit] mark undelivered failed:", err));
    await db.activity_log
      .create({
        data: { type: "audit_delivery_failed", facility_id: facilityId, detail },
      })
      .catch((err) => console.error("[activity_log] failed:", err));
    return;
  }

  const req = new NextRequest("http://localhost/api/audit-generate-diagnostic", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-key": secret,
    },
    body: JSON.stringify({ diagnosticJson, facilityId }),
  });
  const res = await generateDiagnosticPost(req);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`audit generation returned ${res.status}: ${text.slice(0, 300)}`);
  }
}
