import { describe, expect, it } from "vitest";

import { getInfrastructureConstructionOptions } from "@/lib/game/infrastructure-construction";

const regularArchitect = {
  contractId: "regular",
  hasParallelConstructionTalent: false,
};
const parallelArchitect = {
  contractId: "parallel",
  hasParallelConstructionTalent: true,
};

describe("infrastructure construction slots", () => {
  it("keeps the first line open without an architect", () => {
    const options = getInfrastructureConstructionOptions({
      architects: [regularArchitect, parallelArchitect],
      activeProjects: [],
    });

    expect(options.canStartWithoutArchitect).toBe(true);
    expect(options.eligibleArchitects).toHaveLength(2);
    expect(options.capacityBlockReason).toBeNull();
  });

  it("requires the talented architect on the second project when absent from the first", () => {
    const options = getInfrastructureConstructionOptions({
      architects: [regularArchitect, parallelArchitect],
      activeProjects: [{ architectContractId: "regular" }],
    });

    expect(options.canStartWithoutArchitect).toBe(false);
    expect(options.eligibleArchitects).toEqual([parallelArchitect]);
    expect(options.selectionBlockReason).toContain("Double chantier");
  });

  it("allows an ordinary second project when the talented architect runs the first", () => {
    const options = getInfrastructureConstructionOptions({
      architects: [regularArchitect, parallelArchitect],
      activeProjects: [{ architectContractId: "parallel" }],
    });

    expect(options.canStartWithoutArchitect).toBe(true);
    expect(options.eligibleArchitects).toEqual([regularArchitect]);
  });

  it("blocks a third project", () => {
    const options = getInfrastructureConstructionOptions({
      architects: [regularArchitect, parallelArchitect],
      activeProjects: [
        { architectContractId: "parallel" },
        { architectContractId: "regular" },
      ],
    });

    expect(options.eligibleArchitects).toEqual([]);
    expect(options.capacityBlockReason).toBe("Deux chantiers sont déjà en cours.");
  });
});
