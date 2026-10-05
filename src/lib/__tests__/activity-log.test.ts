import { describe, expect, it } from "vitest";
import {
  activityLogWhere,
  categoryForType,
  isCronNoise,
  presentActivityLog,
} from "@/lib/activity-log";

describe("activity-log presentation", () => {
  it("maps raw DB rows onto the admin UI contract", () => {
    const presented = presentActivityLog({
      id: "a1",
      type: "lead_created",
      lead_name: "Jane Operator",
      facility_name: "Westside Storage",
      detail: "New lead from Westside Storage",
      created_at: new Date("2026-10-05T12:00:00.000Z"),
    });

    expect(presented).toMatchObject({
      id: "a1",
      timestamp: "2026-10-05T12:00:00.000Z",
      type: "lead_created",
      category: "leads",
      description: "New lead from Westside Storage",
      actor: "Jane Operator",
      detail: "Westside Storage",
      lead_name: "Jane Operator",
      facility: "Westside Storage",
    });
  });

  it("falls back to a humanized type and System actor when fields are empty", () => {
    const presented = presentActivityLog({
      id: "a2",
      type: "cron_completed",
      created_at: "2026-10-05T13:00:00.000Z",
    });
    expect(presented.description).toBe("Cron Completed");
    expect(presented.actor).toBe("System");
    expect(presented.category).toBe("system");
    expect(presented.timestamp).toBe("2026-10-05T13:00:00.000Z");
  });

  it("categorizes known and prefixed types", () => {
    expect(categoryForType("org_created")).toBe("billing");
    expect(categoryForType("audience_created")).toBe("campaigns");
    expect(categoryForType("storedge_move_in")).toBe("system");
    expect(categoryForType("mystery_event")).toBe("system");
  });

  it("treats cron_* as noise", () => {
    expect(isCronNoise("cron_completed")).toBe(true);
    expect(isCronNoise("cron_other")).toBe(true);
    expect(isCronNoise("lead_created")).toBe(false);
  });

  it("hides cron rows from the default where clause", () => {
    expect(activityLogWhere({})).toEqual({
      NOT: { type: { startsWith: "cron_" } },
    });
  });

  it("keeps cron rows when the system filter is on", () => {
    const where = activityLogWhere({ category: "system" });
    expect(where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: { startsWith: "cron_" } }),
      ])
    );
    expect(where.NOT).toBeUndefined();
  });
});
