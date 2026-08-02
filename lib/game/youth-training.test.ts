import { describe, expect, it } from "vitest";

import type {
  YouthMiniGameScoreInput,
  YouthTrainingGameType,
} from "./youth-training";

function createScoreInput(
  gameType: YouthTrainingGameType,
  overrides: Partial<YouthMiniGameScoreInput> = {},
): YouthMiniGameScoreInput {
  return {
    gameType,
    rhythmPoints: 0,
    rhythmTaps: 0,
    reflexHits: 0,
    reflexOpportunities: 0,
    speedTaps: 0,
    timeTrialOptimalMilliseconds: 0,
    timeTrialElapsedMilliseconds: 0,
    breakawaySuccessfulAttacks: 0,
    breakawayOpportunities: 0,
    breakawayEnergy: 0,
    puncheurPoints: 0,
    puncheurOpportunities: 0,
    ...overrides,
  };
}

import {
  YOUTH_PUNCHEUR_ACCURACY_FOR_MAX_SCORE,
  YOUTH_PUNCHEUR_TARGET_MAX,
  YOUTH_PUNCHEUR_TARGET_MIN,
  YOUTH_REFLEX_HITS_FOR_MAX_SCORE,
  YOUTH_REFLEX_TARGET_INTERVAL_MS,
  YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE,
  YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE,
  YOUTH_SPEED_TAPS_FOR_MAX_SCORE,
  YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE,
  YOUTH_TRAINING_DURATION_SECONDS,
  calculateYouthAutomaticTrainingGain,
  calculateYouthMiniGameScore,
  calculateYouthPuncheurReleasePoints,
  getYouthPuncheurChargeRateMultiplier,
  calculateYouthManualTrainingGain,
  getYouthAutomaticFirstDay,
  getYouthManualTrainingDivisor,
  getYouthManualTrainingSlot,
  getYouthTrainingGameType,
  isYouthAutomaticTrainingDue,
  projectYouthRating,
  summarizeYouthSeasonTraining,
  unprojectYouthRating,
} from "./youth-training";

describe("youth training", () => {
  it("associe chaque profil junior au bon minijeu", () => {
    expect(getYouthTrainingGameType("climber")).toBe("rhythm");
    expect(getYouthTrainingGameType("puncheur")).toBe("puncheur");
    expect(getYouthTrainingGameType("northern_classics")).toBe("reflex");
    expect(getYouthTrainingGameType("breakaway")).toBe("breakaway");
    expect(getYouthTrainingGameType("sprinter")).toBe("speed");
    expect(getYouthTrainingGameType("rouleur")).toBe("time_trial");
  });

  it("applique la durée et les calibrages demandés aux jeux existants", () => {
    expect(YOUTH_TRAINING_DURATION_SECONDS).toBe(30);
    expect(YOUTH_SPEED_TAPS_FOR_MAX_SCORE).toBe(190);
    expect(YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE).toBe(28);
    expect(YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE).toBe(940);
    expect(YOUTH_REFLEX_TARGET_INTERVAL_MS).toBe(680);
    expect(YOUTH_REFLEX_HITS_FOR_MAX_SCORE).toBe(36);
    expect(YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE).toBe(0.88);
    expect(YOUTH_PUNCHEUR_ACCURACY_FOR_MAX_SCORE).toBe(950);
  });

  it("sépare les deux créneaux manuels à midi heure de Paris", () => {
    expect(getYouthManualTrainingSlot(0)).toBe("manual_am");
    expect(getYouthManualTrainingSlot(11)).toBe("manual_am");
    expect(getYouthManualTrainingSlot(12)).toBe("manual_pm");
    expect(getYouthManualTrainingSlot(23)).toBe("manual_pm");
  });

  it("ne rattrape pas les jours manuels après un passage en automatique", () => {
    expect(
      getYouthAutomaticFirstDay({
        automaticSinceSeasonId: "season-current",
        automaticSinceDayNumber: 12,
        currentSeasonId: "season-current",
      }),
    ).toBe(12);
    expect(
      getYouthAutomaticFirstDay({
        automaticSinceSeasonId: "season-previous",
        automaticSinceDayNumber: 12,
        currentSeasonId: "season-current",
      }),
    ).toBe(1);
  });

  it("déclenche la séance courante à partir de 8 h heure de Paris", () => {
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 10,
        currentDayNumber: 10,
        parisHour: 7,
      }),
    ).toBe(false);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 10,
        currentDayNumber: 10,
        parisHour: 8,
      }),
    ).toBe(true);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 9,
        currentDayNumber: 10,
        parisHour: 0,
      }),
    ).toBe(true);
    expect(
      isYouthAutomaticTrainingDue({
        dayNumber: 11,
        currentDayNumber: 10,
        parisHour: 12,
      }),
    ).toBe(false);
  });

  it("applique les cinq paliers de difficulté demandés", () => {
    expect(getYouthManualTrainingDivisor(49.999)).toBe(1_000);
    expect(getYouthManualTrainingDivisor(50)).toBe(2_000);
    expect(getYouthManualTrainingDivisor(60)).toBe(4_000);
    expect(getYouthManualTrainingDivisor(65)).toBe(6_000);
    expect(getYouthManualTrainingDivisor(70)).toBe(10_000);
  });

  it("accorde quatre points principaux pour 1000 points et quatre étoiles sous 50", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 20,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(4);
  });

  it("réduit progressivement le gain selon la note et le poids de la statistique", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 55,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(2);
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 62,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(1);
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 55,
        domain: "climber",
        ratingKey: "hills",
      }),
    ).toBeCloseTo(1.1);
  });

  it("double la progression automatique sans bonus d’entraîneur", () => {
    const gain = calculateYouthAutomaticTrainingGain({
      age: 17,
      potentialSteps: 8,
      currentProjectedRating: 55,
      domain: "climber",
      ratingKey: "mountain",
    });

    expect(gain).toBeGreaterThan(0.7);
    expect(gain).toBeLessThan(1);
  });

  it("continue de faire progresser un junior au-delà de 65", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: 80,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBeGreaterThan(0);
    expect(
      calculateYouthAutomaticTrainingGain({
        age: 18,
        potentialSteps: 8,
        currentProjectedRating: 80,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBeGreaterThan(0);
  });

  it("convertit les notes internes sans perdre la projection professionnelle", () => {
    expect(projectYouthRating(2)).toBe(50);
    expect(unprojectYouthRating(50)).toBe(2);
    expect(projectYouthRating(unprojectYouthRating(100))).toBe(100);
  });

  it("cumule les gains de saison et distingue les séances automatiques et manuelles", () => {
    expect(
      summarizeYouthSeasonTraining([
        {
          trainingMode: "automatic",
          ratingChanges: { mountain: 0.125, hills: 0.075 },
        },
        {
          trainingMode: "manual",
          ratingChanges: { mountain: 0.333, sprint: 0.2 },
        },
        {
          trainingMode: "manual",
          ratingChanges: { mountain: 0.222, hills: 0.1 },
        },
      ]),
    ).toEqual({
      sessionCount: 3,
      automaticSessionCount: 1,
      manualSessionCount: 2,
      ratingChanges: {
        mountain: 0.68,
        hills: 0.175,
        sprint: 0.2,
      },
    });
  });

  it("resserre la zone de relâchement du jeu Puncheur", () => {
    expect(YOUTH_PUNCHEUR_TARGET_MIN).toBe(0.73);
    expect(YOUTH_PUNCHEUR_TARGET_MAX).toBe(0.84);
    expect(calculateYouthPuncheurReleasePoints(0.73)).toBe(1_000);
    expect(calculateYouthPuncheurReleasePoints(0.78)).toBe(1_000);
    expect(calculateYouthPuncheurReleasePoints(0.84)).toBe(1_000);
    expect(calculateYouthPuncheurReleasePoints(0.65)).toBeGreaterThan(0);
    expect(calculateYouthPuncheurReleasePoints(0.65)).toBeLessThan(1_000);
    expect(calculateYouthPuncheurReleasePoints(0)).toBe(0);
  });

  it("accélère raisonnablement la charge du Puncheur en approchant du sommet", () => {
    expect(getYouthPuncheurChargeRateMultiplier(0)).toBe(0.8);
    expect(getYouthPuncheurChargeRateMultiplier(0.8)).toBeGreaterThan(
      getYouthPuncheurChargeRateMultiplier(0.2),
    );
    expect(getYouthPuncheurChargeRateMultiplier(1)).toBeCloseTo(1.7);
  });

  it("normalise les six minijeux sur 1000 points", () => {
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("rhythm", {
          rhythmPoints: 26_320,
          rhythmTaps: 28,
        }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("reflex", {
          reflexHits: 36,
          reflexOpportunities: 36,
        }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("speed", { speedTaps: 190 }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("time_trial", {
          timeTrialOptimalMilliseconds: 8_800,
          timeTrialElapsedMilliseconds: 10_000,
        }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("breakaway", {
          breakawaySuccessfulAttacks: 6,
          breakawayOpportunities: 6,
          breakawayEnergy: 30,
        }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("puncheur", {
          puncheurPoints: 5_700,
          puncheurOpportunities: 6,
        }),
      ),
    ).toBe(1_000);
  });

  it("borne les scores et ne récompense pas une partie inactive", () => {
    expect(
      calculateYouthMiniGameScore(createScoreInput("rhythm")),
    ).toBe(0);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("speed", { speedTaps: 999 }),
      ),
    ).toBe(1_000);
    expect(
      calculateYouthMiniGameScore(createScoreInput("time_trial")),
    ).toBe(0);
    expect(
      calculateYouthMiniGameScore(createScoreInput("breakaway")),
    ).toBe(0);
    expect(
      calculateYouthMiniGameScore(createScoreInput("puncheur")),
    ).toBe(0);
  });
});