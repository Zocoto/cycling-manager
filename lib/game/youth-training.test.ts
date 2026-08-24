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
  calculateYouthAutomaticTrainingGain,
  calculateYouthManualTrainingGain,
  calculateYouthMiniGameScore,
  calculateYouthPuncheurReleasePoints,
  getYouthAutomaticFirstDay,
  getYouthBreakawayWindowStart,
  getYouthManualTrainingSlot,
  getYouthProfileLoadFactor,
  getYouthPuncheurChargeRateMultiplier,
  getYouthPuncheurScoredOpportunities,
  getYouthRatingProgressFactor,
  getYouthReflexTargetInterval,
  getYouthRhythmCursorPosition,
  getYouthTimeTrialWindDrift,
  getYouthTalentProgressMultiplier,
  getYouthTrainingSessionVariance,
  getYouthTrainingVarianceFromRoll,
  getYouthTrainingGameType,
  isYouthAutomaticTrainingDue,
  projectYouthRating,
  summarizeYouthSeasonTraining,
  unprojectYouthRating,
} from "./youth-training";

const SIMULATED_YOUTH_RATING_KEYS = [
  "mountain",
  "hills",
  "flat",
  "timeTrial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
] as const;

type SimulatedYouthRatingKey = (typeof SIMULATED_YOUTH_RATING_KEYS)[number];

function simulateYouthCareer({
  potentialSteps,
  mode,
  score,
}: {
  potentialSteps: number;
  mode: "automatic" | "manual";
  score: number;
}) {
  const ratings: Record<SimulatedYouthRatingKey, number> = {
    mountain: 50,
    hills: 48,
    flat: 43,
    timeTrial: 42,
    cobbles: 41,
    sprint: 40,
    acceleration: 43,
    downhill: 45,
    endurance: 46,
    resistance: 46,
    recovery: 44,
    breakaway: 43,
    prologue: 42,
  };

  for (let day = 0; day < 84; day += 1) {
    const sessionCount = mode === "manual" ? 2 : 1;
    for (let session = 0; session < sessionCount; session += 1) {
      const profileValues = Object.values(ratings);
      const profilePeakRating = Math.max(...profileValues);
      const profileAverageRating =
        profileValues.reduce((sum, rating) => sum + rating, 0) /
        profileValues.length;

      for (const ratingKey of SIMULATED_YOUTH_RATING_KEYS) {
        const context = {
          age: 17,
          potentialSteps,
          currentProjectedRating: ratings[ratingKey],
          profilePeakRating,
          profileAverageRating,
          sessionVariance: 1,
          domain: "climber" as const,
          ratingKey,
        };
        const gain =
          mode === "manual"
            ? calculateYouthManualTrainingGain({ ...context, score })
            : calculateYouthAutomaticTrainingGain(context);
        ratings[ratingKey] = Math.round((ratings[ratingKey] + gain) * 1_000) / 1_000;
      }
    }
  }

  return ratings;
}

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

  it("remplace tous les paliers par une courbe continue jusque dans l’élite", () => {
    const aroundSeventy = [69.99, 70, 70.01].map(
      getYouthRatingProgressFactor,
    );

    expect(Math.max(...aroundSeventy) - Math.min(...aroundSeventy)).toBeLessThan(
      0.001,
    );
    expect(getYouthRatingProgressFactor(42)).toBeGreaterThan(
      getYouthRatingProgressFactor(70),
    );
    expect(getYouthRatingProgressFactor(80)).toBeGreaterThan(0.65);
    expect(getYouthRatingProgressFactor(90)).toBeGreaterThan(0.55);
  });

  it("donne au talent un poids nettement supérieur à celui du modèle pro", () => {
    const lowTalent = getYouthTalentProgressMultiplier(1);
    const mediumTalent = getYouthTalentProgressMultiplier(4);
    const eliteTalent = getYouthTalentProgressMultiplier(8);

    expect(eliteTalent / lowTalent).toBeGreaterThan(3);
    expect(eliteTalent / mediumTalent).toBeGreaterThan(1.8);
  });

  it("rend deux bonnes séances manuelles 33 à 50 % plus efficaces", () => {
    const context = {
      age: 17,
      potentialSteps: 8,
      currentProjectedRating: 55,
      profilePeakRating: 60,
      profileAverageRating: 50,
      sessionVariance: 1,
      domain: "climber" as const,
      ratingKey: "mountain" as const,
    };
    const automaticGain = calculateYouthAutomaticTrainingGain(context);
    const manualDayGain =
      calculateYouthManualTrainingGain({ ...context, score: 900 }) * 2;

    expect(manualDayGain / automaticGain).toBeGreaterThanOrEqual(1.35);
    expect(manualDayGain / automaticGain).toBeLessThanOrEqual(1.5);
  });

  it("freine surtout la statistique forte et plus légèrement tout le profil", () => {
    const freshProfileFactor = getYouthProfileLoadFactor({
      profilePeakRating: 65,
      profileAverageRating: 55,
    });
    const loadedProfileFactor = getYouthProfileLoadFactor({
      profilePeakRating: 82,
      profileAverageRating: 60,
    });
    const strongStatFactor = getYouthRatingProgressFactor(82);
    const ordinaryStatFactor = getYouthRatingProgressFactor(55);

    expect(loadedProfileFactor).toBeLessThan(freshProfileFactor);
    expect(loadedProfileFactor).toBeGreaterThan(0.8);
    expect(strongStatFactor / ordinaryStatFactor).toBeLessThan(
      loadedProfileFactor / freshProfileFactor,
    );
  });

  it("produit des séances déterministes avec de rares bons et mauvais jours", () => {
    const badDay = getYouthTrainingVarianceFromRoll(0);
    const normalDay = getYouthTrainingVarianceFromRoll(0.5);
    const greatDay = getYouthTrainingVarianceFromRoll(1);

    expect(badDay).toBe(0.78);
    expect(normalDay).toBe(1);
    expect(greatDay).toBe(1.28);
    expect(getYouthTrainingSessionVariance("rider:day:automatic")).toBe(
      getYouthTrainingSessionVariance("rider:day:automatic"),
    );
  });

  it("permet à un talent exceptionnel très travaillé de devenir fort sans être à 80 partout", () => {
    const ratings = simulateYouthCareer({
      potentialSteps: 8,
      mode: "manual",
      score: 900,
    });
    const values = Object.values(ratings);

    expect(Math.max(...values)).toBeGreaterThan(85);
    expect(values.filter((rating) => rating >= 80).length).toBeLessThanOrEqual(
      3,
    );
    expect(values.reduce((sum, rating) => sum + rating, 0) / values.length).toBeLessThan(
      70,
    );
  });

  it("garde un talent moyen dans une trajectoire crédible sur trois saisons", () => {
    const automaticRatings = Object.values(
      simulateYouthCareer({
        potentialSteps: 4,
        mode: "automatic",
        score: 0,
      }),
    );
    const manualRatings = Object.values(
      simulateYouthCareer({
        potentialSteps: 4,
        mode: "manual",
        score: 900,
      }),
    );

    expect(Math.max(...automaticRatings)).toBeGreaterThan(68);
    expect(Math.max(...automaticRatings)).toBeLessThan(74);
    expect(Math.max(...manualRatings)).toBeGreaterThan(74);
    expect(Math.max(...manualRatings)).toBeLessThan(80);
    expect(
      manualRatings.reduce((sum, rating) => sum + rating, 0) /
        manualRatings.length,
    ).toBeLessThan(60);
  });

  it("continue à faire progresser une très bonne statistique sans plafond artificiel", () => {
    expect(
      calculateYouthAutomaticTrainingGain({
        age: 18,
        potentialSteps: 8,
        currentProjectedRating: 90,
        profilePeakRating: 90,
        profileAverageRating: 66,
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
