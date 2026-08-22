import type { RiderRatingKey, RiderRatings } from "@/lib/game/rider-profile";

export type DevelopmentProgressionProfile =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial"
  | "mixed";

export type DevelopmentProgressionWeight = {
  ratingKey: RiderRatingKey;
  weight: number;
  primary: boolean;
};

export const DEVELOPMENT_PODIUM_PROFILE_WEIGHTS: Record<
  DevelopmentProgressionProfile,
  readonly DevelopmentProgressionWeight[]
> = {
  flat: [
    { ratingKey: "flat", weight: 1, primary: true },
    { ratingKey: "sprint", weight: 0.26, primary: false },
    { ratingKey: "acceleration", weight: 0.18, primary: false },
    { ratingKey: "endurance", weight: 0.12, primary: false },
    { ratingKey: "resistance", weight: 0.1, primary: false },
  ],
  sprint: [
    { ratingKey: "sprint", weight: 1, primary: true },
    { ratingKey: "acceleration", weight: 0.24, primary: false },
    { ratingKey: "flat", weight: 0.18, primary: false },
    { ratingKey: "resistance", weight: 0.13, primary: false },
    { ratingKey: "endurance", weight: 0.11, primary: false },
  ],
  hilly: [
    { ratingKey: "hills", weight: 1, primary: true },
    { ratingKey: "acceleration", weight: 0.18, primary: false },
    { ratingKey: "endurance", weight: 0.17, primary: false },
    { ratingKey: "resistance", weight: 0.14, primary: false },
    { ratingKey: "mountain", weight: 0.1, primary: false },
    { ratingKey: "sprint", weight: 0.05, primary: false },
  ],
  mountain: [
    { ratingKey: "mountain", weight: 1, primary: true },
    { ratingKey: "recovery", weight: 0.18, primary: false },
    { ratingKey: "endurance", weight: 0.17, primary: false },
    { ratingKey: "resistance", weight: 0.13, primary: false },
    { ratingKey: "downhill", weight: 0.1, primary: false },
  ],
  cobbles: [
    { ratingKey: "cobbles", weight: 1, primary: true },
    { ratingKey: "flat", weight: 0.19, primary: false },
    { ratingKey: "resistance", weight: 0.18, primary: false },
    { ratingKey: "endurance", weight: 0.14, primary: false },
    { ratingKey: "acceleration", weight: 0.1, primary: false },
  ],
  time_trial: [
    { ratingKey: "timeTrial", weight: 1, primary: true },
    { ratingKey: "prologue", weight: 0.16, primary: false },
    { ratingKey: "flat", weight: 0.14, primary: false },
    { ratingKey: "endurance", weight: 0.1, primary: false },
    { ratingKey: "resistance", weight: 0.08, primary: false },
  ],
  mixed: [
    { ratingKey: "endurance", weight: 1, primary: true },
    { ratingKey: "hills", weight: 0.18, primary: false },
    { ratingKey: "mountain", weight: 0.16, primary: false },
    { ratingKey: "flat", weight: 0.14, primary: false },
    { ratingKey: "timeTrial", weight: 0.14, primary: false },
    { ratingKey: "recovery", weight: 0.1, primary: false },
    { ratingKey: "resistance", weight: 0.1, primary: false },
  ],
};

export function getDevelopmentPodiumPlaceFactor(rank: number): number {
  if (rank === 1) return 1;
  if (rank === 2) return 0.6;
  if (rank === 3) return 0.35;
  return 0;
}

export function getDevelopmentPodiumRatingFactor(
  projectedRating: number,
): number {
  if (projectedRating < 70) return 1;
  if (projectedRating < 74) return 0.65;
  if (projectedRating < 77) return 0.4;
  return 0.25;
}

export function calculateDevelopmentPodiumProgression({
  rank,
  profile,
  ratings,
}: {
  rank: number;
  profile: DevelopmentProgressionProfile;
  ratings: RiderRatings;
}): Partial<Record<RiderRatingKey, number>> {
  const placeFactor = getDevelopmentPodiumPlaceFactor(rank);
  if (placeFactor === 0) return {};

  return Object.fromEntries(
    DEVELOPMENT_PODIUM_PROFILE_WEIGHTS[profile].flatMap(
      ({ ratingKey, weight }) => {
        const rating = Math.min(100, Math.max(0, ratings[ratingKey]));
        const gain = Math.min(
          100 - rating,
          placeFactor *
            weight *
            getDevelopmentPodiumRatingFactor(rating),
        );
        return gain > 0 ? [[ratingKey, roundToThousandth(gain)]] : [];
      },
    ),
  );
}

function roundToThousandth(value: number) {
  return Math.round(value * 1_000) / 1_000;
}
