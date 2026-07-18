import { describe, expect, it } from "vitest";

import { generateProvisionalSponsorObjectives } from "./sponsor-objectives";

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