export const ROSTER_SORT_KEYS = [
  "rider",
  "age",
  "profile",
  "potential",
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
  "average",
  "salary",
  "contract",
] as const;

export type RosterSortKey =
  (typeof ROSTER_SORT_KEYS)[number];

export type RosterSortDirection =
  | "asc"
  | "desc";

export type RosterSortValue =
  | number
  | string
  | null;

const DESCENDING_BY_DEFAULT = new Set<RosterSortKey>([
  "potential",
  "mountain",
  "hills",
  "flat",
  "time_trial",
  "cobbles",
  "sprint",
  "acceleration",
  "downhill",
  "endurance",
  "resistance",
  "recovery",
  "breakaway",
  "prologue",
  "average",
  "salary",
]);

export function parseRosterSortKey(
  value: string | undefined
): RosterSortKey | null {
  return ROSTER_SORT_KEYS.includes(
    value as RosterSortKey
  )
    ? (value as RosterSortKey)
    : null;
}

export function parseRosterSortDirection(
  value: string | undefined,
  sortKey: RosterSortKey
): RosterSortDirection {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return getDefaultRosterSortDirection(sortKey);
}

export function getDefaultRosterSortDirection(
  sortKey: RosterSortKey
): RosterSortDirection {
  return DESCENDING_BY_DEFAULT.has(sortKey)
    ? "desc"
    : "asc";
}

export function getNextRosterSortDirection({
  sortKey,
  currentSortKey,
  currentDirection,
}: {
  sortKey: RosterSortKey;
  currentSortKey: RosterSortKey | null;
  currentDirection: RosterSortDirection;
}): RosterSortDirection {
  if (sortKey !== currentSortKey) {
    return getDefaultRosterSortDirection(sortKey);
  }

  return currentDirection === "asc"
    ? "desc"
    : "asc";
}

export function compareRosterSortValues(
  left: RosterSortValue,
  right: RosterSortValue,
  direction: RosterSortDirection
): number {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const comparison =
    typeof left === "number" &&
    typeof right === "number"
      ? left - right
      : String(left).localeCompare(
          String(right),
          "fr-FR",
          {
            numeric: true,
            sensitivity: "base",
          }
        );

  return direction === "asc"
    ? comparison
    : -comparison;
}

export function sortRosterItems<T>({
  items,
  direction,
  getValue,
  getTieBreaker,
}: {
  items: readonly T[];
  direction: RosterSortDirection;
  getValue: (item: T) => RosterSortValue;
  getTieBreaker: (item: T) => string;
}): T[] {
  return [...items].sort((left, right) => {
    const comparison = compareRosterSortValues(
      getValue(left),
      getValue(right),
      direction
    );

    if (comparison !== 0) {
      return comparison;
    }

    return compareRosterSortValues(
      getTieBreaker(left),
      getTieBreaker(right),
      "asc"
    );
  });
}
