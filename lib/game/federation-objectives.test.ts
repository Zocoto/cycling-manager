import { describe, expect, it } from "vitest";

import {
  buildFederationObjectives,
  getFederationMemberTeamTarget,
  getFederationSeasonObjectiveVariants,
} from "@/lib/game/federation-objectives";

describe("federation objectives", () => {
  it("keeps the membership target close to the season baseline", () => {
    expect(getFederationMemberTeamTarget(0)).toBe(1);
    expect(getFederationMemberTeamTarget(5)).toBe(6);
    expect(getFederationMemberTeamTarget(10)).toBe(12);
  });

  it("builds five dynamic objectives and validates reached progress", () => {
    const objectives = buildFederationObjectives({
      countryId: "0a000000-0000-0000-0000-000000000000",
      gameYear: 3,
      nationRank: 12,
      referenceMemberTeamCount: 5,
      currentMemberTeamCount: 6,
      naturalizationCount: 2,
      manuallySubmittedSelectionCount: 5,
      nationsCupRank: 4,
      nationsCupOverallRank: 7,
      nationsCupDivision: 1,
      nationsCupGroup: null,
      nationsCupPoolSize: 21,
      worldRank: 5,
      worldGameYear: 3,
      continentalRank: 5,
      continentalGameYear: 3,
      juniorChampionshipRank: null,
      cyclingSchoolCount: 0,
      teamUciRank: null,
      riderUciRank: null,
    });

    expect(objectives).toHaveLength(5);
    expect(objectives.every((objective) => objective.completed)).toBe(true);
    expect(objectives.every((objective) => objective.progressPercentage === 100)).toBe(true);
    expect(objectives[4].title).toBe(
      "Soumettre des convocations pour 5 événements internationaux (manuellement)",
    );
    expect(objectives[4].currentLabel).toBe("5 événements");
    expect(objectives[2].title).toContain("top 5 de la division 1 de la Nations Cup seniors");
    expect(objectives[3].title).toBe("Signer un top 8 aux Championnats du monde");
  });

  it("switches the professional objective to the quadriennial programme", () => {
    const objective = buildFederationObjectives({
      countryId: "0a000000-0000-0000-0000-000000000000",
      gameYear: 4,
      nationRank: null,
      referenceMemberTeamCount: 2,
      currentMemberTeamCount: 2,
      naturalizationCount: 0,
      manuallySubmittedSelectionCount: 0,
      nationsCupRank: null,
      nationsCupOverallRank: null,
      nationsCupDivision: null,
      nationsCupGroup: null,
      nationsCupPoolSize: 0,
      worldRank: null,
      worldGameYear: null,
      continentalRank: null,
      continentalGameYear: null,
      juniorChampionshipRank: null,
      cyclingSchoolCount: 0,
      teamUciRank: null,
      riderUciRank: null,
    })[1];

    expect(objective.title).toContain("Jeux quadriennaux");
    expect(objective.title).not.toContain("Nations Cup");
    expect(objective.progressPercentage).toBe(0);
  });

  it("ignore les Mondiaux précédents et borne le top Nations Cup à la taille de la poule", () => {
    const objectives = buildFederationObjectives({
      countryId: "0a000000-0000-0000-0000-000000000000",
      gameYear: 3,
      nationRank: 12,
      referenceMemberTeamCount: 2,
      currentMemberTeamCount: 2,
      naturalizationCount: 0,
      manuallySubmittedSelectionCount: 0,
      nationsCupRank: null,
      nationsCupOverallRank: null,
      nationsCupDivision: 2,
      nationsCupGroup: "A",
      nationsCupPoolSize: 4,
      worldRank: 1,
      worldGameYear: 2,
      continentalRank: 1,
      continentalGameYear: 2,
      juniorChampionshipRank: null,
      cyclingSchoolCount: 0,
      teamUciRank: null,
      riderUciRank: null,
    });

    expect(objectives[2].title).toContain("top 3 du groupe A (division 2)");
    expect(objectives[3].completed).toBe(false);
    expect(objectives[3].currentLabel).toBe("Pas encore disputé");
  });

  it("fait varier deux objectifs à partir de la S4 sans changer le tirage d’une fédération", () => {
    const countryId = "0b000000-0000-0000-0000-000000000000";
    expect(getFederationSeasonObjectiveVariants(countryId, 4)).toEqual([
      "championships", "cycling_school",
    ]);

    const objectives = buildFederationObjectives({
      countryId,
      gameYear: 4,
      nationRank: 12,
      referenceMemberTeamCount: 2,
      currentMemberTeamCount: 3,
      naturalizationCount: 0,
      manuallySubmittedSelectionCount: 5,
      nationsCupRank: null,
      nationsCupOverallRank: null,
      nationsCupDivision: null,
      nationsCupGroup: null,
      nationsCupPoolSize: 0,
      worldRank: 5,
      worldGameYear: 4,
      continentalRank: null,
      continentalGameYear: null,
      juniorChampionshipRank: null,
      cyclingSchoolCount: 1,
      teamUciRank: null,
      riderUciRank: null,
    });

    expect(objectives).toHaveLength(5);
    expect(objectives.map((objective) => objective.id)).toEqual([
      "members", "international", "selections", "championships", "cycling_school",
    ]);
    expect(objectives[3].completed).toBe(true);
    expect(objectives[4].completed).toBe(true);
  });
});
