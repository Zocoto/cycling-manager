import {
  formatScoutedNumericValue,
  type ScoutedNumericValue,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";
import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
  type RiderRatings,
} from "@/lib/game/rider-profile";

export type RiderComparisonOption = {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  countryName: string;
  age: number | null;
};

export type ComparableRiderValue = {
  display: string;
  minimum: number | null;
  maximum: number | null;
  plotValue: number | null;
  estimated: boolean;
};

export type RiderComparisonWinner =
  | "left"
  | "right"
  | "tie"
  | "undetermined";

export function buildComparableRiderRatings({
  ratings,
  scoutingReport,
}: {
  ratings: RiderRatings | null;
  scoutingReport: TransferScoutingReport | null;
}): Record<RiderRatingKey, ComparableRiderValue> {
  return Object.fromEntries(
    RIDER_RATING_AXES.map((axis) => [
      axis.key,
      ratings
        ? createExactComparableValue(ratings[axis.key])
        : createScoutedComparableValue(
            scoutingReport?.ratings[axis.key] ?? { kind: "unknown" },
          ),
    ]),
  ) as Record<RiderRatingKey, ComparableRiderValue>;
}

export function buildComparableRiderOverall({
  ratings,
  scoutingReport,
}: {
  ratings: RiderRatings | null;
  scoutingReport: TransferScoutingReport | null;
}): ComparableRiderValue {
  if (ratings) {
    const total = RIDER_RATING_AXES.reduce(
      (sum, axis) => sum + ratings[axis.key],
      0,
    );
    return createExactComparableValue(
      Math.round(total / RIDER_RATING_AXES.length),
    );
  }

  return createScoutedComparableValue(
    scoutingReport?.overall ?? { kind: "unknown" },
  );
}

export function compareRiderValues(
  left: ComparableRiderValue,
  right: ComparableRiderValue,
): RiderComparisonWinner {
  if (
    left.minimum === null ||
    left.maximum === null ||
    right.minimum === null ||
    right.maximum === null
  ) {
    return "undetermined";
  }

  if (left.minimum > right.maximum) return "left";
  if (right.minimum > left.maximum) return "right";
  if (
    left.minimum === left.maximum &&
    right.minimum === right.maximum &&
    left.minimum === right.minimum
  ) {
    return "tie";
  }

  return "undetermined";
}

function createExactComparableValue(value: number): ComparableRiderValue {
  return {
    display: String(value),
    minimum: value,
    maximum: value,
    plotValue: value,
    estimated: false,
  };
}

function createScoutedComparableValue(
  value: ScoutedNumericValue,
): ComparableRiderValue {
  if (value.kind === "unknown") {
    return {
      display: "?",
      minimum: null,
      maximum: null,
      plotValue: null,
      estimated: true,
    };
  }

  if (value.kind === "range") {
    return {
      display: formatScoutedNumericValue(value),
      minimum: value.minimum,
      maximum: value.maximum,
      plotValue: (value.minimum + value.maximum) / 2,
      estimated: true,
    };
  }

  return {
    display: formatScoutedNumericValue(value),
    minimum: value.value,
    maximum: value.value,
    plotValue: value.value,
    estimated: false,
  };
}
