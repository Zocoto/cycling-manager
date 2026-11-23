import { describe, expect, it } from "vitest";

import { RIDER_RATING_AXES, type RiderRatings } from "./rider-profile";
import { ROSTER_SORT_KEYS, sortRosterItems } from "./roster-sort";
import {
  getDefaultTrainingRosterSortDirection,
  getTrainingRosterSortValue,
  TRAINING_ROSTER_SORT_OPTIONS,
  type TrainingRosterSortKey,
  type TrainingRosterSortRider,
} from "./training-roster-sort";

const ratings: RiderRatings = {
  mountain: 65, hills: 66, flat: 67, timeTrial: 68, cobbles: 69,
  sprint: 70, acceleration: 71, downhill: 72, endurance: 73,
  resistance: 74, recovery: 75, breakaway: 76, prologue: 77,
};

function rider(
  id: string,
  overrides: Partial<TrainingRosterSortRider> = {},
): TrainingRosterSortRider {
  return { id, firstName: "Ana", lastName: id, squadStatus: null, ...overrides };
}

function sortBy(
  items: readonly TrainingRosterSortRider[],
  key: TrainingRosterSortKey,
  direction = getDefaultTrainingRosterSortDirection(key),
) {
  return sortRosterItems({
    items,
    direction,
    getValue: (item) => getTrainingRosterSortValue(item, key),
    getTieBreaker: (item) => `${item.lastName} ${item.firstName} ${item.id}`,
  }).map((item) => item.id);
}

describe("training roster sorting", () => {
  it("offers every Effectif criterion plus nationality and the original order", () => {
    const keys = TRAINING_ROSTER_SORT_OPTIONS.map((option) => option.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...ROSTER_SORT_KEYS, "default", "nationality"].sort());
    expect(keys[0]).toBe("default");
    expect(keys.at(-1)).toBe("average");
  });

  it("groups countries by name, handles accents, and reverses alphabetic order", () => {
    const items = [
      rider("fr", { countryName: "France" }),
      rider("eq", { countryName: "Équateur" }),
      rider("be", { countryName: "Belgique" }),
    ];
    expect(sortBy(items, "nationality")).toEqual(["be", "eq", "fr"]);
    expect(sortBy(items, "nationality", "desc")).toEqual(["fr", "eq", "be"]);
  });

  it("shows the best potential first and supports the opposite direction", () => {
    const items = [rider("medium", { potentialSteps: 5 }), rider("high", { potentialSteps: 8 }), rider("low", { potentialSteps: 2 })];
    expect(sortBy(items, "potential")).toEqual(["high", "medium", "low"]);
    expect(sortBy(items, "potential", "asc")).toEqual(["low", "medium", "high"]);
    expect(getDefaultTrainingRosterSortDirection("age")).toBe("asc");
    expect(getDefaultTrainingRosterSortDirection("rider")).toBe("asc");
    expect(getDefaultTrainingRosterSortDirection("default")).toBe("asc");
  });

  it("reads all thirteen native ratings, including the time-trial naming conversion", () => {
    const item = rider("all-ratings", { ratings });
    for (const axis of RIDER_RATING_AXES) {
      const key = axis.key === "timeTrial" ? "time_trial" : axis.key;
      expect(getTrainingRosterSortValue(item, key)).toBe(ratings[axis.key]);
      expect(getDefaultTrainingRosterSortDirection(key)).toBe("desc");
    }
    expect(sortBy([
      rider("slow", { ratings: { ...ratings, timeTrial: 50 } }),
      rider("fast", { ratings: { ...ratings, timeTrial: 85 } }),
    ], "time_trial")).toEqual(["fast", "slow"]);
  });

  it("uses a complete rounded thirteen-rating average and the rider's actual profile", () => {
    expect(getTrainingRosterSortValue(rider("average", { ratings }), "average")).toBe(71);
    const mountainRatings = Object.fromEntries(RIDER_RATING_AXES.map((axis) => [axis.key, 45])) as RiderRatings;
    mountainRatings.mountain = 90;
    mountainRatings.endurance = 90;
    expect(getTrainingRosterSortValue(rider("climber", { ratings: mountainRatings }), "profile"))
      .toBe("Grimpeur");
    expect(getTrainingRosterSortValue(rider("default"), "default")).toBeNull();
  });

  it("keeps missing and null values last in either direction", () => {
    for (const key of ["nationality", "age", "potential", "form", "morale", "profile", "average", "time_trial", "mountain"] as const) {
      const known = rider("known", { countryName: "France", age: 25, potentialSteps: 6, form: 90, morale: 70, ratings });
      const missing = rider("missing");
      const empty = rider("empty", { countryName: " ", age: null, potentialSteps: null, form: null, morale: null, ratings: null });
      for (const direction of ["asc", "desc"] as const) {
        expect(sortBy([missing, known, empty], key, direction)[0]).toBe("known");
      }
      expect(getTrainingRosterSortValue(missing, key)).toBeNull();
      expect(getTrainingRosterSortValue(empty, key)).toBeNull();
    }
    expect(getTrainingRosterSortValue(rider("bad-number", { form: Number.NaN }), "form")).toBeNull();
    expect(getTrainingRosterSortValue(rider("bad-rating", { ratings: { ...ratings, sprint: Number.POSITIVE_INFINITY } }), "average")).toBeNull();
  });

  it("places undefined squad statuses last and keeps the current leadership hierarchy", () => {
    const items = [rider("undefined"), rider("helper", { squadStatus: "domestique" }), rider("leader", { squadStatus: "absolute_leader" })];
    expect(sortBy(items, "squad_status")).toEqual(["leader", "helper", "undefined"]);
    expect(sortBy(items, "squad_status", "asc")).toEqual(["helper", "leader", "undefined"]);
  });

  it("breaks equal values by name without changing riders, ratings, or input order", () => {
    const sharedRatings = Object.freeze({ ...ratings });
    const items = Object.freeze([
      Object.freeze(rider("z", { lastName: "Zulu", ratings: sharedRatings, potentialSteps: 8 })),
      Object.freeze(rider("b", { firstName: "Zoé", lastName: "Alpha", ratings: sharedRatings, potentialSteps: 8 })),
      Object.freeze(rider("a", { firstName: "Ana", lastName: "Alpha", ratings: sharedRatings, potentialSteps: 8 })),
    ]);
    const before = JSON.stringify(items);
    expect(sortBy(items, "potential")).toEqual(["a", "b", "z"]);
    expect(sortBy(items, "potential", "asc")).toEqual(["a", "b", "z"]);
    expect(sortBy(items, "rider")).toEqual(["a", "b", "z"]);
    expect(JSON.stringify(items)).toBe(before);
  });
});
