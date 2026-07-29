import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
import {
  applyEquipmentRatingBonuses,
  EMPTY_EQUIPMENT_EFFECTS,
} from "./equipment";
import { getRiderExperienceRaceBonus } from "./rider-experience";
import type {
  RiderSimulationInput,
  RiderSimulationRatings,
  StageSimulationInput,
} from "./race-simulation";

export type RaceFavoriteStars = 1 | 2 | 3;

export type RaceFavorite = {
  rider: RiderSimulationInput;
  rank: number;
  stars: RaceFavoriteStars;
  score: number;
};

export function getFrozenRaceFavoriteRiders(
  edition: Pick<RaceCalendarEdition, "stages" | "engagedRiders">,
  lockedSimulations: Array<{
    stageId: string;
    input: Pick<
      StageSimulationInput,
      "riders" | "unavailableRiderIds"
    >;
  }>,
  stageId?: string,
) {
  const targetStage = stageId
    ? edition.stages.find((stage) => stage.id === stageId)
    : [...edition.stages].sort(
        (first, second) =>
          first.stageNumber - second.stageNumber ||
          first.id.localeCompare(second.id),
      )[0];
  const frozenSimulation = targetStage
    ? lockedSimulations.find(
        (simulation) => simulation.stageId === targetStage.id,
      )?.input
    : undefined;

  if (!frozenSimulation) {
    return edition.engagedRiders;
  }

  const unavailableRiderIds = new Set(
    frozenSimulation.unavailableRiderIds ?? [],
  );

  return frozenSimulation.riders.filter(
    (rider) => !unavailableRiderIds.has(rider.id),
  );
}

export function buildRaceFavorites({
  edition,
  riders = edition.engagedRiders,
  limit = 20,
}: {
  edition: Pick<RaceCalendarEdition, "raceFormat" | "stages" | "engagedRiders">;
  riders?: RiderSimulationInput[];
  limit?: number;
}): RaceFavorite[] {
  const uniqueRiders = [
    ...new Map(riders.map((rider) => [rider.id, rider])).values(),
  ];
  const safeLimit = Math.max(0, Math.min(20, Math.floor(limit)));

  return uniqueRiders
    .map((rider) => ({
      rider,
      score: getRaceFavoriteScore(edition, rider),
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        getRatingsAverage(second.rider.ratings) -
          getRatingsAverage(first.rider.ratings) ||
        first.rider.name.localeCompare(second.rider.name, "fr") ||
        first.rider.id.localeCompare(second.rider.id),
    )
    .slice(0, safeLimit)
    .map(({ rider, score }, index) => {
      const rank = index + 1;
      return {
        rider,
        rank,
        stars: rank <= 3 ? 3 : rank <= 10 ? 2 : 1,
        score: round(score, 3),
      };
    });
}

export function getRaceFavoriteScore(
  edition: Pick<RaceCalendarEdition, "raceFormat" | "stages">,
  rider: RiderSimulationInput,
) {
  const stages = [...edition.stages].sort(
    (first, second) =>
      first.stageNumber - second.stageNumber ||
      first.id.localeCompare(second.id),
  );
  if (stages.length === 0) {
    return getRatingsAverage(rider.ratings);
  }

  const experienceBonus = getRiderExperienceRaceBonus(
    rider.careerRaceDays ?? 0,
  );
  const localBonus = rider.localRaceBonus ?? 0;

  if (edition.raceFormat === "one_day") {
    return (
      getStageFavoriteScore(rider, stages[0], false) +
      experienceBonus +
      localBonus
    );
  }

  let weightedScore = 0;
  let totalWeight = 0;
  const stageScores: number[] = [];

  for (const stage of stages) {
    const stageScore = getStageFavoriteScore(rider, stage, true);
    const stageWeight = getGeneralClassificationStageWeight(stage);
    stageScores.push(stageScore);
    weightedScore += stageScore * stageWeight;
    totalWeight += stageWeight;
  }

  const lowestStageScore = Math.min(...stageScores);
  const ratings = getStageRatings(rider, stages[0]);

  return (
    (weightedScore / Math.max(1, totalWeight)) * 0.86 +
    lowestStageScore * 0.06 +
    ratings.recovery * 0.04 +
    rider.form * 0.04 +
    experienceBonus +
    localBonus
  );
}

function getStageFavoriteScore(
  rider: RiderSimulationInput,
  stage: RaceCalendarStage,
  forGeneralClassification: boolean,
) {
  const ratings = getStageRatings(rider, stage);
  const reconnaissanceBonus =
    stage.reconnaissanceBonuses?.[rider.id] ?? rider.reconnaissanceBonus ?? 0;

  if (stage.stageType === "prologue") {
    return (
      ratings.prologue * 0.58 +
      ratings.acceleration * 0.16 +
      ratings.timeTrial * 0.12 +
      ratings.flat * 0.08 +
      ratings.resistance * 0.06 +
      rider.form * 0.05 +
      reconnaissanceBonus
    );
  }

  if (
    stage.stageType === "individual_time_trial" ||
    stage.stageType === "team_time_trial"
  ) {
    const terrainRating = getRouteRating(ratings, stage);
    const terrainDifficulty = getTimeTrialTerrainDifficulty(stage);
    const timeTrialWeight = 0.56 - terrainDifficulty * 0.1;
    const terrainWeight = 0.18 + terrainDifficulty * 0.1;
    return (
      ratings.timeTrial * timeTrialWeight +
      terrainRating * terrainWeight +
      ratings.endurance * 0.12 +
      ratings.resistance * 0.08 +
      ratings.recovery * (forGeneralClassification ? 0.06 : 0.01) +
      rider.form * 0.05 +
      reconnaissanceBonus
    );
  }

  if (forGeneralClassification) {
    const routeRating = getRouteRating(ratings, stage);
    return (
      routeRating * 0.72 +
      ratings.endurance * 0.1 +
      ratings.resistance * 0.07 +
      ratings.recovery * 0.07 +
      rider.form * 0.04 +
      reconnaissanceBonus
    );
  }

  return (
    getOneDayRoadFavoriteScore(ratings, stage, rider.form) +
    reconnaissanceBonus
  );
}

function getOneDayRoadFavoriteScore(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
  form: number,
) {
  // The declared profile drives selection and the finish in the race engine.
  // Keep the pre-race prediction aligned with those decisive ratings instead
  // of allowing secondary all-rounder ratings to outweigh the specialist.
  if (stage.profileType === "flat") {
    return (
      ratings.sprint * 0.62 +
      ratings.acceleration * 0.15 +
      ratings.flat * 0.08 +
      ratings.resistance * 0.05 +
      ratings.endurance * 0.05 +
      form * 0.05
    );
  }

  if (stage.profileType === "sprint") {
    return (
      ratings.sprint * 0.68 +
      ratings.acceleration * 0.14 +
      ratings.flat * 0.06 +
      ratings.resistance * 0.04 +
      ratings.endurance * 0.03 +
      form * 0.05
    );
  }

  if (stage.profileType === "hilly") {
    return (
      ratings.hills * 0.56 +
      ratings.acceleration * 0.14 +
      ratings.resistance * 0.08 +
      ratings.endurance * 0.06 +
      ratings.mountain * 0.05 +
      ratings.sprint * 0.04 +
      form * 0.07
    );
  }

  if (stage.profileType === "mountain") {
    return (
      ratings.mountain * 0.62 +
      ratings.hills * 0.1 +
      ratings.endurance * 0.08 +
      ratings.resistance * 0.06 +
      ratings.acceleration * 0.04 +
      ratings.downhill * 0.03 +
      form * 0.07
    );
  }

  if (stage.profileType === "cobbles") {
    return (
      ratings.cobbles * 0.52 +
      ratings.flat * 0.13 +
      ratings.resistance * 0.1 +
      ratings.endurance * 0.07 +
      ratings.sprint * 0.06 +
      ratings.acceleration * 0.05 +
      form * 0.07
    );
  }

  if (stage.profileType === "time_trial") {
    return (
      ratings.timeTrial * 0.56 +
      ratings.flat * 0.12 +
      ratings.endurance * 0.1 +
      ratings.resistance * 0.07 +
      ratings.prologue * 0.04 +
      ratings.acceleration * 0.04 +
      form * 0.07
    );
  }

  const routeRating = getRouteRating(ratings, stage);
  const finishRating = getFinishRating(ratings, stage);
  return routeRating * 0.55 + finishRating * 0.38 + form * 0.07;
}

function getStageRatings(
  rider: RiderSimulationInput,
  stage: RaceCalendarStage,
) {
  const equipmentEffects =
    rider.equipmentEffects ?? EMPTY_EQUIPMENT_EFFECTS;
  const isTimeTrial =
    stage.stageType === "individual_time_trial" ||
    stage.stageType === "team_time_trial" ||
    stage.stageType === "prologue";

  return applyEquipmentRatingBonuses(
    rider.ratings,
    equipmentEffects,
    { isTimeTrial },
  );
}

function getRouteRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  const totalDistance = Math.max(
    1,
    stage.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
  );

  return stage.segments.reduce((total, segment) => {
    let segmentRating: number;

    if (segment.surface === "cobbles") {
      segmentRating =
        ratings.cobbles * 0.62 +
        ratings.flat * 0.16 +
        ratings.resistance * 0.13 +
        ratings.endurance * 0.09;
    } else if (segment.terrain === "climb") {
      const gradient = Math.abs(segment.averageGradientPct);
      const mountainWeight = clamp(
        0.18 +
          Math.max(0, gradient - 3) * 0.07 +
          Math.max(0, segment.distanceKm - 5) * 0.025,
        0.18,
        0.82,
      );
      segmentRating =
        ratings.mountain * mountainWeight +
        ratings.hills * (1 - mountainWeight);
    } else if (segment.terrain === "descent") {
      segmentRating =
        ratings.downhill * 0.5 +
        ratings.resistance * 0.3 +
        ratings.flat * 0.2;
    } else {
      segmentRating =
        ratings.flat * 0.62 +
        ratings.endurance * 0.23 +
        ratings.resistance * 0.15;
    }

    const selectivity =
      segment.surface === "cobbles"
        ? 1.28
        : segment.terrain === "climb"
          ? 1 + Math.abs(segment.averageGradientPct) / 18
          : segment.terrain === "descent"
            ? 0.62
            : 0.82;

    return total + segmentRating * segment.distanceKm * selectivity;
  }, 0) / totalDistance;
}

function getFinishRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  const finalSegments = stage.segments.slice(-3);
  const finalSegment = finalSegments.at(-1);
  const hasCobbles = finalSegments.some(
    (segment) => segment.surface === "cobbles",
  );

  if (hasCobbles) {
    return (
      ratings.cobbles * 0.48 +
      ratings.acceleration * 0.17 +
      ratings.flat * 0.14 +
      ratings.resistance * 0.13 +
      ratings.sprint * 0.08
    );
  }

  if (finalSegment?.terrain === "climb") {
    const gradient = Math.abs(finalSegment.averageGradientPct);
    if (gradient >= 6 || finalSegment.distanceKm >= 8) {
      return (
        ratings.mountain * 0.48 +
        ratings.hills * 0.18 +
        ratings.acceleration * 0.12 +
        ratings.endurance * 0.12 +
        ratings.resistance * 0.1
      );
    }

    return (
      ratings.hills * 0.44 +
      ratings.acceleration * 0.24 +
      ratings.mountain * 0.12 +
      ratings.sprint * 0.08 +
      ratings.resistance * 0.07 +
      ratings.endurance * 0.05
    );
  }

  if (finalSegment?.terrain === "descent") {
    return (
      ratings.downhill * 0.28 +
      ratings.sprint * 0.26 +
      ratings.acceleration * 0.2 +
      ratings.flat * 0.14 +
      ratings.resistance * 0.12
    );
  }

  return (
    ratings.sprint * 0.42 +
    ratings.acceleration * 0.24 +
    ratings.flat * 0.16 +
    ratings.resistance * 0.1 +
    ratings.endurance * 0.08
  );
}

function getGeneralClassificationStageWeight(stage: RaceCalendarStage) {
  if (
    stage.stageType === "individual_time_trial" ||
    stage.stageType === "team_time_trial"
  ) {
    const distanceWeight = clamp(
      Math.pow(Math.max(1, stage.distanceKm) / 35, 0.85),
      0.4,
      1.9,
    );
    const terrainWeight = 1 + getTimeTrialTerrainDifficulty(stage) * 0.35;

    return 1.25 * distanceWeight * terrainWeight;
  }

  if (stage.stageType === "prologue") {
    return (
      0.35 *
      clamp(Math.max(1, stage.distanceKm) / 8, 0.65, 1.35) *
      (1 + getTimeTrialTerrainDifficulty(stage) * 0.2)
    );
  }

  const profileWeight = {
    // A bunch finish decides the stage winner, but usually creates almost no
    // gap in the general classification. Selective terrain does the opposite.
    flat: 0.16,
    sprint: 0.12,
    hilly: 1.32,
    mountain: 1.75,
    cobbles: 1.3,
    time_trial: 1.3,
    mixed: 1.12,
  }[stage.profileType];
  const distanceWeight = clamp(
    Math.sqrt(Math.max(1, stage.distanceKm) / 100),
    0.55,
    1.45,
  );

  return profileWeight * distanceWeight;
}

function getTimeTrialTerrainDifficulty(stage: RaceCalendarStage) {
  const totalDistance = Math.max(
    1,
    stage.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
  );
  const climbs = stage.segments.filter(
    (segment) => segment.terrain === "climb",
  );
  const climbDistance = climbs.reduce(
    (total, segment) => total + segment.distanceKm,
    0,
  );
  const averageClimbGradient = climbDistance > 0
    ? climbs.reduce(
        (total, segment) =>
          total + Math.abs(segment.averageGradientPct) * segment.distanceKm,
        0,
      ) / climbDistance
    : 0;
  const cobbleDistance = stage.segments.reduce(
    (total, segment) =>
      total + (segment.surface === "cobbles" ? segment.distanceKm : 0),
    0,
  );
  const declaredProfileDifficulty = {
    flat: 0,
    sprint: 0,
    time_trial: 0,
    mixed: 0.18,
    hilly: 0.32,
    cobbles: 0.32,
    mountain: 0.58,
  }[stage.profileType];
  const routeDifficulty =
    (climbDistance / totalDistance) * 0.55 +
    Math.max(0, averageClimbGradient - 3) * 0.055 +
    (cobbleDistance / totalDistance) * 0.35;

  return clamp(declaredProfileDifficulty + routeDifficulty, 0, 1);
}

function getRatingsAverage(ratings: RiderSimulationRatings) {
  const values = Object.values(ratings);
  return values.reduce((total, rating) => total + rating, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
