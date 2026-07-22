import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import { normalizePotentialSteps } from "@/lib/game/training";

export const STANDARD_SCOUTING_EXACT_RATING_COUNT = 3;
export const STANDARD_SCOUTING_RANGE_RATING_COUNT = 6;

export type ScoutedNumericValue =
  | { kind: "exact"; value: number }
  | { kind: "range"; minimum: number; maximum: number }
  | { kind: "unknown" };

export type ScoutedPotentialValue =
  | { kind: "exact"; steps: number }
  | { kind: "range"; minimumSteps: number; maximumSteps: number }
  | { kind: "unknown" };

export type TransferScoutingReport = {
  overall: ScoutedNumericValue;
  potential: ScoutedPotentialValue;
  ratings: Record<RiderRatingKey, ScoutedNumericValue>;
};

export function createStandardTransferScoutingReport({
  riderId,
  seasonId,
  ratings,
  potentialSteps,
}: {
  riderId: string;
  seasonId: string;
  ratings: RiderRatings;
  potentialSteps: number;
}): TransferScoutingReport {
  const visibilityOrder = RIDER_RATING_AXES.map((axis) => ({
    key: axis.key,
    score: stableHash(`${riderId}:${seasonId}:${axis.key}:visibility`),
  })).sort(
    (left, right) => left.score - right.score || left.key.localeCompare(right.key)
  );
  const exactKeys = new Set(
    visibilityOrder
      .slice(0, STANDARD_SCOUTING_EXACT_RATING_COUNT)
      .map(({ key }) => key)
  );
  const rangedKeys = new Set(
    visibilityOrder
      .slice(
        STANDARD_SCOUTING_EXACT_RATING_COUNT,
        STANDARD_SCOUTING_EXACT_RATING_COUNT +
          STANDARD_SCOUTING_RANGE_RATING_COUNT
      )
      .map(({ key }) => key)
  );
  const scoutedRatings = Object.fromEntries(
    RIDER_RATING_AXES.map((axis) => {
      const value = ratings[axis.key];

      if (exactKeys.has(axis.key)) {
        return [axis.key, { kind: "exact", value } satisfies ScoutedNumericValue];
      }

      if (rangedKeys.has(axis.key)) {
        return [
          axis.key,
          createNumericRange(
            value,
            stableHash(`${riderId}:${seasonId}:${axis.key}:range`)
          ),
        ];
      }

      return [axis.key, { kind: "unknown" } satisfies ScoutedNumericValue];
    })
  ) as Record<RiderRatingKey, ScoutedNumericValue>;
  const overall = calculateOverall(ratings);
  const potentialSeed = stableHash(`${riderId}:${seasonId}:potential`);

  return {
    overall: createNumericRange(
      overall,
      stableHash(`${riderId}:${seasonId}:overall`),
      1
    ),
    potential:
      potentialSeed % 4 === 0
        ? { kind: "unknown" }
        : createPotentialRange(potentialSteps, potentialSeed),
    ratings: scoutedRatings,
  };
}

export function createExactTransferScoutingReport({
  ratings,
  potentialSteps,
}: {
  ratings: RiderRatings;
  potentialSteps: number;
}): TransferScoutingReport {
  return {
    overall: { kind: "exact", value: calculateOverall(ratings) },
    potential: {
      kind: "exact",
      steps: normalizePotentialSteps(potentialSteps),
    },
    ratings: Object.fromEntries(
      RIDER_RATING_AXES.map((axis) => [
        axis.key,
        { kind: "exact", value: ratings[axis.key] } satisfies ScoutedNumericValue,
      ])
    ) as Record<RiderRatingKey, ScoutedNumericValue>,
  };
}

export function formatScoutedNumericValue(value: ScoutedNumericValue): string {
  if (value.kind === "unknown") return "?";
  if (value.kind === "range") {
    return `${formatRating(value.minimum)}–${formatRating(value.maximum)}`;
  }
  return formatRating(value.value);
}

export function formatScoutedPotentialValue(
  value: ScoutedPotentialValue
): string {
  if (value.kind === "unknown") return "?";
  if (value.kind === "range") {
    return `${formatPotentialSteps(value.minimumSteps)}–${formatPotentialSteps(value.maximumSteps)}`;
  }
  return formatPotentialSteps(value.steps);
}

export function getScoutedNumericSortValue(value: ScoutedNumericValue): number {
  if (value.kind === "unknown") return -1;
  if (value.kind === "range") return (value.minimum + value.maximum) / 2;
  return value.value;
}

export function scoutedValueCouldMeetMinimum(
  value: ScoutedNumericValue,
  minimum: number
): boolean {
  if (value.kind === "unknown") return false;
  if (value.kind === "range") return value.maximum >= minimum;
  return value.value >= minimum;
}

function createNumericRange(
  value: number,
  seed: number,
  minimumSpread = 2
): ScoutedNumericValue {
  const lowerSpread = minimumSpread + (seed % 3);
  const upperSpread = minimumSpread + ((seed >>> 4) % 3);
  let minimum = clamp(Math.floor(value - lowerSpread), 0, 100);
  let maximum = clamp(Math.ceil(value + upperSpread), 0, 100);

  if (minimum === maximum) {
    if (minimum === 0) maximum = 1;
    else minimum -= 1;
  }

  return { kind: "range", minimum, maximum };
}

function createPotentialRange(
  potentialSteps: number,
  seed: number
): ScoutedPotentialValue {
  const normalized = normalizePotentialSteps(potentialSteps);
  const lowerSpread = seed % 3 === 0 ? 2 : 1;
  const upperSpread = (seed >>> 3) % 3 === 0 ? 2 : 1;
  let minimumSteps = clamp(normalized - lowerSpread, 1, 8);
  let maximumSteps = clamp(normalized + upperSpread, 1, 8);

  if (minimumSteps === maximumSteps) {
    if (minimumSteps === 1) maximumSteps = 2;
    else minimumSteps -= 1;
  }

  return { kind: "range", minimumSteps, maximumSteps };
}

function calculateOverall(ratings: RiderRatings): number {
  const values = Object.values(ratings);
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 10
  ) / 10;
}

function formatPotentialSteps(steps: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    normalizePotentialSteps(steps) / 2
  )}★`;
}

function formatRating(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
    value
  );
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
