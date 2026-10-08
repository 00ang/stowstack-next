import { describe, expect, it } from "vitest";
import { buildTemplate, edgeCounts, isEmptyFlow, visitBucket, type FlowCounts } from "@/lib/funnel-graph";

const counts: FlowCounts = {
  days: 30,
  visits: { meta: 240, google: 1, gbp: 96, tiktok: 0, other: 12 },
  leads: 9,
  answered: 7,
  enrolled: 5,
  toured: 2,
  holds: 3,
  moveIns: 2,
};

describe("edgeCounts", () => {
  const graph = buildTemplate("drive");
  const labels = edgeCounts(graph, counts);
  const labelFrom = (type: string, port = 0) => {
    const node = graph.nodes.find((n) => n.type === type)!;
    const edge = graph.edges.find((e) => e.from === node.id && e.fromPort === port);
    return edge ? labels[edge.id] : undefined;
  };

  it("labels each wire with what left the function at its start", () => {
    expect(labelFrom("meta")).toBe("240 visits");
    expect(labelFrom("page", 0)).toBe("9 leads");
    expect(labelFrom("textback")).toBe("7 answered");
    expect(labelFrom("follow")).toBe("5 in follow-up");
    expect(labelFrom("reserve")).toBe("3 holds");
    expect(labelFrom("movein")).toBe("2 move-ins");
  });

  it("leaves configuration wires unlabelled", () => {
    expect(labelFrom("units")).toBeUndefined();
    expect(labelFrom("audience")).toBeUndefined();
    expect(labelFrom("proven")).toBeUndefined();
    // Visits going on from the page to Reserve are counted as holds at Reserve, not here.
    expect(labelFrom("page", 1)).toBeUndefined();
  });

  it("says one, not ones", () => {
    const g = buildTemplate("lease");
    const one = edgeCounts(g, { ...counts, visits: { ...counts.visits, google: 1 } });
    const google = g.nodes.find((n) => n.type === "google")!;
    const edge = g.edges.find((e) => e.from === google.id)!;
    expect(one[edge.id]).toBe("1 visit");
  });

  it("labels nothing without counts", () => {
    expect(edgeCounts(graph, null)).toEqual({});
    expect(isEmptyFlow(null)).toBe(true);
    expect(isEmptyFlow({ ...counts, visits: { meta: 0, google: 0, gbp: 0, tiktok: 0, other: 0 }, leads: 0 })).toBe(true);
    expect(isEmptyFlow(counts)).toBe(false);
  });
});

describe("visitBucket", () => {
  it("sorts a touch into the channel a node stands for", () => {
    expect(visitBucket("paid_social", "meta")).toBe("meta");
    expect(visitBucket("organic_social", "meta")).toBe("meta");
    expect(visitBucket("paid_search", "google")).toBe("google");
    expect(visitBucket("organic_search", "google")).toBe("gbp");
    expect(visitBucket("paid_social", "tiktok")).toBe("tiktok");
    expect(visitBucket("direct", null)).toBe("other");
    expect(visitBucket("referral", "nextdoor.com")).toBe("other");
  });
});
