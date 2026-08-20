import { describe, expect, it } from "vitest";

import {
  countPhysiotherapistAssignments,
  serializePhysiotherapistAssignments,
  togglePhysiotherapistAssignment,
} from "@/lib/game/physiotherapist-matrix";

describe("physiotherapist assignment matrix", () => {
  it("moves a rider from one physiotherapist to another", () => {
    const assignments = togglePhysiotherapistAssignment({
      assignments: { rider: "physio-a" },
      riderId: "rider",
      staffContractId: "physio-b",
      capacity: 2,
    });

    expect(assignments).toEqual({ rider: "physio-b" });
  });

  it("unchecks an already assigned crossing", () => {
    expect(
      togglePhysiotherapistAssignment({
        assignments: { rider: "physio-a" },
        riderId: "rider",
        staffContractId: "physio-a",
        capacity: 2,
      }),
    ).toEqual({ rider: null });
  });

  it("does not exceed the physiotherapist capacity", () => {
    const initial = { one: "physio-a", two: null };
    const assignments = togglePhysiotherapistAssignment({
      assignments: initial,
      riderId: "two",
      staffContractId: "physio-a",
      capacity: 1,
    });

    expect(assignments).toBe(initial);
    expect(countPhysiotherapistAssignments(assignments, "physio-a")).toBe(1);
  });

  it("serializes only checked crossings", () => {
    expect(
      serializePhysiotherapistAssignments({
        one: "physio-a",
        two: null,
        three: "physio-b",
      }),
    ).toEqual([
      { riderId: "one", staffContractId: "physio-a" },
      { riderId: "three", staffContractId: "physio-b" },
    ]);
  });
});
