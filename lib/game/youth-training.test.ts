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
    puncheurHits: 0,
    puncheurOpportunities: 0,
    ...overrides,
  };
}

import {
  YOUTH_BREAKAWAY_WINDOW_WIDTH,
  YOUTH_PUNCHEUR_HITS_FOR_MAX_SCORE,
  YOUTH_PUNCHEUR_TARGET_MAX,
  YOUTH_PUNCHEUR_TARGET_MIN,
  YOUTH_REFLEX_HITS_FOR_MAX_SCORE,
  YOUTH_REFLEX_INITIAL_DELAY_MS,
  YOUTH_REFLEX_TARGET_INTERVAL_MAX_MS,
  YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS,
  YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE,
  YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE,
  YOUTH_SPEED_TAPS_FOR_MAX_SCORE,
  YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE,
  YOUTH_TRAINING_DURATION_SECONDS,
  YOUTH_TRAINING_SOFT_CEILING,
  calculateYouthAutomaticTrainingGain,
  calculateYouthManualTrainingGain,
  calculateYouthMiniGameScore,
  calculateYouthPuncheurReleasePoints,
  getYouthAutomaticFirstDay,
  getYouthBreakawayWindowStart,
  getYouthHighRatingProgressFactor,
  getYouthManualTrainingDivisor,
  getYouthManualTrainingSlot,
  getYouthPuncheurChargeRateMultiplier,
  getYouthPuncheurScoredOpportunities,
  getYouthReflexTargetInterval,
  getYouthRhythmCursorPosition,
  getYouthTimeTrialWindDrift,
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
    expect(YOUTH_RHYTHM_TAPS_FOR_MAX_SCORE).toBe(27);
    expect(YOUTH_RHYTHM_ACCURACY_FOR_MAX_SCORE).toBe(920);
    expect(YOUTH_REFLEX_INITIAL_DELAY_MS).toBe(950);
    expect(YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS).toBe(520);
    expect(YOUTH_REFLEX_TARGET_INTERVAL_MAX_MS).toBe(880);
    expect(YOUTH_REFLEX_HITS_FOR_MAX_SCORE).toBe(36);
    expect(YOUTH_TIME_TRIAL_OPTIMAL_RATIO_FOR_MAX_SCORE).toBe(0.88);
    expect(YOUTH_BREAKAWAY_WINDOW_WIDTH).toBe(0.2);
    expect(YOUTH_PUNCHEUR_HITS_FOR_MAX_SCORE).toBe(7);
  });

  it("démarre le curseur Grimpeur à une extrémité avant de traverser", () => {
    expect(getYouthRhythmCursorPosition(0)).toBeCloseTo(0.02);
    expect(getYouthRhythmCursorPosition(500)).toBeGreaterThan(0.15);
  });

  it("laisse un départ calme puis varie le rythme des cibles Pavés", () => {
    expect(getYouthReflexTargetInterval(0)).toBe(
      YOUTH_REFLEX_TARGET_INTERVAL_MIN_MS,
    );
    expect(getYouthReflexTargetInterval(1)).toBe(
      YOUTH_REFLEX_TARGET_INTERVAL_MAX_MS,
    );
    expect(getYouthReflexTargetInterval(0.5)).toBe(700);
  });

  it("déplace la fenêtre Baroudeur sans la rendre inaccessible", () => {
    const starts = Array.from({ length: 6 }, (_, cycle) =>
      getYouthBreakawayWindowStart(cycle),
    );

    expect(new Set(starts).size).toBe(6);
    for (const start of starts) {
      expect(start).toBeGreaterThanOrEqual(0.15);
      expect(start + YOUTH_BREAKAWAY_WINDOW_WIDTH).toBeLessThanOrEqual(0.9);
    }
  });

  it("fait vaciller le coureur CLM dans les deux directions", () => {
    const drifts = Array.from({ length: 101 }, (_, index) =>
      getYouthTimeTrialWindDrift(index * 100),
    );

    expect(Math.min(...drifts)).toBeLessThan(-0.00005);
    expect(Math.max(...drifts)).toBeGreaterThan(0.00005);
    expect(Math.max(...drifts) - Math.min(...drifts)).toBeGreaterThan(
      0.0002,
    );
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

  it("calcule une séance automatique quotidienne sans bonus d’entraîneur", () => {
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

  it("freine dès 70 et ralentit fortement à l’approche de 75", () => {
    expect(
      getYouthHighRatingProgressFactor({
        currentProjectedRating: 69.999,
        potentialSteps: 8,
      }),
    ).toBe(1);
    expect(
      getYouthHighRatingProgressFactor({
        currentProjectedRating: 70,
        potentialSteps: 8,
      }),
    ).toBeCloseTo(0.35);
    expect(
      getYouthHighRatingProgressFactor({
        currentProjectedRating: 75,
        potentialSteps: 8,
      }),
    ).toBeLessThan(0.01);
    expect(
      getYouthHighRatingProgressFactor({
        currentProjectedRating: YOUTH_TRAINING_SOFT_CEILING,
        potentialSteps: 8,
      }),
    ).toBe(0);
  });

  it("ramène le cas signalé à environ six centièmes par jour", () => {
    const gain = calculateYouthAutomaticTrainingGain({
      age: 17,
      potentialSteps: 4,
      currentProjectedRating: 71,
      domain: "climber",
      ratingKey: "mountain",
    });

    expect(gain).toBeGreaterThan(0.05);
    expect(gain).toBeLessThan(0.07);
  });

  it("maintient un potentiel maximal autour de 75 après trois saisons parfaites", () => {
    let rawRating = unprojectYouthRating(50);

    for (let session = 0; session < 28 * 3 * 2; session += 1) {
      const projectedRating = projectYouthRating(rawRating);
      const projectedGain = calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: projectedRating,
        domain: "climber",
        ratingKey: "mountain",
      });
      rawRating =
        Math.round((rawRating + projectedGain / 8) * 1_000) / 1_000;
    }

    expect(projectYouthRating(rawRating)).toBeGreaterThan(74);
    expect(projectYouthRating(rawRating)).toBeLessThanOrEqual(75.2);
  });

  it("ne crée plus de progression junior à partir du plafond souple", () => {
    expect(
      calculateYouthManualTrainingGain({
        score: 1_000,
        potentialSteps: 8,
        currentProjectedRating: YOUTH_TRAINING_SOFT_CEILING,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(0);
    expect(
      calculateYouthAutomaticTrainingGain({
        age: 18,
        potentialSteps: 8,
        currentProjectedRating: YOUTH_TRAINING_SOFT_CEILING,
        domain: "climber",
        ratingKey: "mountain",
      }),
    ).toBe(0);
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
    expect(getYouthPuncheurChargeRateMultiplier(0)).toBe(0.7);
    expect(getYouthPuncheurChargeRateMultiplier(0.8)).toBeGreaterThan(
      getYouthPuncheurChargeRateMultiplier(0.2),
    );
    expect(getYouthPuncheurChargeRateMultiplier(1)).toBeCloseTo(2.6);
    expect(
      getYouthPuncheurChargeRateMultiplier(0.9) -
        getYouthPuncheurChargeRateMultiplier(0.7),
    ).toBeGreaterThan(
      getYouthPuncheurChargeRateMultiplier(0.4) -
        getYouthPuncheurChargeRateMultiplier(0.2),
    );
  });

  it("ignore la tentative Puncheur encore pressée au terme du chrono", () => {
    expect(getYouthPuncheurScoredOpportunities(7, false)).toBe(7);
    expect(getYouthPuncheurScoredOpportunities(7, true)).toBe(6);
    expect(getYouthPuncheurScoredOpportunities(1, true)).toBe(0);
    expect(getYouthPuncheurScoredOpportunities(0, true)).toBe(0);
  });

  it("exige plusieurs HIT Puncheur pour approcher les 1000 points", () => {
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("puncheur", {
          puncheurPoints: 1_000,
          puncheurHits: 1,
          puncheurOpportunities: 1,
        }),
      ),
    ).toBe(271);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("puncheur", {
          puncheurPoints: 6_000,
          puncheurHits: 6,
          puncheurOpportunities: 6,
        }),
      ),
    ).toBe(879);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("puncheur", {
          puncheurPoints: 7_000,
          puncheurHits: 7,
          puncheurOpportunities: 7,
        }),
      ),
    ).toBe(1_000);
  });

  it("garde le score parfait Grimpeur exigeant sur les deux critères", () => {
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("rhythm", {
          rhythmPoints: 24_300,
          rhythmTaps: 27,
        }),
      ),
    ).toBe(978);
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("rhythm", {
          rhythmPoints: 23_920,
          rhythmTaps: 26,
        }),
      ),
    ).toBe(987);
  });

  it("normalise les six minijeux sur 1000 points", () => {
    expect(
      calculateYouthMiniGameScore(
        createScoreInput("rhythm", {
          rhythmPoints: 24_840,
          rhythmTaps: 27,
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
          puncheurPoints: 7_000,
          puncheurHits: 7,
          puncheurOpportunities: 7,
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
