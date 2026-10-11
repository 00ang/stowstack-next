import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadStepBoard } from "@/components/admin/lead-step-board";
import { deriveLeadStep, LEAD_STEP_IDS, type LeadStepId } from "@/lib/lead-step";

const NOW = new Date("2026-10-11T12:00:00.000Z");
const contact = deriveLeadStep(
  {
    contactName: "Pat Owner",
    contactPhone: "+15125550123",
    createdAt: "2026-10-08T12:00:00.000Z",
    intakeAnswers: { source: "homepage_popup", consent: true },
  },
  NOW
);

const counts = Object.fromEntries(LEAD_STEP_IDS.map((id) => [id, 0])) as Record<LeadStepId, number>;
counts.contact_saved = 1;

const payload = {
  leads: [
    {
      id: "1",
      name: "Pat Owner",
      email: "",
      phone: "+15125550123",
      facilityName: "Homepage inquiry",
      location: "Not provided",
      createdAt: "2026-10-08T12:00:00.000Z",
      step: contact,
    },
  ],
  counts,
  total: 1,
  truncated: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LeadStepBoard", () => {
  it("groups leads by step and filters to an empty step", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      })
    );

    render(<LeadStepBoard />);

    expect(await screen.findByText("Pat Owner")).toBeTruthy();
    expect(screen.getByText("They stopped after contact. The next popup question is “You are the…”.")).toBeTruthy();
    expect(screen.getByText("Stuck here since 3 days")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Popup questions 0" }));

    expect(screen.getByText("No leads at this step.")).toBeTruthy();
    expect(screen.queryByText("Pat Owner")).toBeNull();
  });
});
