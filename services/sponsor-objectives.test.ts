import { describe, expect, it } from "vitest";

import {
  areSponsorCountriesNeighbors,
  generateProvisionalSponsorObjectives as generateObjectivesFromRaces,
  isRaceCategoryUnlockedForSponsorObjectives,
  matchesSponsorSportingPhilosophy,
  resolveSponsorObjectiveFocus,
  resolveSponsorObjectiveAmbitionLevel,
  selectSponsorObjectiveRaces,
  type SponsorObjectiveRaceCandidate,
} from "./sponsor-objectives";
import { resolveSponsorSportingPhilosophy } from "@/lib/game/sponsor-philosophy";

const RACE_CANDIDATES: SponsorObjectiveRaceCandidate[] = [
  createRace("fr-tour", "Tour de l’Hexagone", "FR", {
    raceFormat: "stage_race",
    profileTypes: ["hilly", "time_trial"],
  }),
  createRace("fr-bretagne", "Grand Prix de Bretagne", "FR", {
    profileTypes: ["cobbles"],
  }),
  createRace("be-namur", "Critérium de Namur", "BE", {
    profileTypes: ["hilly"],
  }),
  createRace("es-valencia", "Trofeo de Valencia", "ES", {
    profileTypes: ["sprint"],
  }),
  createRace("it-lombardia", "Giro di Lombardia", "IT", {
    isMonument: true,
    profileTypes: ["hilly"],
  }),
  createRace("es-grand-tour", "Vuelta Iberica", "ES", {
    raceFormat: "stage_race",
    isGrandTour: true,
    categoryCode: "world",
    profileTypes: ["mountain", "time_trial"],
  }),
];

type GeneratorOptions = Omit<
  Parameters<typeof generateObjectivesFromRaces>[0],
  "teamReputationPoints" | "raceCandidates" | "proposedBudget"
> & {
  proposedBudget?: number;
};

const REPRESENTATIVE_BUDGET_BY_PRESTIGE = {
  1: 250_000,
  2: 500_000,
  3: 800_000,
  4: 1_200_000,
  5: 1_700_000,
} as const;

function generateProvisionalSponsorObjectives(
  options: GeneratorOptions,
) {
  return generateObjectivesFromRaces({
    ...options,
    proposedBudget:
      options.proposedBudget ??
      REPRESENTATIVE_BUDGET_BY_PRESTIGE[options.sponsorPrestige],
    teamReputationPoints: 200,
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
    continentCode: ["FR", "BE", "ES", "IT", "PL"].includes(countryCode)
      ? "europe"
      : null,
    registrationPolicy: "open",
    minimumReputation: 0,
    categoryCode: "national",
    raceFormat: "one_day",
    profileTypes: ["flat"],
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

  it("décale exactement d’un niveau l’ambition négociée", () => {
    const generateAtDifficulty = (
      objectiveDifficulty: "accessible" | "balanced" | "ambitious",
    ) => generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 3,
      proposedBudget: 800_000,
      objectiveDifficulty,
      random: createDeterministicRandom([0.2, 0.7, 0.4]),
    });

    for (const [difficulty, expectedAmbition] of [
      ["accessible", 2],
      ["balanced", 3],
      ["ambitious", 4],
    ] as const) {
      const objectives = generateAtDifficulty(difficulty);

      expect(
        new Set(
          objectives.map(
            (objective) => objective.targetDetails.ambitionLevel,
          ),
        ),
      ).toEqual(new Set([expectedAmbition]));
      expect(
        new Set(
          objectives.map(
            (objective) => objective.targetDetails.objectiveDifficulty,
          ),
        ),
      ).toEqual(new Set([difficulty]));
    }
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

  it("aligne au moins un objectif de course sur la philosophie du sponsor", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 5,
      sponsorCatalogKey: "montbrun-private",
      sponsorSector: "Banque privée",
      sportingPhilosophy: "cobbled_classics",
      random: createDeterministicRandom([0.1, 0.4, 0.7]),
    });
    const raceIds = objectives.flatMap((objective) =>
      objective.targetDetails.kind === "race_result"
        ? [objective.targetDetails.raceId]
        : [],
    );

    expect(raceIds).toContain("race-fr-bretagne");
    expect(
      objectives.every(
        (objective) =>
          objective.targetDetails.sportingPhilosophy === "cobbled_classics",
      ),
    ).toBe(true);
  });

  it("fait du quota national l’engagement central de la préférence nationale", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 3,
      sponsorCatalogKey: "terroirs-unis",
      sponsorSector: "Agroalimentaire",
      sportingPhilosophy: "national_preference",
      random: createDeterministicRandom([0.1, 0.4, 0.7]),
    });
    const nationalityObjective = objectives.find(
      (objective) => objective.targetDetails.kind === "nationality_quota",
    );

    expect(nationalityObjective?.satisfactionPoints).toBe(30);
    expect(nationalityObjective?.priority).toBe("mandatory");
    expect(
      nationalityObjective?.targetDetails.kind === "nationality_quota"
        ? nationalityObjective.targetDetails.minimumPercentage
        : 0,
    ).toBeGreaterThanOrEqual(60);
    expect(
      objectives.reduce(
        (total, objective) => total + objective.satisfactionPoints,
        0,
      ),
    ).toBe(100);
  });

  it("compose la philosophie formateur autour de quatre métriques juniors", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "CO",
      sponsorPrestige: 4,
      sponsorCatalogKey: "pura-cadencia-test-team",
      sponsorSector: "Laboratoire cycliste d’altitude",
      sportingPhilosophy: "youth_development",
      random: createDeterministicRandom([0.1, 0.4, 0.7]),
    });
    const developmentObjectives = objectives.filter(
      (objective) => objective.targetDetails.kind === "youth_development",
    );
    const metrics = new Map(
      developmentObjectives.map((objective) => [
        objective.targetDetails.kind === "youth_development"
          ? objective.targetDetails.metric
          : "",
        objective,
      ]),
    );

    expect(developmentObjectives).toHaveLength(4);
    expect(new Set(metrics.keys())).toEqual(
      new Set([
        "promotions",
        "development_roster",
        "junior_race_wins",
        "homegrown_sales",
      ]),
    );
    expect(metrics.get("promotions")?.satisfactionPoints).toBe(18);
    expect(metrics.get("junior_race_wins")?.satisfactionPoints).toBe(18);
    const homegrownSalesObjective = metrics.get("homegrown_sales");

    expect(
      homegrownSalesObjective?.targetDetails.kind === "youth_development"
        ? homegrownSalesObjective.targetDetails.minimumCount
        : 0,
    ).toBe(2);
    expect(
      objectives.reduce(
        (total, objective) => total + objective.satisfactionPoints,
        0,
      ),
    ).toBe(100);
  });

  it("conserve la même philosophie lors d’une prolongation", () => {
    const sponsorKey = "atlas-racing-lab";

    expect(resolveSponsorSportingPhilosophy(sponsorKey)).toBe(
      resolveSponsorSportingPhilosophy(sponsorKey),
    );
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

  it("ouvre les catégories continentale et mondiale aux seuils du calendrier", () => {
    expect(
      isRaceCategoryUnlockedForSponsorObjectives("continental", 99),
    ).toBe(false);
    expect(
      isRaceCategoryUnlockedForSponsorObjectives("continental", 100),
    ).toBe(true);
    expect(isRaceCategoryUnlockedForSponsorObjectives("world", 199)).toBe(
      false,
    );
    expect(isRaceCategoryUnlockedForSponsorObjectives("world", 200)).toBe(
      true,
    );

    const raceCandidates = [
      createRace("national", "Course nationale", "FR"),
      createRace("continental", "Course continentale", "FR", {
        categoryCode: "continental",
      }),
      createRace("world", "Course mondiale", "FR", {
        categoryCode: "world",
      }),
    ];
    const selectedAt99 = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      teamReputationPoints: 99,
      raceCandidates,
      count: 1,
      random: () => 0.5,
    });
    const selectedAt100 = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      teamReputationPoints: 100,
      raceCandidates,
      count: 2,
      random: () => 0.5,
    });
    const selectedAt200 = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      teamReputationPoints: 200,
      raceCandidates,
      count: 3,
      random: () => 0.5,
    });

    expect(selectedAt99.map((race) => race.categoryCode)).toEqual([
      "national",
    ]);
    expect(new Set(selectedAt100.map((race) => race.categoryCode))).toEqual(
      new Set(["national", "continental"]),
    );
    expect(new Set(selectedAt200.map((race) => race.categoryCode))).toEqual(
      new Set(["national", "continental", "world"]),
    );
  });

  it("reconnaît les profils sportifs à partir du format et des étapes", () => {
    expect(
      matchesSponsorSportingPhilosophy(
        createRace("pavee", "Classique pavée", "FR", {
          profileTypes: ["cobbles"],
        }),
        "cobbled_classics",
      ),
    ).toBe(true);
    expect(
      matchesSponsorSportingPhilosophy(
        createRace("tour", "Tour intermédiaire", "FR", {
          raceFormat: "stage_race",
          profileTypes: ["hilly"],
        }),
        "medium_stage_races",
      ),
    ).toBe(true);
  });

  it("privilégie le pays, puis les voisins, puis le continent", () => {
    const selectedRaces = selectSponsorObjectiveRaces({
      sponsorCountryCode: "FR",
      sponsorContinentCode: "europe",
      teamReputationPoints: 100,
      count: 4,
      random: () => 0.5,
      raceCandidates: [
        createRace("argentine", "Course Argentine", "AR", {
          continentCode: "america",
        }),
        createRace("pologne", "Course Pologne", "PL"),
        createRace("belgique", "Course Belgique", "BE"),
        createRace("france", "Course France", "FR"),
      ],
    });

    expect(selectedRaces.map((race) => race.countryCode)).toEqual([
      "FR",
      "BE",
      "PL",
      "AR",
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

  it("fait progresser l’ambition avec le prestige et le budget proposé", () => {
    expect(
      resolveSponsorObjectiveAmbitionLevel({
        sponsorPrestige: 1,
        proposedBudget: 250_000,
      }),
    ).toBe(1);
    expect(
      resolveSponsorObjectiveAmbitionLevel({
        sponsorPrestige: 4,
        proposedBudget: 800_000,
      }),
    ).toBe(4);
    expect(
      resolveSponsorObjectiveAmbitionLevel({
        sponsorPrestige: 2,
        proposedBudget: 1_600_000,
      }),
    ).toBe(5);
    expect(
      resolveSponsorObjectiveAmbitionLevel({
        sponsorPrestige: 5,
        proposedBudget: 2_000_000,
      }),
    ).toBe(6);
  });

  it("refuse un budget d’offre nul ou invalide", () => {
    expect(() =>
      resolveSponsorObjectiveAmbitionLevel({
        sponsorPrestige: 3,
        proposedBudget: 0,
      }),
    ).toThrow("budget proposé");
  });

  it("réserve une victoire majeure et un très haut classement aux offres de 2 M€", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 5,
      proposedBudget: 2_100_000,
      sportingPhilosophy: "grand_tour_general",
      random: () => 0.3,
    });
    const grandTourObjective = objectives.find(
      (objective) =>
        objective.targetDetails.kind === "race_result" &&
        objective.targetDetails.raceId === "race-es-grand-tour",
    );
    const rankingObjective = objectives.find(
      (objective) => objective.targetDetails.kind === "uci_ranking",
    );

    expect(grandTourObjective?.targetDetails.kind).toBe("race_result");
    expect(
      grandTourObjective?.targetDetails.kind === "race_result"
        ? grandTourObjective.targetDetails.achievementType
        : null,
    ).toBe("win");
    expect(
      rankingObjective?.targetDetails.kind === "uci_ranking"
        ? rankingObjective.targetDetails.targetRank
        : Infinity,
    ).toBeLessThanOrEqual(10);
    expect(
      objectives.every(
        (objective) => objective.targetDetails.ambitionLevel === 6,
      ),
    ).toBe(true);
  });

  it("durcit fortement le quota des offres premium à préférence nationale", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 5,
      proposedBudget: 2_100_000,
      sportingPhilosophy: "national_preference",
      random: () => 0.3,
    });
    const nationalityObjective = objectives.find(
      (objective) => objective.targetDetails.kind === "nationality_quota",
    );

    expect(
      nationalityObjective?.targetDetails.kind === "nationality_quota"
        ? nationalityObjective.targetDetails.minimumPercentage
        : 0,
    ).toBeGreaterThanOrEqual(75);
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
