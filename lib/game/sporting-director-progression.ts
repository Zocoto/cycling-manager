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
  const safeExperiencePoints = Math.max(
    0,
    Math.floor(experiencePoints)
  );

  let level = 1;
  let experienceConsumed = 0;
  let experienceRequiredForNextLevel =
    getExperienceRequiredForNextLevel(level);

  while (
    safeExperiencePoints >=
    experienceConsumed +
      experienceRequiredForNextLevel
  ) {
    experienceConsumed +=
      experienceRequiredForNextLevel;

    level += 1;

    experienceRequiredForNextLevel =
      getExperienceRequiredForNextLevel(level);
  }

  const experienceIntoLevel =
    safeExperiencePoints - experienceConsumed;

  const progressPercentage = Math.min(
    100,
    Math.max(
      0,
      (experienceIntoLevel /
        experienceRequiredForNextLevel) *
        100
    )
  );

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
  const safeCurrentLevel = Math.max(
    1,
    Math.floor(currentLevel)
  );

  return 100 + (safeCurrentLevel - 1) * 50;
}