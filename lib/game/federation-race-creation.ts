export const FEDERATION_RACE_CREATION_START_GAME_YEAR = 4;
export const FEDERATION_RACE_CREATION_SCORE_THRESHOLD = 60;

export const FEDERATION_RACE_CATEGORY_OPTIONS = [
  { code: "continental", label: "Continentale" },
  { code: "national", label: "Nationale" },
  { code: "regional", label: "Régionale" },
] as const;

export type FederationRaceCategoryCode =
  (typeof FEDERATION_RACE_CATEGORY_OPTIONS)[number]["code"];
export type FederationRaceFormat = "one_day" | "stage_race";
export type FederationRaceStageType =
  | "road"
  | "individual_time_trial"
  | "team_time_trial"
  | "prologue";
export type FederationRaceProfileType =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial"
  | "mixed";
export type FederationRaceTerrainType = "flat" | "climb" | "descent";
export type FederationRaceSurfaceType = "asphalt" | "cobbles";
export type FederationRaceDaySlot = "early" | "late";

export type FederationRaceSegmentBlueprint = {
  distanceKm: number;
  terrainType: FederationRaceTerrainType;
  surfaceType: FederationRaceSurfaceType;
  averageGradientPct: number;
};

export type FederationRaceStageBlueprint = {
  name: string;
  stageType: FederationRaceStageType;
  profileType: FederationRaceProfileType;
  segments: FederationRaceSegmentBlueprint[];
};

export type FederationRaceCreationScore = {
  nationRank: number | null;
  rankingPoints: number;
  completedObjectiveCount: number;
  objectivePoints: number;
  existingRaceCount: number;
  calendarPenalty: number;
  total: number;
  threshold: number;
  eligible: boolean;
};

export function buildFederationRaceCreationScore({
  nationRank,
  completedObjectiveCount,
  existingRaceCount,
}: {
  nationRank: number | null;
  completedObjectiveCount: number;
  existingRaceCount: number;
}): FederationRaceCreationScore {
  const normalizedRank = nationRank == null ? 173 : Math.max(1, nationRank);
  const normalizedObjectives = Math.max(
    0,
    Math.min(5, Math.trunc(completedObjectiveCount)),
  );
  const normalizedRaceCount = Math.max(0, Math.trunc(existingRaceCount));
  const rankingPoints = Math.max(0, 41 - normalizedRank);
  const objectivePoints = normalizedObjectives * 15;
  const calendarPenalty = normalizedRaceCount * 10;
  const total = Math.max(
    0,
    Math.min(100, rankingPoints + objectivePoints - calendarPenalty),
  );

  return {
    nationRank,
    rankingPoints,
    completedObjectiveCount: normalizedObjectives,
    objectivePoints,
    existingRaceCount: normalizedRaceCount,
    calendarPenalty,
    total,
    threshold: FEDERATION_RACE_CREATION_SCORE_THRESHOLD,
    eligible: total >= FEDERATION_RACE_CREATION_SCORE_THRESHOLD,
  };
}

export function getFederationRaceStageDistance(
  stage: FederationRaceStageBlueprint,
): number {
  return stage.segments.reduce(
    (total, segment) => total + segment.distanceKm,
    0,
  );
}

export function getFederationRaceScheduledSlot({
  startDay,
  startSlot,
  stageIndex,
}: {
  startDay: number;
  startSlot: FederationRaceDaySlot;
  stageIndex: number;
}): { dayNumber: number; daySlot: FederationRaceDaySlot } {
  const slotIndex =
    (Math.max(1, Math.trunc(startDay)) - 1) * 2 +
    (startSlot === "late" ? 1 : 0) +
    Math.max(0, Math.trunc(stageIndex));
  return {
    dayNumber: Math.floor(slotIndex / 2) + 1,
    daySlot: slotIndex % 2 === 0 ? "early" : "late",
  };
}
