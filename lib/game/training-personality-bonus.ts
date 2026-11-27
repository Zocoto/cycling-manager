export const ASSIDU_TRAINING_BONUS_PERCENTAGE = 5;

export type TrainingPersonalityBonus = {
  percentage: 5;
  source: "session" | "current";
  sessionCount?: number;
  totalSessionCount?: number;
};

type RecordedPercentage = number | string | null | undefined;

export function getTrainingPersonalityBonus({
  recordedPercentage,
  currentPersonalityKey,
  completed = true,
}: {
  recordedPercentage: RecordedPercentage;
  currentPersonalityKey: unknown;
  completed?: boolean;
}): TrainingPersonalityBonus | null {
  if (!completed) return null;
  if (recordedPercentage !== null && recordedPercentage !== undefined) {
    return Number(recordedPercentage) === ASSIDU_TRAINING_BONUS_PERCENTAGE
      ? { percentage: ASSIDU_TRAINING_BONUS_PERCENTAGE, source: "session" }
      : null;
  }
  // Legacy sessions do not attest a character. Keep current information
  // separate, including after a reroll, and never add it to recorded bonuses.
  return currentPersonalityKey === "assidu"
    ? { percentage: ASSIDU_TRAINING_BONUS_PERCENTAGE, source: "current" }
    : null;
}

export function getDailyTrainingPersonalityBonus({
  recordedPercentages,
  currentPersonalityKey,
}: {
  recordedPercentages: readonly RecordedPercentage[];
  currentPersonalityKey: unknown;
}): TrainingPersonalityBonus | null {
  if (!recordedPercentages.length) return null;
  const sessionCount = recordedPercentages.filter((value) =>
    value !== null && value !== undefined && Number(value) === ASSIDU_TRAINING_BONUS_PERCENTAGE,
  ).length;
  if (sessionCount) return {
    percentage: ASSIDU_TRAINING_BONUS_PERCENTAGE,
    source: "session",
    sessionCount,
    totalSessionCount: recordedPercentages.length,
  };
  return recordedPercentages.some((value) => value === null || value === undefined)
    ? getTrainingPersonalityBonus({ recordedPercentage: null, currentPersonalityKey })
    : null;
}
