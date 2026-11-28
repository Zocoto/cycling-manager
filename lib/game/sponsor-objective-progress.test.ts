import { describe, expect, it } from "vitest";

import { getSponsorObjectiveProgressDisplay } from "./sponsor-objective-progress";

describe("getSponsorObjectiveProgressDisplay", () => {
  it("affiche la progression des victoires d’étape sans valider trop tôt", () => {
    expect(
      getSponsorObjectiveProgressDisplay({
        targetDetails: {
          kind: "season_wins",
          minimumWinCount: 5,
          winScope: "stages",
        },
        currentValue: 4,
        persistedTargetValue: 5,
      }),
    ).toEqual({
      label: "Victoires d’étape",
      currentValue: 4,
      targetValue: 5,
      percentage: 80,
      unit: "count",
    });
  });

  it.each([
    [
      {
        kind: "national_championship" as const,
        countryCode: "FR",
        championshipType: "any" as const,
        requiredTitleCount: 2,
      },
      "Titres nationaux",
      2,
    ],
    [
      {
        kind: "youth_development" as const,
        metric: "junior_race_wins" as const,
        minimumCount: 3,
      },
      "Victoires juniors",
      3,
    ],
    [
      {
        kind: "infrastructure" as const,
        minimumCompletedCount: 2,
      },
      "Infrastructures terminées",
      2,
    ],
    [
      { kind: "race_visibility" as const, metric: "classic_breakaways" as const, minimumCount: 4 },
      "Classiques avec une échappée",
      4,
    ],
    [
      { kind: "race_visibility" as const, metric: "stage_breakaways" as const, minimumCount: 6 },
      "Étapes avec une échappée",
      6,
    ],
    [
      { kind: "race_visibility" as const, metric: "combativity_awards" as const, minimumCount: 2 },
      "Prix de la combativité",
      2,
    ],
  ])(
    "généralise la jauge aux autres objectifs quantifiés",
    (targetDetails, label, targetValue) => {
      expect(
        getSponsorObjectiveProgressDisplay({
          targetDetails,
          currentValue: 1,
          persistedTargetValue: null,
        }),
      ).toMatchObject({ label, targetValue });
    },
  );

  it("conserve une jauge plafonnée visuellement à 100 %", () => {
    expect(
      getSponsorObjectiveProgressDisplay({
        targetDetails: {
          kind: "nationality_quota",
          countryCode: "BE",
          minimumPercentage: 20,
        },
        currentValue: 35,
        persistedTargetValue: 20,
      })?.percentage,
    ).toBe(100);
  });

  it("n’invente pas de jauge pour un objectif de classement", () => {
    expect(
      getSponsorObjectiveProgressDisplay({
        targetDetails: {
          kind: "race_result",
          raceId: "race-id",
          raceEditionId: "edition-id",
          raceSlug: "course",
          raceLabel: "Course",
          countryCode: "FR",
          achievementType: "top_n",
          targetRank: 5,
          requiredCount: 1,
        },
        currentValue: 6,
        persistedTargetValue: 5,
      }),
    ).toBeNull();
  });
});
