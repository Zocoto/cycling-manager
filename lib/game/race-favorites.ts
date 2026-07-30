import type {
  RaceCalendarEdition,
  RaceCalendarStage,
} from "./race-calendar";
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

  if (edition.raceFormat === "one_day") {
    return getOneDayFavoriteScore(rider.ratings, stages[0]);
  }

  return getGeneralClassificationFavoriteScore(rider.ratings, stages);
}

function getOneDayFavoriteScore(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  if (stage.stageType === "prologue") {
    return getPrologueFavoriteRating(ratings);
  }

  if (isTimeTrialStage(stage)) {
    return getTimeTrialFavoriteRating(ratings, stage);
  }

  return getOneDayRoadFavoriteScore(ratings, stage);
}

function getOneDayRoadFavoriteScore(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  // A classic predicts the rider best suited to this course profile. Dynamic
  // state (form, equipment or contextual bonuses) deliberately stays out.
  if (stage.profileType === "mixed") {
    const routeRating = getRouteRating(
      ratings,
      stage,
      getRatingsAverage(ratings),
    );
    return routeRating * 0.65 + getFinishRating(ratings, stage) * 0.35;
  }

  return getOneDayProfileRating(ratings, stage.profileType);
}

function getOneDayProfileRating(
  ratings: RiderSimulationRatings,
  profileType: RaceCalendarStage["profileType"],
) {
  if (profileType === "flat") {
    return (
      ratings.sprint * 0.62 +
      ratings.acceleration * 0.15 +
      ratings.flat * 0.1 +
      ratings.resistance * 0.07 +
      ratings.endurance * 0.06
    );
  }

  if (profileType === "sprint") {
    return (
      ratings.sprint * 0.68 +
      ratings.acceleration * 0.15 +
      ratings.flat * 0.07 +
      ratings.resistance * 0.06 +
      ratings.endurance * 0.04
    );
  }

  if (profileType === "hilly") {
    return (
      ratings.hills * 0.62 +
      ratings.acceleration * 0.13 +
      ratings.resistance * 0.09 +
      ratings.endurance * 0.07 +
      ratings.mountain * 0.06 +
      ratings.sprint * 0.03
    );
  }

  if (profileType === "mountain") {
    return (
      ratings.mountain * 0.67 +
      ratings.hills * 0.11 +
      ratings.endurance * 0.09 +
      ratings.resistance * 0.07 +
      ratings.acceleration * 0.03 +
      ratings.downhill * 0.03
    );
  }

  if (profileType === "cobbles") {
    return (
      ratings.cobbles * 0.6 +
      ratings.resistance * 0.14 +
      ratings.endurance * 0.1 +
      ratings.flat * 0.08 +
      ratings.sprint * 0.04 +
      ratings.acceleration * 0.04
    );
  }

  if (profileType === "time_trial") {
    return (
      ratings.timeTrial * 0.66 +
      ratings.endurance * 0.11 +
      ratings.flat * 0.08 +
      ratings.resistance * 0.07 +
      ratings.prologue * 0.05 +
      ratings.acceleration * 0.03
    );
  }

  return getRatingsAverage(ratings);
}

function getGeneralClassificationFavoriteScore(
  ratings: RiderSimulationRatings,
  stages: RaceCalendarStage[],
) {
  const decisiveStages = stages
    .map((stage) => ({
      stage,
      weight: getGeneralClassificationStageWeight(stage),
    }))
    .filter(({ weight }) => weight > 0);

  if (decisiveStages.length === 0) {
    return (
      getFlatTourProfileRating(ratings) * 0.94 +
      ratings.recovery * 0.06
    );
  }

  const totalWeight = decisiveStages.reduce(
    (total, { weight }) => total + weight,
    0,
  );
  const decisiveProfileRating = decisiveStages.reduce(
    (total, { stage, weight }) =>
      total + getGeneralClassificationStageRating(ratings, stage) * weight,
    0,
  ) / totalWeight;

  // Recovery is an intrinsic GC attribute, unlike form and equipment. It is
  // counted once for the whole tour and never lets bunch stages dilute the
  // stages on which time gaps are actually created.
  return decisiveProfileRating * 0.94 + ratings.recovery * 0.06;
}

function getGeneralClassificationStageRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  if (stage.stageType === "prologue") {
    return getPrologueFavoriteRating(ratings);
  }

  if (isTimeTrialStage(stage)) {
    return getTimeTrialFavoriteRating(ratings, stage);
  }

  if (stage.profileType === "hilly") {
    return (
      ratings.hills * 0.62 +
      ratings.mountain * 0.12 +
      ratings.endurance * 0.11 +
      ratings.resistance * 0.1 +
      ratings.acceleration * 0.05
    );
  }

  if (stage.profileType === "mountain") {
    return (
      ratings.mountain * 0.67 +
      ratings.hills * 0.11 +
      ratings.endurance * 0.11 +
      ratings.resistance * 0.08 +
      ratings.downhill * 0.03
    );
  }

  if (stage.profileType === "cobbles") {
    return (
      ratings.cobbles * 0.6 +
      ratings.resistance * 0.16 +
      ratings.endurance * 0.12 +
      ratings.flat * 0.08 +
      ratings.acceleration * 0.04
    );
  }

  if (stage.profileType === "mixed") {
    const routeRating = getSelectiveRoadRating(ratings, stage);
    return (
      routeRating * 0.8 +
      ratings.endurance * 0.12 +
      ratings.resistance * 0.08
    );
  }

  return getFlatTourProfileRating(ratings);
}

function getTimeTrialFavoriteRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  const routeRating = getRouteRating(ratings, stage, ratings.timeTrial);
  const terrainDifficulty = getTimeTrialTerrainDifficulty(stage);
  const terrainWeight = 0.16 + terrainDifficulty * 0.12;
  const timeTrialWeight = 0.66 - terrainDifficulty * 0.12;
  return (
    ratings.timeTrial * timeTrialWeight +
    routeRating * terrainWeight +
    ratings.endurance * 0.11 +
    ratings.resistance * 0.07
  );
}

function getPrologueFavoriteRating(ratings: RiderSimulationRatings) {
  return (
    ratings.prologue * 0.62 +
    ratings.timeTrial * 0.16 +
    ratings.acceleration * 0.14 +
    ratings.flat * 0.05 +
    ratings.resistance * 0.03
  );
}

function getFlatTourProfileRating(ratings: RiderSimulationRatings) {
  return (
    ratings.flat * 0.5 +
    ratings.endurance * 0.28 +
    ratings.resistance * 0.22
  );
}

function getSelectiveRoadRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
) {
  const selectiveRoute = stage.segments.reduce(
    (summary, segment) => {
      const intensity = getSelectiveSegmentIntensity(segment);
      if (intensity <= 0) {
        return summary;
      }

      let segmentRating: number;
      if (segment.surface === "cobbles") {
        segmentRating =
          ratings.cobbles * 0.62 +
          ratings.flat * 0.16 +
          ratings.resistance * 0.13 +
          ratings.endurance * 0.09;
      } else {
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
      }

      const weight = segment.distanceKm * intensity;
      return {
        rating: summary.rating + segmentRating * weight,
        weight: summary.weight + weight,
      };
    },
    { rating: 0, weight: 0 },
  );

  return selectiveRoute.weight > 0
    ? selectiveRoute.rating / selectiveRoute.weight
    : getMixedGeneralClassificationFallbackRating(ratings);
}

function getMixedGeneralClassificationFallbackRating(
  ratings: RiderSimulationRatings,
) {
  return (
    ratings.hills * 0.28 +
    ratings.mountain * 0.27 +
    ratings.cobbles * 0.17 +
    ratings.flat * 0.1 +
    ratings.endurance * 0.1 +
    ratings.resistance * 0.08
  );
}

function getSelectiveSegmentIntensity(
  segment: RaceCalendarStage["segments"][number],
) {
  let intensity = segment.surface === "cobbles" ? 1.25 : 0;

  if (segment.terrain === "climb") {
    intensity += clamp(
      0.55 +
        Math.abs(segment.averageGradientPct) / 5 +
        Math.max(0, segment.distanceKm - 5) * 0.025,
      0.6,
      2.2,
    );
  }

  return intensity;
}

function getRoadStageSelectivityFactor(stage: RaceCalendarStage) {
  if (stage.segments.length === 0) {
    return 1;
  }

  const totalDistance = Math.max(
    1,
    stage.segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
  );
  const selectiveLoad = stage.segments.reduce(
    (total, segment) =>
      total + segment.distanceKm * getSelectiveSegmentIntensity(segment),
    0,
  );

  if (selectiveLoad <= 0) {
    return 0;
  }

  return clamp(0.5 + (selectiveLoad / totalDistance) * 1.5, 0.5, 1.5);
}

function isTimeTrialStage(stage: RaceCalendarStage) {
  return (
    stage.stageType === "individual_time_trial" ||
    stage.stageType === "team_time_trial" ||
    stage.profileType === "time_trial"
  );
}

function getRouteRating(
  ratings: RiderSimulationRatings,
  stage: RaceCalendarStage,
  fallbackRating: number,
) {
  if (stage.segments.length === 0) {
    return fallbackRating;
  }

  const route = stage.segments.reduce(
    (summary, segment) => {
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
      const weight = segment.distanceKm * selectivity;

      return {
        rating: summary.rating + segmentRating * weight,
        weight: summary.weight + weight,
      };
    },
    { rating: 0, weight: 0 },
  );

  return route.weight > 0 ? route.rating / route.weight : fallbackRating;
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
  if (stage.stageType === "prologue") {
    return (
      0.25 *
      clamp(Math.max(1, stage.distanceKm) / 8, 0.65, 1.35) *
      (1 + getTimeTrialTerrainDifficulty(stage) * 0.2)
    );
  }

  if (isTimeTrialStage(stage)) {
    const distanceWeight = clamp(
      Math.pow(Math.max(1, stage.distanceKm) / 35, 0.85),
      0.3,
      2,
    );
    const terrainWeight = 1 + getTimeTrialTerrainDifficulty(stage) * 0.35;

    return 1.25 * distanceWeight * terrainWeight;
  }

  const profileWeight = {
    // Bunch stages decide stage winners, not the general classification.
    // They must not dilute the stages where the simulator creates time gaps.
    flat: 0,
    sprint: 0,
    hilly: 1,
    mountain: 1.8,
    cobbles: 1.3,
    time_trial: 0,
    mixed: 0.8,
  }[stage.profileType];
  const distanceWeight = clamp(
    Math.sqrt(Math.max(1, stage.distanceKm) / 120),
    0.6,
    1.5,
  );

  return (
    profileWeight * distanceWeight * getRoadStageSelectivityFactor(stage)
  );
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
