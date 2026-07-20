import { describe, expect, it } from "vitest";

import {
  generateProvisionalSponsorObjectives as generateObjectivesFromRaces,
  selectSponsorObjectiveRaces,
  type SponsorObjectiveRaceCandidate,
} from "./sponsor-objectives";

const RACE_CANDIDATES: SponsorObjectiveRaceCandidate[] = [
  createRace("fr-bretagne", "Grand Prix de Bretagne", "FR"),
  createRace("fr-cevennes", "Circuit des Cévennes", "FR"),
  createRace("fr-hexagone", "Boucle de l’Hexagone", "FR"),
  createRace("be-namur", "Critérium de Namur", "BE"),
  createRace("be-brabant", "Flèche du Brabant", "BE"),
  createRace("es-valencia", "Trofeo de Valencia", "ES"),
];

type GeneratorOptions = Omit<
  Parameters<typeof generateObjectivesFromRaces>[0],
  "teamReputationPoints" | "raceCandidates"
>;

function generateProvisionalSponsorObjectives(
  options: GeneratorOptions
) {
  return generateObjectivesFromRaces({
    ...options,
    teamReputationPoints: 30,
    raceCandidates: RACE_CANDIDATES,
  });
}

function createRace(
  raceSlug: string,
  raceLabel: string,
  countryCode: string,
  overrides: Partial<SponsorObjectiveRaceCandidate> = {}
): SponsorObjectiveRaceCandidate {
  return {
    raceId: `race-${raceSlug}`,
    raceEditionId: `edition-${raceSlug}`,
    raceSlug,
    raceLabel,
    countryCode,
    registrationPolicy: "open",
    minimumReputation: 0,
    ...overrides,
  };
}

function createDeterministicRandom(
  values: readonly number[]
): () => number {
  let currentIndex = 0;

  return () => {
    const value =
      values[currentIndex % values.length];

    currentIndex += 1;

    return value;
  };
}

describe("generateProvisionalSponsorObjectives", () => {
  it("génère exactement sept objectifs ordonnés", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 2,
      });

    expect(objectives).toHaveLength(7);

    expect(
      objectives.map(
        (objective) => objective.displayOrder
      )
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("génère les quatre familles d’objectifs prévues", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 3,
      });

    const objectiveTypes = new Set(
      objectives.map(
        (objective) => objective.objectiveType
      )
    );

    expect(objectiveTypes).toContain("race_result");
    expect(objectiveTypes).toContain(
      "nationality_quota"
    );
    expect(objectiveTypes).toContain("season_wins");
    expect(objectiveTypes).toContain("uci_ranking");
  });

  it("génère trois objectifs de résultat sur des courses distinctes", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 2,
        random: createDeterministicRandom([
          0.1,
          0.2,
          0.3,
          0.4,
          0.5,
          0.6,
          0.7,
          0.8,
          0.9,
        ]),
      });

    const raceObjectives = objectives.filter(
      (objective) =>
        objective.objectiveType === "race_result"
    );

    expect(raceObjectives).toHaveLength(3);

    const raceLabels = raceObjectives.map(
      (objective) => {
        if (
          objective.targetDetails.kind !==
          "race_result"
        ) {
          throw new Error(
            "Type de détails inattendu pour un objectif de course."
          );
        }

        return objective.targetDetails.raceLabel;
      }
    );

    expect(new Set(raceLabels).size).toBe(3);
  });

  it("privilégie les courses du pays du sponsor", () => {
    const objectives = generateProvisionalSponsorObjectives({
      sponsorCountryCode: "FR",
      sponsorPrestige: 2,
      random: createDeterministicRandom([0.2, 0.7, 0.4]),
    });
    const raceObjectives = objectives.filter(
      (objective) => objective.targetDetails.kind === "race_result"
    );

    expect(raceObjectives).toHaveLength(3);
    expect(
      raceObjectives.every(
        (objective) =>
          objective.targetDetails.kind === "race_result" &&
          objective.targetDetails.countryCode === "FR"
      )
    ).toBe(true);
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
      "FR"
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

  it("utilise la nationalité du sponsor pour le quota d’effectif", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: " be ",
        sponsorPrestige: 2,
      });

    const nationalityObjective = objectives.find(
      (objective) =>
        objective.objectiveType ===
        "nationality_quota"
    );

    expect(nationalityObjective).toBeDefined();

    if (
      !nationalityObjective ||
      nationalityObjective.targetDetails.kind !==
        "nationality_quota"
    ) {
      throw new Error(
        "Objectif de nationalité introuvable."
      );
    }

    expect(
      nationalityObjective.targetDetails.countryCode
    ).toBe("BE");
  });

  it("attribue un bonus de renouvellement de un pour cent à chaque objectif", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "ES",
        sponsorPrestige: 3,
      });

    expect(
      objectives.every(
        (objective) =>
          objective.renewalBonusPercent === 1
      )
    ).toBe(true);

    const maximumRenewalBonus = objectives.reduce(
      (total, objective) =>
        total + objective.renewalBonusPercent,
      0
    );

    expect(maximumRenewalBonus).toBe(7);
  });

  it("marque tous les objectifs comme provisoires et évaluables en fin de saison", () => {
    const objectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 1,
      });

    expect(
      objectives.every(
        (objective) =>
          objective.isProvisional &&
          objective.evaluationTiming ===
            "season_end" &&
          objective.evaluationDayNumber === null
      )
    ).toBe(true);
  });

  it("rend les attentes globalement plus exigeantes pour un sponsor prestigieux", () => {
    const randomValues = [
      0.1,
      0.2,
      0.3,
      0.4,
      0.5,
      0.6,
      0.7,
      0.8,
      0.9,
    ];

    const lowPrestigeObjectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 1,
        random:
          createDeterministicRandom(randomValues),
      });

    const highPrestigeObjectives =
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "FR",
        sponsorPrestige: 5,
        random:
          createDeterministicRandom(randomValues),
      });

    const lowPrestigeUciObjective =
      lowPrestigeObjectives.find(
        (objective) =>
          objective.objectiveType === "uci_ranking"
      );

    const highPrestigeUciObjective =
      highPrestigeObjectives.find(
        (objective) =>
          objective.objectiveType === "uci_ranking"
      );

    if (
      !lowPrestigeUciObjective ||
      lowPrestigeUciObjective.targetDetails.kind !==
        "uci_ranking" ||
      !highPrestigeUciObjective ||
      highPrestigeUciObjective.targetDetails.kind !==
        "uci_ranking"
    ) {
      throw new Error(
        "Objectifs de classement UCI introuvables."
      );
    }

    expect(
      highPrestigeUciObjective.targetDetails
        .targetRank
    ).toBeLessThan(
      lowPrestigeUciObjective.targetDetails
        .targetRank
    );
  });

  it("refuse de générer des objectifs sans pays sponsor", () => {
    expect(() =>
      generateProvisionalSponsorObjectives({
        sponsorCountryCode: "   ",
        sponsorPrestige: 1,
      })
    ).toThrow(
      "Le code pays du sponsor est obligatoire"
    );
  });
});
