import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
  type RiderRatings,
} from "@/lib/game/rider-profile";

export type RiderProgressionStatKey = "average" | RiderRatingKey;

export type RiderProgressionValues = Record<RiderProgressionStatKey, number>;

export type RiderProgressionPoint = {
  dayNumber: number;
  values: RiderProgressionValues;
};

export type RiderProgressionSeason = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  isCurrent: boolean;
  points: RiderProgressionPoint[];
};

export type RiderProgressionHistory = {
  riderId: string;
  seasons: RiderProgressionSeason[];
};

const STAT_COLORS: Record<RiderRatingKey, string> = {
  mountain: "#D1495B",
  hills: "#E67E22",
  recovery: "#00A6A6",
  endurance: "#219653",
  resistance: "#59636E",
  breakaway: "#9B51E0",
  downhill: "#27AE60",
  acceleration: "#F2994A",
  sprint: "#EB5757",
  flat: "#2D9CDB",
  cobbles: "#8D6E63",
  prologue: "#1D6FA5",
  timeTrial: "#7B61FF",
};

export const RIDER_PROGRESSION_SERIES = [
  {
    key: "average",
    shortLabel: "MOY",
    label: "Moyenne générale",
    color: "#D6A900",
  },
  ...RIDER_RATING_AXES.map((axis) => ({
    key: axis.key,
    shortLabel: axis.shortLabel,
    label: axis.label,
    color: STAT_COLORS[axis.key],
  })),
] as const satisfies ReadonlyArray<{
  key: RiderProgressionStatKey;
  shortLabel: string;
  label: string;
  color: string;
}>;

export const DEFAULT_RIDER_PROGRESSION_STATS = [
  "average",
  "mountain",
  "hills",
] as const satisfies ReadonlyArray<RiderProgressionStatKey>;

export function createProgressionValues(
  ratings: RiderRatings,
): RiderProgressionValues {
  const values = Object.values(ratings);
  const average =
    values.reduce((total, value) => total + value, 0) / values.length;

  return {
    average: round(average, 2),
    ...ratings,
  };
}

export function isRiderProgressionStatKey(
  value: string,
): value is RiderProgressionStatKey {
  return RIDER_PROGRESSION_SERIES.some((series) => series.key === value);
}

export function getProgressionChartBounds(
  seasons: readonly RiderProgressionSeason[],
  selectedStats: readonly RiderProgressionStatKey[],
): { minimum: number; maximum: number } {
  const values = seasons.flatMap((season) =>
    season.points.flatMap((point) =>
      selectedStats.map((stat) => point.values[stat]),
    ),
  );

  if (values.length === 0) {
    return { minimum: 40, maximum: 80 };
  }

  const rawMinimum = Math.min(...values);
  const rawMaximum = Math.max(...values);
  const paddedMinimum = Math.max(0, Math.floor(rawMinimum / 5) * 5 - 5);
  const paddedMaximum = Math.min(100, Math.ceil(rawMaximum / 5) * 5 + 5);

  if (paddedMaximum - paddedMinimum >= 10) {
    return { minimum: paddedMinimum, maximum: paddedMaximum };
  }

  return {
    minimum: Math.max(0, paddedMinimum - 5),
    maximum: Math.min(100, paddedMaximum + 5),
  };
}

function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
