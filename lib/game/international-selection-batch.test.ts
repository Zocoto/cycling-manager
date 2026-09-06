import { describe, expect, it } from "vitest";

import { parseAnsweredInternationalSelectionDecisions } from "./international-selection-batch";

function submittedDecision(
  index: number,
  decision: "confirm" | "decline" | "skip",
) {
  return {
    candidateId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    decision,
    acknowledgedConflicts: [],
  };
}

describe("partial international selection batches", () => {
  it("keeps only the five answered invitations in a seven-invitation form", () => {
    const parsed = parseAnsweredInternationalSelectionDecisions([
      submittedDecision(1, "confirm"),
      submittedDecision(2, "decline"),
      submittedDecision(3, "confirm"),
      submittedDecision(4, "skip"),
      submittedDecision(5, "decline"),
      submittedDecision(6, "skip"),
      submittedDecision(7, "confirm"),
    ]);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.decisions).toHaveLength(5);
    expect(parsed.decisions.map(({ candidateId }) => candidateId)).toEqual([
      submittedDecision(1, "confirm").candidateId,
      submittedDecision(2, "decline").candidateId,
      submittedDecision(3, "confirm").candidateId,
      submittedDecision(5, "decline").candidateId,
      submittedDecision(7, "confirm").candidateId,
    ]);
  });

  it("rejects a batch where every invitation is left pending", () => {
    expect(
      parseAnsweredInternationalSelectionDecisions([
        submittedDecision(1, "skip"),
        submittedDecision(2, "skip"),
      ]),
    ).toEqual({ success: false, reason: "empty" });
  });

  it("rejects duplicate invitations and unknown decisions", () => {
    const duplicate = submittedDecision(1, "confirm");

    expect(
      parseAnsweredInternationalSelectionDecisions([duplicate, duplicate]),
    ).toEqual({ success: false, reason: "invalid" });
    expect(
      parseAnsweredInternationalSelectionDecisions([
        { ...submittedDecision(2, "confirm"), decision: "unknown" },
      ]),
    ).toEqual({ success: false, reason: "invalid" });
  });
});
