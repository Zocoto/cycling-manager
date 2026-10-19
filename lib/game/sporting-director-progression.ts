export type SportingDirectorProgression = {
  level: number;
  totalExperiencePoints: number;
  experienceIntoLevel: number;
  experienceRequiredForNextLevel: number;
  progressPercentage: number;
};

export function calculateSportingDirectorProgression(
  experiencePoints: number
): SportingDirectorProgression {
  // Keep integer arithmetic exact in JavaScript, without a gameplay level cap.
  const safeExperiencePoints = Number.isFinite(experiencePoints)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(experiencePoints)))
    : 0;

  // The existing 100, 150, 200... thresholds sum to 25 * (L - 1) * (L + 2).
  // Invert that sum instead of walking through every level on each page load.
  let level = Math.max(1, Math.floor((Math.sqrt(4 * safeExperiencePoints + 225) - 5) / 10));
  const consumedAtLevel = (value: number) => 25 * (value - 1) * (value + 2);
  // Correct possible floating-point rounding at an exact threshold.
  if (consumedAtLevel(level) > safeExperiencePoints) level -= 1;
  if (consumedAtLevel(level + 1) <= safeExperiencePoints) level += 1;

  const experienceIntoLevel = safeExperiencePoints - consumedAtLevel(level);
  const experienceRequiredForNextLevel = getExperienceRequiredForNextLevel(level);
  const progressPercentage = (experienceIntoLevel / experienceRequiredForNextLevel) * 100;

  return {
    level,
    totalExperiencePoints: safeExperiencePoints,
    experienceIntoLevel,
    experienceRequiredForNextLevel,
    progressPercentage,
  };
}

export function getExperienceRequiredForNextLevel(
  currentLevel: number
): number {
  const safeCurrentLevel = Number.isFinite(currentLevel)
    ? Math.max(1, Math.floor(currentLevel)) : 1;

  return 100 + (safeCurrentLevel - 1) * 50;
}
