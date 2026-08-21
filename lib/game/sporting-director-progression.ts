import {
  MAX_SPORTING_DIRECTOR_EXPERIENCE_POINTS,
  MAX_SPORTING_DIRECTOR_LEVEL,
} from "./sporting-director-limits";

export type SportingDirectorProgression = {
  level: number;
  totalExperiencePoints: number;
  experienceIntoLevel: number;
  experienceRequiredForNextLevel: number;
  progressPercentage: number;
  isMaxLevel: boolean;
};

export function calculateSportingDirectorProgression(
  experiencePoints: number
): SportingDirectorProgression {
  const safeExperiencePoints = Math.min(
    MAX_SPORTING_DIRECTOR_EXPERIENCE_POINTS,
    Math.max(0, Math.floor(experiencePoints))
  );

  let level = 1;
  let experienceConsumed = 0;
  let experienceRequiredForNextLevel =
    getExperienceRequiredForNextLevel(level);

  while (
    level < MAX_SPORTING_DIRECTOR_LEVEL &&
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

  const isMaxLevel =
    level >= MAX_SPORTING_DIRECTOR_LEVEL;

  const experienceIntoLevel = isMaxLevel
    ? 0
    : safeExperiencePoints - experienceConsumed;

  if (isMaxLevel) {
    experienceRequiredForNextLevel = 0;
  }

  const progressPercentage = isMaxLevel
    ? 100
    : Math.min(
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
    isMaxLevel,
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
