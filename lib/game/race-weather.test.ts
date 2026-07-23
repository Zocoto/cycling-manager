import { describe, expect, it } from "vitest";

import {
  applyRaceWeatherRatingAdjustments,
  getRaceWeather,
} from "./race-weather";
import type { RiderSimulationRatings } from "./race-simulation";

const ratings: RiderSimulationRatings = {
  mountain: 60,
  hills: 63,
  flat: 66,
  timeTrial: 61,
  cobbles: 78,
  sprint: 60,
  acceleration: 62,
  downhill: 72,
  endurance: 68,
  resistance: 74,
  recovery: 65,
  breakaway: 67,
  prologue: 59,
};

describe("race weather", () => {
  it("is deterministic for a race seed", () => {
    expect(getRaceWeather("stage:official")).toEqual(
      getRaceWeather("stage:official")
    );
  });

  it("gives wet-road specialists a measured advantage in rain", () => {
    const wetWeather = {
      ...getRaceWeather("rain-test"),
      condition: "rain" as const,
      rainIntensity: "heavy" as const,
      isWet: true,
    };
    const adjusted = applyRaceWeatherRatingAdjustments(
      ratings,
      wetWeather
    );

    expect(adjusted.cobbles).toBeGreaterThan(ratings.cobbles);
    expect(adjusted.downhill).toBeGreaterThan(ratings.downhill);
    expect(adjusted.cobbles - ratings.cobbles).toBeLessThanOrEqual(3.75);
  });

  it("does not alter ratings on a dry road", () => {
    const dryWeather = {
      ...getRaceWeather("dry-test"),
      condition: "dry" as const,
      rainIntensity: "none" as const,
      isWet: false,
    };

    expect(
      applyRaceWeatherRatingAdjustments(ratings, dryWeather)
    ).toBe(ratings);
  });
});
