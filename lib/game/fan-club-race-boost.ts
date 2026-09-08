export const FAN_CLUB_TRAVEL_SHARE = 0.4;
export const FAN_CLUB_RACE_RATING_BOOST_CAP = 3;

export const FAN_CLUB_CAR_CAPACITY_BY_MODEL = {
  regional: 40,
  "grand-tourisme": 55,
  "double-etage": 80,
} as const;

export type FanClubCarModelCode = keyof typeof FAN_CLUB_CAR_CAPACITY_BY_MODEL;

export type FanClubRaceTripAllocation = {
  modelCode: string;
  carCount: number;
};

export type FanClubRaceBoost = {
  carCount: number;
  seatCapacity: number;
  availableSupporters: number;
  mobilizedSupporters: number;
  fervor: number;
  fervorMultiplier: number;
  rawRatingBoost: number;
  ratingBoost: number;
  projectedMountainRatingAt70: number;
};

type FanClubBoostProfileType =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial"
  | "mixed";

type FanClubBoostStageType =
  | "road"
  | "individual_time_trial"
  | "team_time_trial"
  | "prologue";

export function getFanClubCarCapacity(
  allocations: ReadonlyArray<FanClubRaceTripAllocation>,
) {
  return allocations.reduce(
    (total, allocation) =>
      total +
      Math.max(0, Math.floor(allocation.carCount)) *
        (FAN_CLUB_CAR_CAPACITY_BY_MODEL[
          allocation.modelCode as FanClubCarModelCode
        ] ?? 0),
    0,
  );
}

export function getAvailableFanClubTravelingSupporters(
  supporterCount: number,
) {
  return Math.max(
    0,
    Math.floor(Math.max(0, supporterCount) * FAN_CLUB_TRAVEL_SHARE),
  );
}

/**
 * Chaque supporter compte, avec un rendement décroissant pour éviter qu'une
 * flotte massive rende une course déterministe. La ferveur est le
 * multiplicateur final et le bonus reste plafonné à trois points de note.
 */
export function calculateFanClubRaceBoost({
  supporterCount,
  fervor,
  allocations,
  seatCapacity,
}: {
  supporterCount: number;
  fervor: number;
  allocations?: ReadonlyArray<FanClubRaceTripAllocation>;
  seatCapacity?: number;
}): FanClubRaceBoost {
  const safeSeatCapacity = Math.max(
    0,
    Math.floor(
      seatCapacity ?? getFanClubCarCapacity(allocations ?? []),
    ),
  );
  const carCount = (allocations ?? []).reduce(
    (total, allocation) =>
      total + Math.max(0, Math.floor(allocation.carCount)),
    0,
  );
  const availableSupporters = getAvailableFanClubTravelingSupporters(
    supporterCount,
  );
  const mobilizedSupporters = Math.min(
    availableSupporters,
    safeSeatCapacity,
  );
  const safeFervor = clamp(fervor, 0, 100);
  const fervorMultiplier = safeFervor / 100;
  const rawRatingBoost = Math.min(
    FAN_CLUB_RACE_RATING_BOOST_CAP,
    Math.sqrt(mobilizedSupporters / 100),
  );
  const ratingBoost = roundRating(rawRatingBoost * fervorMultiplier);

  return {
    carCount,
    seatCapacity: safeSeatCapacity,
    availableSupporters,
    mobilizedSupporters,
    fervor: roundRating(safeFervor),
    fervorMultiplier: roundRating(fervorMultiplier),
    rawRatingBoost: roundRating(rawRatingBoost),
    ratingBoost,
    projectedMountainRatingAt70: projectFanClubRaceRating(70, ratingBoost),
  };
}

export function projectFanClubRaceRating(
  baseRating: number,
  ratingBoost: number,
) {
  return roundRating(clamp(baseRating + Math.max(0, ratingBoost), 0, 100));
}

export function applyFanClubRaceRatingBoost<
  Ratings extends Record<string, number>,
>({
  ratings,
  ratingBoost,
  profileType,
  stageType,
}: {
  ratings: Ratings;
  ratingBoost: number;
  profileType: FanClubBoostProfileType;
  stageType: FanClubBoostStageType;
}): Ratings {
  const safeBoost = Math.max(0, ratingBoost);
  if (safeBoost === 0) return ratings;

  const primaryRatings = getFanClubPrimaryBoostedRatings(
    profileType,
    stageType,
  );
  const effortRatings = new Set(["acceleration", "endurance", "resistance"]);

  return Object.fromEntries(
    Object.entries(ratings).map(([key, value]) => {
      const appliedBoost = primaryRatings.has(key)
        ? safeBoost
        : effortRatings.has(key)
          ? safeBoost / 2
          : 0;
      return [key, projectFanClubRaceRating(value, appliedBoost)];
    }),
  ) as Ratings;
}

function getFanClubPrimaryBoostedRatings(
  profileType: FanClubBoostProfileType,
  stageType: FanClubBoostStageType,
) {
  if (stageType === "prologue") return new Set(["prologue"]);
  if (
    stageType === "individual_time_trial" ||
    stageType === "team_time_trial"
  ) {
    return new Set(["timeTrial"]);
  }

  return new Set(
    {
      flat: ["flat"],
      sprint: ["sprint"],
      hilly: ["hills"],
      mountain: ["mountain"],
      cobbles: ["cobbles"],
      time_trial: ["timeTrial"],
      mixed: ["flat", "hills"],
    }[profileType],
  );
}

function roundRating(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
