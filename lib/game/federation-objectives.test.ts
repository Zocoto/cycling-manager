import { describe, expect, it } from "vitest";

import {
  buildFederationObjectives,
  getFederationMemberTeamTarget,
} from "@/lib/game/federation-objectives";

describe("federation objectives", () => {
  it("keeps the membership target close to the season baseline", () => {
    expect(getFederationMemberTeamTarget(0)).toBe(1);
    expect(getFederationMemberTeamTarget(5)).toBe(6);
    expect(getFederationMemberTeamTarget(10)).toBe(12);
  });

  it("builds five dynamic objectives and validates reached progress", () => {
    const objectives = buildFederationObjectives({
      gameYear: 3,
      nationRank: 12,
      referenceMemberTeamCount: 5,
      currentMemberTeamCount: 6,
      naturalizationCount: 2,
      manuallySubmittedSelectionCount: 5,
      nationsCupRank: 7,
      worldRank: 9,
      continentalRank: 5,
    });

    expect(objectives).toHaveLength(5);
    expect(objectives.every((objective) => objective.completed)).toBe(true);
    expect(objectives.every((objective) => objective.progressPercentage === 100)).toBe(true);
    expect(objectives[4].title).toBe(
      "Soumettre des convocations pour 5 événements internationaux (manuellement)",
    );
    expect(objectives[4].currentLabel).toBe("5 événements");
  });

  it("switches the Nations Cup wording to the quadriennial programme", () => {
    const objective = buildFederationObjectives({
      gameYear: 4,
      nationRank: null,
      referenceMemberTeamCount: 2,
      currentMemberTeamCount: 2,
      naturalizationCount: 0,
      manuallySubmittedSelectionCount: 0,
      nationsCupRank: null,
      worldRank: null,
      continentalRank: null,
    })[2];

    expect(objective.title).toContain("Jeux quadriennaux");
    expect(objective.progressPercentage).toBe(0);
  });
});
