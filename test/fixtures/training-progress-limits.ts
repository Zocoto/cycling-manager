import { TRAINING_STAT_CODES, type RiderTrainingReport, type RiderTrainingSeasonReport } from "@/lib/game/training";

// Synthetic presentation fixture. No accounts, requests or gameplay writes.
export const trainingLimitLatestFixture: RiderTrainingReport = {
  dayNumber: 25, status: "completed", intensity: 100, domain: "puncheur",
  minimumForm: 30, trainerLevel: 4, trainerSpecialty: "hills", trainerCountryMatch: false,
  physiotherapistLevel: 3, formBefore: 75, formDelta: -10, formAfter: 65,
  progressMilli: { hills: 398, acceleration: 398 }, declineMilli: {}, ratingChanges: { hills: 2 },
  processedAt: "2026-11-02T07:00:00.000Z",
};

export const trainingLimitSeasonFixture: RiderTrainingSeasonReport = {
  age: 18, potentialSteps: 8, fromDayNumber: 1, toDayNumber: 25,
  firstSessionDayNumber: 4, lastSessionDayNumber: 25, sessionCount: 22,
  completedSessionCount: 22, skippedSessionCount: 0, totalFormDelta: -220,
  stats: TRAINING_STAT_CODES.map((statCode) => ({
    statCode, initialRating: statCode === "hills" ? 61 : 55,
    currentRating: statCode === "hills" ? 75 : 57,
    ratingGain: statCode === "hills" ? 14 : 2, ratingLoss: 0,
    netRatingChange: statCode === "hills" ? 14 : 2,
    balanceMilli: statCode === "hills" ? 409 : 350,
    totalTrainingMilli: statCode === "hills" ? 14_409 : 2_350, totalDeclineMilli: 0,
  })),
};
