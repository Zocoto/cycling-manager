import { describe, expect, it } from "vitest";

import {
  areSponsorCountriesNeighbors,
  generateProvisionalSponsorObjectives as generateObjectivesFromRaces,
  resolveSponsorObjectiveFocus,
  selectSponsorObjectiveRaces,
  type SponsorObjectiveRaceCandidate,
} from "./sponsor-objectives";

const RACE_CANDIDATES: SponsorObjectiveRaceCandidate[] = [
  createRace("fr-tour", "Tour de l’Hexagone", "FR", {
    raceFormat: "stage_race",
  }),
  createRace("fr-bretagne", "Grand Prix de Bretagne", "FR"),
  createRace("be-namur", "Critérium de Namur", "BE"),
  createRace("es-valencia", "Trofeo de Valencia", "ES"),
  createRace("it-lombardia", "Giro di Lombardia", "IT", {
    isMonument: true,
  }),
  createRace("es-grand-tour", "Vuelta Iberica", "ES", {
    raceFormat: "stage_race",
    isGrandTour: true,
  }),
];

type GeneratorOptions = Omit<
  Parameters<typeof generateObjectivesFromRaces>[0],
  "teamReputationPoints" | "raceCandidates"
>;

function generateProvisionalSponsorObjectives(
  options: GeneratorOptions,
) {
  return generateObjectivesFromRaces({
    ...options,
    teamReputationPoints: 100,
    raceCandidates: RACE_CANDIDATES,
  });
}

function createRace(
  raceSlug: string,
  raceLabel: string,
  countryCode: string,
  overrides: Partial<SponsorObjectiveRaceCandidate> = {},
): SponsorObjectiveRaceCandidate {
  return {
    raceId: `race-${raceSlug}`,
    raceEditionId: `edition-${raceSlug}`,
    raceSlug,
    raceLabel,
    countryCode,
    registrationPolicy: "open",
    minimumReputation: 0,
    raceFormat: "one_day",
    competitionType: "standard",
    isMonument: false,
    isGrandTour: false,
    ...overrides,
  };
}

function createDeterministicRandom(
  values: readonly number[],
): () => number {
  let currentIndex = 0;

  return () => {
    const value = values[currentIndex % values.length];
    currentIndex += 1;
    return value;
  };
}

describe("generateProvisionalSponsorObjectives", () => {
  it("génère exactement dix objectifs ordonnés totalisant 100 points", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 2,
      sponsorCatalogKey: "terroirs-unis",
      sponsorSector: "Agroalimentaire",
    });

    expect(objectives).toHaveLength(10);
    expect(objectives.map((objective) => objective.displayOrder)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    expect(
      objectives.reduce(
        (total, objective) => total + objective.satisfactionPoints,
        0,
      ),
    ).toBe(100);
  });

  it("laisse le renouvellement dépendre uniquement de la satisfaction globale", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "ES",
      sponsorPrestige: 3,
      sponsorCatalogKey: "sol-del-sur",
      sponsorSector: "Énergie solaire",
    });
    const total = objectives.reduce(
      (sum, objective) => sum + objective.renewalBonusPercent,
      0,
    );

    expect(total).toBe(0);
  });

  it("couvre les résultats, l’effectif, les victoires et les classements", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 3,
    });
    const objectiveTypes = new Set(
      objectives.map((objective) => objective.objectiveType),
    );

    for (const objectiveType of [
      "race_result",
      "nationality_quota",
      "season_wins",
      "uci_ranking",
      "nation_uci_ranking",
      "national_championship",
    ]) {
      expect(objectiveTypes).toContain(objectiveType);
    }
  });

  it("associe une course nationale et une course d’un pays voisin", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 2,
      random: createDeterministicRandom([0.2, 0.7, 0.4]),
    });
    const raceCountries = objectives.flatMap((objective) =>
      objective.targetDetails.kind === "race_result"
        ? [objective.targetDetails.countryCode]
        : [],
    );

    expect(raceCountries).toContain("FR");
    expect(
      raceCountries.some(
        (countryCode) =>
          countryCode !== "FR" &&
          areSponsorCountriesNeighbors("FR", countryCode),
      ),
    ).toBe(true);
  });

  it("réserve Monuments et Grands Tours aux sponsors prestigieux", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 5,
      sponsorCatalogKey: "montbrun-private",
      sponsorSector: "Banque privée",
      random: createDeterministicRandom([0.1, 0.4, 0.7]),
    });
    const raceIds = objectives.flatMap((objective) =>
      objective.targetDetails.kind === "race_result"
        ? [objective.targetDetails.raceId]
        : [],
    );

    expect(raceIds).toContain("race-it-lombardia");
    expect(raceIds).toContain("race-es-grand-tour");
  });

  it("utilise le pays du sponsor pour le quota, le titre et le classement national", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: " be ",
      sponsorPrestige: 2,
    });
    const countryCodes = objectives.flatMap((objective) => {
      const details = objective.targetDetails;

      if (
        details.kind === "nationality_quota" ||
        details.kind === "national_championship" ||
        details.kind === "nation_uci_ranking"
      ) {
        return [details.countryCode];
      }

      return [];
    });

    expect(countryCodes).toEqual(["BE", "BE", "BE"]);
  });

  it("introduit la formation à partir de la deuxième année de relation", () => {
    const firstYear = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 2,
      relationshipYear: 1,
    });
    const secondYear = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 2,
      relationshipYear: 2,
    });

    expect(
      firstYear.some(
        (objective) => objective.objectiveType === "homegrown_roster",
      ),
    ).toBe(false);
    expect(
      secondYear.some(
        (objective) =>
          objective.targetDetails.kind === "homegrown_roster" &&
          objective.targetDetails.minimumPercentage === 10,
      ),
    ).toBe(true);
  });

  it("attribue des profils de priorité différents selon le sponsor", () => {
    expect(
      resolveSponsorObjectiveFocus({
        sponsorCatalogKey: "atlas-racing-lab",
        sponsorSector: "Laboratoire cycliste d’altitude",
        sponsorPrestige: 2,
      }),
    ).toBe("talent_development");

    expect(
      resolveSponsorObjectiveFocus({
        sponsorCatalogKey: "montbrun-private",
        sponsorSector: "Banque privée",
        sponsorPrestige: 5,
      }),
    ).toBe("prestige");
  });

  it("écarte les courses fermées ou trop prestigieuses pour l’équipe", () => {
    const selectedRaces = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      teamReputationPoints: 30,
      count: 3,
      random: () => 0.5,
      raceCandidates: [
        createRace("accessible-1", "Accessible 1", "FR"),
        createRace("accessible-2", "Accessible 2", "FR"),
        createRace("accessible-3", "Accessible 3", "BE"),
        createRace("locked", "Course verrouillée", "FR", {
          minimumReputation: 50,
        }),
        createRace("pending", "Course sur critères", "FR", {
          registrationPolicy: "criteria_pending",
          minimumReputation: null,
        }),
      ],
    });

    expect(selectedRaces.map((race) => race.raceSlug).sort()).toEqual([
      "accessible-1",
      "accessible-2",
      "accessible-3",
    ]);
  });

  it("accepte automatiquement une nouvelle course fournie par la base", () => {
    const newRace = createRace(
      "nouvelle-classique",
      "Nouvelle Classique",
      "FR",
    );
    const selectedRaces = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      teamReputationPoints: 30,
      count: 1,
      random: () => 0.5,
      raceCandidates: [newRace],
    });

    expect(selectedRaces).toEqual([newRace]);
  });

  it("rend les classements plus exigeants pour un sponsor prestigieux", () => {
    const lowPrestige = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 1,
      random: () => 0.3,
    });
    const highPrestige = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 5,
      random: () => 0.3,
    });
    const getTeamRank = (
      objectives: ReturnType<typeof generateProvisionalSponsorObjectives>,
    ) => {
      const objective = objectives.find(
        (entry) => entry.targetDetails.kind === "uci_ranking",
      );

      if (!objective || objective.targetDetails.kind !== "uci_ranking") {
        throw new Error("Objectif UCI introuvable.");
      }

      return objective.targetDetails.targetRank;
    };

    expect(getTeamRank(highPrestige)).toBeLessThan(getTeamRank(lowPrestige));
  });

  it("refuse de générer des objectifs sans pays sponsor", () => {
    expect(() =>
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "   ",
        sponsorPrestige: 1,
      }),
    ).toThrow("Le code pays du sponsor est obligatoire");
  });
});
