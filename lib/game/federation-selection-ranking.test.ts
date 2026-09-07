import { describe, expect, it } from "vitest";

import {
  getRaceClimatePerformanceAdjustment,
  getRiderClimateProfile,
  type RaceWeather,
} from "./race-weather";
import { sortFederationSelectionRiders } from "./federation-selection-ranking";

const riders = [
  {
    id: "rider-a",
    name: "Ana Alpha",
    overall: 75,
    ratings: {
      mountain: 82,
      hills: 74,
      flat: 65,
      timeTrial: 68,
      cobbles: 60,
      sprint: 62,
      acceleration: 71,
      downhill: 76,
      endurance: 79,
      resistance: 78,
      recovery: 70,
      breakaway: 73,
      prologue: 66,
    },
  },
  {
    id: "rider-b",
    name: "Bert Beta",
    overall: 78,
    ratings: {
      mountain: 69,
      hills: 72,
      flat: 81,
      timeTrial: 77,
      cobbles: 75,
      sprint: 84,
      acceleration: 86,
      downhill: 68,
      endurance: 76,
      resistance: 74,
      recovery: 79,
      breakaway: 65,
      prologue: 80,
    },
  },
];

describe("federation selection ranking", () => {
  it("sorts every sporting rating in either direction", () => {
    expect(
      sortFederationSelectionRiders(riders, {
        key: "mountain",
        direction: "descending",
        countryCode: "FR",
        weather: null,
      }).map((rider) => rider.id),
    ).toEqual(["rider-a", "rider-b"]);

    expect(
      sortFederationSelectionRiders(riders, {
        key: "acceleration",
        direction: "ascending",
        countryCode: "FR",
        weather: null,
      }).map((rider) => rider.id),
    ).toEqual(["rider-a", "rider-b"]);
  });

  it("can rank riders by their affinity with a published forecast", () => {
    const weather: RaceWeather = {
      condition: "clear",
      rainIntensity: "none",
      temperatureC: 24,
      windSpeedKph: 8,
      windDirection: "tailwind",
      windIntensity: "calm",
      isWet: false,
    };
    const candidates = Array.from({ length: 30 }, (_, index) => ({
      ...riders[index % riders.length],
      id: `rider-weather-${index}`,
      name: `Rider ${index}`,
    }));
    const sorted = sortFederationSelectionRiders(candidates, {
      key: "weatherAffinity",
      direction: "descending",
      countryCode: "US",
      weather,
    });
    const adjustment = (riderId: string) =>
      getRaceClimatePerformanceAdjustment(
        getRiderClimateProfile({ riderId, countryCode: "US" }),
        weather,
      );

    expect(adjustment(sorted[0].id)).toBe(1.5);
    expect(adjustment(sorted.at(-1)!.id)).toBe(0);
  });
});
