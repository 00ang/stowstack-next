import { db } from "@/lib/db";

/**
 * Which facilities an owner may open in the facility tools (/portal/tools,
 * /partner/tools). The manage session minted from these lists is the only
 * thing the tool APIs check (requireFacilityAccess), so these queries ARE the
 * authorization scope: keep them tight.
 */

/** Every live facility this email is a live signed client of. */
export async function clientToolFacilityIds(email: string): Promise<string[]> {
  const rows = await db.clients.findMany({
    where: {
      email: { equals: email.trim(), mode: "insensitive" },
      deleted_at: null,
      facilities: { deleted_at: null },
    },
    select: { facility_id: true },
  });
  return [...new Set(rows.map((r) => r.facility_id))];
}

/** Every live facility in a partner org. */
export async function orgToolFacilityIds(organizationId: string): Promise<string[]> {
  const rows = await db.facilities.findMany({
    where: { organization_id: organizationId, deleted_at: null },
    select: { id: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => r.id);
}
